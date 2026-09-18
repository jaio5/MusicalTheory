/**
 * Caminos habituales entre grados, con criterio de rock.
 *
 * Esto no es armonía de coral a cuatro voces: aquí el bVII es tan normal como
 * el V, la dominante muchas veces es menor y nadie exige que la sensible
 * resuelva. Los pesos son frecuencia de uso en el repertorio, no reglas.
 */

import { chordSymbol, triadNotes, type ChordQuality } from './chords';
import { accidentalForKey } from './circle-of-fifths';
import { normalizePitchClass, type PitchClass } from './notes';
import type { KeyMode } from './keys';

/** Grados sobre tonalidad mayor, incluidos los tres prestados de rigor. */
export type MajorDegreeSymbol =
  | 'I'
  | 'ii'
  | 'iii'
  | 'IV'
  | 'V'
  | 'vi'
  | 'vii°'
  | 'bII'
  | 'bIII'
  | 'iv'
  | 'bVI'
  | 'bVII'
  | 'V/ii'
  | 'V/iii'
  | 'V/V'
  | 'V/vi';

/** Grados sobre tonalidad menor, con las dos dominantes y el napolitano. */
export type MinorDegreeSymbol =
  'i' | 'ii°' | 'bII' | 'III' | 'iv' | 'v' | 'V' | 'VI' | 'VII' | 'V/iv' | 'V/V';

export type DegreeSymbol = MajorDegreeSymbol | MinorDegreeSymbol;

interface DegreeShape {
  /** Semitonos de la fundamental sobre la tónica. */
  readonly offset: number;
  readonly quality: ChordQuality;
  /** Por qué se usa, en una frase de músico. */
  readonly role: string;
  /**
   * Si es una dominante secundaria, o sea un acorde que apunta a otro grado.
   *
   * Está marcado porque **no todas las preguntas que se le hacen a esta tabla las
   * admiten**. «¿Qué acorde es este en esta tonalidad?» sí: un E7 en Re menor es
   * la dominante de la dominante. «¿Cuál es el préstamo modal de este grado?» no:
   * un préstamo viene del modo paralelo, y una dominante secundaria no viene de
   * ningún modo. Sin la marca, la rearmonización empezó a contestar `V/iii` a una
   * pregunta que no tiene respuesta, y lo cazaron sus tests.
   */
  readonly secundaria?: boolean;
}

const MAJOR_DEGREES: Readonly<Record<MajorDegreeSymbol, DegreeShape>> = {
  I: { offset: 0, quality: 'major', role: 'Casa.' },
  ii: { offset: 2, quality: 'minor', role: 'Antesala de la dominante.' },
  iii: { offset: 4, quality: 'minor', role: 'Casa en penumbra: comparte dos notas con I.' },
  IV: { offset: 5, quality: 'major', role: 'El otro polo. Con I y V basta para medio repertorio.' },
  V: { offset: 7, quality: 'major', role: 'Tensión que pide volver a I.' },
  vi: { offset: 9, quality: 'minor', role: 'La relativa menor: el mismo material, otro ánimo.' },
  'vii°': {
    offset: 11,
    quality: 'diminished',
    role: 'Poco frecuente en rock; suele sustituirse por V.',
  },
  bII: {
    offset: 1,
    quality: 'major',
    role: 'El napolitano. Sustituye al V por el tritono: comparten las dos notas que aprietan.',
  },
  bIII: {
    offset: 3,
    quality: 'major',
    role: 'Prestado del menor. Sube el riff sin salir del tono.',
  },
  /*
    El cuarto menor, que es el préstamo que más se usa y el único de los cuatro
    que es **menor**: los otros tres —bIII, bVI, bVII— son mayores. La cadencia
    plagal menor `I–iv–I` está en media discografía de los sesenta en adelante, y
    el giro `IV–iv–I` es idioma corriente en pop y en soul
    ([adr/0036](../../../docs/adr/0036-el-cuarto-menor-prestado.md)).
  */
  iv: {
    offset: 5,
    quality: 'minor',
    role: 'El cuarto menor, prestado. El amén que se nubla.',
  },
  bVI: { offset: 8, quality: 'major', role: 'Prestado del menor. Oscurece de golpe.' },
  bVII: { offset: 10, quality: 'major', role: 'El giro mixolidio. Vuelve a I sin sensible.' },
  /*
    Las dominantes secundarias: acordes mayores sobre grados que en la tonalidad
    son menores, y que apuntan al grado siguiente en vez de a la tónica.

    No estaban, y no por olvido: el dominio guardaba solo lo que sale de la
    escala más los prestados. Pero un E7 en Re menor —la dominante de la
    dominante— es idioma corriente en el blues y en cualquier estándar, y sin
    ellas la aplicación decía «ese acorde no existe aquí» a algo que existe.

    **Se distinguen por la especie de la tríada**, que es como `degreeOfChord`
    busca: donde la tonalidad tiene un acorde menor o disminuido, el mayor con
    la misma fundamental está libre y no pisa a nadie. Por eso están estas cuatro
    y no las demás: la del IV es un I mayor con séptima, y esa **solo se
    distingue por la séptima**, que hoy no entra en el cálculo del grado.
  */
  'V/ii': {
    secundaria: true,
    offset: 9,
    quality: 'major',
    role: 'Dominante del ii: lo convierte en llegada.',
  },
  'V/iii': {
    secundaria: true,
    offset: 11,
    quality: 'major',
    role: 'Dominante del iii. Empuja al grado más oscuro.',
  },
  'V/V': {
    secundaria: true,
    offset: 2,
    quality: 'major',
    role: 'Dominante de la dominante: aprieta antes del V.',
  },
  'V/vi': {
    secundaria: true,
    offset: 4,
    quality: 'major',
    role: 'Dominante de la relativa menor.',
  },
};

