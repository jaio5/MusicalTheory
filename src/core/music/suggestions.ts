/**
 * Sugerencias de acordes.
 *
 * La idea es no quedarse en los siete de la tonalidad. Se arma un catálogo con
 * todo lo que cabe de verdad ahí —prestados, dominantes secundarias, sustitutos
 * tritonales, disminuidos de paso, el napolitano— y se ordena por dos cosas:
 * cuánto pega en el estilo elegido y cuánto encaja con lo que se está tocando.
 *
 * Cada sugerencia lleva escrito por qué está: un acorde raro sin explicación no
 * sirve de nada.
 */

import { accidentalForKey } from './circle-of-fifths';
import {
  HARMONIC_ROLES,
  roleOfDegree,
  substitutionOfDegree,
  teachingRank,
  type HarmonicRole,
  type Substitution,
} from './harmonic-function';
import type { KeyMode } from './keys';
import { noteName, normalizePitchClass, type Accidental, type PitchClass } from './notes';
import { STYLES, type ChordFamily, type StyleId } from './styles';

interface Shape {
  readonly suffix: string;
  /** Semitonos desde la fundamental. */
  readonly intervals: readonly number[];
}

const SHAPES = {
  major: { suffix: '', intervals: [0, 4, 7] },
  minor: { suffix: 'm', intervals: [0, 3, 7] },
  diminished: { suffix: 'dim', intervals: [0, 3, 6] },
  power: { suffix: '5', intervals: [0, 7] },
  sus2: { suffix: 'sus2', intervals: [0, 2, 7] },
  sus4: { suffix: 'sus4', intervals: [0, 5, 7] },
  add9: { suffix: 'add9', intervals: [0, 2, 4, 7] },
  sixth: { suffix: '6', intervals: [0, 4, 7, 9] },
  minorSixth: { suffix: 'm6', intervals: [0, 3, 7, 9] },
  dominant7: { suffix: '7', intervals: [0, 4, 7, 10] },
  major7: { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  minor7: { suffix: 'm7', intervals: [0, 3, 7, 10] },
  halfDiminished7: { suffix: 'm7b5', intervals: [0, 3, 6, 10] },
  diminished7: { suffix: 'dim7', intervals: [0, 3, 6, 9] },
  dominant7sharp9: { suffix: '7#9', intervals: [0, 3, 4, 7, 10] },
  dominant7flat9: { suffix: '7b9', intervals: [0, 1, 4, 7, 10] },
  dominant7sus4: { suffix: '7sus4', intervals: [0, 5, 7, 10] },
} as const satisfies Record<string, Shape>;

type ShapeId = keyof typeof SHAPES;

export interface ChordSuggestion {
  /** Cifrado listo para leer: A7#9, Bbmaj7, E5. */
  readonly symbol: string;
  /** Qué es respecto a la tonalidad: bVII, V/vi, subV7/V. */
  readonly label: string;
  readonly family: ChordFamily;
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
  /** Cuánto encaja con lo que se está tocando, de 0 a 1. */
  readonly fit: number;
  /** Orden final: mezcla del estilo y del encaje. */
  readonly score: number;
  /** Por qué está aquí. */
  readonly why: string;
  /** Qué papel hace en la tonalidad: reposo, salida o tensión. */
  readonly role: HarmonicRole;
  /** Qué hace ese papel, en una frase. */
  readonly roleWhy: string;
  /** A qué grado puede reemplazar y por qué, si es de los que se enseñan. */
  readonly substitution: Substitution | null;
}

export interface SuggestionInput {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly styleId: StyleId;
  /** Las clases de altura tocadas últimamente, si las hay. */
  readonly playedNotes?: readonly PitchClass[];
  readonly limit?: number;
}

interface Candidate {
  readonly rootOffset: number;
  readonly shape: ShapeId;
  readonly label: string;
  readonly family: ChordFamily;
  readonly why: string;
  readonly role: HarmonicRole;
  /**
   * Orden de enseñanza dentro de su mismo peso. Cuanto más bajo, antes sale.
   *
   * Es lo que arregla que la lista saliera por orden alfabético del cifrado:
   * en Do mayor eso ponía el vii° de segundo y la tónica de tercera, que es
   * exactamente lo que no hay que enseñar primero.
   */
  readonly rank: number;
  readonly substitution?: Substitution | null;
  /**
   * Peso propio para algún estilo, cuando el de la familia se queda corto o
   * largo. El I7 es un préstamo en cualquier sitio, pero en blues no es un
   * préstamo: es el acorde de la tónica.
   */
  readonly weights?: Partial<Record<StyleId, number>>;
}

/** Grados de la escala mayor y de la menor natural, en semitonos. */
const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREES = [0, 2, 3, 5, 7, 8, 10];

const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_ROMAN = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
const MAJOR_SHAPES: ShapeId[] = [
  'major',
  'minor',
  'minor',
  'major',
  'major',
  'minor',
  'diminished',
];
const MINOR_SHAPES: ShapeId[] = [
  'minor',
  'diminished',
  'major',
  'minor',
  'minor',
  'major',
  'major',
];
const MAJOR_SEVENTHS: ShapeId[] = [
  'major7',
  'minor7',
  'minor7',
  'major7',
  'dominant7',
  'minor7',
  'halfDiminished7',
];
const MINOR_SEVENTHS: ShapeId[] = [
  'minor7',
  'halfDiminished7',
  'major7',
  'minor7',
  'minor7',
  'major7',
  'dominant7',
];

/** Qué es cada grado, en una frase. El orden es el de la escala, no el de enseñanza. */
const MAJOR_DEGREE_WHY = [
  'La casa. Todo lo que suena se mide desde aquí.',
  'El menor que prepara la dominante. La mitad del jazz empieza aquí.',
  'El menos usado de los tres de reposo: casi un I con otro color.',
  'La salida de casa. Con el I y el V sostiene una canción entera.',
  'El que más tira: lleva dentro el tritono que pide volver al I.',
  'El relativo menor. El mismo reposo con la cara triste.',
  'Disminuido, con el tritono a la vista. Se cruza de paso, no se aparca.',
];

const MINOR_DEGREE_WHY = [
  'La casa, en menor.',
  'Disminuido: prepara la dominante, pero incomoda si se sostiene.',
  'El relativo mayor. El sitio al que se escapa una canción en menor.',
  'La salida en menor: el giro melancólico más viejo que hay.',
  'La dominante sin sensible. Empuja, pero menos que un V mayor.',
  'Reposo de cara ancha. La bajada VI – VII – i empieza aquí.',
  'Subtónica: vuelve a la tónica sin sensible. La cadencia del rock.',
];

/**
 * El cifrado romano de una cuatríada, que no es el del acorde de tres notas
 * con un 7 pegado detrás.
 *
 * Sin esto, en Do mayor salían un `Cmaj7` y un `C7` etiquetados los dos como
 * «I7»: dos acordes distintos con el mismo nombre. Y el `Bm7b5` se anunciaba
 * como «vii°7», que por convención es el disminuido entero, no el
 * semidisminuido que de verdad es.
 */
function seventhLabel(roman: string, shape: ShapeId): string {
  const base = roman.replace('°', '');
  switch (shape) {
    case 'major7':
      return `${base}maj7`;
    case 'halfDiminished7':
      return `${base}ø7`;
    case 'diminished7':
      return `${base}°7`;
    default:
      return `${base}7`;
  }
}

/** Qué añade la séptima según de qué séptima se trate. */
function seventhWhy(shape: ShapeId): string {
  switch (shape) {
    case 'major7':
      return 'Séptima mayor: el mismo reposo, más abierto y menos rotundo.';
    case 'minor7':
      return 'Séptima menor sobre un acorde menor: redondea sin cambiar el papel.';
    case 'dominant7':
      return 'Con la séptima menor aparece el tritono. Eso es lo que le hace pedir resolver.';
    case 'halfDiminished7':
      return 'Semidisminuido: el disminuido con la quinta bemol, mucho más usable que a secas.';
    default:
      return 'La misma función con una nota más de color.';
  }
}

function diatonicCandidates(mode: KeyMode): Candidate[] {
  const degrees = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  const romans = mode === 'major' ? MAJOR_ROMAN : MINOR_ROMAN;
  const shapes = mode === 'major' ? MAJOR_SHAPES : MINOR_SHAPES;
  const sevenths = mode === 'major' ? MAJOR_SEVENTHS : MINOR_SEVENTHS;
  const whys = mode === 'major' ? MAJOR_DEGREE_WHY : MINOR_DEGREE_WHY;

  const candidates: Candidate[] = [];
  degrees.forEach((offset, index) => {
    const role = roleOfDegree(mode, index);
    const substitution = substitutionOfDegree(mode, index);
    const rank = teachingRank(mode, index);

    candidates.push({
      rootOffset: offset,
      shape: shapes[index]!,
      label: romans[index]!,
      family: 'diatonic',
      why: whys[index]!,
      role,
      rank,
      substitution,
    });
    candidates.push({
      rootOffset: offset,
      shape: sevenths[index]!,
      label: seventhLabel(romans[index]!, sevenths[index]!),
      family: 'seventh',
      why: seventhWhy(sevenths[index]!),
      role,
      // Detrás de la tríada del mismo grado: primero se aprende el acorde y
      // después lo que le añade la séptima.
      rank: rank + DIATONIC_RANKS,
      substitution,
    });
  });
  return candidates;
}

/** Cuántos grados tiene la escala: el hueco que se deja para las cuatríadas. */
const DIATONIC_RANKS = 7;

function colourCandidates(mode: KeyMode): Candidate[] {
  const tonicLabel = mode === 'major' ? 'I' : 'i';
  const fourth = mode === 'major' ? 'IV' : 'iv';
  const fifth = mode === 'major' ? 'V' : 'v';

  return [
    {
      rootOffset: 0,
      shape: 'power',
      label: `${tonicLabel}5`,
      family: 'power',
      why: 'Sin tercera no es mayor ni menor: aguanta cualquier ganancia.',
      role: 'tonic',
      rank: OUTSIDE_RANK,
    },
    {
      rootOffset: 5,
      shape: 'power',
      label: `${fourth}5`,
      family: 'power',
      why: 'La quinta del cuarto grado, el otro polo del riff.',
      role: 'subdominant',
      rank: OUTSIDE_RANK + 1,
    },
    {
      rootOffset: 7,
      shape: 'power',
      label: `${fifth}5`,
      family: 'power',
      why: 'Tensión sin comprometerse con el modo.',
      role: 'dominant',
      rank: OUTSIDE_RANK + 2,
    },
    {
      rootOffset: 0,
      shape: 'sus4',
      label: `${tonicLabel}sus4`,
      family: 'suspended',
      why: 'La cuarta cae a la tercera y da movimiento sin cambiar de acorde.',
      role: 'tonic',
      rank: OUTSIDE_RANK + 3,
    },
    {
      rootOffset: 0,
      shape: 'sus2',
      label: `${tonicLabel}sus2`,
      family: 'suspended',
      why: 'Abre el acorde quitándole la tercera por abajo.',
      role: 'tonic',
      rank: OUTSIDE_RANK + 4,
    },
    {
      rootOffset: 5,
      shape: 'sus2',
      label: `${fourth}sus2`,
      family: 'suspended',
      why: 'El adorno de siempre sobre el cuarto grado.',
      role: 'subdominant',
      rank: OUTSIDE_RANK + 5,
    },
    {
      rootOffset: 7,
      shape: 'dominant7sus4',
      label: `${fifth}7sus4`,
      family: 'suspended',
      why: 'Retrasa la resolución un compás más.',
      role: 'dominant',
      rank: OUTSIDE_RANK + 6,
    },
    {
      rootOffset: 0,
      shape: mode === 'major' ? 'add9' : 'minorSixth',
      label: mode === 'major' ? 'Iadd9' : 'im6',
      family: 'added',
      why: 'Color sobre la tónica sin tocarle la función.',
      role: 'tonic',
      rank: OUTSIDE_RANK + 7,
    },
    {
      rootOffset: 5,
      shape: mode === 'major' ? 'add9' : 'minorSixth',
      label: mode === 'major' ? 'IVadd9' : 'ivm6',
      family: 'added',
      why: 'Lo mismo sobre el cuarto grado.',
      role: 'subdominant',
      rank: OUTSIDE_RANK + 8,
    },
    {
      rootOffset: 0,
      shape: 'sixth',
      label: `${tonicLabel}6`,
      family: 'added',
      why: 'La sexta redondea el acorde sin la tensión de la séptima.',
      role: 'tonic',
      rank: OUTSIDE_RANK + 9,
    },
  ];
}

/**
 * Desde dónde numeran los acordes que no son grados de la escala.
 *
 * Deja por delante las catorce posiciones de las tríadas y las cuatríadas
 * diatónicas, para que un préstamo nunca se cuele entre los grados cuando los
 * pesos empatan.
 */
const OUTSIDE_RANK = 20;

function borrowedCandidates(mode: KeyMode): Candidate[] {
  if (mode === 'major') {
    return [
      {
        rootOffset: 10,
        shape: 'major',
        label: 'bVII',
        family: 'borrowed',
        why: 'Prestado del menor. Vuelve a la tónica sin sensible: la cadencia del rock.',
        role: 'dominant',
        rank: OUTSIDE_RANK + 10,
      },
      {
        rootOffset: 8,
        shape: 'major',
        label: 'bVI',
        family: 'borrowed',
        why: 'Prestado del menor. Oscurece de golpe sin salir del tono.',
        role: 'subdominant',
        rank: OUTSIDE_RANK + 11,
      },
      {
        rootOffset: 3,
        shape: 'major',
        label: 'bIII',
        family: 'borrowed',
        why: 'Prestado del menor. Sube el riff sin cambiar de centro.',
        role: 'tonic',
        rank: OUTSIDE_RANK + 12,
      },
      {
        rootOffset: 5,
        shape: 'minor',
        label: 'iv',
        family: 'borrowed',
        why: 'El cuarto grado en menor: el giro melancólico más viejo que hay.',
        role: 'subdominant',
        rank: OUTSIDE_RANK + 13,
        substitution: {
          of: 'IV',
          why: 'Va donde iría el IV y solo cambia una nota: la tercera, que baja medio tono.',
        },
      },
      {
        rootOffset: 0,
        shape: 'dominant7',
        label: 'I7',
        family: 'borrowed',
        why: 'La tónica con séptima menor. En blues no es una licencia, es la norma.',
        weights: { blues: 1, rock: 0.55 },
        role: 'tonic',
        rank: OUTSIDE_RANK + 14,
      },
      {
        rootOffset: 5,
        shape: 'dominant7',
        label: 'IV7',
        family: 'borrowed',
        why: 'El cuarto grado también dominante: el compás cinco del blues.',
        weights: { blues: 0.95, rock: 0.5 },
        role: 'subdominant',
        rank: OUTSIDE_RANK + 15,
      },
    ];
  }

  return [
    {
      rootOffset: 5,
      shape: 'major',
      label: 'IV',
      family: 'borrowed',
      why: 'El cuarto grado mayor: color dórico dentro del menor.',
      role: 'subdominant',
      rank: OUTSIDE_RANK + 11,
      substitution: {
        of: 'iv',
        why: 'El mismo sitio que el iv, con la tercera subida: cambia el color, no la función.',
      },
    },
    {
      rootOffset: 7,
      shape: 'major',
      label: 'V',
      family: 'borrowed',
      why: 'Dominante con sensible, prestada del menor armónico. Aprieta más que la menor.',
      role: 'dominant',
      rank: OUTSIDE_RANK + 10,
      substitution: {
        of: 'v',
        why: 'Sustituye al v natural y gana la sensible, que es lo que de verdad tira hacia el i.',
      },
    },
    {
      rootOffset: 7,
      shape: 'dominant7',
      label: 'V7',
      family: 'borrowed',
      why: 'La misma dominante con séptima: pide volver a casa.',
      role: 'dominant',
      rank: OUTSIDE_RANK + 12,
    },
    {
      rootOffset: 0,
      shape: 'major',
      label: 'I',
      family: 'borrowed',
      why: 'Terminar en mayor una pieza en menor. La tercera de Picardía.',
      role: 'tonic',
      rank: OUTSIDE_RANK + 13,
      // En folk y en jazz es un final de toda la vida; en rock y metal, casi
      // nunca. Con el peso de la familia salía demasiado arriba en rock.
      weights: { rock: 0.25, metal: 0.15, pop: 0.3 },
    },
  ];
}

/** La dominante de cada grado, que es la forma más vieja de encadenar. */
function secondaryDominants(mode: KeyMode): Candidate[] {
  const degrees = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  const romans = mode === 'major' ? MAJOR_ROMAN : MINOR_ROMAN;

  const candidates: Candidate[] = [];
  degrees.forEach((offset, index) => {
    const roman = romans[index]!;
    // Ni sobre la tónica ni sobre el grado disminuido: no hay nada que preparar.
    if (index === 0 || roman.includes('°')) {
      return;
    }
    candidates.push({
      rootOffset: offset + 7,
      shape: 'major',
      label: `V/${roman}`,
      family: 'secondaryDominant',
      why: `Prepara el ${roman} como si fuera la tónica un momento.`,
      role: 'dominant',
      rank: OUTSIDE_RANK + 30 + index * 3,
    });
    candidates.push({
      rootOffset: offset + 7,
      shape: 'dominant7',
      label: `V7/${roman}`,
      family: 'secondaryDominant',
      why: `La misma preparación del ${roman}, con séptima: tira más.`,
      role: 'dominant',
      rank: OUTSIDE_RANK + 31 + index * 3,
    });
    candidates.push({
      rootOffset: offset + 1,
      shape: 'dominant7',
      label: `subV7/${roman}`,
      family: 'tritoneSub',
      why: `Lo mismo que V7/${roman} pero bajando medio tono: el sustituto tritonal.`,
      role: 'dominant',
      rank: OUTSIDE_RANK + 32 + index * 3,
      substitution: {
        of: `V7/${roman}`,
        why: 'Los dos llevan el mismo tritono dentro, así que aprietan igual. Cambia el bajo, que ahora baja medio tono.',
      },
    });
  });
  return candidates;
}

function chromaticCandidates(mode: KeyMode): Candidate[] {
  const base: Candidate[] = [
    {
      rootOffset: 1,
      shape: 'major',
      label: 'bII',
      family: 'neapolitan',
      why: 'El napolitano. Un semitono por encima de la tónica: el color frigio.',
      role: 'subdominant',
      rank: OUTSIDE_RANK + 60,
      substitution: {
        of: 'ii',
        why: 'Ocupa el sitio del ii y hace la misma salida, pero bajando la fundamental medio tono.',
      },
    },
    {
      rootOffset: 1,
      shape: 'diminished7',
      label: '#i°7',
      family: 'diminished',
      why: 'Disminuido de paso entre la tónica y el segundo grado.',
      role: 'approach',
      rank: OUTSIDE_RANK + 61,
    },
    {
      rootOffset: 6,
      shape: 'diminished7',
      label: '#iv°7',
      family: 'diminished',
      why: 'Disminuido de paso hacia el quinto grado.',
      role: 'approach',
      rank: OUTSIDE_RANK + 62,
    },
    {
      rootOffset: 7,
      shape: 'dominant7sharp9',
      label: 'V7#9',
      family: 'altered',
      why: 'La tercera mayor y la menor a la vez. El acorde de Hendrix.',
      role: 'dominant',
      rank: OUTSIDE_RANK + 63,
    },
    {
      rootOffset: 7,
      shape: 'dominant7flat9',
      label: 'V7b9',
      family: 'altered',
      why: 'Dominante con la novena bemol: aprieta hacia el menor.',
      role: 'dominant',
      rank: OUTSIDE_RANK + 64,
    },
  ];

  if (mode === 'major') {
    base.push({
      rootOffset: 0,
      shape: 'dominant7sharp9',
      label: 'I7#9',
      family: 'altered',
      why: 'Sobre la tónica, en blues y en funk, no es un error: es el sonido.',
      role: 'tonic',
      rank: OUTSIDE_RANK + 65,
    });
  }
  return base;
}

function buildCandidates(mode: KeyMode): Candidate[] {
  return [
    ...diatonicCandidates(mode),
    ...colourCandidates(mode),
    ...borrowedCandidates(mode),
    ...secondaryDominants(mode),
    ...chromaticCandidates(mode),
  ];
}

/**
 * Cuánto encaja el acorde con lo que se está tocando.
 *
 * Mira las dos direcciones: cuántas notas del acorde han sonado, y cuánto de lo
 * que ha sonado cabe en el acorde. Solo la primera premiaría a los acordes de
 * cinco notas; solo la segunda, a las quintas.
 */
export function chordFit(
  chordNotes: readonly PitchClass[],
  playedNotes: readonly PitchClass[],
): number {
  if (playedNotes.length === 0 || chordNotes.length === 0) {
    return 0;
  }
  const played = new Set(playedNotes);
  const chord = new Set(chordNotes);

  let covered = 0;
  for (const note of chord) {
    if (played.has(note)) {
      covered += 1;
    }
  }

  let explained = 0;
  for (const note of played) {
    if (chord.has(note)) {
      explained += 1;
    }
  }

  // Explicar lo que suena pesa más que cubrirse a sí mismo: una nota que suena
  // y no está en el acorde es un choque real, mientras que una nota del acorde
  // que todavía no ha sonado solo es una nota que no ha sonado todavía.
  return 0.35 * (covered / chord.size) + 0.65 * (explained / played.size);
}

export function chordNotesFor(root: PitchClass, shape: ShapeId): PitchClass[] {
  const notes = SHAPES[shape].intervals.map((interval) => normalizePitchClass(root + interval));
  return [...new Set(notes)];
}

/**
 * Acordes que pueden ir ahí, ordenados por lo bien que pegan.
 *
 * Sin notas tocadas manda el estilo. Con notas, el encaje pesa más: es lo que
 * hace que aparezca un acorde raro cuando de verdad explica lo que suena.
 */
export function suggestChords(input: SuggestionInput): ChordSuggestion[] {
  const { tonic, mode, styleId, playedNotes = [], limit = 8 } = input;
  const style = STYLES[styleId];
  const accidental: Accidental = accidentalForKey(tonic, mode);
  const hasPlayed = playedNotes.length > 0;

  const seen = new Set<string>();
  // El rango viaja con la sugerencia solo para ordenar; fuera de aquí no
  // significa nada, así que se quita antes de devolverla.
  const suggestions: (ChordSuggestion & { rank: number })[] = [];

  for (const candidate of buildCandidates(mode)) {
    const weight = candidate.weights?.[styleId] ?? style.weights[candidate.family];
    if (weight <= 0) {
      continue;
    }

    const root = normalizePitchClass(tonic + candidate.rootOffset);
    const notes = chordNotesFor(root, candidate.shape);
    const symbol = `${noteName(root, accidental)}${SHAPES[candidate.shape].suffix}`;

    if (seen.has(symbol)) {
      continue;
    }
    seen.add(symbol);

    const fit = chordFit(notes, playedNotes);
    // Con notas sonando manda el encaje; sin ellas, lo único que hay es el
    // estilo. Si no, un acorde raro que explica exactamente lo que se toca
    // nunca llegaría a proponerse.
    const score = hasPlayed ? weight * 0.35 + fit * 0.65 : weight;

    suggestions.push({
      symbol,
      label: candidate.label,
      family: candidate.family,
      root,
      notes,
      fit,
      score,
      why: candidate.why,
      role: candidate.role,
      roleWhy: HARMONIC_ROLES[candidate.role].what,
      substitution: candidate.substitution ?? null,
      rank: candidate.rank,
    });
  }

  // A igualdad de puntuación manda el orden de enseñanza, no el alfabeto. Antes
  // se desempataba por el cifrado, y en Do mayor eso sacaba «Am, Bdim, C…»:
  // el disminuido de segundo y la tónica de tercera.
  return suggestions
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.symbol.localeCompare(b.symbol))
    .slice(0, limit)
    .map(({ rank: _rank, ...suggestion }) => suggestion);
}
