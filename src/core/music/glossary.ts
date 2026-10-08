/**
 * El glosario de teoría que se le da al profesor, comprobado contra el dominio.
 *
 * Existe porque el profesor lo sacaba todo de memoria: el prompt le daba la
 * tonalidad y los símbolos de grado y nada más, y un modelo de ocho mil millones
 * contestó que la cadencia perfecta en Do mayor era «C a G a C» y, a la segunda,
 * «F-C». Con una referencia delante, lo que tiene que decir está escrito.
 *
 * **Lo que depende de la tonalidad no está escrito: se calcula.** Cada entrada
 * guarda la definición en grados y la resuelve con las mismas funciones que el
 * resto de la aplicación —`resolveDegree`, `diatonicTriads`, `keySignature`—, así
 * que la cadencia perfecta dice «G → C» en Do mayor y «E → Am» en La menor sin
 * que nadie haya escrito ninguna de las dos. Los intervalos de acordes y escalas
 * salen de `CHORD_SHAPES` y `SCALES`, y el carácter de cada papel, de
 * `HARMONIC_ROLES`: si el dominio lo dice, aquí se dice igual.
 *
 * Y sirve para dos cosas, no para una: para **enseñar** —va en el prompt— y para
 * **comprobar** lo que vuelve, que es `checkAnswerAgainstTheory`. Las entradas con
 * una firma que se puede leer en un texto —las cadencias y la relativa— rechazan
 * la respuesta que las nombra sin decir sus acordes, o diciendo los de otra.
 */

import { CHORD_SHAPES, parseChordSymbol } from './chord-symbols';
import { diatonicTriads, TRIADS } from './chords';
import { keySignature, relativeMajor, relativeMinor, accidentalForKey } from './circle-of-fifths';
import { HARMONIC_ROLES, roleOfDegreeSymbol, substitutionOfDegree } from './harmonic-function';
import { keyName, type KeyMode } from './keys';
import { midiToPitchClass, noteName, normalizePitchClass, type PitchClass } from './notes';
import {
  degreeOfChord,
  gradoDeLaFundamental,
  PROGRESSIONS,
  resolveDegree,
  type DegreeSymbol,
} from './progressions';
import { SCALES } from './scales';
import { keyTonic, parseSpelledName, spellAt, spelledName } from './spelling';
import { MAX_BPM, MIN_BPM } from './tempo';
import { STANDARD_TUNING } from '../instrument/guitar';

/** La tonalidad en la que se resuelve una entrada. */
export interface TheoryKey {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
}

/**
 * Lo que se puede leer en una respuesta para saber si dice lo que tiene que decir.
 *
 * - `cadence`: los acordes en grados. `exact` es la cadencia entera —V → I— y
 *   `endsOn`, dónde acaba la semicadencia, que puede venir de varios sitios.
 * - `relative`: la tonalidad relativa, que se nombra y no se encadena.
 */
export type TheorySignature =
  | {
      readonly kind: 'cadence';
      readonly exact?: Readonly<Record<KeyMode, readonly DegreeSymbol[]>>;
      readonly endsOn?: Readonly<Record<KeyMode, readonly DegreeSymbol[]>>;
    }
  | { readonly kind: 'relative' }
  /** Si se preguntan sus notas, tienen que estar todas: las de `notesOf`. */
  | { readonly kind: 'notes' }
  /** Un acorde que hay que nombrar, por su grado: la dominante, la del V. */
  | { readonly kind: 'chord'; readonly degree: DegreeSymbol }
  /** Cuántas alteraciones lleva, y de cuáles. */
  | { readonly kind: 'key-signature' }
  /** Los acordes de la tonalidad, escritos. */
  | { readonly kind: 'key-chords' }
  /** Los modos, por su nombre. */
  | { readonly kind: 'modes' };

export interface GlossaryEntry {
  readonly id: string;
  /** Cómo se llama al escribirlo en el prompt. */
  readonly title: string;
  /**
   * Los nombres del concepto, ya normalizados: sin tildes y en minúsculas.
   *
   * Buscan en la pregunta y **se reconocen en la respuesta**: una respuesta que
   * nombra «perfecta» está hablando de la perfecta, y entonces tiene que decir
   * sus acordes.
   */
  readonly names: readonly string[];
  /**
   * Otras formas de preguntarlo que no son su nombre —«v i», «2 5 1»—.
   *
   * Solo buscan en la pregunta. En la respuesta no cuentan como nombrarlo: un
   * «IV → I» escrito en mitad de una explicación de la perfecta no es hablar de la
   * plagal, y si contara, la eximiría de la comprobación que la caza.
   */
  readonly aliases?: readonly string[];
  /** Lo que es, sin tonalidad. Breve: cada carácter es un token de cada pregunta. */
  readonly definition: string;
  /** Lo que es en esta tonalidad, calculado. */
  readonly inKey?: (key: TheoryKey) => string;
  readonly signature?: TheorySignature;
  /**
   * Las notas, para comprobar que una respuesta que las da las da todas. Nulo
   * cuando en esa tonalidad no se sabe de cuáles se habla: la pentatónica menor
   * en Do mayor puede ser la de Do o la de su relativa.
   */
  readonly notesOf?: (key: TheoryKey) => readonly PitchClass[] | null;
}

// ---------------------------------------------------------------------------
// Escribir notas: la letra la pone el intervalo, no la tecla.
// ---------------------------------------------------------------------------

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_PITCH: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

/**
 * Cuántas letras sube cada intervalo de un acorde.
 *
 * Una tercera son dos letras aunque mida tres semitonos o cuatro, y por eso el G7
 * de Do es G B D **F** y el E7 de La menor es E **G#** B D: con los doce nombres
 * de `noteName` saldría un Ab, que suena igual y no lo escribe nadie. La quinta
 * disminuida y la aumentada siguen siendo quintas: cuatro letras.
 */
const LETTER_STEP: Readonly<Record<number, number>> = {
  0: 0,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 4,
  7: 4,
  8: 4,
  9: 5,
  10: 6,
  11: 6,
};

/**
 * La altura de una nota escrita, con las alteraciones que lleve.
 *
 * Propia y no `pitchClassFromName` porque aquí salen nombres que aquel no conoce:
 * el séptimo grado de F# mayor es **E#**, y el locrio de F# empieza en él. Y
 * tampoco `parseSpelledName`, que es estricto a propósito: esto lee lo que escribe
 * el modelo, que puede venir en minúscula, y ante la duda tiene que dar una
 * altura y no una excepción.
 */
function pitchOfSpelled(name: string): PitchClass {
  const letter = LETTERS.indexOf(name[0]?.toUpperCase() as (typeof LETTERS)[number]);
  /* v8 ignore next -- solo llegan nombres que empiezan por una de las siete letras */
  const natural = NATURAL_PITCH[letter] ?? 0;
  const sharps = name.split('#').length - 1;
  const flats = name.slice(1).split('b').length - 1;
  return normalizePitchClass(natural + sharps - flats);
}

/**
 * El nombre de la fundamental de un cifrado: `Bb` de `Bbm7`, y `F##` de `F##7`.
 *
 * Con las alteraciones repetidas, porque los acordes se escriben por la letra
 * del grado y la fundamental puede llevar dos. Ninguna especie empieza por `b`,
 * así que no se come la de nadie.
 */