const MINOR_DEGREES: Readonly<Record<MinorDegreeSymbol, DegreeShape>> = {
  i: { offset: 0, quality: 'minor', role: 'Casa.' },
  'ii°': { offset: 2, quality: 'diminished', role: 'Raro en rock: casi siempre se cambia por iv.' },
  bII: {
    offset: 1,
    quality: 'major',
    role: 'El color frigio. Un semitono por encima de la tónica.',
  },
  III: { offset: 3, quality: 'major', role: 'La relativa mayor: abre sin cambiar de notas.' },
  iv: { offset: 5, quality: 'minor', role: 'El otro polo del menor.' },
  v: { offset: 7, quality: 'minor', role: 'Dominante menor, sin sensible. La del menor natural.' },
  V: {
    offset: 7,
    quality: 'major',
    role: 'Dominante mayor, prestada del menor armónico. Aprieta más.',
  },
  VI: { offset: 8, quality: 'major', role: 'Descanso luminoso dentro del menor.' },
  VII: { offset: 10, quality: 'major', role: 'Escalón hacia i o hacia III.' },
  /*
    Las dos dominantes secundarias que caben en menor sin pisar a nadie.

    `V/V` es el caso que destapó esto: un E7 en Re menor, que resuelve al A7 y de
    ahí a la tónica. `V/iv` es el I mayor del blues menor, que tira al iv.

    Las otras dos que se usarían —la del III y la del VI— caen encima del VII y
    del III, que ya son acordes mayores con esa misma fundamental, así que solo
    se separarían mirando la séptima.
  */
  'V/iv': {
    secundaria: true,
    offset: 0,
    quality: 'major',
    role: 'El I mayor del blues: tira hacia el iv.',
  },
  'V/V': {
    secundaria: true,
    offset: 2,
    quality: 'major',
    role: 'Dominante de la dominante: aprieta antes del V.',
  },
};

export interface DegreeMove {
  readonly to: DegreeSymbol;
  /** Frecuencia de uso, de 0 a 1. Sirve para ordenar sugerencias. */
  readonly weight: number;
  readonly why: string;
}

