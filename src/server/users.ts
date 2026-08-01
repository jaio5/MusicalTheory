/**
 * Crear cuentas y encontrarlas.
 *
 * Todo lo que devuelve es un resultado con nombre —`'ok'`, `'ya-existe'`,
 * `'sin-base-de-datos'`— y no una excepción. Las rutas tienen que contestar algo
 * en español a quien está mirando la pantalla, y para eso un `catch` genérico no
 * sirve: no distingue «ese correo ya está» de «la base de datos no contesta», y
 * son dos frases distintas.
 */

import { eq } from 'drizzle-orm';

import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH, planOf, type PlanId } from '@core/billing';

import { db } from './db/client';
import { users } from './db/schema';
import { hashPassword, verifyPassword } from './password';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly plan: PlanId;
}

/**
 * El correo tal y como se va a guardar, o nulo si no puede ser un correo.
 *
 * En minúsculas y sin espacios alrededor, porque quien escribe `Javier@…` al
 * registrarse escribe `javier@…` al entrar, y si no se normaliza son dos cuentas
 * distintas. La comprobación es a propósito de mínimos: validar correos con una
 * expresión regular exhaustiva rechaza direcciones válidas y no evita ninguna
 * falsa. Lo que de verdad comprueba que un correo existe es escribirle.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) {
    return null;
  }
  const at = email.indexOf('@');
  const dot = email.lastIndexOf('.');
  const bien = at > 0 && dot > at + 1 && dot < email.length - 1 && !email.includes(' ');
  return bien ? email : null;
}

/**
 * El nombre tal y como se guarda, o nulo si no ha dicho ninguno.
 *
 * Se recorta al tope del dominio en vez de rechazar lo que se pase: un nombre
 * demasiado largo no es un intento de nada, es alguien que ha pegado algo. Vacío
 * y nulo son lo mismo aquí —«no lo he dicho»—, y por eso borrarlo es una
 * operación válida y no un error.
 */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const name = raw.trim().slice(0, MAX_NAME_LENGTH);
  return name === '' ? null : name;
}

export type CreateUserResult =
  | { readonly kind: 'ok'; readonly user: User }
  | { readonly kind: 'sin-base-de-datos' }
  | { readonly kind: 'correo-invalido' }
  | { readonly kind: 'contrasena-corta' }
  | { readonly kind: 'ya-existe' }
  | { readonly kind: 'error' };

function toUser(row: { id: string; email: string; name: string | null; plan: string }): User {
  return { id: row.id, email: row.email, name: row.name, plan: planOf(row.plan).id };
}

export async function createUser(input: {
  email: unknown;
  password: unknown;
  name?: unknown;
}): Promise<CreateUserResult> {
  const database = db();
  if (database === null) {
    return { kind: 'sin-base-de-datos' };
  }

  const email = normalizeEmail(input.email);
  if (email === null) {
    return { kind: 'correo-invalido' };
  }
  if (typeof input.password !== 'string' || input.password.length < MIN_PASSWORD_LENGTH) {
    return { kind: 'contrasena-corta' };
  }
  const name = normalizeName(input.name);

  const passwordHash = await hashPassword(input.password);

  try {
    // Se deja que la restricción de unicidad de la base de datos sea la que
    // decida: comprobar antes con un select y luego insertar deja una rendija
    // por la que dos registros a la vez crean dos cuentas con el mismo correo.
    const [row] = await database
      .insert(users)
      .values({ email, name, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning();

    return row === undefined ? { kind: 'ya-existe' } : { kind: 'ok', user: toUser(row) };
  } catch {
    return { kind: 'error' };
  }
}

/** La cuenta con su contraseña cifrada. Solo la usa la comprobación al entrar. */
export async function findUserWithPassword(
  rawEmail: unknown,
): Promise<{ user: User; passwordHash: string } | null> {
  const database = db();
  const email = normalizeEmail(rawEmail);
  if (database === null || email === null) {
    return null;
  }

  try {
    const [row] = await database.select().from(users).where(eq(users.email, email)).limit(1);
    return row === undefined ? null : { user: toUser(row), passwordHash: row.passwordHash };
  } catch {
    return null;
  }
}

export async function findUserById(id: string): Promise<User | null> {
  const database = db();
  if (database === null) {
    return null;
  }
  try {
    const [row] = await database.select().from(users).where(eq(users.id, id)).limit(1);
    return row === undefined ? null : toUser(row);
  } catch {
    return null;
  }
}

/**
 * Cambia el nombre. Devuelve la cuenta ya cambiada, o nulo si no se pudo.
 *
 * Devuelve la fila y no un booleano porque quien llama tiene que contestarle a
 * una pantalla que está enseñando ese nombre: con un `true` habría que ir a
 * buscarlo otra vez para pintarlo.
 */
export async function setName(userId: string, rawName: unknown): Promise<User | null> {
  const database = db();
  if (database === null) {
    return null;
  }
  try {
    const [row] = await database
      .update(users)
      .set({ name: normalizeName(rawName) })
      .where(eq(users.id, userId))
      .returning();
    return row === undefined ? null : toUser(row);
  } catch {
    return null;
  }
}

export type ChangePasswordResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'sin-base-de-datos' }
  | { readonly kind: 'contrasena-corta' }
  | { readonly kind: 'no-coincide' }
  | { readonly kind: 'error' };

/**
 * Cambia la contraseña, pidiendo la de ahora.
 *
 * **Se pide la actual aunque ya haya sesión**, y no es burocracia: una sesión
 * abierta en un ordenador prestado o un enlace malicioso desde otra pestaña
 * bastarían para quedarse con la cuenta para siempre. Pedirla convierte «tener la
 * cookie un rato» en «saber la contraseña», que no es lo mismo.
 *
 * La nueva se cifra con los parámetros de hoy, así que cambiarla es también la
 * forma de que una cuenta vieja pase al cifrado nuevo si algún día se sube el
 * coste.
 *
 * No comprueba que la nueva sea distinta de la vieja: es un aviso que no protege
 * de nada y estorba a quien está reciclando una contraseña a propósito.
 */
export async function changePassword(
  userId: string,
  actual: unknown,
  nueva: unknown,
): Promise<ChangePasswordResult> {
  const database = db();
  if (database === null) {
    return { kind: 'sin-base-de-datos' };
  }
  if (typeof nueva !== 'string' || nueva.length < MIN_PASSWORD_LENGTH) {
    return { kind: 'contrasena-corta' };
  }

  try {
    const [row] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
    if (row === undefined) {
      return { kind: 'error' };
    }

    const ok = await verifyPassword(typeof actual === 'string' ? actual : '', row.passwordHash);
    if (!ok) {
      return { kind: 'no-coincide' };
    }

    await database
      .update(users)
      .set({ passwordHash: await hashPassword(nueva) })
      .where(eq(users.id, userId));
    return { kind: 'ok' };
  } catch {
    return { kind: 'error' };
  }
}

/** Cambia el plan. Devuelve si se cambió algo. */
export async function setPlan(userId: string, plan: PlanId): Promise<boolean> {
  const database = db();
  if (database === null) {
    return false;
  }
  try {
    const rows = await database
      .update(users)
      .set({ plan })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return rows.length > 0;
  } catch {
    return false;
  }
}