function rootName(symbol: string): string {
  /* v8 ignore next -- todo cifrado del dominio empieza por su fundamental */
  return /^[A-G](?:#+|b+)?/.exec(symbol)?.[0] ?? symbol;
}

/**
 * Las notas que quedan a esos semitonos y esas letras de la fundamental.
 *
 * Con alteraciones dobles cuando hacen falta, que es lo correcto y lo raro: la
 * menor armónica de G# lleva un F##. Lo escribe `spelling.ts`, que es quien
 * escribe también las lecciones: aquí había una copia de la misma regla, y lo que
 * se lee en una unidad y lo que contesta el profesor tienen que salir iguales.
 */
function spell(root: string, semitones: readonly number[], steps: readonly number[]): string[] {
  const from = parseSpelledName(root);
  return semitones.map((semitone, index) => {
    /* v8 ignore start -- quien llama pasa tantas letras como semitonos */
    const step = steps[index] ?? 0;
    /* v8 ignore stop */
    return spelledName(spellAt(from, step, semitone));
  });
}

/** Lo que importa de un cifrado leído: dónde suena la fundamental y sus intervalos. */
interface SpelledChord {
  readonly root: PitchClass;
  readonly intervals: readonly number[];
}

/**
 * Un cifrado leído con la fundamental escrita por su letra: `E#dim`, `Cb`, `F##7`.
 *
 * `parseChordSymbol` solo conoce los doce nombres, y el glosario escribe cada
 * fundamental con la letra de su grado —el vii° de Fa# mayor es `E#dim`—: si el
 * validador no los leyera, rechazaría la respuesta que copia la referencia. Así
 * que la especie se lee sobre una C y la altura sale de la letra.
 */
function readChord(symbol: string): SpelledChord | null {
  const root = rootName(symbol);
  const parsed = parseChordSymbol(`C${symbol.slice(root.length)}`);
  /*
    Nulo con una especie fuera del catálogo, que hoy no llega: los cifrados del
    dominio son todos de él, y el patrón de la respuesta solo deja pasar especies
    que lo son. Se devuelve en vez de lanzar porque esto lee lo que escribe el
    modelo, y una excepción ahí deja la pregunta sin respuesta.
  */
  /* v8 ignore next 3 -- ver arriba: ninguno de los dos llamantes pasa una especie desconocida */
  if (parsed === null) {
    return null;
  }
  return { root: pitchOfSpelled(root), intervals: parsed.shape.intervals };
}

/** Las notas de un cifrado, bien escritas: «G B D F», «E# G# B». */
function chordNotes(symbol: string): string {
  const parsed = readChord(symbol);
  /* v8 ignore next 3 -- aquí solo llegan cifrados que ha escrito el propio dominio */
  if (parsed === null) {
    return symbol;
  }
  const intervals = parsed.intervals;
  return spell(
    rootName(symbol),
    intervals,
    /* v8 ignore start -- las especies que se escriben aquí tienen todos sus intervalos en la tabla */
    intervals.map((interval) => LETTER_STEP[interval] ?? 0),
    /* v8 ignore stop */
  ).join(' ');
}

/** Una escala de siete notas, una letra por grado. */
function heptatonic(root: string, intervals: readonly number[]): string[] {
  return spell(
    root,
    intervals,
    intervals.map((_, index) => index),
  );
}

/** El nombre de la tónica como lo escribe la tonalidad: Bb mayor, no A# mayor. */
function tonicName(tonic: PitchClass, mode: KeyMode): string {
  return noteName(tonic, accidentalForKey(tonic, mode));
}

// ---------------------------------------------------------------------------
// Lo que se calcula de una tonalidad.
// ---------------------------------------------------------------------------

/** Los siete números romanos, en orden: el índice es el grado menos uno. */
const NUMERALES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/**
 * Cuántas letras hay de la tónica a la fundamental de un grado: la del número
 * romano, con bemol o sin él, y en una secundaria la de su destino más cuatro
 * —el V/vi de Do es A, cinco letras por encima de la E del vi—.
 */
function degreeLetterSteps(degree: DegreeSymbol): number {
  const [own, target] = degree.split('/') as [string, string | undefined];
  const steps = (roman: string) =>
    NUMERALES.indexOf(roman.replace(/^b|°$/g, '').toUpperCase() as (typeof NUMERALES)[number]);
  return target === undefined ? steps(own) : steps(target) + 4;
}

/**
 * El acorde de un grado, con la fundamental escrita por la letra del grado.
 *
 * La especie y la altura las pone `resolveDegree`, y la letra el grado: en Fa#
 * mayor el vii° es `E#dim` y no `Fdim`, que es lo que dicen las lecciones y lo que
 * sale al escribir sus notas, E# G# B. Lo prestado igual: el bVII de Db es `Cb`.
 * `resolveDegree` sigue con sus doce nombres porque lo usa componer.
 */
function chord(key: TheoryKey, degree: DegreeSymbol): string {
  const resolved = resolveDegree(key.tonic, key.mode, degree);
  const root = spellAt(
    keyTonic(key.tonic, key.mode),
    degreeLetterSteps(degree),
    resolved.root - key.tonic,
  );
  return `${spelledName(root)}${resolved.symbol.replace(/^[A-G][#b]?/, '')}`;
}

/** El mismo grado con una especie de cuatríada encima: `G7`, `Bm7b5`. */
function withSuffix(key: TheoryKey, degree: DegreeSymbol, suffix: string): string {
  return `${rootName(chord(key, degree))}${suffix}`;
}

/** Los siete grados de la escala —la mayor o la menor natural—, en orden. */
function naturalDegrees(mode: KeyMode): DegreeSymbol[] {
  return diatonicTriads(0, mode === 'major' ? 'major' : 'naturalMinor').map(
    (triad) => triad.roman as DegreeSymbol,
  );
}

/**
 * Los grados de la escala, en orden, y en menor también el V mayor.
 *
 * El V mayor de la menor armónica va al lado del v porque es el que cierra la
 * cadencia perfecta en menor, y sin él la tabla no tendría el acorde del que más
 * se pregunta.
 */
function scaleDegrees(mode: KeyMode): DegreeSymbol[] {
  const romans = naturalDegrees(mode);
  if (mode === 'minor') {
    romans.splice(5, 0, 'V');
  }
  return romans;
}

/** La relativa: el nombre de su tónica y en qué modo está. */
function relativeOf(key: TheoryKey): { readonly tonic: PitchClass; readonly mode: KeyMode } {
  return key.mode === 'major'
    ? { tonic: relativeMinor(key.tonic), mode: 'minor' }
    : { tonic: relativeMajor(key.tonic), mode: 'major' };
}

/** La mayor de la que salen los modos: la propia, o la relativa si es menor. */
function parentMajor(key: TheoryKey): PitchClass {
  return key.mode === 'major' ? key.tonic : relativeMajor(key.tonic);
}

/** Los intervalos, en semitonos y separados por espacios: «0 4 7». */
function semitones(intervals: readonly number[]): string {
  return intervals.join(' ');
}

/** Los intervalos de un sufijo de cifrado, sacados de `CHORD_SHAPES`. */
function shape(suffix: string): string {
  /* v8 ignore next -- los sufijos de aquí están todos en el catálogo, y hay prueba */
  return semitones(CHORD_SHAPES[suffix]?.intervals ?? []);
}

const MAJOR = SCALES.major.intervals;
const NATURAL_MINOR = SCALES.naturalMinor.intervals;
const HARMONIC_MINOR = SCALES.harmonicMinor.intervals;
/** La melódica: la natural con la sexta y la séptima subidas. */
const MELODIC_MINOR: readonly number[] = NATURAL_MINOR.map((interval, index) =>
  index >= 5 ? interval + 1 : interval,
);

/** Los nombres de los intervalos, por semitonos. Se usan para enseñarlos y para nombrarlos. */
const INTERVAL_NAMES: readonly string[] = [
  'unísono',
  '2.ª menor',
  '2.ª mayor',
  '3.ª menor',
  '3.ª mayor',
  '4.ª justa',
  'tritono',
  '5.ª justa',
  '6.ª menor',
  '6.ª mayor',
  '7.ª menor',
  '7.ª mayor',
  'octava',
];

/** «tono, tono, semitono…» de una escala. */
function steps(intervals: readonly number[]): string {
  return (
    [...intervals.slice(1), 12]
      /* v8 ignore start -- el índice es de la propia escala */
      .map((interval, index) => (interval - (intervals[index] ?? 0) === 1 ? 'S' : 'T'))
      /* v8 ignore stop */
      .join(' ')
  );
}

/** Una escala de siete notas sobre una tónica de una tonalidad, escrita. */
function scaleOn(tonic: PitchClass, mode: KeyMode, intervals: readonly number[]): string {
  return heptatonic(tonicName(tonic, mode), intervals).join(' ');
}

/** Las notas de una escala menor sobre la tónica menor que toque: la propia o la relativa. */
function minorTonic(key: TheoryKey): PitchClass {
  return key.mode === 'minor' ? key.tonic : relativeMinor(key.tonic);
}

/** «En A menor» o «En su relativa, A menor», según de quién sea la escala. */
function minorLabel(key: TheoryKey): string {
  return key.mode === 'minor'
    ? keyName(key.tonic, 'minor')
    : `su relativa, ${keyName(relativeMinor(key.tonic), 'minor')}`;
}

function majorLabel(key: TheoryKey): string {
  return key.mode === 'major'
    ? keyName(key.tonic, 'major')
    : `su relativa, ${keyName(relativeMajor(key.tonic), 'major')}`;
}

/**
 * Las alturas de una escala sobre la tónica de la tonalidad, **solo si es suya**.
 *
 * «¿Qué notas tiene la escala mayor?» en La menor puede ser la de La o la de su
 * relativa, y comprobarla contra una de las dos rechazaría la otra. Así que solo se
 * comprueba la que no tiene duda: la mayor en mayor, las menores en menor.
 */
function alturasSiEsDelModo(
  modo: KeyMode,
  intervalos: readonly number[],
): (key: TheoryKey) => readonly PitchClass[] | null {
  return (key) =>
    key.mode === modo
      ? intervalos.map((intervalo) => normalizePitchClass(key.tonic + intervalo))
      : null;
}

/** Las cinco de una pentatónica, sacadas de su escala de siete ya escrita. */
function pick(notes: readonly string[], indices: readonly number[]): string {
  /* v8 ignore next -- los índices son de una escala de siete */
  return indices.map((index) => notes[index] ?? '').join(' ');
}

// ---------------------------------------------------------------------------
// El glosario.
// ---------------------------------------------------------------------------

const CADENCE_PERFECT = {
  major: ['V', 'I'],
  minor: ['V', 'i'],
} as const satisfies Record<KeyMode, readonly DegreeSymbol[]>;
const CADENCE_PLAGAL = {
  major: ['IV', 'I'],
  minor: ['iv', 'i'],
} as const satisfies Record<KeyMode, readonly DegreeSymbol[]>;
const CADENCE_DECEPTIVE = {
  major: ['V', 'vi'],
  minor: ['V', 'VI'],
} as const satisfies Record<KeyMode, readonly DegreeSymbol[]>;
const HALF_CADENCE = {
  major: ['V'],
  minor: ['V', 'v'],
} as const satisfies Record<KeyMode, readonly DegreeSymbol[]>;

/** «V → I: G → C», con los grados y los acordes de la tonalidad. */
function progression(key: TheoryKey, degrees: readonly DegreeSymbol[]): string {
  return `${degrees.join(' → ')}: ${degrees.map((degree) => chord(key, degree)).join(' → ')}`;
}

/** Los siete modos, en el orden de los grados de la mayor. */
const MODES: ReadonlyArray<{
  readonly id: string;
  readonly name: string;
  readonly ordinal: string;
  readonly trait: string;
}> = [
  { id: 'jonico', name: 'jónico', ordinal: 'primer', trait: 'la escala mayor' },
  { id: 'dorico', name: 'dórico', ordinal: 'segundo', trait: SCALES.dorian.character },
  { id: 'frigio', name: 'frigio', ordinal: 'tercer', trait: SCALES.phrygian.character },
  { id: 'lidio', name: 'lidio', ordinal: 'cuarto', trait: 'Mayor con la cuarta aumentada.' },
  { id: 'mixolidio', name: 'mixolidio', ordinal: 'quinto', trait: SCALES.mixolydian.character },
  { id: 'eolico', name: 'eólico', ordinal: 'sexto', trait: 'la menor natural' },
  {
    id: 'locrio',
    name: 'locrio',
    ordinal: 'séptimo',
    trait: 'Segunda menor y quinta disminuida; casi no se usa.',
  },
];

/** Los intervalos de un modo: la mayor empezando en su grado. */
function modeIntervals(degree: number): number[] {
  return MAJOR.map((_, index) => {
    /* v8 ignore next -- el índice da la vuelta dentro de la propia escala */
    const from = MAJOR[(degree + index) % 7] ?? 0;
    /* v8 ignore next -- lo mismo */
    return normalizePitchClass(from - (MAJOR[degree] ?? 0));
  });
}

/** Una frase del dominio, sin el punto final y empezando en minúscula. */
function clause(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1).replace(/\.$/, '')}`;
}

function modeEntry(degree: number): GlossaryEntry {
  /* v8 ignore next -- solo se llama con los siete grados de la mayor */
  const mode = MODES[degree] ?? MODES[0]!;
  return {
    id: `modo-${mode.id}`,
    title: `Modo ${mode.name}`,
    names: [`modo ${normalizeForSearch(mode.name)}`, normalizeForSearch(mode.name)],
    definition: `Escala mayor desde su ${mode.ordinal} grado: ${clause(mode.trait)} (${semitones(modeIntervals(degree))}).`,
    inKey: (key) => {
      const root = heptatonic(tonicName(parentMajor(key), 'major'), MAJOR)[degree] as string;
      return `En ${keyName(parentMajor(key), 'major')} empieza en ${root}: ${heptatonic(root, modeIntervals(degree)).join(' ')}.`;
    },
  };
}

const TONIC = { major: 'I', minor: 'i' } as const satisfies Record<KeyMode, DegreeSymbol>;

/** El acorde de la tónica. */
function home(key: TheoryKey): string {
  return chord(key, TONIC[key.mode]);
}

/** El blues de doce compases del catálogo, en grados. */
function twelveBar(): readonly DegreeSymbol[] {
  /* v8 ignore next -- el catálogo trae el blues */
  return PROGRESSIONS.find((progression) => progression.id === 'twelve-bar-blues')?.degrees ?? [];
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  // --- Cadencias -----------------------------------------------------------
  {
    id: 'cadencia',
    title: 'Cadencia',
    names: ['cadencia', 'tipos de cadencia', 'cadencias'],
    definition: 'Los dos últimos acordes de una frase, que la cierran o la dejan abierta.',
    inKey: (key) => {
      const say = (degrees: Readonly<Record<KeyMode, readonly DegreeSymbol[]>>) =>
        degrees[key.mode].map((degree) => chord(key, degree)).join(' → ');
      return `En ${keyName(key.tonic, key.mode)}: perfecta ${say(CADENCE_PERFECT)}, plagal ${say(CADENCE_PLAGAL)}, rota ${say(CADENCE_DECEPTIVE)}; la semicadencia acaba en ${chord(key, 'V')}.`;
    },
  },
  {
    id: 'cadencia-perfecta',
    /*
      Perfecta **e imperfecta**, en una entrada: las dos son V → I y se diferencian
      en cómo van colocados los acordes, no en cuáles son. Separadas, la
      imperfecta no la encontraba nadie —«¿qué es una cadencia imperfecta?» caía
      en la entrada general, que no la nombra— y una entrada más con los mismos
      acordes habría pedido a la respuesta las mismas comprobaciones dos veces.
      «Auténtica» es como la llaman los libros en inglés —y algunos de aquí, para
      las dos—, y sigue en el título y entre sus nombres.
    */
    title: 'Cadencia perfecta o auténtica',
    names: [
      'cadencia perfecta',
      'cadencia autentica',
      'cadencia imperfecta',
      'perfecta',
      'autentica',
      'imperfecta',
    ],
    aliases: [
      'v i',
      'v a i',
      'v al i',
      'v va al i',
      'v7 i',
      'dominante a la tonica',
      'dominante a tonica',
    ],
    definition: 'V → I en estado fundamental y con la tónica arriba; si no, imperfecta.',
    inKey: (key) =>
      `En ${keyName(key.tonic, key.mode)}, ${progression(key, CADENCE_PERFECT[key.mode])}, o ${withSuffix(key, 'V', '7')} → ${home(key)}${key.mode === 'minor' ? ', con el V mayor de la armónica' : ''}.`,
    signature: { kind: 'cadence', exact: CADENCE_PERFECT },
  },
  {
    id: 'cadencia-plagal',
    title: 'Cadencia plagal',
    names: ['cadencia plagal', 'plagal', 'cadencia del amen'],
    aliases: ['iv i', 'iv a i', 'iv al i', 'iv va al i', 'amen'],
    definition: 'La subdominante yendo a la tónica: un cierre suave, sin tensión, el del amén.',
    inKey: (key) =>
      `En ${keyName(key.tonic, key.mode)}, ${progression(key, CADENCE_PLAGAL[key.mode])}.`,
    signature: { kind: 'cadence', exact: CADENCE_PLAGAL },
  },
  {
    id: 'cadencia-rota',
    title: 'Cadencia rota, deceptiva o interrumpida',
    names: [
      'cadencia rota',
      'cadencia deceptiva',
      'cadencia interrumpida',
      'cadencia de engano',
      'rota',
      'deceptiva',
      'interrumpida',
    ],
    aliases: ['v vi', 'v a vi', 'v al vi'],
    definition:
      'La dominante que, en vez de ir a la tónica, cae en el sexto grado, que comparte dos notas con ella.',
    inKey: (key) =>
      `En ${keyName(key.tonic, key.mode)}, ${progression(key, CADENCE_DECEPTIVE[key.mode])}.`,
    signature: { kind: 'cadence', exact: CADENCE_DECEPTIVE },
  },
  {
    id: 'semicadencia',
    title: 'Semicadencia',
    names: ['semicadencia', 'media cadencia', 'cadencia suspensiva'],
    definition:
      'Acaba en la dominante y deja la frase abierta, pidiendo seguir. Suele llegar desde la tónica o la subdominante.',
    inKey: (key) => {
      const sub = key.mode === 'major' ? 'IV' : 'iv';
      return `En ${keyName(key.tonic, key.mode)} acaba en ${chord(key, 'V')}: ${home(key)} → ${chord(key, 'V')} o ${chord(key, sub)} → ${chord(key, 'V')}.`;
    },
    signature: { kind: 'cadence', endsOn: HALF_CADENCE },
  },

  // --- Funciones -----------------------------------------------------------
  {
    id: 'funciones',
    title: 'Funciones armónicas',
    names: ['funcion armonica', 'funciones armonicas', 'funcion', 'armonia funcional'],
    aliases: ['t s d'],
    definition: `Tres papeles: tónica (${clause(HARMONIC_ROLES.tonic.what.split('.')[0] as string)}), subdominante (${clause(HARMONIC_ROLES.subdominant.what.split('.')[0] as string)}) y dominante (${clause(HARMONIC_ROLES.dominant.what.split('.')[0] as string)}).`,
    inKey: (key) => `En ${keyName(key.tonic, key.mode)}: ${byRole(key, '; ')}.`,
  },
  {
    id: 'tonica',
    title: 'Tónica',
    names: ['tonica', 'acorde de tonica', 'funcion de tonica'],
    definition: `El primer grado, la casa. ${HARMONIC_ROLES.tonic.what}`,
    inKey: (key) => {
      const others = scaleDegrees(key.mode)
        .slice(1)
        .filter((degree) => roleOfDegreeSymbol(degree) === 'tonic')
        .map((degree) => chord(key, degree));
      return `En ${keyName(key.tonic, key.mode)} es ${home(key)}; ${others.join(' y ')} hacen su papel.`;
    },
  },
  {
    id: 'subdominante',
    title: 'Subdominante',
    names: ['subdominante', 'funcion de subdominante'],
    definition: `El IV. ${HARMONIC_ROLES.subdominant.what} ${HARMONIC_ROLES.subdominant.goes}`,
    inKey: (key) => {
      const [fourth, second] =
        key.mode === 'major' ? (['IV', 'ii'] as const) : (['iv', 'ii°'] as const);
      return `En ${keyName(key.tonic, key.mode)}: ${chord(key, fourth)} (${fourth}) y ${chord(key, second)} (${second}).`;
    },
  },
  {
    id: 'dominante',
    title: 'Dominante',
    names: ['dominante', 'acorde de dominante', 'funcion de dominante', 'quinto grado'],
    definition: `El V. ${HARMONIC_ROLES.dominant.what}`,
    signature: { kind: 'chord', degree: 'V' },
    inKey: (key) =>
      key.mode === 'major'
        ? `En ${keyName(key.tonic, 'major')}: ${chord(key, 'V')} (V), ${withSuffix(key, 'V', '7')} con séptima; ${chord(key, 'vii°')} (vii°) hace su papel.`
        : `En ${keyName(key.tonic, 'minor')}: ${chord(key, 'V')} (V, de la armónica, con sensible) o ${chord(key, 'v')} (v, sin ella); ${chord(key, 'VII')} (VII) también tira a ${home(key)}.`,
  },
  {
    id: 'sustitucion',
    title: 'Sustitución',
    names: ['sustitucion', 'sustituir', 'sustituto', 'acorde sustituto'],
    definition: 'Dos acordes con el mismo papel y dos notas en común se cambian uno por otro.',
    inKey: (key) => {
      const groups = new Map<string, string[]>();
      naturalDegrees(key.mode).forEach((degree, index) => {
        const sub = substitutionOfDegree(key.mode, index);
        if (sub !== null) {
          const target = chord(key, sub.of as DegreeSymbol);
          groups.set(target, [...(groups.get(target) ?? []), chord(key, degree)]);
        }
      });
      const pairs = [...groups].map(([target, subs]) => `${subs.join(' o ')} por ${target}`);
      return `En ${keyName(key.tonic, key.mode)}: ${pairs.join(', ')}.`;
    },
  },
  {
    id: 'sustitucion-tritonal',
    title: 'Sustitución tritonal',
    names: ['sustitucion tritonal', 'sustitucion de tritono', 'tritonal', 'sustituto tritonal'],
    definition:
      'Cambia el V7 por la séptima a un tritono: comparten tercera y séptima, y el bajo baja por semitonos.',
    /*
      El sustituto se nombra por la nota a un tritono de la dominante, con bemol,
      y no por la letra del bII: en Db mayor sería en rigor un Ebb7 y se escribe D7,
      que es como lo cifra todo el mundo y como lo escribe la lección de
      sustituciones. Por eso aquí la fundamental es la de `resolveDegree`.
    */
    inKey: (key) =>
      `En ${keyName(key.tonic, key.mode)}: ${rootName(resolveDegree(key.tonic, key.mode, 'bII').symbol)}7 → ${home(key)} en vez de ${withSuffix(key, 'V', '7')} → ${home(key)}.`,
  },

  // --- Acordes -------------------------------------------------------------
  {
    id: 'triada-mayor',
    title: 'Acorde mayor',
    names: ['acorde mayor', 'acordes mayores', 'triada mayor'],
    definition: `Fundamental, tercera mayor y quinta justa: ${shape('')} semitonos.`,
    inKey: (key) => {
      const majors = ofQuality(key, 'major');
      const first = majors[0] as string;
      return `En ${keyName(key.tonic, key.mode)}: ${first} = ${chordNotes(first)}; los mayores son ${majors.join(', ')}.`;
    },
  },
  {
    id: 'triada-menor',
    title: 'Acorde menor',
    names: ['acorde menor', 'acordes menores', 'triada menor'],
    definition: `Fundamental, tercera menor y quinta justa: ${shape('m')} semitonos.`,
    inKey: (key) => {
      const minors = ofQuality(key, 'minor');
      const first = minors[0] as string;
      return `En ${keyName(key.tonic, key.mode)}: ${first} = ${chordNotes(first)}; los menores son ${minors.join(', ')}.`;
    },
  },
  {
    id: 'disminuido',
    title: 'Acorde disminuido',
    names: ['acorde disminuido', 'disminuido', 'triada disminuida', 'dim'],
    definition: `Fundamental, tercera menor y quinta disminuida: ${shape('dim')} semitonos. Inestable: tira a resolver.`,
    inKey: (key) => {
      const degree = key.mode === 'major' ? 'vii°' : 'ii°';
      const symbol = chord(key, degree);
      return `En ${keyName(key.tonic, key.mode)}: ${symbol} = ${chordNotes(symbol)}, el ${degree}.`;
    },
  },
  {
    id: 'aumentado',
    title: 'Acorde aumentado',
    names: ['acorde aumentado', 'aumentado', 'triada aumentada', 'aug'],
    definition: `Fundamental, tercera mayor y quinta aumentada: ${shape('aug')} semitonos. No está en la mayor; en la menor armónica es el III+.`,
    inKey: (key) => {
      const minor = minorTonic(key);
      const third = diatonicTriads(minor, 'harmonicMinor', accidentalForKey(minor, 'minor'))[2];
      /* v8 ignore next -- la armónica tiene siete grados */
      const symbol = `${rootName(third?.symbol ?? '')}aug`;
      return `En ${keyName(minor, 'minor')} armónica: ${symbol} = ${chordNotes(symbol)}.`;
    },
  },
  {
    id: 'septima-dominante',
    title: 'Séptima de dominante',
    names: [
      'septima de dominante',
      'acorde de septima',
      'acordes de septima',
      'dominante con septima',
      'septima',
    ],
    aliases: ['v7', 'acorde 7'],
    definition: `Tríada mayor con séptima menor (${shape('7')}): el tritono entre su tercera y su séptima pide resolver.`,
    inKey: (key) => {
      const symbol = withSuffix(key, 'V', '7');
      return `En ${keyName(key.tonic, key.mode)}: ${symbol} = ${chordNotes(symbol)}, que resuelve a ${home(key)}.`;
    },
  },
  {
    id: 'maj7',
    title: 'Séptima mayor (maj7)',
    names: ['maj7', 'septima mayor', 'acorde maj7', 'mayor septima', 'acorde de septima mayor'],
    definition: `Tríada mayor con séptima mayor: ${shape('maj7')} semitonos. Suena abierto, sin tensión.`,
    inKey: (key) => {
      const [a, b] = key.mode === 'major' ? (['I', 'IV'] as const) : (['III', 'VI'] as const);
      const first = withSuffix(key, a, 'maj7');
      return `En ${keyName(key.tonic, key.mode)}: ${first} = ${chordNotes(first)} (${a}) y ${withSuffix(key, b, 'maj7')} (${b}).`;
    },
  },
  {
    id: 'm7',
    title: 'Menor séptima (m7)',
    names: ['m7', 'menor septima', 'menor con septima', 'acorde m7'],
    definition: `Tríada menor con séptima menor: ${shape('m7')} semitonos.`,
    inKey: (key) => {
      const degrees: readonly DegreeSymbol[] =
        key.mode === 'major' ? ['ii', 'iii', 'vi'] : ['i', 'iv', 'v'];
      const symbols = degrees.map((degree) => withSuffix(key, degree, 'm7'));
      const first = symbols[0] as string;
      return `En ${keyName(key.tonic, key.mode)}: ${first} = ${chordNotes(first)}, ${symbols.slice(1).join(' y ')}.`;
    },
  },
  {
    id: 'm7b5',
    title: 'Semidisminuido (m7b5 o ø)',
    names: ['m7b5', 'semidisminuido', 'semidisminuida', 'menor septima bemol cinco'],
    definition: `Un disminuido con séptima menor: ${shape('m7b5')} semitonos.`,
    inKey: (key) => {
      if (key.mode === 'major') {
        const symbol = withSuffix(key, 'vii°', 'm7b5');
        return `En ${keyName(key.tonic, 'major')}: ${symbol} = ${chordNotes(symbol)}, el viiø7.`;
      }
      const symbol = withSuffix(key, 'ii°', 'm7b5');
      return `En ${keyName(key.tonic, 'minor')}: ${symbol} = ${chordNotes(symbol)}, el iiø7, que prepara ${withSuffix(key, 'V', '7')} → ${home(key)}.`;
    },
  },
  {
    id: 'suspendido',
    title: 'Acordes sus2 y sus4',
    names: ['sus2', 'sus4', 'acorde suspendido', 'acordes suspendidos', 'suspendido', 'sus'],
    definition: `Sin tercera: la cambian por la 2.ª (sus2, ${shape('sus2')}) o la 4.ª (sus4, ${shape('sus4')}). El sus4 pide volver a la tercera.`,
    inKey: (key) => {
      const tonic = rootName(home(key));
      return `En ${keyName(key.tonic, key.mode)}: ${tonic}sus2 = ${chordNotes(`${tonic}sus2`)}, ${tonic}sus4 = ${chordNotes(`${tonic}sus4`)}.`;
    },
  },
  {
    id: 'power-chord',
    title: 'Power chord',
    names: ['power chord', 'powerchord', 'acorde de quinta', 'acordes de quinta'],
    aliases: ['acorde 5', 'quintas de rock'],
    definition: `El acorde de quinta, escrito con un 5: fundamental y quinta justa sin tercera (${shape('5')}). Ni mayor ni menor: aguanta la distorsión.`,
    inKey: (key) => {
      const roots = [TONIC[key.mode], 'V'] as const;
      return `En ${keyName(key.tonic, key.mode)}: ${roots
        .map((degree) => {
          const symbol = `${rootName(chord(key, degree))}5`;
          return `${symbol} = ${chordNotes(symbol)}`;
        })
        .join(', ')}.`;
    },
  },

  {
    id: 'inversion',
    title: 'Inversión',
    names: [
      'inversion',
      'acorde invertido',
      'primera inversion',
      'segunda inversion',
      'estado fundamental',
    ],
    aliases: ['acorde con barra', 'nota en el bajo'],
    definition:
      'El acorde con otra nota que la fundamental en el bajo: la tercera en primera inversión, la quinta en segunda. Se escribe con barra.',
    inKey: (key) => {
      const tonic = home(key);
      const [, third, fifth] = chordNotes(tonic).split(' ');
      return `En ${keyName(key.tonic, key.mode)}: ${tonic}/${third} y ${tonic}/${fifth}.`;
    },
  },
  {
    id: 'acordes-de-la-tonalidad',
    title: 'Acordes de la tonalidad',
    names: [
      'acordes de la tonalidad',
      'acordes de esta tonalidad',
      'acordes de la escala',
      'acordes diatonicos',
      'acordes tiene',
      'acordes van bien',
    ],
    definition: 'Uno por grado de la escala.',
    inKey: (key) =>
      `En ${keyName(key.tonic, key.mode)}: ${scaleDegrees(key.mode)
        .map((degree) => `${degree} ${chord(key, degree)}`)
        .join(', ')}${key.mode === 'minor' ? ', con el V de la armónica' : ''}.`,
    signature: { kind: 'key-chords' },
  },

  // --- Intervalos ----------------------------------------------------------
  {
    id: 'intervalos',
    title: 'Intervalos',
    names: [
      'intervalo',
      'intervalos',
      'tercera mayor',
      'tercera menor',
      'tercera',
      'quinta justa',
      'quinta',
      'cuarta justa',
      'cuarta',
      'segunda mayor',
      'segunda menor',
      'sexta mayor',
      'sexta menor',
      'octava',
    ],
    aliases: ['cuantos semitonos', 'distancia entre notas'],
    definition: `En semitonos: ${INTERVAL_NAMES.slice(1)
      .map((name, index) => `${name} ${index + 1}`)
      .join(', ')}.`,
  },
  {
    id: 'semitono',
    title: 'Tono y semitono',
    names: ['semitono', 'medio tono', 'tono entero', 'tono y semitono'],
    definition: `Un semitono es un traste; un tono, dos. La escala mayor va ${steps(MAJOR)} (T tono, S semitono).`,
    inKey: (key) => {
      const intervals = key.mode === 'major' ? MAJOR : NATURAL_MINOR;
      const scale = heptatonic(tonicName(key.tonic, key.mode), intervals);
      const halves = [...intervals.slice(1), 12]
        /* v8 ignore start -- el índice es de la propia escala */
        .map((interval, index) => ({ index, size: interval - (intervals[index] ?? 0) }))
        /* v8 ignore stop */
        .filter((step) => step.size === 1)
        .map((step) => `${scale[step.index]}–${scale[(step.index + 1) % 7]}`);
      return `En ${keyName(key.tonic, key.mode)} los semitonos caen en ${halves.join(' y ')}.`;
    },
  },
  {
    id: 'tritono',
    title: 'Tritono',
    names: ['tritono', 'cuarta aumentada', 'quinta disminuida', 'diabolus in musica'],
    definition:
      'Seis semitonos, tres tonos: la cuarta aumentada o la quinta disminuida. Va entre la tercera y la séptima del V7, y por eso tensa.',
    inKey: (key) => {
      const symbol = withSuffix(key, 'V', '7');
      const notes = chordNotes(symbol).split(' ');
      return `En ${keyName(key.tonic, key.mode)}: ${notes[1]}–${notes[3]}, dentro de ${symbol}.`;
    },
  },

  // --- Escalas -------------------------------------------------------------
  {
    id: 'escala-mayor',
    title: 'Escala mayor',
    names: ['escala mayor', 'escalas mayores', 'modo jonico', 'jonico', 'escala jonica'],
    definition: `Siete notas a ${semitones(MAJOR)} semitonos de la tónica: ${steps(MAJOR)} (T tono, S semitono). Es el modo jónico.`,
    signature: { kind: 'notes' },
    notesOf: alturasSiEsDelModo('major', MAJOR),
    inKey: (key) => `En ${majorLabel(key)}: ${scaleOn(parentMajor(key), 'major', MAJOR)}.`,
  },
  {
    id: 'menor-natural',
    title: 'Menor natural',
    names: ['menor natural', 'escala menor natural', 'escala menor', 'modo eolico', 'eolico'],
    definition: `${semitones(NATURAL_MINOR)} semitonos. ${SCALES.naturalMinor.character} Es el modo eólico.`,
    signature: { kind: 'notes' },
    notesOf: alturasSiEsDelModo('minor', NATURAL_MINOR),
    inKey: (key) => `En ${minorLabel(key)}: ${scaleOn(minorTonic(key), 'minor', NATURAL_MINOR)}.`,
  },
  {
    id: 'menor-armonica',
    title: 'Menor armónica',
    names: ['menor armonica', 'escala menor armonica', 'armonica'],
    aliases: ['v mayor', 'dominante mayor'],
    definition: `La natural con la séptima subida (${semitones(HARMONIC_MINOR)}): da sensible y dominante mayor.`,
    signature: { kind: 'notes' },
    notesOf: alturasSiEsDelModo('minor', HARMONIC_MINOR),
    inKey: (key) => {
      const minor = minorTonic(key);
      return `En ${minorLabel(key)}: ${scaleOn(minor, 'minor', HARMONIC_MINOR)}; da ${chord({ tonic: minor, mode: 'minor' }, 'V')} (V) y no ${chord({ tonic: minor, mode: 'minor' }, 'v')}.`;
    },
  },
  {
    id: 'menor-melodica',
    title: 'Menor melódica',
    names: ['menor melodica', 'escala menor melodica', 'melodica'],
    definition: `La natural con la sexta y la séptima subidas al subir (${semitones(MELODIC_MINOR)}); al bajar se suele tocar como la natural.`,
    signature: { kind: 'notes' },
    notesOf: alturasSiEsDelModo('minor', MELODIC_MINOR),
    inKey: (key) => `En ${minorLabel(key)}: ${scaleOn(minorTonic(key), 'minor', MELODIC_MINOR)}.`,
  },
  {
    id: 'pentatonica-menor',
    title: 'Pentatónica menor',
    names: ['pentatonica menor', 'escala pentatonica menor', 'pentatonica'],
    definition: `Escala menor natural sin la 2.ª ni la 6.ª (${semitones(SCALES.minorPentatonic.intervals)}). ${SCALES.minorPentatonic.character.split('.')[0]}.`,
    signature: { kind: 'notes' },
    notesOf: alturasSiEsDelModo('minor', SCALES.minorPentatonic.intervals),
    inKey: (key) => {
      const notes = heptatonic(tonicName(minorTonic(key), 'minor'), NATURAL_MINOR);
      return `En ${minorLabel(key)}: ${pick(notes, [0, 2, 3, 4, 6])}${key.mode === 'major' ? `, las de la pentatónica mayor de ${tonicName(key.tonic, 'major')}` : ''}.`;
    },
  },
  {
    id: 'pentatonica-mayor',
    title: 'Pentatónica mayor',
    names: ['pentatonica mayor', 'escala pentatonica mayor'],
    definition: `Escala mayor sin la 4.ª ni la 7.ª (${semitones(SCALES.majorPentatonic.intervals)}). Difícil sonar mal.`,
    signature: { kind: 'notes' },
    notesOf: alturasSiEsDelModo('major', SCALES.majorPentatonic.intervals),
    inKey: (key) => {
      const notes = heptatonic(tonicName(parentMajor(key), 'major'), MAJOR);
      return `En ${majorLabel(key)}: ${pick(notes, [0, 1, 2, 4, 5])}.`;
    },
  },
  {
    id: 'blues',
    title: 'Escala de blues',
    names: ['escala de blues', 'escala blues', 'blue note', 'nota de blues'],
    aliases: ['quinta bemol'],
    definition: `${SCALES.blues.character.slice(0, -1)}: ${semitones(SCALES.blues.intervals)}.`,
    signature: { kind: 'notes' },
    notesOf: (key) =>
      SCALES.blues.intervals.map((intervalo) => normalizePitchClass(key.tonic + intervalo)),
    inKey: (key) => {
      const tonic = tonicName(key.tonic, key.mode);
      const minor = heptatonic(tonic, NATURAL_MINOR);
      const flatFive = spell(tonic, [6], [4])[0] as string;
      return `Sobre ${tonic}: ${pick(minor, [0, 2, 3])} ${flatFive} ${pick(minor, [4, 6])}.`;
    },
  },

  // --- Modos ---------------------------------------------------------------
  {
    id: 'modos',
    title: 'Los siete modos',
    names: ['modos', 'modo', 'modos griegos', 'siete modos', 'modos de la escala mayor'],
    definition: 'La escala mayor empezando en cada uno de sus siete grados.',
    signature: { kind: 'modes' },
    inKey: (key) => {
      const notes = heptatonic(tonicName(parentMajor(key), 'major'), MAJOR);
      return `En ${keyName(parentMajor(key), 'major')}: ${MODES.map((mode, index) => `${notes[index]} ${mode.name}`).join(', ')}.`;
    },
  },
  modeEntry(1),
  modeEntry(2),
  modeEntry(3),
  modeEntry(4),
  modeEntry(6),

  // --- Tonalidades ---------------------------------------------------------
  {
    id: 'relativa',
    title: 'Tonalidad relativa',
    names: [
      'relativa',
      'relativo',
      'relativa menor',
      'relativa mayor',
      'tonalidad relativa',
      'tono relativo',
    ],
    definition:
      'Una mayor y una menor con las mismas notas y la misma armadura; la menor, tres semitonos por debajo.',
    inKey: (key) => {
      const relative = relativeOf(key);
      const symbol = home(relative);
      return `La relativa ${relative.mode === 'major' ? 'mayor' : 'menor'} de ${keyName(key.tonic, key.mode)} es ${keyName(relative.tonic, relative.mode)} (${symbol}).`;
    },
    signature: { kind: 'relative' },
  },
  {
    id: 'armadura',
    title: 'Armadura',
    names: ['armadura', 'armadura de clave', 'alteraciones', 'sostenidos', 'bemoles'],
    signature: { kind: 'key-signature' },
    definition:
      'Las alteraciones fijas de la tonalidad. Los sostenidos entran en el orden F C G D A E B, y los bemoles al revés.',
    inKey: (key) => {
      const signature = keySignature(key.tonic, key.mode);
      const count = signature.letters.length;
      if (count === 0) {
        return `${keyName(key.tonic, key.mode)} no lleva alteraciones.`;
      }
      const sharp = signature.accidental === 'sharp';
      const word = sharp ? 'sostenido' : 'bemol';
      const plural = count === 1 ? word : `${word}${sharp ? 's' : 'es'}`;
      return `${keyName(key.tonic, key.mode)} lleva ${count} ${plural}: ${signature.letters.map((letter) => `${letter}${sharp ? '#' : 'b'}`).join(' ')}.`;
    },
  },
  {
    id: 'circulo-de-quintas',
    title: 'Círculo de quintas',
    names: ['circulo de quintas', 'rueda de quintas', 'circulo de cuartas', 'circulo', 'rueda'],
    definition:
      'Las doce tonalidades a quintas: cada paso suma un sostenido o un bemol, y las vecinas comparten seis notas.',
    inKey: (key) => {
      // Con la alteración de esta tonalidad: la quinta de arriba de F# es C#, y
      // `keyName` la llamaba «Db mayor».
      const accidental = accidentalForKey(key.tonic, key.mode);
      const [up, down] = [7, 5].map((step) =>
        noteName(normalizePitchClass(key.tonic + step), accidental),
      );
      const modo = key.mode === 'major' ? 'mayor' : 'menor';
      return `Vecinas de ${keyName(key.tonic, key.mode)}: ${up} ${modo} y ${down} ${modo}.`;
    },
  },
  {
    id: 'grados',
    title: 'Grados',
    names: ['grado', 'grados', 'numeros romanos', 'cifrado romano', 'cifrado en grados'],
    definition:
      'El acorde por su sitio en la escala, en números romanos: mayúscula si es mayor, minúscula si es menor y ° si es disminuido.',
  },
  {
    id: 'sensible',
    title: 'Sensible',
    names: ['sensible', 'nota sensible', 'septimo grado', 'septima nota'],
    definition:
      'La séptima nota a medio tono de la tónica, que tira hacia ella. En menor la pone la armónica.',
    inKey: (key) => {
      const tonic = tonicName(key.tonic, key.mode);
      if (key.mode === 'major') {
        return `En ${keyName(key.tonic, 'major')}: ${heptatonic(tonic, MAJOR)[6]} → ${tonic}.`;
      }
      return `En ${keyName(key.tonic, 'minor')}: ${heptatonic(tonic, HARMONIC_MINOR)[6]} → ${tonic}, de la armónica; la natural tiene ${heptatonic(tonic, NATURAL_MINOR)[6]}.`;
    },
  },

  // --- Progresiones --------------------------------------------------------
  {
    id: 'ii-v-i',
    title: 'ii–V–I',
    names: ['ii v i', 'dos cinco uno', 'segundo quinto primero'],
    aliases: ['2 5 1', 'ii v', 'ii v7 i', 'ii7 v7 i'],
    definition: 'El ii prepara al V y el V resuelve al I, con el bajo cayendo por quintas.',
    inKey: (key) =>
      key.mode === 'major'
        ? `En ${keyName(key.tonic, 'major')}: ${progression(key, ['ii', 'V', 'I'])}; con séptimas, ${withSuffix(key, 'ii', 'm7')} → ${withSuffix(key, 'V', '7')} → ${withSuffix(key, 'I', 'maj7')}.`
        : `En ${keyName(key.tonic, 'minor')}: ${progression(key, ['ii°', 'V', 'i'])}; con séptimas, ${withSuffix(key, 'ii°', 'm7b5')} → ${withSuffix(key, 'V', '7')} → ${home(key)}.`,
  },
  {
    id: 'dominante-secundaria',
    title: 'Dominante secundaria',
    names: ['dominante secundaria', 'dominantes secundarias'],
    definition:
      'Un acorde mayor, a menudo con séptima, que hace de V de un grado que no es la tónica: V/x.',
    inKey: (key) => {
      const secondaries: readonly DegreeSymbol[] =
        key.mode === 'major' ? ['V/V', 'V/ii', 'V/vi'] : ['V/V', 'V/iv'];
      const list = secondaries.map(
        (degree) =>
          `${withSuffix(key, degree, '7')} (${degree}) → ${chord(key, degree.split('/')[1] as DegreeSymbol)}`,
      );
      return `En ${keyName(key.tonic, key.mode)}: ${list.join(', ')}.`;
    },
  },
  {
    id: 'dominante-de-la-dominante',
    title: 'Dominante de la dominante (V/V)',
    names: ['dominante de la dominante', 'quinto del quinto'],
    aliases: ['v v', 'v de v', 'v del v', 'v7 v'],
    definition: 'El V del V: un acorde mayor, casi siempre con séptima, que lleva a la dominante.',
    inKey: (key) =>
      `En ${keyName(key.tonic, key.mode)}: ${withSuffix(key, 'V/V', '7')} → ${withSuffix(key, 'V', '7')} → ${home(key)}.`,
    signature: { kind: 'chord', degree: 'V/V' },
  },
  {
    id: 'prestado',
    title: 'Acorde prestado',
    names: [
      'acorde prestado',
      'acordes prestados',
      'prestado',
      'intercambio modal',
      'prestamo modal',
      'mixtura modal',
      'prestamo',
    ],
    aliases: ['bvii', 'biii', 'bvi', 'iv menor'],
    definition: 'Uno que viene del modo paralelo, el de la misma tónica: en mayor, los del menor.',
    inKey: (key) => {
      if (key.mode === 'major') {
        const borrowed: readonly DegreeSymbol[] = ['iv', 'bIII', 'bVI', 'bVII'];
        return `En ${keyName(key.tonic, 'major')}: ${borrowed.map((degree) => `${chord(key, degree)} (${degree})`).join(', ')}.`;
      }
      // El paralelo se nombra con la misma tónica: `keyName` llamaba «Db mayor»
      // al de C# menor, y su V no es G# sino Ab.
      return `En ${keyName(key.tonic, 'minor')}, sobre todo el V mayor, ${chord(key, 'V')}, que es el de ${tonicName(key.tonic, 'minor')} mayor.`;
    },
  },
  {
    id: 'modulacion',
    title: 'Modulación',
    names: [
      'modulacion',
      'modular',
      'cambiar de tonalidad',
      'cambio de tonalidad',
      'cambiar de tono',
    ],
    definition:
      'Cambiar de tónica a mitad de canción. Lo más suave es ir a una vecina del círculo entrando por su V.',
    inKey: (key) => {
      const [up, down] = [7, 5].map((step) => normalizePitchClass(key.tonic + step));
      const viaV = (tonic: PitchClass) =>
        `${keyName(tonic, key.mode)} por ${rootName(chord({ tonic, mode: key.mode }, 'V'))}7`;
      return `Desde ${keyName(key.tonic, key.mode)}: a ${viaV(up as PitchClass)}, o a ${viaV(down as PitchClass)}.`;
    },
  },
  {
    id: 'blues-de-doce',
    title: 'Blues de doce compases',
    names: [
      'blues de doce compases',
      'blues de 12 compases',
      'doce compases',
      'progresion de blues',
      'blues',
    ],
    aliases: ['12 compases', 'doce de blues'],
    definition: `${twelveBar().join(' ')}, un compás por grado, a menudo todos con séptima.`,
    inKey: (key) =>
      key.mode === 'minor'
        ? `En ${keyName(key.tonic, 'minor')}, igual con ${home(key)}, ${chord(key, 'iv')} y ${withSuffix(key, 'V', '7')}: i, iv y V.`
        : `En ${keyName(key.tonic, 'major')}: ${twelveBar()
            .map((degree) => chord(key, degree))
            .join(' ')}.`,
  },

  // --- Ritmo ---------------------------------------------------------------
  {
    id: 'compas',
    title: 'Compás',
    names: ['compas', 'compases', 'metrica', 'compas binario', 'compas ternario'],
    aliases: ['4 4', '3 4', '6 8', '12 8'],
    definition:
      'Agrupa los pulsos: 4/4 son cuatro negras por compás, 3/4 tres, que es el vals, y 6/8 dos pulsos de tres corcheas.',
  },
  {
    id: 'tempo',
    title: 'Tempo',
    names: ['tempo', 'bpm', 'pulsos por minuto', 'pulsaciones por minuto', 'velocidad', 'pulso'],
    aliases: ['metronomo'],
    definition: `La velocidad del pulso, en pulsos por minuto (BPM): 60 es uno por segundo y 120, dos. El metrónomo de aquí va de ${MIN_BPM} a ${MAX_BPM}.`,
  },
  {
    id: 'figuras',
    title: 'Figuras',
    names: ['figura', 'negra', 'blanca', 'redonda', 'corchea', 'semicorchea', 'figuras musicales'],
    definition:
      'Lo que dura una nota. En 4/4 la negra es un pulso; la blanca, dos; la redonda, cuatro; la corchea, medio, y la semicorchea, un cuarto.',
  },
  {
    id: 'sincopa',
    title: 'Síncopa',
    names: ['sincopa', 'sincopado', 'contratiempo', 'a contratiempo'],
    definition:
      'Acentuar una parte débil alargándola sobre la fuerte, para que el golpe llegue antes de tiempo. A contratiempo es tocar solo en las débiles.',
  },

  // --- La aplicación -------------------------------------------------------
  // Lo que se pregunta de la aplicación también es del profesor: el prompt de
  // sistema lo cuenta como `musica`. Sin esto el modelo no sabía nada de ella y o
  // lo rechazaba como fuera de tema o se lo inventaba —«sí, puedes grabar
  // vídeo»—. Lo que dice cada una está en CLAUDE.md y en su ADR.
  {
    id: 'afinar',
    title: 'Afinar',
    names: ['afinar', 'afino', 'afinador', 'afinacion', 'afinacion estandar', 'afinar la guitarra'],
    definition: `En Afinar, toca una cuerda al aire: dice qué nota oye y cuántos cents le sobran o le faltan. La estándar, de la sexta a la primera: ${STANDARD_TUNING.map(
      (cuerda) => noteName(midiToPitchClass(cuerda.midi)),
    ).join(' ')}.`,
  },
  {
    id: 'grabar',
    title: 'Grabar',
    names: ['grabar', 'grabo', 'grabarme', 'grabacion', 'video', 'grabar video'],
    definition:
      'En Componer, el papel «Solo grabar» guarda el sonido de lo que tocas y te lo descargas. No graba vídeo, y el audio no sale de tu equipo.',
  },
  {
    id: 'tu-audio',
    title: 'Tu audio',
    names: ['sube mi audio', 'sube el audio', 'subir el audio', 'mi audio', 'privacidad'],
    definition:
      'El micro se escucha en tu navegador y el audio no sale de tu equipo: a la IA solo viajan símbolos, como la tonalidad, los grados y tu pregunta.',
  },
  {
    id: 'escribir-tocando',
    title: 'Escribir tocando',
    names: [
      'escriba los acordes',
      'escribir los acordes',
      'reconoce los acordes',
      'reconocer los acordes',
      'detecta los acordes',
      'detectar los acordes',
      'reconoce',
      'reconocer',
      'detecta',
      'detectar',
    ],
    definition:
      'En Componer, en Tocando, eliges rítmica o punteo y el micro escribe lo que suena. Duda con las inversiones, y una nota sola se lee como su acorde mayor.',
  },
  {
    id: 'ensayar',
    title: 'Ensayar',
    names: ['ensayar', 'ensayo', 'ensaya'],
    definition:
      'En Componer, Ensayar toca lo que has escrito contra el metrónomo y te puntúa cómo lo sigues.',
  },
];

/** Los acordes de una especie que hay en la escala, en orden de grado. */
function ofQuality(key: TheoryKey, quality: 'major' | 'minor'): string[] {
  return scaleDegrees(key.mode)
    .filter((degree) => resolveDegree(key.tonic, key.mode, degree).quality === quality)
    .map((degree) => chord(key, degree));
}

/** Los grados de la escala agrupados por papel: «tónica C, Em, Am; …». */
function byRole(key: TheoryKey, separator: string): string {
  return (['tonic', 'subdominant', 'dominant'] as const)
    .map(
      (role) =>
        `${HARMONIC_ROLES[role].name.toLowerCase()} ${scaleDegrees(key.mode)
          .filter((degree) => roleOfDegreeSymbol(degree) === role)
          .map((degree) => chord(key, degree))
          .join(', ')}`,
    )
    .join(separator);
}

// ---------------------------------------------------------------------------
// Buscar en la pregunta.
// ---------------------------------------------------------------------------

/**
 * Minúsculas, sin tildes y con todo lo que no sea letra o número convertido en
 * un espacio: «¿Qué es el ii–V–I?» queda «que es el ii v i».
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Lo que se escribe abreviado en un mensaje, por lo que es: «q es», «d esta», «xq».
 *
 * Sin esto, «el círculo d quintas» no era el círculo de quintas. Van las que se
 * escriben de verdad en un móvil y ninguna que pueda ser otra palabra.
 */
const ABREVIATURAS: Readonly<Record<string, string>> = {
  q: 'que',
  k: 'que',
  ke: 'que',
  xq: 'por que',
  pq: 'por que',
  porq: 'por que',
  d: 'de',
  tb: 'tambien',
  tmb: 'tambien',
};

/**
 * La raíz con la que se comparan singular y plural: «acordes» y «acorde», «menores»
 * y «menor», «compases» y «compás».
 *
 * No es gramática, es una regla que da **lo mismo a las dos formas**, que es lo
 * único que hace falta para compararlas: se quitan la `s` final, una `e` detrás de
 * consonante y otra `s`. «compás» se queda en «compa» igual que «compases». Las
 * palabras de cuatro letras o menos no se tocan: «tres», «dos» y «mas» no son
 * plurales de nada.
 */
function raiz(palabra: string): string {
  if (palabra.length <= 4) {
    return palabra;
  }
  return palabra
    .replace(/s$/, '')
    .replace(/([^aeiou])e$/, '$1')
    .replace(/s$/, '');
}

/** Las palabras de un texto, ya normalizadas, sin abreviaturas y en su raíz. */
function palabras(texto: string): string[] {
  return normalizeForSearch(texto)
    .split(' ')
    .filter(Boolean)
    .flatMap((palabra) => (ABREVIATURAS[palabra] ?? palabra).split(' '))
    .map(raiz);
}

/**
 * Cuántas letras hay que cambiar, quitar, poner o dar la vuelta para ir de una
 * palabra a otra. Con el cambio de orden de dos letras seguidas, que es la falta
 * más corriente al teclear: «cadnecia».
 */
function distancia(a: string, b: string): number {
  const filas = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      /* v8 ignore start -- los índices son de la propia tabla */
      const fila = filas[i] as number[];
      const anterior = filas[i - 1] as number[];
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(
        (anterior[j] ?? 0) + 1,
        (fila[j - 1] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + coste,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        fila[j] = Math.min(fila[j] ?? 0, ((filas[i - 2] as number[])[j - 2] ?? 0) + 1);
      }
      /* v8 ignore stop */
    }
  }
  /* v8 ignore next -- la tabla tiene esa celda */
  return (filas[a.length] as number[])[b.length] ?? 0;
}

/**
 * Las palabras que no se corrigen nunca, aunque se parezcan a una del glosario.
 *
 * Son corrientes y están a una letra de un nombre: corregir «tiempo» a «tempo»
 * metía el tempo en «¿qué tiempo hará mañana?», y la pregunta parecía de música.
 */
const NO_SE_CORRIGEN: ReadonlySet<string> = new Set(
  [
    'tiempo',
    'cuerda',
    'cancion',
    'sonido',
    'musica',
    'guitarra',
    'tocando',
    'tonalidad',
    // «¿cuántas negras…?» no es «cuartas», ni «el cuarto grado» la cuarta justa.
    'cuanto',
    'cuanta',
    'cuantos',
    'cuantas',
    'cuando',
    'segundo',
    'tercero',
    'cuarto',
    'quinto',
    'sexto',
    'septimo',
  ].map(raiz),
);

/** Todas las palabras de todos los nombres: lo que está bien escrito no se corrige. */
let conocidas: ReadonlySet<string> | null = null;
function palabrasConocidas(): ReadonlySet<string> {
  conocidas ??= new Set([
    ...NO_SE_CORRIGEN,
    ...GLOSSARY.flatMap((entry) => [...entry.names, ...(entry.aliases ?? [])].flatMap(palabras)),
  ]);
  return conocidas;
}

/**
 * Si una palabra de la pregunta es la del nombre, o la del nombre mal tecleada.
 *
 * **Solo se corrige lo que no existe**: si la palabra ya es de algún nombre, se
 * compara tal cual. Sin eso, «armonía» —que está en «armonía funcional»— se leía
 * como «armónica», que está a una letra. Y solo palabras largas, a una letra de
 * distancia —a dos si pasan de ocho—: en las cortas, una letra es otra palabra.
 */
function casa(dePregunta: string, delNombre: string, corregir: boolean): boolean {
  if (dePregunta === delNombre) {
    return true;
  }
  if (!corregir || delNombre.length < 6 || dePregunta.length < 5) {
    return false;
  }
  if (palabrasConocidas().has(dePregunta)) {
    return false;
  }
  return distancia(dePregunta, delNombre) <= (delNombre.length >= 9 ? 2 : 1);
}

/**
 * Las palabras de un nombre, calculadas una vez: son siempre los mismos
 * cuatrocientos, y se miran contra cada pregunta.
 */
const palabrasDeNombres = new Map<string, readonly string[]>();
function palabrasDeLaFrase(frase: string): readonly string[] {
  let hechas = palabrasDeNombres.get(frase);
  if (hechas === undefined) {
    hechas = palabras(frase);
    palabrasDeNombres.set(frase, hechas);
  }
  return hechas;
}

/**
 * Dónde dice el texto esa frase, en palabras: de cuál a cuál. Nulo si no la dice.
 *
 * Compara palabra a palabra y en su raíz, así que vale en singular y en plural, con
 * las abreviaturas de un mensaje y —en la pregunta— con faltas de una letra.
 */
function findPhrase(
  texto: readonly string[],
  frase: string,
  corregir: boolean,
): { start: number; end: number } | null {
  const buscada = palabrasDeLaFrase(frase);
  for (let start = 0; start + buscada.length <= texto.length; start += 1) {
    if (
      buscada.every((palabra, indice) => casa(texto[start + indice] as string, palabra, corregir))
    ) {
      return { start, end: start + buscada.length };
    }
  }
  return null;
}

/**
 * Las entradas que contestan a la pregunta, de la que más casa a la que menos.
 *
 * **Gana la frase más larga, y lo que ella cubre no cuenta para nadie más.** En
 * «¿qué es una cadencia perfecta?» casan «cadencia perfecta» y «cadencia», y la
 * segunda es parte de la primera: si contara, la entrada general de las cadencias
 * entraría en el prompt detrás de la perfecta, gastando tokens en decir lo mismo.
 *
 * Como mucho dos, porque cada entrada son tokens de todas las preguntas. Sin
 * ninguna que case no se añade nada: una referencia que no viene a cuento es ruido
 * que el modelo intenta usar.
 *
 * **Y si la pregunta pide las notas de un acorde escrito** —«¿qué notas tiene un
 * G7?», «el acorde de re mayor»—, va primero una entrada hecha para él, con sus
 * notas calculadas (`notasDelAcordeDeLaPregunta`): ningún nombre del glosario la
 * habría encontrado, y es lo que más fácil se dice mal.
 */
export function findTheory(question: string, limit = 2): GlossaryEntry[] {
  return rankTheory(question, limit).map((found) => found.entry);
}

/** Lo mismo, diciendo además si se la nombró o solo se la rozó con un alias. */
function rankTheory(
  question: string,
  limit = 2,
): Array<{ readonly entry: GlossaryEntry; readonly byName: boolean }> {
  const texto = palabras(question);
  const matches = GLOSSARY.flatMap((entry) =>
    [
      ...entry.names.map((phrase) => ({ phrase, byName: true })),
      ...(entry.aliases ?? []).map((phrase) => ({ phrase, byName: false })),
    ].flatMap(({ phrase, byName }) => {
      const span = findPhrase(texto, phrase, true);
      return span === null ? [] : [{ entry, byName, ...span, largo: phrase.length }];
    }),
  ).sort((a, b) => b.largo - a.largo || a.start - b.start);

  const taken: Array<{ start: number; end: number }> = [];
  const score = new Map<GlossaryEntry, { words: number; first: number; byName: boolean }>();
  for (const match of matches) {
    if (taken.some((span) => match.start < span.end && span.start < match.end)) {
      continue;
    }
    taken.push(match);
    const previous = score.get(match.entry);
    score.set(match.entry, {
      words: (previous?.words ?? 0) + match.end - match.start,
      first: Math.min(previous?.first ?? match.start, match.start),
      byName: (previous?.byName ?? false) || match.byName,
    });
  }

  const delAcorde = entradaDelAcorde(question);
  return [
    ...(delAcorde === null ? [] : [{ entry: delAcorde, byName: true }]),
    ...[...score]
      .sort(([, a], [, b]) => b.words - a.words || a.first - b.first)
      .map(([entry, { byName }]) => ({ entry, byName })),
  ].slice(0, limit);
}

/**
 * Lo más larga que puede ser una entrada resuelta, en caracteres.
 *
 * Van hasta dos en cada pregunta, y el presupuesto de tokens del profesor
 * (`TOKEN_BUDGETS.profesor.input`, de donde salen los cupos de todos los planes)
 * se mide con las dos más largas de las veinticuatro tonalidades. Ciento ochenta
 * es lo que cabe sin subirlo: el test del glosario lo exige a cada entrada en cada
 * tonalidad, y `server/prompts.test.ts` suma el peor caso entero.
 */
export const MAX_REFERENCE_LENGTH = 180;

/** Una entrada lista para el prompt: su nombre, lo que es y lo que es aquí. */
export function theoryReference(entry: GlossaryEntry, key: TheoryKey): string {
  const inKey = entry.inKey === undefined ? '' : ` ${entry.inKey(key)}`;
  return `${entry.title}: ${entry.definition}${inKey}`;
}

/**
 * Los acordes de la tonalidad con su papel, en una línea.
 *
 * Va siempre en el prompt del profesor, y es lo que más falta hacía: el modelo
 * tenía los símbolos de grado y tenía que adivinar qué acorde era cada uno. En
 * menor lleva también el V mayor de la armónica, que es el de la cadencia
 * perfecta.
 */
export function keyChordTable(key: TheoryKey): string {
  const groups = (['tonic', 'subdominant', 'dominant'] as const).map(
    (role) =>
      `${HARMONIC_ROLES[role].name}: ${scaleDegrees(key.mode)
        .filter((degree) => roleOfDegreeSymbol(degree) === role)
        .map((degree) => `${degree} ${chord(key, degree)}`)
        .join(', ')}.`,
  );
  return `Acordes de ${keyName(key.tonic, key.mode)}. ${groups.join(' ')}`;
}

// ---------------------------------------------------------------------------
// Leer la respuesta.
// ---------------------------------------------------------------------------

/** Un acorde o un grado escritos en la respuesta, ya en grados de la tonalidad. */
interface Token {
  readonly start: number;
  readonly end: number;
  readonly kind: 'chord' | 'roman';
  /** El grado del acorde en la tonalidad, o nulo si no es de ella. */
  readonly degree: DegreeSymbol | null;
  /** El grado escrito en romanos, sin especie ni mayúsculas: «V», «BVII», «V/V». */
  readonly roman: string | null;
  /** La fundamental de un acorde escrito, si el lector de cifrados lo conoce. */
  readonly root: PitchClass | null;
}

const CHORD_SUFFIX = '(maj7|m7b5|dim7|dim|aug|sus2|sus4|m7|m|7|5|°7|°|ø|\\+)?';
const CHORD_TOKEN = new RegExp(
  `(?<![\\p{L}\\p{N}#/])([A-G][#b]?)${CHORD_SUFFIX}(?![\\p{L}\\p{N}#])`,
  'gu',
);
const ROMAN_TOKEN =
  /(?<![\p{L}\p{N}#/])(b?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(?:°|ø|\+)?(?:7|maj7)?(?:\/(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i))?(?![\p{L}\p{N}#])/gu;
/** Lo que sigue a una tónica cuando es una tonalidad y no un acorde: «C mayor». */
const KEY_AFTER = /^\s+(?:mayor|menor)\b/u;

/**
 * Una nota con su nombre en castellano, y su alteración: «Sol», «si bemol», «Fa#».
 *
 * El signo va pegado y la palabra separada: con un espacio delante de la `b`,
 * «la b» sería también el principio de «la banda».
 */
const SPANISH_NOTE = '([Dd]o|[Rr]e|[Mm]i|[Ff]a|[Ss]ol|[Ll]a|[Ss]i)(#|b|\\s+sostenido|\\s+bemol)?';
const SPANISH_LETTER: Readonly<Record<string, string>> = {
  do: 'C',
  re: 'D',
  mi: 'E',
  fa: 'F',
  sol: 'G',
  la: 'A',
  si: 'B',
};
/** Un acorde con la nota en castellano: «Sol», «Lam», «Si bemol7». */
const SPANISH_CHORD_TOKEN = new RegExp(
  `(?<![\\p{L}\\p{N}#/])${SPANISH_NOTE}${CHORD_SUFFIX}(?![\\p{L}\\p{N}#])`,
  'gu',
);
const ARROW_BEFORE = /(?:→|->|[-–—])\s*$/u;
const ARROW_AFTER = /^\s*(?:→|->|[-–—])/u;
const SENTENCE_START = /(?:^|[.;:!?¿¡\n])\s*$/u;
const FROM_NOTE_TO = new RegExp(`(?:^|[^\\p{L}])de\\s+${SPANISH_NOTE}\\s+a\\s+$`, 'iu');
const TO_NOTE = new RegExp(`^\\s+a\\s+${SPANISH_NOTE}(?![\\p{L}\\p{N}])`, 'iu');

/**
 * El nombre en letras de una nota en castellano: «Bb» de «si bemol».
 *
 * La alteración en palabras pasa a signo, y así la lee `pitchOfSpelled` o el
 * lector de cifrados como cualquier otra.
 */
function spanishToLetter(note: string, accidental: string | undefined): string {
  /* v8 ignore next -- los dos patrones solo dejan pasar los siete nombres */
  const letter = SPANISH_LETTER[note.toLowerCase()] ?? 'C';
  const sign = accidental?.trim().toLowerCase();
  return `${letter}${sign === undefined ? '' : sign === '#' || sign === 'sostenido' ? '#' : 'b'}`;
}

/**
 * Si una nota en castellano está donde va un acorde, y no es una palabra.
 *
 * «la» es un artículo y «si» una conjunción, y los dos van delante de acordes: «la
 * Dm → G → C», «si G va a C». Leídos como acordes alargarían la progresión y la
 * romperían. Por eso cuentan solo junto a una flecha —«sol → do»—, en «de sol a
 * do», o con mayúscula en mitad de una frase, que es como se escribe una nota y
 * no un artículo: «de Sol a Do». Con mayúscula al empezar la frase, «La» y «Si»
 * siguen siendo palabras.
 */
function spanishInChordPlace(text: string, start: number, end: number, note: string): boolean {
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (ARROW_BEFORE.test(before) || ARROW_AFTER.test(after)) {
    return true;
  }
  if (FROM_NOTE_TO.test(before) || (/(?:^|[^\p{L}])de\s+$/iu.test(before) && TO_NOTE.test(after))) {
    return true;
  }
  const capital = note.charAt(0) !== note.charAt(0).toLowerCase();
  return capital && !(SENTENCE_START.test(before) && /^(?:la|si)$/iu.test(note));
}

/** El grado escrito en romanos, como se compara: sin especie y en mayúsculas. */
function romanKey(degree: string): string {
  return degree.replace(/[°ø+]/g, '').toUpperCase();
}

/**
 * El grado de un acorde escrito, en esta tonalidad.
 *
 * Se lee por su altura, como las notas: `E#dim` es el vii° de Fa# mayor, que es
 * como lo escribe el glosario, y `Fdim` también, que suena igual. Nulo si el
 * acorde no es de la tonalidad.
 */
function degreeOfSymbol(parsed: SpelledChord, key: TheoryKey): DegreeSymbol | null {
  const intervals = parsed.intervals;
  const triad = TRIADS.find(
    (candidate) => intervals.includes(candidate.third) && intervals.includes(candidate.fifth),
  );
  return triad === undefined
    ? gradoDeLaFundamental(key.tonic, key.mode, parsed.root)
    : degreeOfChord(key.tonic, key.mode, parsed.root, triad.quality);
}

function chordToken(start: number, end: number, symbol: string, key: TheoryKey): Token {
  const parsed = readChord(symbol);
  return {
    start,
    end,
    kind: 'chord',
    /* v8 ignore start -- el patrón de cifrados solo deja pasar especies del catálogo, y la fundamental se lee por su letra: siempre se entiende */
    degree: parsed === null ? null : degreeOfSymbol(parsed, key),
    root: parsed?.root ?? null,
    /* v8 ignore stop */
    roman: null,
  };
}

/**
 * Los acordes y grados de un texto, en orden. Las tonalidades —«C mayor», «Do
 * mayor»— no son acordes, y se quedan fuera.
 */
function readTokens(text: string, key: TheoryKey): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(CHORD_TOKEN)) {
    const end = match.index + match[0].length;
    if (!KEY_AFTER.test(text.slice(end))) {
      tokens.push(chordToken(match.index, end, match[0], key));
    }
  }
  for (const match of text.matchAll(SPANISH_CHORD_TOKEN)) {
    const [, note, accidental, suffix] = match;
    const end = match.index + match[0].length;
    if (
      !KEY_AFTER.test(text.slice(end)) &&
      spanishInChordPlace(text, match.index, end, note as string)
    ) {
      const symbol = `${spanishToLetter(note as string, accidental)}${suffix ?? ''}`;
      tokens.push(chordToken(match.index, end, symbol, key));
    }
  }
  for (const match of text.matchAll(ROMAN_TOKEN)) {
    const [, flat, numeral, secondary] = match;
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      kind: 'roman',
      degree: null,
      root: null,
      roman: `${flat === 'b' ? 'B' : ''}${(numeral as string).toUpperCase()}${secondary === undefined ? '' : `/${secondary.toUpperCase()}`}`,
    });
  }
  return tokens.sort((a, b) => a.start - b.start);
}