const MAJOR_MOVES: Readonly<Record<MajorDegreeSymbol, readonly DegreeMove[]>> = {
  I: [
    { to: 'IV', weight: 0.9, why: 'El movimiento más natural del rock.' },
    { to: 'V', weight: 0.85, why: 'Abre tensión de inmediato.' },
    { to: 'vi', weight: 0.8, why: 'El bucle de los cuatro acordes empieza así.' },
    { to: 'bVII', weight: 0.6, why: 'Sale del diatónico sin perder el centro.' },
    { to: 'iii', weight: 0.35, why: 'Cambio de color suave.' },
    { to: 'ii', weight: 0.3, why: 'Camino largo hacia la dominante.' },
  ],
  ii: [
    { to: 'V', weight: 0.9, why: 'El paso clásico hacia la dominante.' },
    { to: 'I', weight: 0.4, why: 'Vuelta directa a casa.' },
    { to: 'IV', weight: 0.35, why: 'Se queda en la zona blanda.' },
  ],
  iii: [
    { to: 'vi', weight: 0.7, why: 'Cae por quintas.' },
    { to: 'IV', weight: 0.6, why: 'Sube un tono y refresca.' },
    { to: 'I', weight: 0.4, why: 'Vuelta a casa.' },
  ],
  IV: [
    { to: 'I', weight: 0.9, why: 'La cadencia plagal, el amén del rock.' },
    { to: 'V', weight: 0.8, why: 'Escalón hacia la tensión máxima.' },
    { to: 'iv', weight: 0.5, why: 'El mismo acorde con la tercera bajada: se nubla de golpe.' },
    { to: 'vi', weight: 0.4, why: 'Sigue el bucle sin volver a casa.' },
    { to: 'bVII', weight: 0.3, why: 'Baja un tono y suena a riff.' },
  ],
  iv: [
    { to: 'I', weight: 0.9, why: 'La cadencia plagal menor: el amén, pero nublado.' },
    { to: 'V', weight: 0.4, why: 'Recupera la tensión después del préstamo.' },
    { to: 'bVII', weight: 0.3, why: 'Sigue por el terreno prestado.' },
  ],
  V: [
    { to: 'I', weight: 0.95, why: 'La resolución esperada.' },
    { to: 'vi', weight: 0.5, why: 'Cadencia rota: promete casa y da la menor.' },
    { to: 'IV', weight: 0.45, why: 'Muy usada en blues, impensable en un coral.' },
  ],
  vi: [
    { to: 'IV', weight: 0.9, why: 'Cierra el bucle de los cuatro acordes.' },
    { to: 'V', weight: 0.5, why: 'Recupera tensión.' },
    { to: 'ii', weight: 0.4, why: 'Cae por quintas.' },
    { to: 'I', weight: 0.35, why: 'Vuelta a casa.' },
  ],
  'vii°': [
    { to: 'I', weight: 0.7, why: 'Resuelve por semitono.' },
    { to: 'V', weight: 0.3, why: 'Se reabsorbe en la dominante.' },
  ],
  bII: [
    { to: 'I', weight: 0.85, why: 'Resuelve por semitono, igual que haría el V.' },
    { to: 'V', weight: 0.3, why: 'Se deshace la sustitución y vuelve la dominante de siempre.' },
  ],
  bIII: [
    { to: 'bVII', weight: 0.7, why: 'Encadena dos prestados y suena a riff mayor.' },
    { to: 'IV', weight: 0.55, why: 'Vuelve al diatónico por el lado blando.' },
    { to: 'I', weight: 0.5, why: 'Regreso brusco y efectivo.' },
  ],
  bVI: [
    { to: 'bVII', weight: 0.8, why: 'Escalón que empuja hacia la tónica.' },
    { to: 'I', weight: 0.5, why: 'Corta el oscurecimiento de golpe.' },
  ],
  bVII: [
    { to: 'I', weight: 0.9, why: 'Cadencia mixolidia: casa sin sensible.' },
    { to: 'IV', weight: 0.6, why: 'Se queda fuera un compás más.' },
    { to: 'bVI', weight: 0.3, why: 'Sigue bajando por tonos.' },
  ],
  /*
    A dónde va una dominante secundaria: **a lo suyo**.

    Se declaran sus salidas y no se tocan las de los demás grados a propósito. El
    que quiera una la escribe, y entonces el dominio ya sabe qué espera de ella;
    meterlas además como propuesta desde cada grado cambiaría lo que la
    aplicación ofrece a quien no las ha pedido, y eso es otra decisión.
  */
  'V/ii': [
    { to: 'ii', weight: 0.95, why: 'Resuelve al ii, que es a lo que apuntaba.' },
    { to: 'V', weight: 0.3, why: 'Se salta el ii y va directo a la dominante.' },
  ],
  'V/iii': [{ to: 'iii', weight: 0.95, why: 'Resuelve al iii, que es a lo que apuntaba.' }],
  'V/V': [
    { to: 'V', weight: 0.95, why: 'Resuelve a la dominante, que es lo que venía a preparar.' },
    { to: 'I', weight: 0.2, why: 'Se salta la dominante y cae en casa.' },
  ],
  'V/vi': [{ to: 'vi', weight: 0.95, why: 'Resuelve a la relativa menor.' }],
};

