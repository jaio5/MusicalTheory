/**
 * Estilos: qué se hace normalmente en cada uno.
 *
 * No es una clasificación musicológica, es una chuleta. Cada estilo dice qué
 * escalas se usan, qué familias de acordes pesan y qué se puede hacer, para que
 * las sugerencias no sean siempre las mismas siete.
 */

import type { ScaleId } from './scales';

export type StyleId = 'rock' | 'blues' | 'metal' | 'pop' | 'folk' | 'jazz';

/**
 * Familias en las que se agrupan los acordes que se pueden sugerir. El peso de
 * cada una en cada estilo es lo que hace que el blues proponga dominantes y el
 * metal proponga el bII.
 */
export type ChordFamily =
  /** Los siete de la tonalidad. */
  | 'diatonic'
  /** Quintas sin tercera. */
  | 'power'
  /** sus2 y sus4. */
  | 'suspended'
  /** add9, 6, m6: color sin cambiar la función. */
  | 'added'
  /** Cuatríadas diatónicas. */
  | 'seventh'
  /** Prestados del modo paralelo. */
  | 'borrowed'
  /** La dominante de otro grado. */
  | 'secondaryDominant'
  /** El sustituto tritonal de una dominante. */
  | 'tritoneSub'
  /** Disminuidos de paso. */
  | 'diminished'
  /** El napolitano: bII. */
  | 'neapolitan'
  /** Dominantes con la novena alterada. */
  | 'altered';

export interface StyleDefinition {
  readonly id: StyleId;
  readonly name: string;
  /** Qué es, en una frase. */
  readonly summary: string;
  /** Escalas que se usan, la primera es la que se propone por defecto. */
  readonly scales: readonly ScaleId[];
  /** Qué se puede hacer. Son pautas, no reglas. */
  readonly tips: readonly string[];
  /** Cuánto pesa cada familia, de 0 a 1. */
  readonly weights: Readonly<Record<ChordFamily, number>>;
}

const NONE: Record<ChordFamily, number> = {
  diatonic: 0,
  power: 0,
  suspended: 0,
  added: 0,
  seventh: 0,
  borrowed: 0,
  secondaryDominant: 0,
  tritoneSub: 0,
  diminished: 0,
  neapolitan: 0,
  altered: 0,
};

export const STYLES: Readonly<Record<StyleId, StyleDefinition>> = {
  rock: {
    id: 'rock',
    name: 'Rock',
    summary: 'Tres acordes y el bVII para no sonar a canción infantil.',
    scales: ['minorPentatonic', 'major', 'mixolydian', 'naturalMinor'],
    tips: [
      'Con I, IV y V se sostiene medio repertorio. Lo que lo saca de lo obvio es el bVII.',
      'Las quintas sin tercera aguantan cualquier ganancia y sirven igual en mayor que en menor.',
      'Un sus4 que cae a la tercera da movimiento sin cambiar de acorde.',
      'La cadencia bVII – I evita la sensible: suena a riff, no a coral.',
    ],
    weights: {
      ...NONE,
      diatonic: 1,
      power: 0.9,
      suspended: 0.8,
      borrowed: 0.75,
      added: 0.45,
      seventh: 0.35,
      secondaryDominant: 0.3,
    },
  },
  blues: {
    id: 'blues',
    name: 'Blues',
    summary: 'Todo dominante, aunque la teoría diga que no.',
    scales: ['blues', 'minorPentatonic', 'mixolydian'],
    tips: [
      'I7, IV7 y V7: los tres con séptima menor, aunque en la tonalidad no toque.',
      'La quinta bemol es de paso, no de reposo: se cruza, no se aparca.',
      'El 7#9 es la tercera mayor y la menor a la vez. Ahí está la gracia.',
      'V – IV – I al final del giro. En un coral sería un error; aquí es el idioma.',
    ],
    weights: {
      ...NONE,
      diatonic: 0.7,
      seventh: 1,
      altered: 0.8,
      power: 0.5,
      borrowed: 0.5,
      suspended: 0.4,
      secondaryDominant: 0.45,
    },
  },
  metal: {
    id: 'metal',
    name: 'Metal',
    summary: 'Menor, frigio y el semitono de arriba de la tónica.',
    scales: ['phrygian', 'naturalMinor', 'minorPentatonic', 'harmonicMinor'],
    tips: [
      'El bII pegado a la tónica es el color frigio: un semitono lo cambia todo.',
      'Quintas y octavas. La tercera ensucia cuando hay mucha ganancia.',
      'El tritono es un color, no un fallo: úsalo de paso hacia la tónica.',
      'i – bVI – bVII es la escalera de bajada de siempre y sigue funcionando.',
    ],
    weights: {
      ...NONE,
      diatonic: 0.8,
      power: 1,
      borrowed: 0.85,
      neapolitan: 0.8,
      diminished: 0.6,
      seventh: 0.3,
      suspended: 0.35,
    },
  },
  pop: {
    id: 'pop',
    name: 'Pop',
    summary: 'Cuatro acordes bien puestos y un giro que no se espera.',
    scales: ['major', 'naturalMinor', 'majorPentatonic'],
    tips: [
      'I – V – vi – IV y sus rotaciones. Funciona siempre, y por eso cansa.',
      'Un add9 abre el acorde sin cambiar su función.',
      'La dominante secundaria V/vi antes del relativo menor levanta el estribillo.',
      'Cambiar el orden de los mismos cuatro acordes ya es otra canción.',
    ],
    weights: {
      ...NONE,
      diatonic: 1,
      added: 0.8,
      suspended: 0.7,
      secondaryDominant: 0.65,
      seventh: 0.5,
      borrowed: 0.45,
    },
  },
  folk: {
    id: 'folk',
    name: 'Folk',
    summary: 'Acordes abiertos y el meñique haciendo el trabajo.',
    scales: ['major', 'majorPentatonic', 'dorian', 'naturalMinor'],
    tips: [
      'Acordes abiertos con cuerdas al aire sonando: es lo que da el timbre.',
      'sus2 y sus4 sobre el mismo acorde, moviendo un dedo. Ahí está el adorno.',
      'El IV y el relativo menor sostienen una letra larga sin cansar.',
      'El dórico da un menor menos triste, con la sexta mayor.',
    ],
    weights: {
      ...NONE,
      diatonic: 1,
      suspended: 0.85,
      added: 0.7,
      seventh: 0.4,
      borrowed: 0.4,
      secondaryDominant: 0.35,
    },
  },
  jazz: {
    id: 'jazz',
    name: 'Jazz',
    summary: 'Cuatríadas por defecto y dominantes por todas partes.',
    scales: ['major', 'dorian', 'mixolydian', 'harmonicMinor'],
    tips: [
      'ii – V – I es la célula. Encadénala y ya tienes la mitad de un tema.',
      'El sustituto tritonal del V baja medio tono a la tónica: subV7 – I.',
      'Cualquier grado admite su propia dominante delante.',
      'Las cuatríadas son el punto de partida, no el adorno.',
    ],
    weights: {
      ...NONE,
      seventh: 1,
      secondaryDominant: 0.9,
      tritoneSub: 0.8,
      diatonic: 0.6,
      altered: 0.7,
      diminished: 0.6,
      borrowed: 0.5,
      added: 0.4,
    },
  },
};

export const STYLE_IDS: readonly StyleId[] = Object.keys(STYLES) as StyleId[];

export function styleDefinition(id: StyleId): StyleDefinition {
  return STYLES[id];
}