/**
 * Los verbos que dicen que un acorde va a otro. Con uno de ellos, una coma no
 * corta: «G, que resuelve en C» es una progresión, y «C, F, G» son tres acordes
 * sueltos de una lista.
 */
const MOVES_TO = new Set([
  'va',
  'van',
  'resuelve',
  'resuelven',
  'resolviendo',
  'cae',
  'pasa',
  'vuelve',
  'llega',
  'mueve',
]);

/**
 * Las palabras que pueden ir entre dos acordes de una misma progresión escrita.
 *
 * «G → C», «de G a C», «el V va al I», «el G se va al Am». Lo que no está aquí
 * corta la progresión, y también la corta cualquier signo de puntuación salvo la
 * coma con un verbo: «V → I. En C mayor, G → C» son dos progresiones, no una de
 * cuatro.
 *
 * La lista salió de respuestas de verdad del modelo de casa, y la primera vez se
 * quedó corta: sin «se», «el G se va al Am» no era una cadencia rota y la ruta
 * rechazaba dos veces una respuesta buena.
 */
const CONNECTORS = new Set([
  ...MOVES_TO,
  'ir',
  'baja',
  'sube',
  'a',
  'al',
  'hacia',
  'hasta',
  'y',
  'luego',
  'despues',
  'entonces',
  'seguido',
  'que',
  'se',
  'lo',
  'su',
  'un',
  'una',
  'de',
  'del',
  'la',
  'el',
  'en',
  'tonica',
  'dominante',
  'subdominante',
  'acorde',
]);