const MINOR_MOVES: Readonly<Record<MinorDegreeSymbol, readonly DegreeMove[]>> = {
  i: [
    { to: 'VII', weight: 0.9, why: 'El descenso por tonos del rock menor.' },
    { to: 'VI', weight: 0.85, why: 'Abre sin abandonar el ánimo.' },
    { to: 'iv', weight: 0.7, why: 'El otro polo del menor.' },
    { to: 'III', weight: 0.6, why: 'Sale a la relativa mayor.' },
    { to: 'bII', weight: 0.3, why: 'Color frigio, muy directo.' },
    { to: 'V', weight: 0.3, why: 'Prepara una vuelta con más tensión.' },
  ],
  'ii°': [
    { to: 'V', weight: 0.6, why: 'Sirve de antesala si se usa la dominante mayor.' },
    { to: 'i', weight: 0.3, why: 'Vuelta directa.' },
  ],
  bII: [
    { to: 'i', weight: 0.9, why: 'Resuelve bajando un semitono. La cadencia frigia.' },
    { to: 'VII', weight: 0.3, why: 'Sigue bajando.' },
  ],
  III: [
    { to: 'VII', weight: 0.7, why: 'Continúa el descenso.' },
    { to: 'VI', weight: 0.6, why: 'Cae por quintas.' },
    { to: 'iv', weight: 0.4, why: 'Vuelve al terreno menor.' },
  ],
  iv: [
    { to: 'i', weight: 0.9, why: 'Cadencia plagal menor.' },
    { to: 'V', weight: 0.5, why: 'Escalón hacia la dominante mayor.' },
    { to: 'v', weight: 0.4, why: 'La misma tensión, sin sensible.' },
    { to: 'VII', weight: 0.35, why: 'Baja al escalón siguiente.' },
  ],
  v: [
    { to: 'i', weight: 0.85, why: 'Resolución modal, sin sensible.' },
    { to: 'iv', weight: 0.35, why: 'Alarga la zona blanda.' },
  ],
  V: [
    { to: 'i', weight: 0.95, why: 'Resolución con sensible: la más tensa del menor.' },
    { to: 'VI', weight: 0.4, why: 'Cadencia rota en menor.' },
  ],
  VI: [
    { to: 'VII', weight: 0.85, why: 'El escalón previo a la vuelta.' },
    { to: 'III', weight: 0.4, why: 'Cae por quintas hacia la relativa mayor.' },
    { to: 'i', weight: 0.4, why: 'Vuelta directa.' },
  ],
  VII: [
    { to: 'i', weight: 0.9, why: 'Cierra el descenso.' },
    { to: 'III', weight: 0.5, why: 'Sube a la relativa mayor.' },
    { to: 'VI', weight: 0.4, why: 'Se queda dando vueltas fuera de casa.' },
  ],
  /* Las mismas dos salidas de siempre: cada dominante secundaria va a lo suyo. */
  'V/iv': [{ to: 'iv', weight: 0.95, why: 'Resuelve al iv, que es a lo que apuntaba.' }],
  'V/V': [
    { to: 'V', weight: 0.95, why: 'Resuelve a la dominante mayor, que es lo que preparaba.' },
    { to: 'v', weight: 0.4, why: 'Cae en la dominante menor, sin sensible.' },
  ],
};

