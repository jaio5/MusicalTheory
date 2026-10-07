/**
 * Estilos: qué se hace normalmente en cada uno.
 *
 * No es una clasificación musicológica, es una chuleta. Cada estilo dice qué
 * escalas se usan, qué familias de acordes pesan y qué se puede hacer, para que
 * las sugerencias no sean siempre las mismas siete.
 */

import type { ScaleId } from './scales';

export type StyleId =
  | 'rock'
  | 'blues'
  | 'metal'
  | 'pop'
  | 'folk'
  | 'jazz'
  | 'funk'
  | 'country'
  | 'reggae'
  | 'bolero'
  | 'flamenco'
  | 'cine';

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
      seventh: 0.8,
      borrowed: 0.75,
      suspended: 0.6,
      added: 0.45,
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
      seventh: 0.5,
      suspended: 0.3,
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
      seventh: 0.85,
      added: 0.8,
      secondaryDominant: 0.65,
      suspended: 0.55,
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
      seventh: 0.8,
      added: 0.7,
      suspended: 0.65,
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
  // Los seis de aquí abajo llegaron porque sin ellos las salidas se juzgaban con el
  // estilo más cercano —un funk como blues, un bolero como jazz, una andaluza como
  // nada— y fallaban justo en lo que hace que cada uno sea él.
  funk: {
    id: 'funk',
    name: 'Funk',
    summary: 'Un acorde con séptima que no se mueve, y el ritmo hace el resto.',
    scales: ['dorian', 'mixolydian', 'minorPentatonic', 'blues'],
    tips: [
      'I7 durante compases y compases: la armonía va lenta para que el ritmo corra.',
      'El vamp de dos, I7 – IV7, o im7 – IV7 en menor: el IV mayor es el dórico.',
      'La dominante no tiene por qué resolver. Se queda, se suspende, vuelve.',
      'Novenas, 7sus4 y el 7#9: color encima del mismo acorde, no acordes nuevos.',
    ],
    // Las cuatríadas de la escala pesan menos que el I7 y el IV7, que en
    // `suggestions.ts` llevan su peso propio: el Imaj7 no es la casa del funk.
    weights: {
      ...NONE,
      seventh: 0.85,
      diatonic: 0.8,
      altered: 0.7,
      suspended: 0.65,
      added: 0.6,
      borrowed: 0.6,
      secondaryDominant: 0.3,
      power: 0.3,
      tritoneSub: 0.2,
    },
  },
  country: {
    id: 'country',
    name: 'Country',
    summary: 'I, IV y V con su séptima, y el II7 que empuja hacia el V.',
    scales: ['majorPentatonic', 'major', 'mixolydian'],
    tips: [
      'I – IV – V y vuelta, con el V7 de siempre: lo que importa es dónde cae cada uno.',
      'El II7 —la dominante del V— antes del V7 es la firma del country.',
      'IV – I cierra suave, y el I7 que se va al IV abre el cambio.',
      'Poco préstamo: el bVII y el iv de vez en cuando, nunca de base.',
    ],
    weights: {
      ...NONE,
      diatonic: 1,
      secondaryDominant: 0.75,
      seventh: 0.7,
      added: 0.6,
      suspended: 0.5,
      borrowed: 0.3,
      power: 0.3,
    },
  },
  reggae: {
    id: 'reggae',
    name: 'Reggae',
    summary: 'Dos acordes en vaivén, a contratiempo y sin prisa.',
    scales: ['major', 'naturalMinor', 'minorPentatonic', 'dorian'],
    tips: [
      'I – IV o I – V, una y otra vez: el vaivén es la canción, no un relleno.',
      'En menor, i – iv o i – VII. El VII cierra sin sensible y es lo de casa.',
      'El acorde suena en el contratiempo: la guitarra calla en el pulso y pica entre medias.',
      'Los acordes cambian cada compás o cada medio compás, nunca más deprisa.',
    ],
    weights: {
      ...NONE,
      diatonic: 1,
      seventh: 0.6,
      borrowed: 0.45,
      added: 0.4,
      suspended: 0.4,
      secondaryDominant: 0.2,
    },
  },
  bolero: {
    id: 'bolero',
    name: 'Bolero',
    summary: 'Dominantes que se encadenan, y el menor armónico de fondo.',
    scales: ['harmonicMinor', 'major', 'naturalMinor'],
    tips: [
      'Cada grado admite su dominante delante, y una lleva a otra: V/ii – ii – V – I.',
      'La tónica con séptima, I7, se va al IV: en menor, la V/iv que lleva al iv.',
      'El menor armónico manda: V7 – i con la sensible, nunca el VII que cierra sin ella.',
      'El bII7 baja medio tono a la tónica, y el bII sin séptima va al V: el napolitano.',
    ],
    weights: {
      ...NONE,
      seventh: 1,
      secondaryDominant: 1,
      diatonic: 0.7,
      diminished: 0.7,
      tritoneSub: 0.6,
      altered: 0.6,
      added: 0.6,
      borrowed: 0.45,
      // El napolitano delante del V7, el bII – V7 – i del bolero en menor.
      neapolitan: 0.4,
      suspended: 0.2,
    },
  },
  flamenco: {
    id: 'flamenco',
    name: 'Flamenco',
    summary: 'La bajada andaluza y el V mayor, que es reposo y no tensión.',
    scales: ['phrygian', 'harmonicMinor', 'naturalMinor'],
    tips: [
      'i – VII – VI – V: la cadencia andaluza baja por grados y se para en el V.',
      'El V mayor es el centro del modo de Mi: llegar a él es llegar, no quedarse a medias.',
      'VI – V es el semitono frigio: el bII y el I del V. Y el bII sobre la tónica, igual.',
      'La sensible solo vive en el V mayor: un vii° o una dominante de paso suenan a otro sitio.',
    ],
    weights: {
      ...NONE,
      diatonic: 1,
      neapolitan: 0.8,
      borrowed: 0.6,
      altered: 0.6,
      seventh: 0.5,
      added: 0.5,
      power: 0.3,
      suspended: 0.3,
      secondaryDominant: 0.25,
      diminished: 0.2,
    },
  },
  cine: {
    id: 'cine',
    name: 'Cine',
    summary: 'El menor prestado, mediantes que dan un salto y un pedal debajo.',
    scales: ['naturalMinor', 'major', 'dorian', 'phrygian'],
    tips: [
      'bVI – bVII – I: la subida épica, prestada del menor, sin pasar por el V.',
      'El iv sobre el I nubla la casa; IV – iv – I es la despedida.',
      'Mediantes que saltan a una tercera: I – bIII, I – bVI, I – III. Comparten una nota y cambian el mundo.',
      'Un bajo que se queda —un pedal— y los acordes encima: el modo lo pone el color, no la cadencia.',
    ],
    weights: {
      ...NONE,
      borrowed: 1,
      diatonic: 0.9,
      seventh: 0.6,
      added: 0.6,
      suspended: 0.55,
      power: 0.5,
      altered: 0.3,
      neapolitan: 0.3,
      diminished: 0.2,
      secondaryDominant: 0.15,
    },
  },
};

export const STYLE_IDS: readonly StyleId[] = Object.keys(STYLES) as StyleId[];

/**
 * Los estilos en tres grupos, para el selector: con doce, una lista suelta ya no se
 * lee de un vistazo. **Por el idioma armónico y no por la historia**, que es lo que
 * cambia lo que propone la aplicación: el riff y las dominantes sin resolver, la
 * canción de tres o cuatro acordes, y la armonía que vive del color —secundarias,
 * préstamos, el modo—. Cada estilo está en uno, y en uno solo (lo vigila su test).
 */
export const STYLE_GROUPS: readonly { readonly name: string; readonly ids: readonly StyleId[] }[] =
  [
    { name: 'De riff', ids: ['rock', 'metal', 'blues', 'funk'] },
    { name: 'De canción', ids: ['pop', 'folk', 'country', 'reggae'] },
    { name: 'De armonía', ids: ['jazz', 'bolero', 'flamenco', 'cine'] },
  ];
