/**
 * El avance de una cuenta, leído y guardado.
 *
 * Lo que sube y baja es el documento entero, y siempre pasa por `parseProgress`
 * al leerlo: lo que hay en la base de datos lo escribió el navegador de alguien,
 * y eso lo convierte en entrada de usuario aunque haya dado la vuelta por
 * Postgres. Nada más entra.
 */

import { eq } from 'drizzle-orm';

import { parseProgress, type Progress } from '@core/music';

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

export async function loadAccountProgress(userId: string): Promise<LoadResult> {
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

    return row === undefined
      ? { kind: 'vacio' }
      : { kind: 'ok', progress: parseProgress(row.data) };
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
