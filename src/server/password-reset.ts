/**
 * Recuperar la contraseña: el vale de un solo uso.
 *
 * Sin esto, alguien que paga 19,99 € y olvida la contraseña pierde la cuenta y
 * el dinero. Era una decisión defendible mientras no se cobraba —y estaba dicha
 * en la pantalla, no escondida— y deja de serlo en cuanto se cobra.
 *
 * Cuatro reglas, y ninguna es de adorno:
 *
 * 1. **El vale se guarda cifrado, no en claro.** Lo que viaja en el correo es el
 *    vale; lo que hay en la base de datos es su huella. Si alguien se lleva la
 *    tabla entera no puede entrar en ninguna cuenta con lo que hay dentro, que es
 *    exactamente el mismo motivo por el que las contraseñas tampoco se guardan.
 * 2. **Caduca.** Una hora. Un vale que vale para siempre es una segunda
 *    contraseña que nadie sabe que tiene, escrita en un buzón de correo.
 * 3. **Un solo uso.** Se marca al gastarlo, y los anteriores de esa cuenta se
 *    invalidan al pedir uno nuevo: si no, pedir tres correos dejaría tres puertas
 *    abiertas.
 * 4. **Usarlo echa a las demás sesiones**, subiendo `sessionVersion`. Quien
 *    recupera la contraseña suele estar haciéndolo porque alguien más entró.
 */

import { randomBytes, createHash } from 'node:crypto';

import { and, eq, isNull, lt } from 'drizzle-orm';

import { MIN_PASSWORD_LENGTH } from '@core/billing';

import { sameHex } from './constant-time';
import { db } from './db/client';
import { passwordResets, users } from './db/schema';
import { hashPassword } from './password';
import { baseYCorreo } from './users';

/**
 * Cuánto dura el vale.
 *
 * Una hora: tiempo de sobra para abrir el correo y bastante poco para que un
 * buzón olvidado en un ordenador prestado no sea una llave.
 */
export const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Lo largo que es el vale, en bytes de azar.
 *
 * Treinta y dos bytes son doscientos cincuenta y seis bits: no se adivina
 * probando. Va en base64 apto para direcciones porque viaja dentro de un enlace,
 * y un `+` o un `/` dentro de una dirección se rompen por el camino.
 */
const TOKEN_BYTES = 32;

export function createResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * La huella de un vale.
 *
 * SHA-256 a secas y no `scrypt`: un vale es azar de doscientos cincuenta y seis
 * bits, no una contraseña que alguien pueda adivinar con un diccionario, así que
 * el coste de cálculo no defiende de nada aquí y sí haría lenta cada
 * comprobación. Lo que se busca es que la tabla no sirva para entrar.
 */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Pide un vale para ese correo.
 *
 * Devuelve el vale en claro **solo para poder mandarlo por correo**, y nulo
 * cuando ese correo no tiene cuenta. Quien llama no puede distinguir los dos
 * casos de cara al usuario: la ruta contesta lo mismo siempre, porque contestar
 * distinto convertiría esta pantalla en un buscador de quién tiene cuenta aquí.
 */
export async function requestReset(
  rawEmail: unknown,
  now: Date,
): Promise<{ token: string; email: string } | null> {
  const abierto = baseYCorreo(rawEmail);
  if (abierto === null) {
    return null;
  }
  const { database, email } = abierto;

  try {
    const [user] = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (user === undefined) {
      return null;
    }

    // Los vales anteriores de esta cuenta se gastan al pedir uno nuevo: pedir
    // tres correos seguidos no puede dejar tres puertas abiertas.
    await database
      .update(passwordResets)
      .set({ usedAt: now })
      .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));

    const token = createResetToken();
    await database.insert(passwordResets).values({
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    });

    return { token, email };
  } catch {
    return null;
  }
}

export type ResetResult =
  'ok' | 'vale-no-vale' | 'contrasena-corta' | 'sin-base-de-datos' | 'error';

/**
 * Gasta el vale y pone la contraseña nueva.
 *
 * Caducado, gastado e inventado devuelven **lo mismo**: desde fuera son el mismo
 * caso —ese enlace ya no sirve— y distinguirlos diría si el vale existió alguna
 * vez, que es información sobre la cuenta de otra persona.
 */
export async function resetPassword(
  token: unknown,
  nueva: unknown,
  now: Date,
): Promise<ResetResult> {
  const database = db();
  if (database === null) {
    return 'sin-base-de-datos';
  }
  if (typeof token !== 'string' || token === '') {
    return 'vale-no-vale';
  }
  if (typeof nueva !== 'string' || nueva.length < MIN_PASSWORD_LENGTH) {
    return 'contrasena-corta';
  }

  const hash = hashResetToken(token);

  try {
    const [row] = await database
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, hash))
      .limit(1);

    // Se busca por la huella —es la clave— y luego se comparan en tiempo
    // constante. Buscar ya es una comparación, pero la de Postgres no lo es, y
    // esta línea cuesta nada.
    if (row === undefined || !sameHex(row.tokenHash, hash)) {
      return 'vale-no-vale';
    }
    if (row.usedAt !== null || row.expiresAt.getTime() <= now.getTime()) {
      return 'vale-no-vale';
    }

    const [user] = await database
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    if (user === undefined) {
      return 'vale-no-vale';
    }

    await database
      .update(users)
      .set({
        passwordHash: await hashPassword(nueva),
        // Quien recupera la contraseña suele estar haciéndolo porque alguien más
        // entró. Dejar viva la sesión de esa persona sería recuperar la cuenta a
        // medias.
        sessionVersion: user.sessionVersion + 1,
      })
      .where(eq(users.id, row.userId));

    await database.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, row.id));

    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * Suelta los vales que ya no valen.
 *
 * Los caducados y nada más: los gastados se quedan un tiempo a propósito, porque
 * un enlace pulsado dos veces —el correo reenviado, el botón de atrás— tiene que
 * poder distinguirse de uno inventado mientras la fila exista.
 */
export async function pruneResets(before: Date): Promise<void> {
  const database = db();
  if (database === null) {
    return;
  }
  try {
    await database.delete(passwordResets).where(lt(passwordResets.expiresAt, before));
  } catch {
    // Que no se pueda limpiar no tumba la petición que venía a otra cosa.
  }
}
