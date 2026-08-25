/**
 * Las canciones de una cuenta, leídas y guardadas.
 *
 * Todo lo que sale de aquí pasa por `parseSong`, igual que el avance pasa por
 * `parseProgress`: lo que hay en la base de datos lo escribió el navegador de
 * alguien, y eso lo convierte en entrada de usuario aunque haya dado la vuelta
 * por Postgres.
 *
 * **Cada consulta filtra por `userId`**, incluidas las de borrar y actualizar,
 * que ya reciben el identificador de la canción. Filtrar solo por el id bastaría
 * para que funcionase, y también para que mandando el id de otra persona se
 * pudiera borrar su canción. El dueño se comprueba en la misma sentencia que
 * escribe, no antes: comprobar y luego escribir deja una rendija entre las dos.
 */

import { and, count, desc, eq } from 'drizzle-orm';

import { MAX_SONGS, parseSong, sortSongs, type Song } from '@core/music';

import { db } from './db/client';
import { songs as songsTable } from './db/schema';

/**
 * Qué ha pasado al escribir.
 *
 * Cinco casos y no un booleano porque la pantalla hace algo distinto en cada
 * uno: «no hemos podido» se reintenta, «no es tuya» no, y «no te caben más» se
 * arregla borrando alguna. Un `false` para los cinco obligaría a inventarse el
 * mensaje en la ruta.
 */
export type SaveResult =
  | { readonly kind: 'ok'; readonly song: Song }
  | { readonly kind: 'no-existe' }
  | { readonly kind: 'llena' }
  | { readonly kind: 'error' };

/**
 * Si eso puede ser un identificador de canción.
 *
 * Se comprueba la forma antes de preguntar porque Postgres **lanza** con un
 * `uuid` mal escrito en vez de no encontrar nada, y eso convertiría un
 * identificador inventado en un 502 —«no hemos podido»— cuando lo cierto es que
 * no existe. Un fallo del cliente no puede parecer un fallo del servidor.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSongId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Lo que se guarda dentro del `jsonb`: la canción menos lo que ya es columna. */
function documentOf(song: Song): Record<string, unknown> {
  return {
    tonic: song.tonic,
    mode: song.mode,
    bpm: song.bpm,
    sections: song.sections,
    updatedAt: song.updatedAt,
  };
}

/** Junta la fila y su documento en una canción, o nulo si el documento está roto. */
function songOfRow(row: { id: string; name: string; data: unknown; updatedAt: Date }): Song | null {
  const parsed = parseSong(row.data, row.id);
  if (parsed === null) {
    return null;
  }
  // El nombre y la fecha mandan desde la columna: son los que se pueden
  // consultar y ordenar, y tener dos versiones de cada uno acabaría con la
  // lista diciendo un nombre y la canción abierta diciendo otro.
  return { ...parsed, name: row.name, updatedAt: row.updatedAt.getTime() };
}

export async function listSongs(userId: string): Promise<Song[] | null> {
  const database = db();
  if (database === null) {
    return null;
  }
  try {
    const rows = await database
      .select({
        id: songsTable.id,
        name: songsTable.name,
        data: songsTable.data,
        updatedAt: songsTable.updatedAt,
      })
      .from(songsTable)
      .where(eq(songsTable.userId, userId))
      .orderBy(desc(songsTable.updatedAt))
      .limit(MAX_SONGS);

    // Una fila con el documento roto se cae de la lista en vez de tumbarla:
    // perder una canción es malo, no poder abrir ninguna es peor.
    return sortSongs(rows.map(songOfRow).filter((song): song is Song => song !== null));
  } catch {
    return null;
  }
}

/** Crea una canción. El identificador lo pone Postgres, no quien llama. */
export async function createSong(userId: string, song: Song): Promise<SaveResult> {
  const database = db();
  if (database === null) {
    return { kind: 'error' };
  }
  try {
    const [existing] = await database
      .select({ total: count() })
      .from(songsTable)
      .where(eq(songsTable.userId, userId));

    if ((existing?.total ?? 0) >= MAX_SONGS) {
      return { kind: 'llena' };
    }

    const [row] = await database
      .insert(songsTable)
      .values({ userId, name: song.name, data: documentOf(song) })
      .returning({
        id: songsTable.id,
        name: songsTable.name,
        data: songsTable.data,
        updatedAt: songsTable.updatedAt,
      });

    const created = row === undefined ? null : songOfRow(row);
    return created === null ? { kind: 'error' } : { kind: 'ok', song: created };
  } catch {
    return { kind: 'error' };
  }
}

/**
 * Escribe encima de una canción que ya existe.
 *
 * El `and` con `userId` es lo que impide escribir en la canción de otra persona
 * mandando su identificador, y por eso el resultado de cero filas es «no
 * existe»: desde fuera, la canción de otro y una que no existe son lo mismo, y
 * decir cuál de las dos es sería confirmar que ese identificador existe.
 */
export async function updateSong(userId: string, song: Song): Promise<SaveResult> {
  const database = db();
  if (database === null) {
    return { kind: 'error' };
  }
  if (!isSongId(song.id)) {
    return { kind: 'no-existe' };
  }
  try {
    const [row] = await database
      .update(songsTable)
      .set({ name: song.name, data: documentOf(song), updatedAt: new Date() })
      .where(and(eq(songsTable.id, song.id), eq(songsTable.userId, userId)))
      .returning({
        id: songsTable.id,
        name: songsTable.name,
        data: songsTable.data,
        updatedAt: songsTable.updatedAt,
      });

    if (row === undefined) {
      return { kind: 'no-existe' };
    }
    const saved = songOfRow(row);
    return saved === null ? { kind: 'error' } : { kind: 'ok', song: saved };
  } catch {
    return { kind: 'error' };
  }
}

export type RemoveResult = 'ok' | 'no-existe' | 'error';

export async function removeSong(userId: string, id: unknown): Promise<RemoveResult> {
  const database = db();
  if (database === null) {
    return 'error';
  }
  if (!isSongId(id)) {
    return 'no-existe';
  }
  try {
    const rows = await database
      .delete(songsTable)
      .where(and(eq(songsTable.id, id), eq(songsTable.userId, userId)))
      .returning({ id: songsTable.id });

    return rows.length === 0 ? 'no-existe' : 'ok';
  } catch {
    return 'error';
  }
}