/**
 * Si el hueco entre dos piezas las une en una progresión.
 *
 * Entre un grado y un acorde, «en» a secas es la tonalidad y no un paso: «V → I en
 * C» es la cadencia en Do, no V → I → I. Con un verbo sí es un paso: «el V
 * resuelve en C».
 */
function joins(gap: string, mixed: boolean): boolean {
  if (/[.;:!?¿¡\n]/u.test(gap)) {
    return false;
  }
  const words = normalizeForSearch(gap).split(' ').filter(Boolean);
  if (words.length > 5 || !words.every((word) => CONNECTORS.has(word))) {
    return false;
  }
  const moves = words.some((word) => MOVES_TO.has(word));
  if (mixed && words.includes('en') && !moves) {
    return false;
  }
  return !gap.includes(',') || moves;
}

/** Un paréntesis sin otro dentro: «(V → I)», «(G7)». */
const ASIDE = /\(([^()]*)\)/gu;

/**
 * Las progresiones escritas en la respuesta: grupos de acordes seguidos.
 *
 * **Un paréntesis justo detrás de un acorde es un aparte**, no la continuación:
 * «G → C (V → I)», «V7 → I (G7 → C)» o «G (V) → C (I)». Lo de dentro se lee como
 * una progresión suya, y la de fuera sigue detrás del paréntesis como si no
 * estuviera. Sin eso, «V → I (G → C)» se leía como cuatro acordes seguidos y no
 * como la cadencia dicha dos veces, y la ruta rechazaba una respuesta buena. Antes
 * solo se saltaba una etiqueta de un único grado o acorde.
 */