export interface ProgressionTemplate {
  readonly id: string;
  readonly name: string;
  readonly mode: KeyMode;
  readonly degrees: readonly DegreeSymbol[];
  readonly note: string;
}

export const PROGRESSIONS: readonly ProgressionTemplate[] = [
  {
    id: 'four-chords',
    name: 'El bucle de cuatro acordes',
    mode: 'major',
    degrees: ['I', 'V', 'vi', 'IV'],
    note: 'Funciona siempre y por eso cansa. Buen punto de partida, mal punto de llegada.',
  },
  {
    id: 'rock-and-roll',
    name: 'Rock and roll',
    mode: 'major',
    degrees: ['I', 'IV', 'V'],
    note: 'Tres acordes y una actitud.',
  },
  {
    id: 'mixolydian-riff',
    name: 'Giro mixolidio',
    mode: 'major',
    degrees: ['I', 'bVII', 'IV'],
    note: 'El bVII evita la sensible y deja el riff a medio camino entre mayor y menor.',
  },
  {
    id: 'twelve-bar-blues',
    name: 'Blues de doce compases',
    mode: 'major',
    degrees: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
    note: 'Un compás por grado. El último V es el giro que reengancha.',
  },
  {
    id: 'minor-descent',
    name: 'Descenso menor',
    mode: 'minor',
    degrees: ['i', 'VII', 'VI', 'VII'],
    note: 'La escalera de bajada de medio rock de los setenta.',
  },
  {
    id: 'andalusian',
    name: 'Cadencia andaluza',
    mode: 'minor',
    degrees: ['i', 'VII', 'VI', 'V'],
    note: 'Igual que la anterior pero cerrando con dominante mayor: aprieta al volver.',
  },
  {
    id: 'minor-plagal',
    name: 'Plagal menor',
    mode: 'minor',
    degrees: ['i', 'iv', 'i', 'v'],
    note: 'Se mueve poco y aguanta mucho: buena base para una letra larga.',
  },
];

export interface ResolvedChord {
  readonly degree: DegreeSymbol;
  readonly root: PitchClass;
  readonly quality: ChordQuality;
  readonly symbol: string;
  readonly notes: readonly PitchClass[];
  readonly role: string;
}

function shapeFor(mode: KeyMode, degree: DegreeSymbol): DegreeShape {
  const shape =
    mode === 'major'
      ? MAJOR_DEGREES[degree as MajorDegreeSymbol]
      : MINOR_DEGREES[degree as MinorDegreeSymbol];

  if (shape === undefined) {
    throw new RangeError(`El grado ${degree} no existe en tonalidad ${mode}.`);
  }
  return shape;
}

/** Convierte un grado en un acorde concreto dentro de una tonalidad. */
export function resolveDegree(
  tonic: PitchClass,
  mode: KeyMode,
  degree: DegreeSymbol,
): ResolvedChord {
  const shape = shapeFor(mode, degree);
  const root = normalizePitchClass(tonic + shape.offset);

  return {
    degree,
    root,
    quality: shape.quality,
    // El grado sabe en qué tonalidad vive, así que puede escribirse solo.
    // Un grado que se llama «b» algo se escribe con bemol, valga lo que valga la
    // tonalidad. Sin esto, el bIII de Do mayor salía «D#» y el bVII «A#»: suenan
    // igual y no los reconoce nadie, que es justo lo que este proyecto ya cuida
    // en las afinaciones —la bajada de medio tono es Eb Ab Db Gb Bb Eb—. El
    // nombre del grado ya lleva dentro cómo se escribe; solo había que hacerle
    // caso.
    symbol: chordSymbol(
      root,
      shape.quality,
      degree.startsWith('b') ? 'flat' : accidentalForKey(tonic, mode),
    ),
    notes: triadNotes(root, shape.quality),
    role: shape.role,
  };
}

export function resolveProgression(
  tonic: PitchClass,
  mode: KeyMode,
  degrees: readonly DegreeSymbol[],
): ResolvedChord[] {
  return degrees.map((degree) => resolveDegree(tonic, mode, degree));
}

