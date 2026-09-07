/**
 * Una canción guardada: la tonalidad, el tempo y las secciones con sus acordes.
 *
 * **Lo que se guarda son grados, no cifrados**, y esa es la única decisión
 * importante de este fichero. Es la misma lección que ya aprendieron
 * `/api/ideas` —los cifrados que devuelve el modelo se recalculan desde los
 * grados— y el repaso —lo fallado se apunta por su posición, no por su texto—:
 * un `Sol` guardado tal cual solo significa algo en la tonalidad en la que se
 * escribió, mientras que un `V` significa lo mismo en las doce. Guardando grados,
 * cambiar de tonalidad una canción entera es cambiar un número, y la fase de las
 * versiones puede rearmonizar sin traducir nada.
 *
 * Lo que se pierde: un acorde que no sea ninguno de los grados del modo no se
 * puede guardar. Es a propósito, y es lo que evita que aquí acabe habiendo texto
 * libre que nadie puede verificar.
 *
 * Dominio puro: aquí no hay base de datos, ni fetch, ni reloj. El instante entra
 * por parámetro, como en `exercise.ts`.
 */

import type { BlockSource } from './arrangement';
import type { KeyMode } from './keys';
import {
  clampOffset,
  clampStart,
  snapLength,
  MAX_LEAD_NOTES,
  MAX_OFFSET,
  MIN_OFFSET,
} from './melody';
import { normalizePitchClass, type PitchClass } from './notes';
import {
  degreesFor,
  resolveProgression,
  type DegreeSymbol,
  type ResolvedChord,
} from './progressions';
import { clampBpm } from './tempo';

/** Un tramo con nombre: la estrofa, el estribillo, el puente. */
export interface SongSection {
  readonly name: string;
  readonly degrees: readonly DegreeSymbol[];
  /**
   * El punteo, como ternas `[semitonos sobre la tónica, pulso de entrada, pulsos
   * que dura]`.
   *
   * **Ternas y no objetos con claves**, que es lo mismo que ya hace `degrees`
   * con los grados: una nota son doce bytes en vez de treinta, y una canción
   * llena baja de veintitrés kilobytes a nueve. El identificador no se guarda:
   * al abrir se regenera por posición, como los bloques.
   *
   * Opcional porque las canciones de antes no lo tienen, y una canción sin
   * punteo es una canción, no una rota.
   */
  readonly lead?: readonly LeadTriple[];
  /**
   * De dónde salió cada grado, en el mismo orden que `degrees`.
   *
   * Es lo que hace que la observación no se construya sobre arena: un `vi` que
   * escribió una persona y un `vi` que salió de un micro en una habitación no
   * valen lo mismo, y quien lea esta canción —la IA, una lección, o alguien
   * dentro de seis meses— tiene que poder distinguirlos. Sin esto, al guardar se
   * perdía y todo pasaba a valer igual.
   */
  readonly sources?: readonly BlockSource[];
}

/** Una nota del punteo, como se guarda: altura, entrada y duración. */
export type LeadTriple = readonly [offset: number, start: number, length: number];

export interface Song {
  readonly id: string;
  readonly name: string;
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  /** Nulo cuando no se apuntó: una canción puede no tener tempo decidido. */
  readonly bpm: number | null;
  readonly sections: readonly SongSection[];
  /** Milisegundos desde epoch. Entra por parámetro: aquí no se lee el reloj. */
  readonly updatedAt: number;
}

/**
 * Los cuatro topes, todos con nombre.
 *
 * No son manía de límites: es lo que hay entre una canción y un sitio donde
 * alguien puede escribir un megabyte de texto en el `jsonb` de otra persona. Los
 * números salen de lo que cabe leyendo a un metro de la pantalla, no de un
 * cálculo.
 */
export const MAX_SONG_NAME = 60;
export const MAX_SECTION_NAME = 30;
export const MAX_SECTIONS = 12;
export const MAX_SECTION_DEGREES = 32;

/** Cuántas canciones guarda una cuenta. Más allá, la lista deja de ser útil. */
export const MAX_SONGS = 50;

/** El nombre que se pone cuando no se ha puesto ninguno. */
export const UNNAMED_SONG = 'Sin título';

/** El nombre de una sección nueva, numerada por su sitio. */
export function defaultSectionName(index: number): string {
  return `Parte ${index + 1}`;
}

