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

function diatonicCandidates(mode: KeyMode): Candidate[] {
  const degrees = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  const romans = mode === 'major' ? MAJOR_ROMAN : MINOR_ROMAN;
  const shapes = mode === 'major' ? MAJOR_SHAPES : MINOR_SHAPES;
  const sevenths = mode === 'major' ? MAJOR_SEVENTHS : MINOR_SEVENTHS;

  const candidates: Candidate[] = [];
  degrees.forEach((offset, index) => {
    candidates.push({
      rootOffset: offset,
      shape: shapes[index]!,
      label: romans[index]!,
      family: 'diatonic',
      why: 'Está en la tonalidad: no puede sonar mal.',
    });
    candidates.push({
      rootOffset: offset,
      shape: sevenths[index]!,
      label: `${romans[index]!}7`,
      family: 'seventh',
      why: 'La misma función con una nota más de color.',
    });
  });
  return candidates;
}

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
    },
    {
      rootOffset: 5,
      shape: 'power',
      label: `${fourth}5`,
      family: 'power',
      why: 'La quinta del cuarto grado, el otro polo del riff.',
    },
    {
      rootOffset: 7,
      shape: 'power',
      label: `${fifth}5`,
      family: 'power',
      why: 'Tensión sin comprometerse con el modo.',
    },
    {
      rootOffset: 0,
      shape: 'sus4',
      label: `${tonicLabel}sus4`,
      family: 'suspended',
      why: 'La cuarta cae a la tercera y da movimiento sin cambiar de acorde.',
    },
    {
      rootOffset: 0,
      shape: 'sus2',
      label: `${tonicLabel}sus2`,
      family: 'suspended',
      why: 'Abre el acorde quitándole la tercera por abajo.',
    },
    {
      rootOffset: 5,
      shape: 'sus2',
      label: `${fourth}sus2`,
      family: 'suspended',
      why: 'El adorno de siempre sobre el cuarto grado.',
    },
    {
      rootOffset: 7,
      shape: 'dominant7sus4',
      label: `${fifth}7sus4`,
      family: 'suspended',
      why: 'Retrasa la resolución un compás más.',
    },
    {
      rootOffset: 0,
      shape: mode === 'major' ? 'add9' : 'minorSixth',
      label: mode === 'major' ? 'Iadd9' : 'im6',
      family: 'added',
      why: 'Color sobre la tónica sin tocarle la función.',
    },
    {
      rootOffset: 5,
      shape: mode === 'major' ? 'add9' : 'minorSixth',
      label: mode === 'major' ? 'IVadd9' : 'ivm6',
      family: 'added',
      why: 'Lo mismo sobre el cuarto grado.',
    },
    {
      rootOffset: 0,
      shape: 'sixth',
      label: `${tonicLabel}6`,
      family: 'added',
      why: 'La sexta redondea el acorde sin la tensión de la séptima.',
    },
  ];
}

function borrowedCandidates(mode: KeyMode): Candidate[] {
  if (mode === 'major') {
    return [
      {
        rootOffset: 10,
        shape: 'major',
        label: 'bVII',
        family: 'borrowed',
        why: 'Prestado del menor. Vuelve a la tónica sin sensible: la cadencia del rock.',
      },
      {
        rootOffset: 8,
        shape: 'major',
        label: 'bVI',
        family: 'borrowed',
        why: 'Prestado del menor. Oscurece de golpe sin salir del tono.',
      },
      {
        rootOffset: 3,
        shape: 'major',
        label: 'bIII',
        family: 'borrowed',
        why: 'Prestado del menor. Sube el riff sin cambiar de centro.',
      },
      {
        rootOffset: 5,
        shape: 'minor',
        label: 'iv',
        family: 'borrowed',
        why: 'El cuarto grado en menor: el giro melancólico más viejo que hay.',
      },
      {
        rootOffset: 0,
        shape: 'dominant7',
        label: 'I7',
        family: 'borrowed',
        why: 'La tónica con séptima menor. En blues no es una licencia, es la norma.',
        weights: { blues: 1, rock: 0.55 },
      },
      {
        rootOffset: 5,
        shape: 'dominant7',
        label: 'IV7',
        family: 'borrowed',
        why: 'El cuarto grado también dominante: el compás cinco del blues.',
        weights: { blues: 0.95, rock: 0.5 },
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
    },
    {
      rootOffset: 7,
      shape: 'major',
      label: 'V',
      family: 'borrowed',
      why: 'Dominante con sensible, prestada del menor armónico. Aprieta más que la menor.',
    },
    {
      rootOffset: 7,
      shape: 'dominant7',
      label: 'V7',
      family: 'borrowed',
      why: 'La misma dominante con séptima: pide volver a casa.',
    },
    {
      rootOffset: 0,
      shape: 'major',
      label: 'I',
      family: 'borrowed',
      why: 'Terminar en mayor una pieza en menor. La tercera de Picardía.',
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
    });
    candidates.push({
      rootOffset: offset + 7,
      shape: 'dominant7',
      label: `V7/${roman}`,
      family: 'secondaryDominant',
      why: `La misma preparación del ${roman}, con séptima: tira más.`,
    });
    candidates.push({
      rootOffset: offset + 1,
      shape: 'dominant7',
      label: `subV7/${roman}`,
      family: 'tritoneSub',
      why: `Lo mismo que V7/${roman} pero bajando medio tono: el sustituto tritonal.`,
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
    },
    {
      rootOffset: 1,
      shape: 'diminished7',
      label: '#i°7',
      family: 'diminished',
      why: 'Disminuido de paso entre la tónica y el segundo grado.',
    },
    {
      rootOffset: 6,
      shape: 'diminished7',
      label: '#iv°7',
      family: 'diminished',
      why: 'Disminuido de paso hacia el quinto grado.',
    },
    {
      rootOffset: 7,
      shape: 'dominant7sharp9',
      label: 'V7#9',
      family: 'altered',
      why: 'La tercera mayor y la menor a la vez. El acorde de Hendrix.',
    },
    {
      rootOffset: 7,
      shape: 'dominant7flat9',
      label: 'V7b9',
      family: 'altered',
      why: 'Dominante con la novena bemol: aprieta hacia el menor.',
    },
  ];

  if (mode === 'major') {
    base.push({
      rootOffset: 0,
      shape: 'dominant7sharp9',
      label: 'I7#9',
      family: 'altered',
      why: 'Sobre la tónica, en blues y en funk, no es un error: es el sonido.',
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
  const suggestions: ChordSuggestion[] = [];

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
    });
  }

  return suggestions
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}