function readChains(text: string, key: TheoryKey): Token[][] {
  const tokens = readTokens(text, key);
  const asides: Token[][] = [];
  // Hasta dónde llega cada acorde con su aparte: el hueco hasta el siguiente se
  // mide desde el paréntesis que cierra, y no lleva el aparte dentro.
  const reach = new Map<Token, number>();
  const inAside = new Set<Token>();
  for (const group of text.matchAll(ASIDE)) {
    const open = group.index;
    const close = open + group[0].length;
    const inside = tokens.filter((token) => token.start > open && token.end < close);
    const owner = tokens.filter((token) => token.end <= open).at(-1);
    if (owner === undefined || inside.length === 0 || !/^\s*$/u.test(text.slice(owner.end, open))) {
      continue;
    }
    reach.set(owner, close);
    inside.forEach((token) => inAside.add(token));
    asides.push(...link(text, inside, reach));
  }
  return [
    ...link(
      text,
      tokens.filter((token) => !inAside.has(token)),
      reach,
    ),
    ...asides,
  ];
}

/** Junta en progresiones las piezas seguidas, en el orden del texto. */
function link(text: string, tokens: readonly Token[], reach: ReadonlyMap<Token, number>) {
  const chains: Token[][] = [];
  let previous: Token | null = null;
  for (const token of tokens) {
    const current = chains[chains.length - 1];
    const gap =
      previous === null ? '' : text.slice(reach.get(previous) ?? previous.end, token.start);
    if (previous === null || current === undefined || !joins(gap, previous.kind !== token.kind)) {
      chains.push([token]);
    } else {
      current.push(token);
    }
    previous = token;
  }
  return chains;
}