function trimTo(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

/**
 * El nombre de una canción, siempre con algo dentro.
 *
 * Vacío y solo espacios son lo mismo aquí —«no le he puesto nombre»— y los dos
 * caen en el mismo rótulo, porque una lista con una fila en blanco no se puede
 * pulsar a ciegas.
 */
export function songName(value: unknown): string {
  const trimmed = trimTo(value, MAX_SONG_NAME);
  return trimmed === '' ? UNNAMED_SONG : trimmed;
}

function asMode(value: unknown): KeyMode {
  return value === 'minor' ? 'minor' : 'major';
}

function asTonic(value: unknown): PitchClass {
  return typeof value === 'number' && Number.isFinite(value) ? normalizePitchClass(value) : 0;
}

/**
 * El tempo, o nulo.
 *
 * Nulo y fuera de rango **no son lo mismo**: no haber apuntado el tempo es una
 * canción sin tempo, y un 5000 es un dato roto que se acerca al tope en vez de
 * borrarse. Borrarlo perdería la única pista de que ahí había algo.
 */
function asBpm(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return clampBpm(value);
}

function asTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Los grados que existen en ese modo, y nada más.
 *
 * Se filtra contra `degreesFor` y no contra una lista escrita aquí: si mañana el
 * catálogo de grados crece, las canciones lo aprovechan sin tocar este fichero.
 * Un grado de mayor colado en una canción menor reventaría `resolveDegree` con
 * un `RangeError` al pintarla, que es un error en el sitio equivocado.
 */
function asDegrees(value: unknown, mode: KeyMode): DegreeSymbol[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const known = new Set<string>(degreesFor(mode));
  return value
    .filter((degree): degree is DegreeSymbol => typeof degree === 'string' && known.has(degree))
    .slice(0, MAX_SECTION_DEGREES);
}

/**
 * El punteo de una sección, leído sin creerse nada.
 *
 * Cada nota pasa por la misma rejilla y los mismos topes que si se acabara de
 * escribir en el lienzo: lo que hay en la base de datos lo escribió el navegador
 * de alguien, y se interpreta igual al leer que al recibir. Es la misma regla
 * que sigue el resto de este fichero.
 *
 * Una terna con algo que no es un número se cae entera. Redondear un `null` a
 * cero pondría una nota en la tónica que nadie tocó.
 */
function asLead(value: unknown): LeadTriple[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const salida: LeadTriple[] = [];
  for (const nota of value.slice(0, MAX_LEAD_NOTES)) {
    if (!Array.isArray(nota) || nota.length < 3) {
      continue;
    }
    const [offset, start, length] = nota;
    if (
      typeof offset !== 'number' ||
      typeof start !== 'number' ||
      typeof length !== 'number' ||
      !Number.isFinite(offset) ||
      !Number.isFinite(start) ||
      !Number.isFinite(length) ||
      offset < MIN_OFFSET ||
      offset > MAX_OFFSET
    ) {
      continue;
    }
    salida.push([clampOffset(offset), clampStart(start), snapLength(length)]);
  }
  return salida;
}

/** De dónde salió cada grado. Lo que no se reconoce se lee como escrito a mano. */
function asSources(value: unknown, cuantos: number): BlockSource[] {
  const crudas = Array.isArray(value) ? value : [];
  return Array.from({ length: cuantos }, (_, indice) => {
    const source = crudas[indice];
    return source === 'heard' || source === 'fixed' ? source : 'written';
  });
}

function asSections(value: unknown, mode: KeyMode): SongSection[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (
    value
      .slice(0, MAX_SECTIONS)
      .map((raw, index) => {
        const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
          string,
          unknown
        >;
        const name = trimTo(record['name'], MAX_SECTION_NAME);
        const degrees = asDegrees(record['degrees'], mode);
        const lead = asLead(record['lead']);
        const sources = asSources(record['sources'], degrees.length);

        // Se omite lo que no dice nada, igual que al escribir. Leer y guardar
        // tienen que dar lo mismo, o una canción crecería sola cada vez que se
        // abre y se vuelve a guardar sin tocarla.
        return {
          name: name === '' ? defaultSectionName(index) : name,
          degrees,
          ...(lead.length > 0 ? { lead } : {}),
          ...(sources.some((source) => source !== 'written') ? { sources } : {}),
        };
      })
      // Una sección sin un solo acorde no es una sección: es una fila vacía que
      // ocupa sitio en la pantalla y no se puede ni tocar ni rearmonizar.
      .filter((section) => section.degrees.length > 0)
  );
}

/**
 * Interpreta lo que venga de fuera.
 *
 * Devuelve nulo, y no una canción vacía, cuando no queda nada aprovechable. Es la
 * diferencia con `parseProgress`, que sí devuelve el avance vacío: un avance sin
 * nada es un avance de alguien que acaba de empezar, pero una canción sin un solo
 * acorde no es una canción, y guardarla llenaría la lista de filas que no se
 * pueden abrir.
 *
 * Lo que hay en la base de datos lo escribió el navegador de alguien, así que
 * esto es entrada de usuario aunque haya dado la vuelta por Postgres. Se
 * interpreta igual al leer que al recibir, y por eso hay una sola función.
 */
export function parseSong(raw: unknown, id: string): Song | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const mode = asMode(record['mode']);
  const sections = asSections(record['sections'], mode);

  if (sections.length === 0) {
    return null;
  }

  return {
    id,
    name: songName(record['name']),
    tonic: asTonic(record['tonic']),
    mode,
    bpm: asBpm(record['bpm']),
    sections,
    updatedAt: asTimestamp(record['updatedAt']),
  };
}

