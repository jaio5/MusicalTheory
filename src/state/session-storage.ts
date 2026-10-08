/**
 * Persistencia local de sesiones, y del lienzo de componer.
 *
 * Sin cuenta y sin servidor: todo vive en el equipo. La interfaz existe para
 * que el resto no dependa de IndexedDB, y para poder probar la lógica con una
 * implementación en memoria.
 */

import { leerMontaje, type Arrangement, type ScaleId } from '@core/music';

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
/**
 * La 2 trae el almacén del lienzo. **Subirla no borra nada**: `onupgradeneeded`
 * solo crea lo que falta, así que las sesiones de quien venía de la 1 siguen ahí.
 */
const DB_VERSION = 2;
const STORE = 'sessions';
const LIENZO = 'lienzo';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Cada almacén se crea si falta, y no según de qué versión se venga: con la
      // base nueva faltan los dos, y viniendo de la 1 solo el del lienzo.
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      /* v8 ignore next 3 -- solo se llega aqui subiendo a la 2, y antes de la 2 este almacen no existia */
      if (!db.objectStoreNames.contains(LIENZO)) {
        db.createObjectStore(LIENZO);
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

/**
 * El lienzo de componer, guardado en este navegador.
 *
 * **Existe porque la canción se perdía al recargar.** Sin plan no hay canciones
 * en la cuenta, y aunque lo hubiera, guardarla es un botón que hay que acordarse
 * de pulsar: quien monta una canción en muchas sesiones la perdía entera con un
 * F5 o con el navegador cerrándose solo. Esto guarda **el lienzo que hay**, uno
 * solo, sin nombre: no es una canción guardada, es no perder lo que tenías
 * delante.
 *
 * Va a IndexedDB, a la misma base que las sesiones, y no a localStorage por la
 * misma razón que ellas: localStorage es síncrono, y escribir ahí en mitad de una
 * toma bloquearía el hilo que analiza el audio. **No sale del navegador**: son
 * grados, pulsos y notas, y no viajan a ningún sitio (regla 4 de CLAUDE.md).
 */
export interface AlmacenDelLienzo {
  guardar(arrangement: Arrangement): Promise<void>;
  /** Lo guardado, o nulo si no hay nada o no se entiende. */
  leer(): Promise<Arrangement | null>;
}

/**
 * La versión de lo que se guarda.
 *
 * Va escrita para que una versión futura pueda saber qué está leyendo. Hoy solo
 * hay una, y lo de una versión que no se conoce se descarta: leerlo con las
 * reglas de esta podría dar por buenos campos que significan otra cosa.
 */
export const VERSION_DEL_LIENZO = 1;

interface LienzoGuardado {
  readonly version: typeof VERSION_DEL_LIENZO;
  readonly arrangement: Arrangement;
}

function envolver(arrangement: Arrangement): LienzoGuardado {
  return { version: VERSION_DEL_LIENZO, arrangement };
}

/**
 * Lo guardado, si se entiende.
 *
 * Tolerante como el resto de lo que se lee de fuera (`workspace.ts`,
 * `parseSong`): lo que no cuadra se cae sin tumbar lo demás, y lo que no es un
 * lienzo de esta versión no se lee. Basura en la clave no puede dejar
 * `/componer` sin abrir.
 */
function leerLienzoGuardado(raw: unknown): Arrangement | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (record['version'] !== VERSION_DEL_LIENZO) {
    return null;
  }
  return leerMontaje(record['arrangement']);
}

/** La clave del único lienzo que hay. */
const CLAVE_DEL_LIENZO = 'actual';

export class IndexedDbLienzo implements AlmacenDelLienzo {
  async guardar(arrangement: Arrangement): Promise<void> {
    const db = await openDatabase();
    try {
      await runRequest(
        db
          .transaction(LIENZO, 'readwrite')
          .objectStore(LIENZO)
          .put(envolver(arrangement), CLAVE_DEL_LIENZO),
      );
    } finally {
      db.close();
    }
  }

  async leer(): Promise<Arrangement | null> {
    const db = await openDatabase();
    try {
      const raw = await runRequest<unknown>(
        db.transaction(LIENZO, 'readonly').objectStore(LIENZO).get(CLAVE_DEL_LIENZO),
      );
      return leerLienzoGuardado(raw);
    } finally {
      db.close();
    }
  }
}

/** En memoria, y pasando por la misma lectura: un test que guarda y lee prueba lo mismo. */
export class MemoriaDelLienzo implements AlmacenDelLienzo {
  #guardado: unknown = undefined;

  async guardar(arrangement: Arrangement): Promise<void> {
    // Por JSON y no la referencia, para que lo leído sea una copia como lo es
    // en IndexedDB y nadie pueda tocar lo guardado desde fuera.
    this.#guardado = JSON.parse(JSON.stringify(envolver(arrangement)));
  }

  async leer(): Promise<Arrangement | null> {
    return leerLienzoGuardado(this.#guardado);
  }
}

/** El que toca según dónde se ejecute: sin IndexedDB, en memoria. */
export function createAlmacenDelLienzo(): AlmacenDelLienzo {
  return typeof indexedDB === 'undefined' ? new MemoriaDelLienzo() : new IndexedDbLienzo();
}