/** A dónde se suele ir desde un grado, de más a menos frecuente. */
export function nextDegrees(mode: KeyMode, from: DegreeSymbol): DegreeMove[] {
  const moves =
    mode === 'major'
      ? MAJOR_MOVES[from as MajorDegreeSymbol]
      : MINOR_MOVES[from as MinorDegreeSymbol];

  if (moves === undefined) {
    throw new RangeError(`El grado ${from} no existe en tonalidad ${mode}.`);
  }
  return [...moves].sort((a, b) => b.weight - a.weight);
}

/**
 * El mismo grado, dicho en el otro modo.
 *
 * Los dos modos no nombran los mismos grados —en mayor hay `I`, `IV` y `vi`; en
 * menor, `i`, `iv` y `VI`—, así que un montaje escrito en mayor **no se puede
 * leer en menor tal cual**: `resolveDegree` y `nextDegrees` lanzan `RangeError`
 * con un grado que no les toca, y eso reventaba la pantalla entera de componer
 * en cuanto alguien cambiaba de tonalidad con la canción empezada.
 *
 * Se traduce **por función y no por sonido**, que es la regla que ya sigue todo
 * esto: un montaje son grados y el tono lo pone la rueda, así que la casa sigue
 * siendo la casa. El `I` de Do mayor pasa a ser el `i` de La menor: suena otro
 * acorde, sí, pero es que has cambiado de tonalidad; lo que no cambia es que sea
 * el sitio al que todo vuelve.
 *
 * Lo que no tiene contraparte son **tres dominantes secundarias de mayor** —la
 * del ii, la del iii y la del vi—, que caen en grados que el menor no tiene.
 * Esas devuelven `null` y quien llame decide; aquí no se inventa un acorde que
 * nadie ha pedido.
 */
const A_MENOR: Readonly<Partial<Record<MajorDegreeSymbol, MinorDegreeSymbol>>> = {
  I: 'i',
  ii: 'ii°',
  iii: 'III',
  IV: 'iv',
  // El menor tiene las dos dominantes: se conserva la que aprieta, que es la
  // que alguien puso a propósito al escribir `V` en mayor.
  V: 'V',
  vi: 'VI',
  'vii°': 'VII',
  // Los prestados ya eran del menor: allí son grados de pleno derecho y pierden
  // el bemol del nombre, que solo decía «esto viene de fuera».
  bII: 'bII',
  bIII: 'III',
  // El cuarto menor prestado ya **es** el cuarto de la tonalidad menor: mismo
  // acorde y misma función, así que no hay nada que traducir.
  iv: 'iv',
  bVI: 'VI',
  bVII: 'VII',
  'V/V': 'V/V',
};

const A_MAYOR: Readonly<Partial<Record<MinorDegreeSymbol, MajorDegreeSymbol>>> = {
  i: 'I',
  'ii°': 'ii',
  bII: 'bII',
  III: 'bIII',
  iv: 'IV',
  // Las dos dominantes del menor caen en la única que hay en mayor.
  v: 'V',
  V: 'V',
  VI: 'bVI',
  VII: 'bVII',
  'V/V': 'V/V',
  // El I mayor del blues menor es, en mayor, el I de toda la vida.
  'V/iv': 'I',
};

/**
 * Traduce un grado al modo pedido. `null` si ese grado no existe allí.
 *
 * Con el modo que ya tiene devuelve el mismo grado, para que quien llame no
 * tenga que comprobar antes si hay algo que hacer.
 */