function isDegree(token: Token | undefined, degree: DegreeSymbol): boolean {
  return (
    token !== undefined &&
    (token.degree === degree || (token.roman !== null && token.roman === romanKey(degree)))
  );
}

/**
 * Si una progresión escrita es la de la firma.
 *
 * La cadencia son los dos últimos acordes, así que vale con algo delante —el
 * ii–V–I acaba en una perfecta—, **salvo que lo de delante sea la propia
 * llegada**: «I a V a I» no es la cadencia perfecta, es ir y volver, y es
 * exactamente lo que contestó el modelo de casa.
 */
function chainMatches(
  chain: readonly Token[],
  signature: Extract<TheorySignature, { kind: 'cadence' }>,
  mode: KeyMode,
): boolean {
  const exact = signature.exact?.[mode];
  if (exact !== undefined) {
    const size = exact.length;
    if (chain.length < size || chain.length > size + 1) {
      return false;
    }
    const tail = chain.slice(chain.length - size);
    const arrives = exact.every((degree, index) => isDegree(tail[index], degree));
    const roundTrip = chain.length > size && isDegree(chain[0], exact[size - 1] as DegreeSymbol);
    return arrives && !roundTrip;
  }
  /* v8 ignore next -- una firma de cadencia trae `exact` o `endsOn` */
  const endsOn = signature.endsOn?.[mode] ?? [];
  const last = chain[chain.length - 1];
  const before = chain[chain.length - 2];
  return (
    chain.length >= 2 &&
    endsOn.some((degree) => isDegree(last, degree) && !isDegree(before, degree))
  );
}

/**
 * «Acaba en G», «llega a C», «termina en el V»: la llegada dicha con un verbo y
 * no con una flecha.
 *
 * Solo vale para la semicadencia, que se define por dónde acaba y no por de dónde
 * viene. Salió de una respuesta buena que se rechazaba —«en F mayor, llega a C
 * desde F o Bb»—, donde la progresión está escrita al revés de como se toca.
 */
const ARRIVES =
  /(?:acaba|termina|llega|cae|para|queda|detiene|reposa|suspende)\p{L}*\s+(?:en|a|al|sobre)(?:\s+(?:el|la|un))?\s*$/u;

function saysItEndsOn(text: string, tokens: readonly Token[], degrees: readonly DegreeSymbol[]) {
  return tokens.some(
    (token) =>
      degrees.some((degree) => isDegree(token, degree)) &&
      ARRIVES.test(text.slice(Math.max(0, token.start - 30), token.start)),
  );
}

/**
 * Si la respuesta nombra la entrada por alguno de sus nombres.
 *
 * Sin corregir faltas: en la pregunta una falta es de quien teclea con prisa, y en
 * la respuesta del modelo una palabra parecida es otra palabra.
 */
function names(texto: readonly string[], entry: GlossaryEntry): boolean {
  return entry.names.some((name) => findPhrase(texto, name, false) !== null);
}

/**
 * «la relativa menor de C mayor es Em», «la relativa de Do mayor es La menor»: la
 * nota que dice que es la relativa.
 *
 * En castellano solo con «mayor» o «menor» detrás: «es la de E menor» no dice que
 * la relativa sea La, y sin ese apoyo el artículo se leería como la nota.
 */
const RELATIVE_CLAIM = new RegExp(
  `relativ\\p{L}*(?:\\s+(?:mayor|menor))?(?:\\s+de\\s+(?:[A-Ga-g][#b]?|${SPANISH_NOTE})(?:\\s+(?:mayor|menor))?)?\\s+(?:es|ser[aá]|ser[ií]a)\\s+(?:(?:el|la|un|una)\\s+)?(?:([A-Ga-g][#b]?)(?![\\p{L}\\p{N}])|${SPANISH_NOTE}(?=\\s+(?:mayor|menor)))`,
  'u',
);

/** Se acepta escrita de las tres maneras: «A menor», «Am» o «La menor». */
const RELATIVE_MENTION: Readonly<Record<KeyMode, RegExp>> = {
  minor: new RegExp(
    `(?<![\\p{L}\\p{N}#])(?:([A-G][#b]?)(?:m(?![\\p{L}\\p{N}])|\\s+menor)|${SPANISH_NOTE}\\s+menor)`,
    'gu',
  ),
  major: new RegExp(
    `(?<![\\p{L}\\p{N}#])(?:([A-G][#b]?)(?:\\s+mayor|(?![\\p{L}\\p{N}#]))|${SPANISH_NOTE}\\s+mayor)`,
    'gu',
  ),
};

