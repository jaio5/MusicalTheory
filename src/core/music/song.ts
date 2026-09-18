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
import { esEspecieDeBloque, type EspecieDeBloque } from './chords';
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

/**
 * Qué papel hace una parte dentro de la canción.
 *
 * Hasta ahora una parte solo tenía nombre, y el nombre era texto libre: «Parte
 * 2», «lo del puente», «asdf». Eso vale para encontrarla en una lista y no vale
 * para nada más. En concreto no vale para lo único que importa aquí, que es que
 * **la IA sepa qué le estás pidiendo**: una estrofa que continúa y un estribillo
 * que tiene que levantar no son la misma petición, y con un nombre libre el
 * modelo solo puede adivinar.
 *
 * `idea` es el que se pone solo, y es un papel de verdad y no un «sin
 * clasificar»: la mayoría de lo que se graba aquí son cuatro compases que
 * todavía no saben dónde van, y forzar a decidirlo antes de tiempo es pedir una
 * decisión que nadie tiene tomada.
 */
export type SectionRole =
  'idea' | 'intro' | 'estrofa' | 'pre' | 'estribillo' | 'puente' | 'solo' | 'final';

export interface Role {
  readonly id: SectionRole;
  /** Cómo se llama en pantalla. */
  readonly name: string;
  /**
   * Qué es, en una frase.
   *
   * Se lee en pantalla **y** se le manda al modelo, igual que `why` en los
   * caminos de `paths.ts`: así lo que entiende quien compone y lo que entiende
   * el modelo salen del mismo sitio y no pueden separarse.
   */
  readonly what: string;
}

/**
 * Los ocho, en el orden en que suelen aparecer en una canción.
 *
 * `idea` va primero por ser el que se pone solo, no por ir primero en la
 * canción. Los otros siete siguen el orden de una canción normal, que es el
 * orden en el que alguien los busca en una lista.
 */
export const ROLES: readonly Role[] = [
  {
    id: 'idea',
    name: 'Una idea',
    what: 'Unos compases que se te han quedado dando vueltas y todavía no saben dónde van.',
  },
  { id: 'intro', name: 'Intro', what: 'Lo que abre la canción y deja puesto el tono.' },
  { id: 'estrofa', name: 'Estrofa', what: 'Cuenta lo que pasa. Se repite con letra distinta.' },
  {
    id: 'pre',
    name: 'Pre-estribillo',
    what: 'El empujón de tres o cuatro compases que deja el estribillo servido.',
  },
  {
    id: 'estribillo',
    name: 'Estribillo',
    what: 'Lo que se canta a gritos: suele ser lo más alto y lo más simple de la canción.',
  },
  {
    id: 'puente',
    name: 'Puente',
    what: 'Se va a otro sitio para que la vuelta al estribillo suene a vuelta.',
  },
  {
    id: 'solo',
    name: 'Solo',
    what: 'Sitio para tocar por encima, casi siempre sobre acordes que ya han sonado.',
  },
  {
    id: 'final',
    name: 'Final',
    what: 'Cómo se cierra: resolviendo, repitiendo hasta apagarse, o cortando en seco.',
  },
];

/** El papel que se pone cuando no se ha dicho nada. */
export const DEFAULT_ROLE: SectionRole = 'idea';

