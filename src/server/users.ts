/**
 * Crear cuentas y encontrarlas.
 *
 * Todo lo que devuelve es un resultado con nombre —`'ok'`, `'ya-existe'`,
 * `'sin-base-de-datos'`— y no una excepción. Las rutas tienen que contestar algo
 * en español a quien está mirando la pantalla, y para eso un `catch` genérico no
 * sirve: no distingue «ese correo ya está» de «la base de datos no contesta», y
 * son dos frases distintas.
 */

import { and, eq, isNull, type SQL } from 'drizzle-orm';

import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH, planOf, type PlanId } from '@core/billing';

import { db, type Database } from './db/client';
import { users } from './db/schema';
import { hashPassword, verifyPassword } from './password';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly plan: PlanId;
  /** Sube al cambiar la contraseña. Es lo que echa a las demás sesiones. */
  readonly sessionVersion: number;
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
function normalizeEmail(raw: unknown): string | null {
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
function normalizeName(raw: unknown): string | null {
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

function toUser(row: {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  sessionVersion: number;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: planOf(row.plan).id,
    sessionVersion: row.sessionVersion,
  };
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

/**
 * La base y el correo ya normalizado, o nulo si falta cualquiera de los dos.
 *
 * Es la entrada de todo lo que busca una cuenta por su correo, y sin ella cada
 * sitio repetía las mismas cinco líneas. Devuelve un solo nulo a propósito:
 * quien pregunta por un correo no puede distinguir «no hay base de datos» de
 * «ese correo no existe», porque contestar distinto convierte la pantalla en un
 * buscador de quién tiene cuenta aquí.
 */
export function baseYCorreo(
  rawEmail: unknown,
): { database: NonNullable<ReturnType<typeof db>>; email: string } | null {
  const database = db();
  const email = normalizeEmail(rawEmail);
  return database === null || email === null ? null : { database, email };
}

/** La cuenta con su contraseña cifrada. Solo la usa la comprobación al entrar. */
export async function findUserWithPassword(
  rawEmail: unknown,
): Promise<{ user: User; passwordHash: string } | null> {
  const abierto = baseYCorreo(rawEmail);
  if (abierto === null) {
    return null;
  }
  const { database, email } = abierto;

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
    const row = await leerCuenta(database, id);
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

/**
 * La cuenta, solo si la contraseña que dan es la suya.
 *
 * Lo piden las dos cosas que no se pueden hacer con la cookie a secas —cambiar
 * la contraseña y borrar la cuenta— y lo pedían **con el mismo bloque escrito
 * dos veces**: leer la fila, ver si existe, comparar el hash. Dos copias de una
 * comprobación de contraseña es justo donde un arreglo se aplica a una y se
 * olvida en la otra, y aquí eso significa dejar una puerta abierta.
 *
 * Devuelve la fila y no un booleano porque quien cambia la contraseña necesita
 * `sessionVersion` de esa misma lectura: con un `true` habría que volver a
 * buscarla, y entre las dos lecturas cabe un cambio.
 *
 * No distingue «no existe» de «no coincide» hacia fuera por casualidad: cada
 * quien llama decide qué contesta, porque no contestan lo mismo.
 */
type FilaDeCuenta = Awaited<ReturnType<typeof leerCuenta>>;

async function leerCuenta(database: Database, userId: string) {
  const [row] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

async function cuentaSiLaContrasenaEsEsa(
  database: Database,
  userId: string,
  password: unknown,
): Promise<
  | { readonly kind: 'ok'; readonly row: NonNullable<FilaDeCuenta> }
  | { readonly kind: 'no-existe' }
  | { readonly kind: 'no-coincide' }
> {
  const row = await leerCuenta(database, userId);
  if (row === undefined) {
    return { kind: 'no-existe' };
  }
  // La cadena vacía cuando no mandan una de verdad: así se compara igual y no se
  // contesta antes de tiempo, que es lo que diría si la cuenta existe.
  const ok = await verifyPassword(typeof password === 'string' ? password : '', row.passwordHash);
  return ok ? { kind: 'ok', row } : { kind: 'no-coincide' };
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
    const cuenta = await cuentaSiLaContrasenaEsEsa(database, userId, actual);
    if (cuenta.kind === 'no-existe') {
      return { kind: 'error' };
    }
    if (cuenta.kind === 'no-coincide') {
      return { kind: 'no-coincide' };
    }

    await database
      .update(users)
      .set({
        passwordHash: await hashPassword(nueva),
        // Sube la versión, y con eso las demás sesiones dejan de valer. Va en la
        // misma sentencia que la contraseña: si fueran dos, entre una y otra
        // habría un instante con la contraseña nueva y las sesiones viejas
        // todavía buenas.
        sessionVersion: cuenta.row.sessionVersion + 1,
      })
      .where(eq(users.id, userId));
    return { kind: 'ok' };
  } catch {
    return { kind: 'error' };
  }
}

export type DeleteAccountResult = 'ok' | 'no-coincide' | 'sin-base-de-datos' | 'error';

/**
 * Borra la cuenta y todo lo que cuelga de ella.
 *
 * **Se pide la contraseña aunque ya haya sesión**, por lo mismo que para
 * cambiarla: una cookie viva en un ordenador prestado no puede bastar para
 * borrarle la cuenta a alguien. Y esto no tiene vuelta atrás.
 *
 * El avance, las canciones y el contador de IA se van con ella porque las tres
 * tablas cuelgan de `users` con `onDelete: cascade`. Es una sola sentencia y no
 * cuatro, así que no puede quedarse a medias: o se borra todo o no se borra
 * nada.
 *
 * Borrar de verdad y no marcar como borrada: lo segundo es más cómodo para
 * recuperar cuentas y es exactamente lo que alguien que pide que le borren sus
 * datos no está pidiendo.
 */
export async function deleteAccount(
  userId: string,
  password: unknown,
): Promise<DeleteAccountResult> {
  const database = db();
  if (database === null) {
    return 'sin-base-de-datos';
  }

  try {
    const cuenta = await cuentaSiLaContrasenaEsEsa(database, userId, password);
    if (cuenta.kind === 'no-existe') {
      return 'error';
    }
    if (cuenta.kind === 'no-coincide') {
      return 'no-coincide';
    }

    await database.delete(users).where(eq(users.id, userId));
    return 'ok';
  } catch {
    return 'error';
  }
}

/** Cambia el plan. Devuelve si se cambió algo. */
export type SetPlanResult =
  /** Cambiado. */
  | 'ok'
  /** Esa cuenta ya no está. Reintentarlo no lo va a arreglar. */
  | 'no-existe'
  /** No se ha podido escribir. Reintentarlo sí puede arreglarlo. */
  | 'error';

/**
 * Cambia el plan.
 *
 * **Distingue «no existe» de «no se ha podido»**, y no es un lujo: el webhook de
 * la pasarela contesta según eso. Con un booleano, una cuenta borrada que tenía
 * suscripción devolvía 500 y Stripe reintentaba ese evento durante días, para
 * siempre, sin que nunca fuera a salir bien. Se vio al ejecutarlo de verdad.
 */
export async function setPlan(userId: string, plan: PlanId): Promise<SetPlanResult> {
  const database = db();
  if (database === null) {
    return 'error';
  }
  try {
    const rows = await database
      .update(users)
      .set({ plan })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return rows.length > 0 ? 'ok' : 'no-existe';
  } catch {
    return 'error';
  }
}

interface CuentaEnStripe {
  readonly customerId: string | null;
  readonly subscriptionId: string | null;
}

/**
 * Lo que Stripe sabe de esta cuenta, o por qué no se sabe.
 *
 * Distingue «no está» de «no se ha podido leer», que `suscripcionDe` junta y el
 * webhook no puede juntar: una cuenta borrada se contesta con 200, y una base que
 * no contesta con 500 para que Stripe lo reintente.
 */
async function leerSuscripcion(
  userId: string,
): Promise<CuentaEnStripe | 'no-existe' | 'error'> {
  const database = db();
  if (database === null) {
    return 'error';
  }
  try {
    const [row] = await database
      .select({
        customerId: users.stripeCustomerId,
        subscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? 'no-existe';
  } catch {
    return 'error';
  }
}

/**
 * Lo que Stripe sabe de esta cuenta: su cliente y su suscripción viva.
 *
 * Nulo cuando no se ha podido leer —sin base, base caída o cuenta que ya no
 * está—, que para quien cobra es lo mismo: no hay con qué ir a Stripe.
 */
export async function suscripcionDe(userId: string): Promise<CuentaEnStripe | null> {
  const cuenta = await leerSuscripcion(userId);
  return typeof cuenta === 'string' ? null : cuenta;
}

/** Escribe y dice si había a quién, con los tres resultados de `setPlan`. */
async function escribirCuenta(
  donde: SQL,
  cambios: Partial<typeof users.$inferInsert>,
): Promise<SetPlanResult> {
  const database = db();
  if (database === null) {
    return 'error';
  }
  try {
    const rows = await database.update(users).set(cambios).where(donde).returning({ id: users.id });
    return rows.length > 0 ? 'ok' : 'no-existe';
  } catch {
    return 'error';
  }
}

/**
 * Lo que pasó al vincular un pago: los tres de `setPlan`, o que la cuenta ya
 * tenía **otra** suscripción guardada, y cuál.
 */
export type VincularResult =
  | { readonly kind: SetPlanResult }
  | { readonly kind: 'otra'; readonly guardada: string };

/**
 * Un pago confirmado: el plan, el cliente y la suscripción, **en una sentencia**.
 *
 * Juntos porque son lo mismo dicho tres veces. Con el plan puesto y la suscripción
 * sin guardar, cancelar no sabría qué parar en Stripe y el aviso de baja no
 * encontraría a nadie: el plan de pago se quedaría para siempre.
 *
 * **Y solo si la cuenta no tenía otra.** Con dos Checkout pagados a la vez, el
 * segundo aviso pisaba la suscripción del primero: esa seguía cobrando y sus
 * avisos ya no encontraban a nadie. Ahora se escribe solo si lo guardado es nulo,
 * es esta misma —un aviso repetido— o es `reemplaza`, la que quien llama ya ha
 * comprobado en Stripe que está muerta. Y la escritura lleva **en su `where` lo
 * que se leyó**: mirar y escribir por separado deja una rendija, y por ella se
 * colaban los dos avisos a la vez.
 */
export async function vincularSuscripcion(
  userId: string,
  pago: { plan: PlanId; customerId: string; subscriptionId: string },
  opciones: { reemplaza?: string } = {},
): Promise<VincularResult> {
  const cuenta = await leerSuscripcion(userId);
  if (typeof cuenta === 'string') {
    return { kind: cuenta };
  }

  const guardada = cuenta.subscriptionId;
  if (guardada !== null && guardada !== pago.subscriptionId && guardada !== opciones.reemplaza) {
    return { kind: 'otra', guardada };
  }

  // Se escribe solo si lo guardado sigue siendo lo que se acaba de leer. Si otro
  // aviso lo cambió entre medias no se escribe nada, y es un error a propósito:
  // Stripe lo reintenta, y la vez siguiente ya ve la suscripción del otro.
  const escrito = await escribirCuenta(
    and(
      eq(users.id, userId),
      guardada === null
        ? isNull(users.stripeSubscriptionId)
        : eq(users.stripeSubscriptionId, guardada),
    ) as SQL,
    {
      plan: pago.plan,
      stripeCustomerId: pago.customerId,
      stripeSubscriptionId: pago.subscriptionId,
    },
  );
  return { kind: escrito === 'no-existe' ? 'error' : escrito };
}

/**
 * Lo que diga Stripe de una suscripción, aplicado a la cuenta que la tiene.
 *
 * **Se busca por la suscripción guardada y no por los metadatos del aviso.** Un
 * aviso viejo que llegue tarde —Stripe no garantiza el orden— trae una
 * suscripción que ya se soltó, y entonces no encuentra a nadie: no puede
 * devolverle el plan de pago a quien ya se dio de baja.
 *
 * Con `soltar`, además se olvida la suscripción: es el aviso de que se acabó.
 */
export async function planDeSuscripcion(
  subscriptionId: string,
  plan: PlanId,
  opciones: { soltar: boolean },
): Promise<SetPlanResult> {
  return escribirCuenta(eq(users.stripeSubscriptionId, subscriptionId), {
    plan,
    ...(opciones.soltar ? { stripeSubscriptionId: null } : {}),
  });
}

/** Gratis y sin suscripción: lo que queda después de cancelarla en Stripe. */
export async function soltarSuscripcion(userId: string): Promise<SetPlanResult> {
  return escribirCuenta(eq(users.id, userId), { plan: 'gratis', stripeSubscriptionId: null });
}

/**
 * Vuelve a cifrar la contraseña con los parámetros de hoy.
 *
 * Solo la llama la entrada, que es el único sitio donde se tiene la contraseña en
 * claro y ya comprobada. **Solo escribe si lo guardado sigue siendo lo que se
 * comprobó**: si entre medias alguien la cambió, esta escritura pisaría la nueva
 * con la vieja.
 *
 * No sube `sessionVersion`, a propósito: es la misma contraseña, y echar a las
 * demás sesiones por cambiar cómo se guarda sería un susto sin motivo. Si falla
 * no pasa nada: se intenta la próxima vez que entre.
 */
export async function recifrarContrasena(
  userId: string,
  comprobado: string,
  password: string,
): Promise<void> {
  const database = db();
  /* v8 ignore next 3 -- solo se llama despues de haber leido la cuenta de la base */
  if (database === null) {
    return;
  }
  try {
    await database
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(and(eq(users.id, userId), eq(users.passwordHash, comprobado)));
  } catch {
    // Entrar no puede fallar porque no se haya podido mejorar cómo se guarda.
  }
}