/** La nota de una mención: en letras en el primer grupo, o en castellano en los dos siguientes. */
function noteOfMatch(match: RegExpMatchArray, from: number): string {
  return match[from] ?? spanishToLetter(match[from + 1] as string, match[from + 2]);
}

function checkRelative(answer: string, key: TheoryKey): string | null {
  const relative = relativeOf(key);
  // Los dos grupos de la nota de «de C mayor» no se usan: la reclamada va después.
  const claim = RELATIVE_CLAIM.exec(answer);
  if (claim !== null && pitchOfSpelled(noteOfMatch(claim, 3)) !== relative.tonic) {
    return `dice que la relativa es ${noteOfMatch(claim, 3)}`;
  }
  const said = [...answer.matchAll(RELATIVE_MENTION[relative.mode])].some(
    (match) => pitchOfSpelled(noteOfMatch(match, 1)) === relative.tonic,
  );
  return said ? null : 'nombra la relativa sin decir cuál es';
}

/** Una tonalidad nombrada en la pregunta: «en G», «de Sol mayor», «E menor». */
const KEY_IN_QUESTION =
  /(?<![\p{L}\p{N}#])([A-G][#b]?)\s+(?:mayor|menor)\b|(?:^|\s)(?:de|en)\s+([A-G][#b]?)(?![\p{L}\p{N}#])/gu;
const SPANISH_KEY = /\b(do|re|mi|fa|sol|la|si)(?:\s*(#|b|sostenido|bemol))?\s+(?:mayor|menor)\b/giu;

/**
 * Si la pregunta habla de otra tonalidad que la puesta.
 *
 * «¿Cuál es la relativa de G?» con Do mayor puesto se contesta en Sol, y
 * comprobarla contra Do sería rechazar una respuesta buena. Cuando se nombra otra
 * tonalidad no se comprueba nada: callar una comprobación es mejor que un rechazo
 * falso, que deja a quien pregunta sin respuesta.
 */
function asksAboutAnotherKey(question: string, key: TheoryKey): boolean {
  const named = [
    ...[...question.matchAll(KEY_IN_QUESTION)].map((match) =>
      pitchOfSpelled((match[1] ?? match[2]) as string),
    ),
    ...[...question.matchAll(SPANISH_KEY)].map((match) =>
      pitchOfSpelled(spanishToLetter(match[1] as string, match[2])),
    ),
  ];
  return named.some((pitch) => pitch !== key.tonic);
}

/**
 * Comprueba lo que contesta el profesor contra el glosario. Nulo si vale; si no,
 * por qué no.
 *
 * Solo mira las entradas por las que se ha preguntado y que tienen firma, y solo
 * si la pregunta las nombra o las nombra la respuesta: con «¿qué es una cadencia
 * perfecta?» la respuesta habla de ella aunque empiece por «es cuando…», y con
 * «¿por qué el V va al I?» no tiene por qué hablar de ninguna. Entonces:
 *
 * 1. una cadencia tiene que escribir su progresión —«G → C», «V → I»— y no otra
 *    que la contenga dando la vuelta, como «C a G a C», ni la de otra cadencia
 *    sin nombrarla, que es como sale «la perfecta es F-C»;
 * 2. la relativa tiene que decir cuál es, y la que es;
 * 3. si se preguntan las notas de un acorde o de una escala, tienen que estar
 *    todas;
 * 4. la dominante y la del V tienen que nombrar su acorde;
 * 5. la armadura no puede contar otras alteraciones que las suyas;
 * 6. los acordes de la tonalidad tienen que estar escritos, y los modos, nombrados.
 *
 * Y dos que miran la respuesta entera, se haya preguntado lo que se haya
 * preguntado: **un intervalo no puede medir otros semitonos que los suyos**, y **un
 * acorde con su grado al lado tiene que ser ese grado** —«D7 (V/vi)» en Fa mayor
 * es falso, el V/vi es A7—.
 *
 * Lo que no hace: entender la frase. Lee acordes, grados, notas y números
 * escritos, y por eso **acepta de menos antes que rechazar de más** —un rechazo es
 * una pregunta sin respuesta del modelo, y la ruta solo reintenta una vez—. Cuando
 * la pregunta es de otra tonalidad no comprueba nada que dependa de ella.
 */
export function checkAnswerAgainstTheory(
  question: string,
  answer: string,
  key: TheoryKey,
): string | null {
  const otra = asksAboutAnotherKey(question, key);
  const texto = palabras(answer);
  const rank = rankTheory(question);
  const lectura = { question, answer, key, texto, rank, otra };

  return (
    comprobarIntervalos(answer) ??
    comprobarNotas(lectura) ??
    comprobarModos(lectura) ??
    (otra
      ? null
      : (comprobarFirmasDeLaTonalidad(lectura) ??
        comprobarEtiquetas(answer, key) ??
        comprobarLaDominanteDicha(answer, key)))
  );
}

/** Lo que se lee de una pregunta y su respuesta, una vez, para todas las comprobaciones. */
interface Lectura {
  readonly question: string;
  readonly answer: string;
  readonly key: TheoryKey;
  /** La respuesta en palabras, para buscar nombres. */
  readonly texto: readonly string[];
  readonly rank: ReadonlyArray<{ readonly entry: GlossaryEntry; readonly byName: boolean }>;
  /** Si la pregunta es de otra tonalidad que la puesta. */
  readonly otra: boolean;
}

/** Las firmas que dependen de la tonalidad: cadencias, relativa, dominante, armadura, acordes. */
function comprobarFirmasDeLaTonalidad({ answer, key, texto, rank }: Lectura): string | null {
  const cadences = GLOSSARY.filter((entry) => entry.signature?.kind === 'cadence');
  let chains: Token[][] | null = null;

  for (const { entry, byName } of rank) {
    const signature = entry.signature;
    // Por su nombre en la pregunta, la respuesta habla de ella aunque no la
    // nombre. Por un alias —«¿por qué el V va al I?»— no tiene por qué: puede
    // contestar con la sensible sin escribir ninguna cadencia.
    if (signature === undefined) {
      continue;
    }
    // Las cadencias y la relativa, también si solo las nombra la respuesta. El
    // acorde que hay que nombrar, la armadura y los acordes de la tonalidad, solo
    // si se pregunta por ellos: «prepara la dominante» en una respuesta sobre la
    // subdominante no obliga a decir cuál es.
    const soloPreguntada =
      signature.kind === 'chord' ||
      signature.kind === 'key-signature' ||
      signature.kind === 'key-chords';
    if (!(byName || (!soloPreguntada && names(texto, entry)))) {
      continue;
    }
    let fallo: string | null = null;
    switch (signature.kind) {
      case 'relative':
        fallo = checkRelative(answer, key);
        break;
      case 'chord':
        fallo = nombraElAcorde(answer, key, entry, signature.degree);
        break;
      case 'key-signature':
        fallo = cuentaLaArmadura(answer, key);
        break;
      case 'key-chords':
        fallo = escribeLosAcordes(answer, key);
        break;
      case 'cadence': {
        chains ??= readChains(answer, key);
        const arrives =
          signature.endsOn !== undefined &&
          saysItEndsOn(answer, chains.flat(), signature.endsOn[key.mode]);
        if (!arrives && !chains.some((chain) => chainMatches(chain, signature, key.mode))) {
          return `habla de «${entry.title}» sin escribir su progresión`;
        }
        for (const other of cadences) {
          const theirs = other.signature as Extract<TheorySignature, { kind: 'cadence' }>;
          if (
            other !== entry &&
            !names(texto, other) &&
            chains.some((chain) => chainMatches(chain, theirs, key.mode))
          ) {
            return `escribe la progresión de «${other.title}» llamándola «${entry.title}»`;
          }
        }
        break;
      }
      // Las notas y los modos no dependen de la tonalidad, y se miran aparte.
      default:
        break;
    }
    if (fallo !== null) {
      return fallo;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Las notas que se preguntan.
// ---------------------------------------------------------------------------

/** Si la pregunta pide notas: «¿qué notas tiene…?», «¿cómo se forma…?». */
function pideNotas(question: string): boolean {
  return /(?:^| )(?:nota|notas|forma|formado|forman|compone|componen|lleva)(?= |$)/u.test(
    normalizeForSearch(question),
  );
}

/** Las especies de acorde que se escriben bien con una letra por intervalo. */
const ESPECIES_QUE_SE_DELETREAN: ReadonlySet<string> = new Set([
  '',
  'm',
  '5',
  'sus2',
  'sus4',
  '7',
  'maj7',
  'm7',
  'm7b5',
  'dim',
  'aug',
]);

/** Una nota en castellano donde no puede ser otra palabra: delante de mayor, de menor o al final. */
const NOTA_QUE_ACABA = '(?=\\s+(?:mayor|menor)\\b|\\s*[?!.,;:)]|\\s*$)';
const ACORDE_EN_CASTELLANO = new RegExp(
  `acordes?\\s+(?:de\\s+)?${SPANISH_NOTE}(\\s+(?:mayor|menor))?${NOTA_QUE_ACABA}`,
  'giu',
);
const CIFRADO_EN_CASTELLANO = new RegExp(
  `(?<![\\p{L}])(do|re|mi|fa|sol|la|si)(#|b)?(m7b5|maj7|m7|7|dim|aug|sus2|sus4)(?![\\p{L}\\p{N}])`,
  'giu',
);

/**
 * El acorde por el que pregunta, como cifrado: «G7», «D» de «el acorde de re
 * mayor», «Am» de «el acorde de A menor». Nulo si no hay ninguno.
 *
 * «A menor» a secas es la tonalidad y no el acorde; detrás de «acorde de» es el
 * acorde. Y una nota en castellano solo cuenta donde no puede ser una palabra:
 * «el acorde de mi canción» no es el de Mi.
 */
function acordeDeLaPregunta(question: string): string | null {
  const encontrados: Array<{ readonly index: number; readonly symbol: string }> = [];
  for (const match of question.matchAll(CHORD_TOKEN)) {
    const end = match.index + match[0].length;
    const tonalidad = /^\s+(mayor|menor)\b/u.exec(question.slice(end));
    if (tonalidad === null) {
      encontrados.push({ index: match.index, symbol: match[0] });
    } else if (/acordes?\s+(?:de\s+)?$/iu.test(question.slice(0, match.index))) {
      encontrados.push({
        index: match.index,
        symbol: `${match[1] as string}${tonalidad[1] === 'menor' ? 'm' : ''}`,
      });
    }
  }
  for (const match of question.matchAll(ACORDE_EN_CASTELLANO)) {
    const [, note, accidental, especie] = match;
    encontrados.push({
      index: match.index,
      symbol: `${spanishToLetter(note as string, accidental)}${especie?.trim() === 'menor' ? 'm' : ''}`,
    });
  }
  for (const match of question.matchAll(CIFRADO_EN_CASTELLANO)) {
    const [, note, accidental, especie] = match;
    encontrados.push({
      index: match.index,
      symbol: `${spanishToLetter(note as string, accidental)}${especie as string}`,
    });
  }
  const [primero] = encontrados.sort((a, b) => a.index - b.index);
  return primero?.symbol ?? null;
}

/**
 * La entrada de un acorde escrito en la pregunta, con sus notas: «Notas de G7: G B
 * D F (fundamental, 3.ª mayor, 5.ª justa, 7.ª menor).»
 *
 * Se hace al vuelo porque no hay un nombre que la encuentre: son doce
 * fundamentales por cada especie. Solo si se preguntan sus notas, y solo para las
 * especies que se deletrean bien —con la novena o el disminuido con séptima, la
 * letra de cada intervalo no sale de contar semitonos—.
 */
function entradaDelAcorde(question: string): GlossaryEntry | null {
  if (!pideNotas(question)) {
    return null;
  }
  const symbol = acordeDeLaPregunta(question);
  const parsed = symbol === null ? null : parseChordSymbol(symbol);
  if (parsed === null || !ESPECIES_QUE_SE_DELETREAN.has(parsed.shape.suffix)) {
    return null;
  }
  const intervalos = parsed.shape.intervals
    .map((intervalo) => (intervalo === 0 ? 'fundamental' : INTERVAL_NAMES[intervalo]))
    .join(', ');
  return {
    id: `notas-de-${parsed.symbol}`,
    title: `Notas de ${parsed.symbol}`,
    names: [],
    definition: `${chordNotes(parsed.symbol)} (${intervalos}).`,
    signature: { kind: 'notes' },
    notesOf: () => parsed.notes,
  };
}

const NOTA_EN_LETRA = /(?<![\p{L}\p{N}#])([A-G])([#b]{0,2})(?!(?!m|maj|dim|aug|sus)\p{Ll})/gu;
const NOTA_EN_CASTELLANO = new RegExp(
  `(?<![\\p{L}])(do|re|mi|fa|sol|la|si)(#|b|\\s+sostenido|\\s+bemol)?(?![\\p{L}#])`,
  'giu',
);

/**
 * Las alturas que nombra un texto: en letra —también la fundamental de un cifrado,
 * «G» de «G7»— y en castellano.
 *
 * Con holgura, porque es para ver si **faltan**: «la» como artículo cuenta como La,
 * y eso hace la comprobación más blanda, nunca más dura.
 */
function alturasDichas(answer: string): Set<PitchClass> {
  const dichas = new Set<PitchClass>();
  for (const match of answer.matchAll(NOTA_EN_LETRA)) {
    dichas.add(pitchOfSpelled(`${match[1] as string}${match[2] as string}`));
  }
  for (const match of answer.matchAll(NOTA_EN_CASTELLANO)) {
    dichas.add(pitchOfSpelled(spanishToLetter(match[1] as string, match[2])));
  }
  return dichas;
}

/**
 * Si se preguntan las notas de un acorde o de una escala, tienen que estar todas.
 *
 * Cuenta alturas y no nombres: «Ab» por «G#» pasa, que suena igual y el lector no
 * sabría decidir cuál es la buena en cada tonalidad. Lo de **más** no se mira: una
 * respuesta puede nombrar la tónica a la que resuelve.
 */
function comprobarNotas({ question, answer, key, rank, otra }: Lectura): string | null {
  if (!pideNotas(question)) {
    return null;
  }
  for (const { entry, byName } of rank) {
    // Las de un acorde no dependen de la tonalidad; las de una escala, sí.
    const delAcorde = entry.names.length === 0;
    if (entry.notesOf === undefined || !byName || (otra && !delAcorde)) {
      continue;
    }
    const notas = entry.notesOf(key);
    if (notas === null) {
      continue;
    }
    const dichas = alturasDichas(answer);
    if (!notas.every((nota) => dichas.has(nota))) {
      return `no da todas las notas de «${entry.title}»`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Los modos, por su nombre.
// ---------------------------------------------------------------------------

/**
 * «¿Qué diferencia hay entre los siete modos?» se contesta nombrándolos, y el
 * modelo de casa contestó una vaguedad sin nombrar ninguno. Cuatro de siete basta:
 * pedir los siete rechazaría una respuesta que agrupe los mayores y los menores.
 * Solo cuando se pregunta por los modos en plural y no por uno de ellos.
 */
function comprobarModos({ question, answer, rank }: Lectura): string | null {
  const porLosModos = rank.some(({ entry, byName }) => byName && entry.signature?.kind === 'modes');
  const porUno = rank.some(({ entry }) => entry.id.startsWith('modo-'));
  if (!porLosModos || porUno || !/(?:^| )modos(?= |$)/u.test(normalizeForSearch(question))) {
    return null;
  }
  const dichos = new Set(normalizeForSearch(answer).split(' '));
  const nombrados = MODES.filter((mode) => dichos.has(normalizeForSearch(mode.name))).length;
  return nombrados >= 4 ? null : 'habla de los modos sin nombrarlos';
}

// ---------------------------------------------------------------------------
// Los intervalos, por sus semitonos.
// ---------------------------------------------------------------------------

/** Los semitonos de cada intervalo como se escribe, ya normalizado. */
const SEMITONOS_DE: Readonly<Record<string, number>> = {
  'segunda menor': 1,
  'segunda mayor': 2,
  'segunda aumentada': 3,
  'tercera menor': 3,
  'tercera mayor': 4,
  'cuarta justa': 5,
  'cuarta aumentada': 6,
  'quinta disminuida': 6,
  tritono: 6,
  'quinta justa': 7,
  'quinta aumentada': 8,
  'sexta menor': 8,
  'sexta mayor': 9,
  'septima menor': 10,
  'septima mayor': 11,
  octava: 12,
};

const NUMEROS: Readonly<Record<string, number>> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

const NUMERO = `(\\d+|${Object.keys(NUMEROS).join('|')})`;

/** «una tercera mayor tiene 4 semitonos», «la quinta justa son siete semitonos». */
const MEDIDA_DE_UN_INTERVALO = new RegExp(
  `(?:^| )(${Object.keys(SEMITONOS_DE).join('|')})(?: (?:tiene|son|mide|es de|equivale a|abarca|de|con))? ${NUMERO} semitonos?(?= |$)`,
  'gu',
);

function numero(texto: string): number {
  return NUMEROS[texto] ?? Number(texto);
}

/**
 * Un intervalo no puede medir otros semitonos que los suyos.
 *
 * Solo lee la medida dicha justo detrás del nombre —«la tercera mayor tiene tres
 * semitonos»—, que es la forma de decirla y la de equivocarse. Lo que va separado
 * no se lee: «la tercera mayor, de C a E, son cuatro» pasa sin mirarse.
 */
function comprobarIntervalos(answer: string): string | null {
  for (const match of normalizeForSearch(answer).matchAll(MEDIDA_DE_UN_INTERVALO)) {
    const [, nombre, cuantos] = match;
    const son = SEMITONOS_DE[nombre as string];
    if (numero(cuantos as string) !== son) {
      return `dice que la ${nombre as string} mide ${cuantos as string} semitonos, y son ${son as number}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// La armadura, contada.
// ---------------------------------------------------------------------------

const CUENTA_DE_ALTERACIONES = new RegExp(
  `(?:^| )${NUMERO} (sostenidos?|bemol(?:es)?)(?= |$)`,
  'gu',
);
const SIN_ALTERACIONES =
  /(?:^| )(?:no lleva|no tiene|sin|ningun|ninguna|cero) (?:alteraciones|alteracion|sostenidos?|bemol(?:es)?)(?= |$)/u;

/**
 * La armadura no puede contar otras alteraciones que las suyas: «Mi mayor tiene 1
 * sostenido» es falso, son cuatro.
 *
 * Vale con que una cuenta sea la buena —«ningún sostenido; lleva un bemol»—, y
 * solo rechaza si todas las que dice son otras.
 */
function cuentaLaArmadura(answer: string, key: TheoryKey): string | null {
  const signature = keySignature(key.tonic, key.mode);
  const cuantas = signature.letters.length;
  const tipo = signature.accidental === 'sharp' ? 'sostenido' : 'bemol';
  const texto = normalizeForSearch(answer);
  if (cuantas === 0 && SIN_ALTERACIONES.test(texto)) {
    return null;
  }
  const cuentas = [...texto.matchAll(CUENTA_DE_ALTERACIONES)].map((match) => ({
    cuantas: numero(match[1] as string),
    tipo: (match[2] as string).startsWith('sostenido') ? 'sostenido' : 'bemol',
  }));
  const buena = cuentas.some(
    (cuenta) =>
      (cuenta.cuantas === cuantas && (cuantas === 0 || cuenta.tipo === tipo)) ||
      (cuenta.cuantas === 0 && cuenta.tipo !== tipo),
  );
  if (cuentas.length === 0 || buena) {
    return null;
  }
  return `cuenta mal la armadura de ${keyName(key.tonic, key.mode)}`;
}

// ---------------------------------------------------------------------------
// Los acordes que hay que nombrar.
// ---------------------------------------------------------------------------

/** La fundamental de un grado en la tonalidad. */
function rootOf(key: TheoryKey, degree: DegreeSymbol): PitchClass {
  return resolveDegree(key.tonic, key.mode, degree).root;
}

/**
 * La dominante o la del V, preguntadas, tienen que nombrar su acorde.
 *
 * Con cualquier especie: el V con séptima sigue siendo el V, y en menor el v sin
 * sensible tiene la misma fundamental. **Una respuesta sin un solo acorde pasa**
 * —«el acorde del quinto grado, que tensa»—, porque explica sin equivocarse; la
 * que escribe acordes y ninguno es el suyo, no: «la dominante de la dominante es
 * el V/V, que en F mayor es C7» nombra el grado y da el acorde de otro.
 */
function nombraElAcorde(
  answer: string,
  key: TheoryKey,
  entry: GlossaryEntry,
  degree: DegreeSymbol,
): string | null {
  const root = rootOf(key, degree);
  const acordes = readTokens(answer, key).filter((token) => token.kind === 'chord');
  return acordes.length === 0 || acordes.some((token) => token.root === root)
    ? null
    : `habla de «${entry.title}» sin decir cuál es`;
}

/**
 * «La dominante de Bb mayor es Eb» es falso, y se lee: «la dominante», quizá «de
 * esta tonalidad», «es» y un acorde. «Su dominante» no, que puede ser la de otro
 * acorde; y «la dominante de la dominante» es otra cosa, con su firma. Solo en
 * letra: «la dominante es la que tensa» leería la nota La.
 */
const LA_DOMINANTE_ES = new RegExp(
  `(?:^|[^\\p{L}])(?<!de\\s+)[Ll]a\\s+dominante(?!\\s+de\\s+la\\s+dominante)(?:\\s+de\\s+[^,.;:]{1,25}?)?\\s+(?:es|ser[aá]|ser[ií]a)\\s+(?:el\\s+|un\\s+)?(?:acorde\\s+(?:de\\s+)?)?([A-G][#b]?)(?![\\p{L}#])`,
  'gu',
);

function comprobarLaDominanteDicha(answer: string, key: TheoryKey): string | null {
  const root = rootOf(key, 'V');
  for (const match of answer.matchAll(LA_DOMINANTE_ES)) {
    const dicha = match[1] as string;
    if (pitchOfSpelled(dicha) !== root && !nombraOtraTonalidad(match[0], key)) {
      return `dice que la dominante es ${dicha}`;
    }
  }
  return null;
}

/**
 * Los acordes de la tonalidad, preguntados, tienen que estar escritos: cinco de
 * los suyos por lo menos. Grados a secas —«i, ii°, III…»— no le dicen a nadie qué
 * tocar, y es lo que contestó el modelo de casa.
 */
function escribeLosAcordes(answer: string, key: TheoryKey): string | null {
  const suyos = new Set(scaleDegrees(key.mode));
  const escritos = new Set(
    readTokens(answer, key)
      .filter((token) => token.kind === 'chord' && token.degree !== null && suyos.has(token.degree))
      .map((token) => token.degree),
  );
  return escritos.size >= 5 ? null : 'no escribe los acordes de la tonalidad';
}

// ---------------------------------------------------------------------------
// Un acorde con su grado al lado.
// ---------------------------------------------------------------------------

/**
 * Las fundamentales que puede tener un grado escrito en romanos, en la tonalidad.
 *
 * Más de una en menor: el VI y el VII son los de la natural o, subidos, los de la
 * melódica y la armónica —«G#dim (vii°)» en La menor es la sensible y está bien—.
 * Un bemol delante baja el de la mayor, que es como se escriben los prestados. Y
 * «V/vi» es el V del vi: la fundamental del vi, una quinta más arriba.
 */
function raicesDelGrado(roman: string, key: TheoryKey): PitchClass[] {
  const [principal, destino] = roman.split('/') as [string, string | undefined];
  const bemol = principal.startsWith('B');
  const indice = NUMERALES.indexOf(principal.replace(/^B/, '') as (typeof NUMERALES)[number]);
  /* v8 ignore next 3 -- el lector de romanos solo deja pasar los siete numerales */
  if (indice === -1) {
    return [];
  }
  const sobreLaMayor = (MAJOR[indice] as number) - (bemol ? 1 : 0);
  if (destino !== undefined) {
    return raicesDelGrado(destino, key).map((raiz) => normalizePitchClass(raiz + sobreLaMayor));
  }
  if (bemol || key.mode === 'major') {
    return [normalizePitchClass(key.tonic + sobreLaMayor)];
  }
  const natural = normalizePitchClass(key.tonic + (NATURAL_MINOR[indice] as number));
  return indice >= 5 ? [natural, normalizePitchClass(natural + 1)] : [natural];
}

/** La frase en la que está una posición del texto, hasta ella: desde el último punto. */
function fraseDe(texto: string, hasta: number): string {
  const antes = texto.slice(0, hasta);
  return antes.slice(Math.max(antes.lastIndexOf('.'), antes.lastIndexOf('\n')) + 1);
}

/** «A menor», «Do mayor», «F# mayor»: una tonalidad escrita en una respuesta. */
const TONALIDAD_ESCRITA = new RegExp(
  `(?<![\\p{L}\\p{N}#])(?:([A-G][#b]?)|${SPANISH_NOTE})\\s+(mayor|menor)\\b`,
  'gu',
);

/**
 * Si un trozo de respuesta habla de otra tonalidad que la puesta.
 *
 * «En su relativa, A menor: … da E (V)» en Do mayor está bien: el V es el de La
 * menor. Comprobarlo contra Do sería rechazar lo que dice el propio glosario. Solo
 * cuenta la tonalidad con «mayor» o «menor» detrás, que es como se escribe: «de G a
 * C» son dos acordes.
 */
function nombraOtraTonalidad(fragmento: string, key: TheoryKey): boolean {
  return [...fragmento.matchAll(TONALIDAD_ESCRITA)].some((match) => {
    const nota = noteOfMatch(match, 1);
    const modo = match[4] === 'mayor' ? 'major' : 'minor';
    return pitchOfSpelled(nota) !== key.tonic || modo !== key.mode;
  });
}

/**
 * Cómo se pega un grado a un acorde para decir que es ese: «G (V)», «el V (G)»,
 * «A7, que es el V/V», «el V/V, que en F mayor es C7», «el V es G». Lo que va
 * entre los dos, exacto.
 */
const ETIQUETA =
  /^(?:\s*\(\s*|\s*,?\s+que(?:\s+en\s+[^,.;:()]{1,15})?\s+es\s+(?:el\s+|un\s+)?|\s+(?:es|ser[ií]a)\s+(?:el\s+|un\s+)?|\s*=\s*)$/u;

/**
 * Un acorde con su grado al lado tiene que ser ese grado.
 *
 * «D7 (V/vi)» en Fa mayor es falso —el V/vi de Fa es A7— y el modelo de casa lo
 * escribió así, dentro de una respuesta que el resto del validador dejaba pasar.
 * Compara solo fundamentales, que es lo que dice el grado; la especie la dice el
 * acorde. Entre paréntesis, solo si dentro va **una** pieza: «V → I (G → C)» es la
 * progresión dicha dos veces, y se lee entera en `readChains`. Y un grado seguido
 * de «de» es de otra tonalidad: «G7 es el V de C» en Fa mayor está bien.
 */
function comprobarEtiquetas(answer: string, key: TheoryKey): string | null {
  const tokens = readTokens(answer, key);
  for (const [index, primero] of tokens.entries()) {
    const segundo = tokens[index + 1];
    if (segundo === undefined || segundo.kind === primero.kind) {
      continue;
    }
    const hueco = answer.slice(primero.end, segundo.start);
    if (!ETIQUETA.test(hueco)) {
      continue;
    }
    if (hueco.includes('(') && !/^\s*\)/u.test(answer.slice(segundo.end))) {
      continue;
    }
    // Un acorde en mitad de una lista de notas no es el que lleva la etiqueta:
    // en «Cmaj7 = C E G B (I)» el I es del Cmaj7, no de la B.
    const anterior = tokens[index - 1];
    if (
      primero.kind === 'chord' &&
      anterior?.kind === 'chord' &&
      /^[\s,]*$/u.test(answer.slice(anterior.end, primero.start))
    ) {
      continue;
    }
    const [acorde, grado] = primero.kind === 'chord' ? [primero, segundo] : [segundo, primero];
    if (
      /^\s+(?:de|del)\s/u.test(answer.slice(grado.end)) ||
      acorde.root === null ||
      nombraOtraTonalidad(fraseDe(answer, segundo.start), key)
    ) {
      continue;
    }
    if (!raicesDelGrado(grado.roman as string, key).includes(acorde.root)) {
      return `llama ${answer.slice(grado.start, grado.end)} a ${answer.slice(acorde.start, acorde.end)}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Contestar con el glosario.
// ---------------------------------------------------------------------------

/**
 * Lo que dice el glosario de la pregunta, resuelto en la tonalidad. Nulo si no
 * casa con nada.
 *
 * Es lo que contesta la aplicación cuando no hay modelo, y cuando el modelo no ha
 * dado nada que pase el validador: son las mismas entradas que van en el prompt,
 * así que dicen lo mismo que se le dio al modelo para contestar.
 */
export function respuestaDelGlosario(question: string, key: TheoryKey): string | null {
  const entradas = findTheory(question);
  return entradas.length === 0
    ? null
    : entradas.map((entry) => theoryReference(entry, key)).join(' ');
}
