/**
 * Persistencia local de sesiones.
 *
 * Sin cuenta y sin servidor: todo vive en el equipo. La interfaz existe para
 * que el resto no dependa de IndexedDB, y para poder probar la lógica con una
 * implementación en memoria.
 */

import type { ScaleId } from '@core/music';

import type { SessionKey } from './session-store';

/** Lo que merece la pena recordar de una sesión. */
export interface StoredSession {
  readonly id: string;
  /** Milisegundos desde epoch. Entra por parámetro: aquí no se lee el reloj. */
  readonly savedAt: number;
  readonly key: SessionKey | null;
  readonly scaleId: ScaleId;
  /** Nombres de las notas tocadas, no el audio. */
  readonly notes: readonly string[];
  /** Cifrados de las progresiones que se han probado. */
  readonly chords: readonly string[];
}

export interface SessionStorage {
  save(session: StoredSession): Promise<void>;
  list(): Promise<StoredSession[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Cuántas sesiones se conservan. Más allá, la lista deja de ser útil. */
export const MAX_STORED_SESSIONS = 20;

/**
 * Se queda con las más recientes. Es la regla de retención, y está aparte de la
 * base de datos para poder probarla.
 */
export function pruneSessions(
  sessions: readonly StoredSession[],
  limit: number = MAX_STORED_SESSIONS,
): StoredSession[] {
  return [...sessions].sort((a, b) => b.savedAt - a.savedAt).slice(0, limit);
}

/** Resumen de una línea para la lista, en español. */
export function describeSession(session: StoredSession): string {
  const when = new Date(session.savedAt);
  const stamp = `${String(when.getDate()).padStart(2, '0')}/${String(when.getMonth() + 1).padStart(
    2,
    '0',
  )} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;

  const notes = session.notes.length;
  const detail = notes === 0 ? 'sin notas' : `${notes} ${notes === 1 ? 'nota' : 'notas'}`;

  return `${stamp} · ${detail}`;
}

/** Implementación en memoria: la que usan los tests y el renderizado en servidor. */
export class MemorySessionStorage implements SessionStorage {
  #sessions: StoredSession[] = [];

  async save(session: StoredSession): Promise<void> {
    this.#sessions = pruneSessions([
      session,
      ...this.#sessions.filter((stored) => stored.id !== session.id),
    ]);
  }

  async list(): Promise<StoredSession[]> {
    return pruneSessions(this.#sessions);
  }

  async remove(id: string): Promise<void> {
    this.#sessions = this.#sessions.filter((stored) => stored.id !== id);
  }

  async clear(): Promise<void> {
    this.#sessions = [];
  }
}

const DB_NAME = 'caos-ordenado';
const DB_VERSION = 1;
const STORE = 'sessions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      /* v8 ignore next 3 -- la version no ha subido nunca, asi que esto solo corre con la base recien creada */
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    /* v8 ignore next -- abrir la base solo falla con permisos denegados, y entonces trae su error */
    request.onerror = () => reject(request.error ?? new Error('No se ha podido abrir la base.'));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    /* v8 ignore next -- una peticion fallida siempre trae su error; la frase es el ultimo recurso */
    request.onerror = () => reject(request.error ?? new Error('La operación ha fallado.'));
  });
}

/**
 * IndexedDB y no localStorage porque una sesión puede llevar cientos de notas y
 * localStorage es síncrono: escribir ahí bloquearía el hilo que está
 * analizando el audio.
 */
export class IndexedDbSessionStorage implements SessionStorage {
  async save(session: StoredSession): Promise<void> {
    const db = await openDatabase();
    try {
      await runRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).put(session));

      // **Se pregunta por todas, no por `list()`.** `list()` ya viene podada al
      // tope, así que lo que sobraba salía siempre vacío y la base crecía sin
      // fin: la lista enseñaba veinte y debajo había las que fueran. No se veía
      // mirando la pantalla, solo el espacio que el navegador iba dando.
      const todas = await runRequest<StoredSession[]>(
        db.transaction(STORE, 'readonly').objectStore(STORE).getAll(),
      );
      for (const vieja of pruneSessions(todas, Number.POSITIVE_INFINITY).slice(
        MAX_STORED_SESSIONS,
      )) {
        await runRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(vieja.id));
      }
    } finally {
      db.close();
    }
  }

  async list(): Promise<StoredSession[]> {
    const db = await openDatabase();
    try {
      const all = await runRequest<StoredSession[]>(
        db.transaction(STORE, 'readonly').objectStore(STORE).getAll(),
      );
      return pruneSessions(all);
    } finally {
      db.close();
    }
  }

  async remove(id: string): Promise<void> {
    const db = await openDatabase();
    try {
      await runRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    try {
      await runRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).clear());
    } finally {
      db.close();
    }
  }
}

/** La que toca según dónde se ejecute: sin IndexedDB, en memoria. */
export function createSessionStorage(): SessionStorage {
  return typeof indexedDB === 'undefined'
    ? new MemorySessionStorage()
    : new IndexedDbSessionStorage();
}