/** Lo que se ha podido guardar de una progresión, y lo que se ha quedado fuera. */
export interface DegreesFromPath {
  readonly degrees: readonly DegreeSymbol[];
  /** Cuántos acordes no eran grados del modo. */
  readonly dropped: number;
}

/**
 * Los grados de un camino de acordes, tal y como los etiqueta el modo componer.
 *
 * El camino guarda etiquetas —«I», «vi», «V7/vi»— y no todas son grados del
 * modo: los dominantes secundarios y los prestados se escriben con una barra o
 * con una alteración que este catálogo todavía no tiene. Se caen, y **se cuenta
 * cuántos**, porque guardar seis acordes de ocho sin decirlo es lo mismo que
 * perderlos: quien abra la canción mañana verá una progresión que no tocó y no
 * sabrá por qué.
 *
 * Cuando el catálogo de grados crezca, esto no cambia: `degreesFor` es el que
 * decide, y esta función solo pregunta.
 */
export function degreesFromPath(labels: readonly string[], mode: KeyMode): DegreesFromPath {
  const known = new Set<string>(degreesFor(mode));
  const degrees = labels
    .filter((label): label is DegreeSymbol => known.has(label))
    .slice(0, MAX_SECTION_DEGREES);

  return { degrees, dropped: labels.length - degrees.length };
}

/** Los acordes de verdad de una sección, en la tonalidad de la canción. */
export function resolveSection(song: Song, section: SongSection): ResolvedChord[] {
  return resolveProgression(song.tonic, song.mode, section.degrees);
}

/**
 * La misma canción en otra tonalidad.
 *
 * Es una línea porque las canciones se guardan en grados. Con cifrados dentro
 * esto sería una tabla de traducción con doce casos y sus bemoles.
 */
export function transposeSong(song: Song, tonic: PitchClass, updatedAt: number): Song {
  return { ...song, tonic, updatedAt };
}

/** Cuántos acordes tiene entera. Es lo que se enseña en la lista. */
export function songLength(song: Song): number {
  return song.sections.reduce((total, section) => total + section.degrees.length, 0);
}

/**
 * Resumen de una línea para la lista, en español.
 *
 * Dice secciones y acordes, no la fecha: la lista ya va ordenada por fecha, así
 * que repetirla en cada fila gasta sitio sin decir nada que no se vea en el
 * orden.
 */
export function describeSong(song: Song): string {
  const sections = song.sections.length;
  const chords = songLength(song);
  const bpm = song.bpm === null ? '' : ` · ${song.bpm} bpm`;

  return `${sections} ${sections === 1 ? 'sección' : 'secciones'} · ${chords} ${
    chords === 1 ? 'acorde' : 'acordes'
  }${bpm}`;
}

/** Las más recientes primero, que es como se listan y como se recortan. */
export function sortSongs(songs: readonly Song[]): Song[] {
  return [...songs].sort((a, b) => b.updatedAt - a.updatedAt);
}