/** Un tramo con nombre: la estrofa, el estribillo, el puente. */
export interface SongSection {
  readonly name: string;
  /**
   * Qué papel hace dentro de la canción.
   *
   * Opcional, y ausente quiere decir `idea`. Las canciones de antes no lo
   * tienen y no están rotas: eran ideas, que es exactamente lo que dice el
   * valor por omisión.
   */
  readonly role?: SectionRole;
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
  /**
   * La especie de cada grado —su séptima, o `quinta`—, en el mismo orden que
   * `degrees`, o nula.
   *
   * Sin esto, un `Fmaj7` se guardaba como `IV` y volvía como un `F`: escribías
   * un acorde, lo guardabas y te devolvían otro. Un bloque sabe guardar su
   * séptima desde que se puede escribir «Am7» en el buscador, y al salir de la
   * aplicación se perdía sin decir nada.
   *
   * Opcional y ausente cuando no hay ninguna, como `sources`: las canciones de
   * antes no lo tienen y no están rotas —eran tríadas—, y leer y volver a
   * guardar sin tocar nada tiene que dar lo mismo.
   */
  readonly especies?: readonly (EspecieDeBloque | null)[];
  /**
   * Compases que ocupa la parte, aunque no estén llenos.
   *
   * Es sitio para escribir, no sonido: una parte de ocho compases con dos
   * acordes suena lo que suenan los dos acordes. Se guarda porque perderlo al
   * reabrir dejaría la partitura encogida a lo que hay dentro.
   */
  readonly bars?: number;
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

/**
 * Lo más larga que puede ser una parte, en compases.
 *
 * Vive aquí y no en `arrangement.ts`, con el resto de lo que usa el montaje,
 * porque es un tope de **lo que se guarda** y este fichero es el que los tiene
 * todos. Ponerlo allí creaba un ciclo —`song` importaba de `arrangement` y
 * `arrangement` de `song`— que ningún test veía y que tiraba la página entera
 * con un `Cannot access 'MAX_SECTIONS' before initialization`.
 *
 * Treinta y dos compases: más que eso no es una parte, es la canción.
 */
export const MAX_BARS = 32;

/** Cuántas canciones guarda una cuenta. Más allá, la lista deja de ser útil. */
export const MAX_SONGS = 50;

/** El nombre que se pone cuando no se ha puesto ninguno. */
export const UNNAMED_SONG = 'Sin título';

/**
 * El nombre de una parte nueva, numerada por su sitio.
 *
 * **Uno solo para el lienzo y para la canción guardada**, aunque cada capa las
 * llame de otra manera. Estuvo escrito dos veces —`defaultPartName` allí y esto
 * aquí, idénticos— y eso no era ahorro de una línea: `nameForRole` decide si un
 * nombre lo puso la aplicación **comparándolo con este**, así que en cuanto los
 * dos se separasen, ponerle papel a una parte del lienzo dejaría de renombrarla
 * y nada lo diría.
 */
export function defaultSectionName(index: number): string {
  return `Parte ${index + 1}`;
}

/**
 * El papel de una parte, con el valor por omisión ya resuelto.
 *
 * Pide lo único que mira y no una `SongSection` entera, porque lo mismo vale
 * para una `Part` del lienzo: las dos guardan el papel igual, y son las dos
 * caras de lo mismo. Pedir la sección obligaría al lienzo a fabricar una falsa
 * con los grados vacíos solo para preguntar.
 */
export function roleOf(section: { readonly role?: SectionRole }): SectionRole {
  return section.role ?? DEFAULT_ROLE;
}

/**
 * Si eso es uno de los ocho papeles.
 *
 * Guarda de tipo y no una comprobación suelta, como `isDay` o `isHeptatonic`: lo
 * preguntan este fichero al leer una canción guardada y el contrato de las
 * salidas al leer una petición, y las dos estaban escribiendo el mismo
 * `ROLES.some(...)` seguido del mismo cast. Con la guarda, TypeScript lo estrecha
 * solo y no hay nada que afirmar a mano.
 */
export function isSectionRole(value: unknown): value is SectionRole {
  return ROLES.some((role) => role.id === value);
}

/** La ficha de un papel. Nunca es nula: un papel desconocido cae en `idea`. */
export function roleInfo(role: SectionRole): Role {
  return ROLES.find((candidate) => candidate.id === role) ?? ROLES[0]!;
}

/**
 * El nombre que le toca a una parte cuando le pones un papel.
 *
 * **Lo que escribiste tú no se pisa nunca.** Solo se cambia el nombre que puso
 * la aplicación sola —«Parte 3»— o el que se dejó vacío, porque ese no es un
 * nombre: es el hueco de un nombre. Renombrar «lo del puente de Marta» a
 * «Estribillo» por tocar un desplegable sería borrar lo único que había escrito
 * una persona.
 *
 * Y al volver a `idea` se vuelve al nombre numerado, que es de donde se venía.
 */
export function nameForRole(current: string, index: number, role: SectionRole): string {
  const puesto = current.trim();
  const automatico =
    puesto === '' ||
    puesto === defaultSectionName(index) ||
    ROLES.some((candidate) => candidate.name === puesto);

  if (!automatico) {
    return current;
  }
  return role === DEFAULT_ROLE ? defaultSectionName(index) : roleInfo(role).name;
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

/** El papel guardado, o `idea`. Un papel retirado se olvida sin romper nada. */
function asRole(value: unknown): SectionRole {
  return isSectionRole(value) ? value : DEFAULT_ROLE;
}

/** De dónde salió cada grado. Lo que no se reconoce se lee como escrito a mano. */
function asSources(value: unknown, cuantos: number): BlockSource[] {
  const crudas = Array.isArray(value) ? value : [];
  return Array.from({ length: cuantos }, (_, indice) => {
    const source = crudas[indice];
    return source === 'heard' || source === 'fixed' ? source : 'written';
  });
}

/** Las especies guardadas, una por grado. Lo que no reconozca, ninguna. */
function asEspecies(value: unknown, cuantos: number): (EspecieDeBloque | null)[] {
  const crudas = Array.isArray(value) ? value : [];
  return Array.from({ length: cuantos }, (_, indice) =>
    esEspecieDeBloque(crudas[indice]) ? crudas[indice] : null,
  );
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
        const role = asRole(record['role']);
        const degrees = asDegrees(record['degrees'], mode);
        const lead = asLead(record['lead']);
        const sources = asSources(record['sources'], degrees.length);
        const especies = asEspecies(record['especies'], degrees.length);
        const bars = record['bars'];

        // Se omite lo que no dice nada, igual que al escribir. Leer y guardar
        // tienen que dar lo mismo, o una canción crecería sola cada vez que se
        // abre y se vuelve a guardar sin tocarla.
        return {
          name: name === '' ? defaultSectionName(index) : name,
          // `idea` se omite por ser el valor por omisión, como el resto de este
          // fichero: leer y volver a guardar tiene que dar lo mismo.
          ...(role === DEFAULT_ROLE ? {} : { role }),
          degrees,
          ...(typeof bars === 'number' && Number.isFinite(bars) && bars > 0
            ? { bars: Math.min(MAX_BARS, Math.round(bars)) }
            : {}),
          ...(lead.length > 0 ? { lead } : {}),
          ...(sources.some((source) => source !== 'written') ? { sources } : {}),
          ...(especies.some((especie) => especie !== null) ? { especies } : {}),
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
