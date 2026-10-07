/**
 * El avance de una cuenta, leído y guardado.
 *
 * Lo que sube y baja es el documento entero, y siempre pasa por `parseProgress`
 * al leerlo: lo que hay en la base de datos lo escribió el navegador de alguien,
 * y eso lo convierte en entrada de usuario aunque haya dado la vuelta por
 * Postgres. Nada más entra.
 */

import { eq } from 'drizzle-orm';

import { mergeProgress, parseProgress, posicionesDeLaUnidad, type Progress } from '@core/music';

import { db } from './db/client';
import { progress as progressTable } from './db/schema';

/**
 * El avance guardado en la cuenta.
 *
 * Distingue tres cosas y por eso no devuelve `Progress` a secas: hay avance, la
 * cuenta existe pero nunca ha guardado nada, o no se ha podido preguntar. La
 * pantalla hace algo distinto en cada caso, y sobre todo: no se puede subir una
 * fusión si no se ha podido leer lo que había, porque eso borraría el avance de
 * la cuenta con el de este navegador.
 */
export type LoadResult =
  | { readonly kind: 'ok'; readonly progress: Progress }
  | { readonly kind: 'vacio' }
  | { readonly kind: 'error' };

/**
 * El día del servidor, en UTC.
 *
 * Es el tope de las fechas que se creen al leer un avance (`parseProgress`): nada
 * puede haberse practicado después de mañana. El reloj se lee aquí y no en el
 * dominio, que no lee relojes.
 */
export function hoyEnElServidor(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function leer(data: unknown, hoy: string): Progress {
  // Con las posiciones contadas: lo que la cola apunte a una pregunta que su
  // lección ya no tiene se suelta aquí, y el navegador lo recibe limpio. Y con el
  // día: lo que se guardó envenenado antes de comprobarlo se repara al leerlo.
  return parseProgress(data, posicionesDeLaUnidad, hoy);
}

export async function loadAccountProgress(
  userId: string,
  hoy: string = hoyEnElServidor(),
): Promise<LoadResult> {
  const database = db();
  if (database === null) {
    return { kind: 'error' };
  }
  try {
    const [row] = await database
      .select({ data: progressTable.data })
      .from(progressTable)
      .where(eq(progressTable.userId, userId))
      .limit(1);

    return row === undefined ? { kind: 'vacio' } : { kind: 'ok', progress: leer(row.data, hoy) };
  } catch {
    return { kind: 'error' };
  }
}

/** Escribe el avance de la cuenta. Devuelve si se ha guardado. */
export async function saveAccountProgress(userId: string, value: Progress): Promise<boolean> {
  const database = db();
  if (database === null) {
    return false;
  }
  try {
    await database
      .insert(progressTable)
      .values({ userId, data: value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: progressTable.userId,
        set: { data: value, updatedAt: new Date() },
      });
    return true;
  } catch {
    return false;
  }
}

/**
 * Funde lo que sube un aparato con lo guardado, **en una transacción**, y devuelve
 * el resultado, o nulo si no se ha podido.
 *
 * Antes la ruta leía, fundía y escribía en tres pasos sueltos, y dos aparatos que
 * subían a la vez leían lo mismo: el segundo en escribir borraba lo del primero.
 * La auditoría lo reprodujo con dos `PUT` simultáneos —una unidad cada uno— y se
 * guardaba una sola (adr/0116). Ahora la fila se bloquea con `for update` antes de
 * leerla, y el segundo espera a que el primero haya escrito para leer ya lo suyo.
 *
 * La primera vez no hay fila que bloquear, y dos inserciones a la vez volverían a
 * pisarse. Por eso se crea antes, vacía y sin pisar nada (`on conflict do
 * nothing`): el segundo que lo intenta espera en el índice único a que el primero
 * termine, y luego bloquea la fila que ya existe.
 *
 * Si algo falla dentro, no se escribe nada: Postgres deshace la transacción entera,
 * y lo que había se queda como estaba, que es la regla de siempre —sin poder leer
 * lo guardado no se escribe encima—.
 */
export async function fusionarAvance(
  userId: string,
  entrante: Progress,
  hoy: string = hoyEnElServidor(),
): Promise<Progress | null> {
  const database = db();
  if (database === null) {
    return null;
  }
  try {
    return await database.transaction(async (tx) => {
      await tx
        .insert(progressTable)
        .values({ userId, data: {}, updatedAt: new Date() })
        .onConflictDoNothing({ target: progressTable.userId });

      const [row] = await tx
        .select({ data: progressTable.data })
        .from(progressTable)
        .where(eq(progressTable.userId, userId))
        .for('update');

      // Recién creada, `data` es `{}` y se lee como el avance vacío: fundir con él
      // deja lo que sube tal cual, sin un camino aparte para la primera vez.
      const junto = mergeProgress(leer(row?.data, hoy), entrante);

      await tx
        .update(progressTable)
        .set({ data: junto, updatedAt: new Date() })
        .where(eq(progressTable.userId, userId));
      return junto;
    });
  } catch {
    return null;
  }
}