export function degreeInMode(degree: DegreeSymbol, to: KeyMode): DegreeSymbol | null {
  /*
    **Lo que ya vale en el modo destino se queda**, y solo se traduce lo que no.

    Es lo que permite que esto se llame siempre y no solo al cambiar de modo, que
    es como lo llama `state/montaje-en-su-modo.ts`: traducir de más tiene que ser
    no hacer nada. Se probó al revés —que la tabla mandara— para que el `iv` de
    una tonalidad menor volviera a mayor como `IV`, y el resultado fue que un
    `iv` prestado escrito en mayor se convertía en `IV` en cuanto se tocaba la
    rueda, o sea que no se podía escribir
    ([adr/0036](../../../docs/adr/0036-el-cuarto-menor-prestado.md)).

    La consecuencia es que un `iv` de menor se queda `iv` al pasar a mayor, y eso
    es lo que ya hace el `vi`: va a `VI` y vuelve como `bVI`. **Suena el mismo
    acorde**, que es el trato de esta traducción desde el principio.
  */
  const tabla = to === 'minor' ? MINOR_DEGREES : MAJOR_DEGREES;
  if (degree in tabla) {
    return degree;
  }
  const traduccion =
    to === 'minor' ? A_MENOR[degree as MajorDegreeSymbol] : A_MAYOR[degree as MinorDegreeSymbol];
  return traduccion ?? null;
}

/**
 * Los siete de la escala, en cada modo.
 *
 * Escritos, y no sacados de las tablas de grados: allí los diatónicos conviven
 * con los prestados y con las dominantes secundarias, y separar unos de otros
 * contando claves o mirando qué empieza por `b` falla justo con el cuarto menor,
 * que es prestado en mayor y de la escala en menor.
 */
const DE_LA_ESCALA: Readonly<Record<KeyMode, readonly DegreeSymbol[]>> = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
};

export function degreesFor(mode: KeyMode): DegreeSymbol[] {
  return mode === 'major'
    ? (Object.keys(MAJOR_DEGREES) as MajorDegreeSymbol[])
    : (Object.keys(MINOR_DEGREES) as MinorDegreeSymbol[]);
}

export function progressionsFor(mode: KeyMode): ProgressionTemplate[] {
  return PROGRESSIONS.filter((progression) => progression.mode === mode);
}

/**
 * Encuentra el grado que corresponde a un acorde ya sonando, para poder
 * sugerir a dónde ir desde ahí. Devuelve null si el acorde no encaja en la
 * tonalidad ni entre los prestados habituales.
 */
/**
 * El grado diatónico de una fundamental, sin mirar de qué calidad es el acorde.
 *
 * Hace falta para las quintas: sin tercera no se sabe si el acorde es mayor o
 * menor, pero **la tonalidad sí lo sabe**. En Do mayor, un `D5` es el `ii`, que
 * es el grado que hay sobre esa fundamental; tocarlo sin tercera no lo cambia de
 * sitio.
 */
export function gradoDeLaFundamental(
  tonic: PitchClass,
  mode: KeyMode,
  root: PitchClass,
): DegreeSymbol | null {
  const candidatos = degreesFor(mode).filter(
    (degree) => resolveDegree(tonic, mode, degree).root === root,
  );

  // Dos grados pueden compartir fundamental —`IV` y el `iv` prestado en mayor,
  // `v` y `V` en menor, `i` y el `V/iv` del blues—, y sin tercera no hay nada en
  // el acorde que los separe. Gana el de la escala: es el que se espera, y el
  // otro contaría un préstamo que nadie ha tocado.
  //
  // Se pregunta por la lista y no se coge «el primero de la tabla»: allí los
  // diatónicos van antes por cómo se escribió, así que la respuesta salía bien
  // por el orden de unas claves, que no es sitio donde dejar una respuesta.
  return candidatos.find((degree) => DE_LA_ESCALA[mode].includes(degree)) ?? candidatos[0] ?? null;
}

export function degreeOfChord(
  tonic: PitchClass,
  mode: KeyMode,
  root: PitchClass,
  quality: ChordQuality,
  /**
   * Si cuentan las dominantes secundarias. Por defecto sí, que es lo que quiere
   * quien escribe un acorde; la rearmonización pide que no, porque pregunta otra
   * cosa. El porqué está en `DegreeShape.secundaria`.
   */
  conSecundarias = true,
): DegreeSymbol | null {
  const offset = normalizePitchClass(root - tonic);
  const table = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;

  for (const [degree, shape] of Object.entries(table)) {
    if (shape.secundaria === true && !conSecundarias) {
      continue;
    }
    if (shape.offset === offset && shape.quality === quality) {
      return degree as DegreeSymbol;
    }
  }
  return null;
}
