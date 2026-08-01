/**
 * Teoría para aprender tocando, no leyendo.
 *
 * Cada lección se genera desde la tonalidad en la que estés, así que las
 * preguntas hablan de los acordes que tienes debajo de los dedos ahora mismo y
 * no de un Do mayor de libro. Todo se calcula: aquí no hay respuestas escritas
 * a mano que se puedan desincronizar del resto del dominio.
 */

import { diatonicSevenths, diatonicTriads, chordSymbol } from './chords';
import { accidentalForKey, circlePosition, relativeMajor, relativeMinor } from './circle-of-fifths';
import type { KeyMode } from './keys';
import { keyName } from './keys';
import { normalizePitchClass, noteName, type PitchClass } from './notes';
import { SCALES, scaleNotes, type HeptatonicScaleId } from './scales';

export type LessonId =
  | 'degrees'
  | 'qualities'
  | 'circle'
  | 'borrowed'
  | 'scales'
  | 'functions'
  | 'sevenths'
  | 'substitutions'
  | 'modes'
  | 'cadences';

export interface Lesson {
  readonly id: LessonId;
  readonly title: string;
  /** De qué va, en una frase. */
  readonly summary: string;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'degrees',
    title: 'Los grados',
    summary: 'Los siete acordes que salen de una tonalidad, y cómo se llaman.',
  },
  {
    id: 'qualities',
    title: 'Mayor, menor y el raro',
    summary: 'Por qué unos grados suenan alegres, otros tristes y uno no se sostiene.',
  },
  {
    id: 'circle',
    title: 'La rueda de quintas',
    summary: 'Qué tonalidades son vecinas y dónde está la relativa.',
  },
  {
    id: 'borrowed',
    title: 'Prestados y dominantes',
    summary: 'Los acordes de fuera que llevan usándose toda la vida.',
  },
  {
    id: 'scales',
    title: 'Qué escala tocar',
    summary: 'Cuál encaja encima de la tonalidad y qué cambia entre ellas.',
  },
  {
    id: 'functions',
    title: 'Funciones armónicas',
    summary: 'Reposo, salida y tensión: qué hace cada grado, no solo cómo se llama.',
  },
  {
    id: 'sevenths',
    title: 'Cuatríadas',
    summary: 'Lo que añade la séptima, y por qué cada especie lo cambia distinto.',
  },
  {
    id: 'substitutions',
    title: 'Sustituciones',
    summary: 'Por qué un acorde puede ir donde iría otro, y cuándo no.',
  },
  {
    id: 'modes',
    title: 'Los modos',
    summary: 'Las mismas notas empezando por otro sitio, y lo que eso cambia.',
  },
  {
    id: 'cadences',
    title: 'Cadencias',
    summary: 'Cómo se cierra una frase, y por qué unas suenan terminadas y otras no.',
  },
];

export interface Choice {
  readonly text: string;
  readonly correct: boolean;
}

export interface Exercise {
  readonly prompt: string;
  readonly choices: readonly Choice[];
  /** Por qué la buena es la buena. Se enseña después de contestar. */
  readonly why: string;
}

/** Lo que se explica antes de preguntar, en la tonalidad de quien lee. */
export interface LessonNotes {
  readonly points: readonly string[];
  readonly exercises: readonly Exercise[];
}

/** La escala de siete notas de la que salen los acordes de esa tonalidad. */
function scaleOf(mode: KeyMode): HeptatonicScaleId {
  return mode === 'major' ? 'major' : 'naturalMinor';
}

function up(tonic: PitchClass, semitones: number): PitchClass {
  return normalizePitchClass(tonic + semitones);
}

/**
 * Las opciones de un ejercicio, con la buena escrita primero.
 *
 * Primero **al escribirlas**, que es como se leen bien las cien que hay en este
 * fichero: la respuesta al lado de la pregunta. En qué orden se enseñan lo decide
 * `lessonNotes` al salir, porque durante un tiempo salieron en este mismo orden y
 * la buena era siempre la de la izquierda: se aprobaba el temario sin leer.
 */
function choices(correct: string, wrong: readonly string[]): readonly Choice[] {
  return [{ text: correct, correct: true }, ...wrong.map((text) => ({ text, correct: false }))];
}

function degreesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = diatonicTriads(tonic, scaleOf(mode), accidentalForKey(tonic, mode));
  const accidental = accidentalForKey(tonic, mode);
  const first = triads[0]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;

  return {
    points: [
      `En ${keyName(tonic, mode)} los siete grados son ${triads.map((triad) => triad.symbol).join(', ')}.`,
      'El número romano dice el grado; la mayúscula o minúscula, si el acorde es mayor o menor.',
      `El I es la casa —${first.symbol}—, el V es el que tira hacia ella —${fifth.symbol}— y el IV es el que te aleja sin salirte —${fourth.symbol}—.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál es el V grado de ${keyName(tonic, mode)}?`,
        choices: choices(fifth.symbol, [fourth.symbol, triads[5]!.symbol, triads[1]!.symbol]),
        why: `El V se cuenta cinco grados arriba desde ${noteName(tonic, accidental)}: ${fifth.symbol}.`,
      },
      {
        prompt: `¿Qué grado es ${fourth.symbol} en ${keyName(tonic, mode)}?`,
        choices: choices(fourth.roman, [fifth.roman, triads[1]!.roman, triads[6]!.roman]),
        why: `${fourth.symbol} es el ${fourth.roman}: el cuarto grado de la tonalidad.`,
      },
      {
        prompt: `Estás en ${first.symbol} y quieres el acorde que más tira de vuelta a casa. ¿Cuál?`,
        choices: choices(fifth.symbol, [triads[2]!.symbol, fourth.symbol, triads[5]!.symbol]),
        why: `El V —${fifth.symbol}— es el que pide resolver al I. Es la cadencia de toda la vida.`,
      },
    ],
  };
}

function qualitiesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = diatonicTriads(tonic, scaleOf(mode), accidentalForKey(tonic, mode));
  const sevenths = diatonicSevenths(tonic, scaleOf(mode), accidentalForKey(tonic, mode));
  const diminished = triads.find((triad) => triad.quality === 'diminished')!;
  const minor = triads.find((triad) => triad.quality === 'minor')!;
  const major = triads.find((triad) => triad.quality === 'major')!;

  return {
    points: [
      'La especie sale de las distancias: mayor tiene la tercera a cuatro semitonos, menor a tres.',
      `En ${keyName(tonic, mode)} hay tres mayores, tres menores y uno disminuido: ${diminished.symbol}.`,
      `Al añadir la séptima, cada grado se afina más: ${sevenths[0]!.symbol}, ${sevenths[4]!.symbol}...`,
    ],
    exercises: [
      {
        prompt: `¿Qué especie es ${minor.symbol}?`,
        choices: choices('Menor', ['Mayor', 'Disminuido', 'Aumentado']),
        why: `${minor.symbol} tiene la tercera a tres semitonos de la fundamental: es menor.`,
      },
      {
        prompt: `¿Cuál de estos no se sostiene solo y pide resolver?`,
        choices: choices(diminished.symbol, [major.symbol, minor.symbol, triads[4]!.symbol]),
        why: `${diminished.symbol} es disminuido: lleva la quinta bemol y suena a tensión sin resolver.`,
      },
      {
        prompt: `¿Qué acorde sale del V grado al añadirle la séptima?`,
        choices: choices(sevenths[4]!.symbol, [
          sevenths[0]!.symbol,
          sevenths[3]!.symbol,
          sevenths[5]!.symbol,
        ]),
        why: `El V con séptima es ${sevenths[4]!.symbol}, la dominante: el acorde que más tira al I.`,
      },
    ],
  };
}

function circleLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const relative =
    mode === 'major'
      ? { tonic: relativeMinor(tonic), mode: 'minor' as const }
      : { tonic: relativeMajor(tonic), mode: 'major' as const };
  const fifthUp = up(tonic, 7);
  const fifthDown = up(tonic, 5);
  const position = circlePosition(tonic);

  return {
    points: [
      'La rueda ordena las tonalidades por quintas: cada paso a la derecha añade un sostenido.',
      `${keyName(tonic, mode)} tiene al lado ${keyName(fifthUp, mode)} y ${keyName(fifthDown, mode)}: comparten casi todas las notas.`,
      `Su relativa es ${keyName(relative.tonic, relative.mode)}: mismas notas, distinto centro.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál es la relativa de ${keyName(tonic, mode)}?`,
        choices: choices(keyName(relative.tonic, relative.mode), [
          keyName(fifthUp, mode === 'major' ? 'minor' : 'major'),
          keyName(fifthDown, mode === 'major' ? 'minor' : 'major'),
          keyName(tonic, mode === 'major' ? 'minor' : 'major'),
        ]),
        why: `${keyName(relative.tonic, relative.mode)} usa exactamente las mismas notas: cambia dónde está la casa.`,
      },
      {
        prompt: `Desde ${noteName(tonic, accidental)}, ¿qué tonalidad está una quinta arriba?`,
        choices: choices(noteName(fifthUp, accidental), [
          noteName(fifthDown, accidental),
          noteName(up(tonic, 2), accidental),
          noteName(up(tonic, 4), accidental),
        ]),
        why: `Una quinta son siete semitonos: de ${noteName(tonic, accidental)} se llega a ${noteName(fifthUp, accidental)}.`,
      },
      {
        prompt: `¿Con qué se escribe ${keyName(tonic, mode)}?`,
        choices: choices(
          position <= 6 ? 'Con sostenidos' : 'Con bemoles',
          position <= 6
            ? ['Con bemoles', 'Con los dos', 'Sin alteraciones']
            : ['Con sostenidos', 'Con los dos', 'Sin alteraciones'],
        ),
        why:
          position <= 6
            ? 'Está en la mitad de sostenidos de la rueda, así que sus alteraciones se escriben con #.'
            : 'Está en la mitad de bemoles de la rueda, así que sus alteraciones se escriben con b.',
      },
    ],
  };
}

function borrowedLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const triads = diatonicTriads(tonic, scaleOf(mode), accidentalForKey(tonic, mode));
  // Un grado rebajado se escribe con bemol aunque la tonalidad vaya de
  // sostenidos: el bVII de C es Bb, nunca A#.
  const flatSeven = chordSymbol(up(tonic, 10), 'major', 'flat');
  const secondary = `${chordSymbol(up(tonic, 2), 'major', accidental)}7`;
  const fifth = triads[4]!;

  return {
    points: [
      'Que una nota se salga de la tonalidad no la convierte en un error: media música vive de eso.',
      `El bVII —${flatSeven}— viene del modo menor y en rock es más normal que el propio VII.`,
      `Una dominante secundaria es el V de otro grado: ${secondary} tira hacia ${fifth.symbol} igual que ${fifth.symbol} tira hacia el I.`,
    ],
    exercises: [
      {
        prompt: `En ${keyName(tonic, mode)}, ¿qué acorde es el bVII?`,
        choices: choices(flatSeven, [
          triads[6]!.symbol,
          triads[5]!.symbol,
          chordSymbol(up(tonic, 11), 'major', accidental),
        ]),
        why: `El bVII está un tono por debajo de la tónica: ${flatSeven}.`,
      },
      {
        prompt: `¿Hacia dónde tira ${secondary}?`,
        choices: choices(fifth.symbol, [triads[0]!.symbol, triads[3]!.symbol, triads[1]!.symbol]),
        why: `${secondary} es la dominante de ${fifth.symbol}: es su V prestado, y resuelve ahí.`,
      },
      {
        prompt: 'Un acorde con una nota de fuera de la tonalidad, ¿qué es?',
        choices: choices('Depende de si tiene un uso conocido', [
          'Siempre un error',
          'Siempre válido',
          'Solo vale en jazz',
        ]),
        why: 'Lo que separa un color de un choque es si ese acorde tiene un uso reconocido, no si se sale.',
      },
    ],
  };
}

function scalesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const pentatonic = mode === 'major' ? 'majorPentatonic' : 'minorPentatonic';
  const notes = scaleNotes(tonic, pentatonic)
    .map((note) => noteName(note, accidental))
    .join(', ');
  const full = scaleOf(mode);

  return {
    points: [
      `La pentatónica de ${keyName(tonic, mode)} son cinco notas: ${notes}.`,
      `La escala completa añade dos más y es la que da los acordes: ${SCALES[full].name}.`,
      'El blues mete una nota de paso entre medias; la mixolidia baja la séptima y suena a rock.',
    ],
    exercises: [
      {
        prompt: `¿Cuántas notas tiene la ${SCALES[pentatonic].name.toLowerCase()}?`,
        choices: choices('Cinco', ['Seis', 'Siete', 'Ocho']),
        why: 'Penta es cinco: quita las dos notas que más rozan y por eso perdona tanto.',
      },
      {
        prompt: `¿Qué escala da los siete acordes de ${keyName(tonic, mode)}?`,
        choices: choices(SCALES[full].name, [
          SCALES[pentatonic].name,
          SCALES.blues.name,
          SCALES.dorian.name,
        ]),
        why: `Los grados salen de apilar terceras sobre ${SCALES[full].name.toLowerCase()}.`,
      },
      {
        prompt: '¿Qué le pasa a la mixolidia respecto a la mayor?',
        choices: choices('Baja la séptima', [
          'Baja la tercera',
          'Sube la cuarta',
          'No cambia nada',
        ]),
        why: 'Esa séptima bemol es lo que la aleja del pop y la acerca al rock.',
      },
    ],
  };
}

/**
 * Funciones armónicas. Es la lección que le faltaba a la aplicación: la pantalla
 * de componer lleva las letras T, S y D desde que se reordenaron las
 * sugerencias, y hasta ahora no había dónde aprender qué significan.
 */
function functionsLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const triads = diatonicTriads(tonic, scaleOf(mode), accidentalForKey(tonic, mode));
  const first = triads[0]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;
  const sixth = triads[5]!;
  const second = triads[1]!;

  return {
    points: [
      'Tres papeles y nada más: la tónica reposa, la subdominante sale de casa y la dominante aprieta para volver.',
      `En ${keyName(tonic, mode)} reposan ${first.symbol}, ${triads[2]!.symbol} y ${sixth.symbol}; salen ${second.symbol} y ${fourth.symbol}; y aprietan ${fifth.symbol} y ${triads[6]!.symbol}.`,
      `No es una etiqueta puesta a dedo: ${first.symbol} y ${sixth.symbol} comparten dos de sus tres notas, y por eso hacen el mismo papel.`,
      'La dominante es la única que lleva el tritono dentro. Ahí está toda su prisa por resolver.',
    ],
    exercises: [
      {
        prompt: `¿Qué papel hace ${fifth.symbol} en ${keyName(tonic, mode)}?`,
        choices: choices('Dominante: aprieta y pide volver a la tónica', [
          'Tónica: es donde la frase reposa',
          'Subdominante: sale de casa sin tensión',
          'Ninguno: está fuera de la tonalidad',
        ]),
        why: `${fifth.symbol} es el V. Lleva el tritono con la séptima y es el que más tira hacia ${first.symbol}.`,
      },
      {
        prompt: `¿Cuál de estos reposa igual que ${first.symbol}?`,
        choices: choices(sixth.symbol, [fourth.symbol, fifth.symbol, second.symbol]),
        why: `${sixth.symbol} comparte dos notas con ${first.symbol} y hace el mismo papel de reposo: es su relativo.`,
      },
      {
        prompt: '¿Qué suele venir después de una subdominante?',
        choices: choices('La dominante', [
          'Otra subdominante, siempre',
          'Nada: la subdominante cierra la frase',
          'El acorde disminuido',
        ]),
        why: 'El camino de siempre es tónica, subdominante, dominante y vuelta a la tónica. La subdominante prepara la tensión.',
      },
      {
        prompt: 'Quieres terminar una frase de forma que suene cerrada. ¿En cuál la dejas?',
        choices: choices(first.symbol, [fifth.symbol, second.symbol, triads[6]!.symbol]),
        why: `Solo la tónica cierra. Dejarla en ${fifth.symbol} deja la frase preguntando.`,
      },
    ],
  };
}

/** Cuatríadas: qué añade la séptima y por qué cada especie la cambia distinto. */
function seventhsLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const triads = diatonicTriads(tonic, scaleOf(mode), accidental);
  const sevenths = diatonicSevenths(tonic, scaleOf(mode), accidental);
  const first = sevenths[0]!;
  const fifth = sevenths[4]!;
  const second = sevenths[1]!;
  const seventh = sevenths[6]!;

  return {
    points: [
      `Apilar una tercera más sobre cada grado da las cuatríadas: ${sevenths.map((chord) => chord.symbol).join(', ')}.`,
      'La séptima no es un adorno: en el V aparece el tritono, y eso es lo que le hace pedir resolver.',
      `Séptima mayor y séptima de dominante no son lo mismo. ${first.symbol} suena abierto; ${fifth.symbol} suena a que falta algo.`,
      'Un acorde de dominante solo hay uno en la tonalidad, y está sobre el quinto grado.',
    ],
    exercises: [
      {
        prompt: `¿Cuál de estas cuatríadas es la de dominante en ${keyName(tonic, mode)}?`,
        choices: choices(fifth.symbol, [first.symbol, second.symbol, sevenths[3]!.symbol]),
        why: `${fifth.symbol} está sobre el quinto grado y es la única con tercera mayor y séptima menor: eso es una dominante.`,
      },
      {
        prompt: `¿Qué le pasa a ${triads[0]!.symbol} cuando le añades la séptima de la tonalidad?`,
        choices: choices(`Se convierte en ${first.symbol}`, [
          `Se convierte en ${fifth.symbol}`,
          'Deja de ser el primer grado',
          'Cambia de mayor a menor',
        ]),
        why: `La séptima de la escala sobre ${triads[0]!.symbol} da ${first.symbol}: el mismo grado y el mismo papel, con una nota más.`,
      },
      {
        prompt: `${seventh.symbol} lleva la quinta bemol. ¿Cómo se llama esa especie?`,
        choices: choices('Semidisminuido', [
          'Disminuido entero',
          'Menor con séptima mayor',
          'Aumentado',
        ]),
        why: 'Semidisminuido: quinta bemol y séptima menor. El disminuido entero llevaría la séptima también bemol, y se escribe °7, no ø7.',
      },
    ],
  };
}

/** Sustituciones: por qué un acorde ocupa el sitio de otro. */
function substitutionsLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const triads = diatonicTriads(tonic, scaleOf(mode), accidental);
  const first = triads[0]!;
  const second = triads[1]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;
  const sixth = triads[5]!;
  const tritone = noteName(up(tonic, 1), accidental);

  return {
    points: [
      'Dos acordes se pueden cambiar el uno por el otro cuando hacen el mismo papel y comparten notas. No hay más misterio.',
      `${sixth.symbol} va donde iría ${first.symbol}: dos notas en común y el mismo reposo.`,
      `${second.symbol} va donde iría ${fourth.symbol}: dos notas en común y la misma salida.`,
      `El sustituto tritonal es otra cosa: ${tritone}7 lleva el mismo tritono que ${fifth.symbol}7, así que aprieta igual aunque la fundamental esté a un tritono.`,
    ],
    exercises: [
      {
        prompt: `Quieres cambiar ${first.symbol} por algo que repose igual pero suene menos obvio. ¿Cuál?`,
        choices: choices(sixth.symbol, [fifth.symbol, triads[6]!.symbol, second.symbol]),
        why: `${sixth.symbol} es el relativo menor: comparte dos notas con ${first.symbol} y hace el mismo papel.`,
      },
      {
        prompt: '¿Qué comparten una dominante y su sustituto tritonal?',
        choices: choices('El tritono', [
          'La fundamental',
          'Las cuatro notas',
          'Nada: es una licencia sin explicación',
        ]),
        why: 'El tritono es simétrico: el mismo par de notas sirve a dos dominantes distintas. Por eso una puede ir por la otra.',
      },
      {
        prompt: `¿Se puede sustituir ${fifth.symbol} por ${fourth.symbol} sin más?`,
        choices: choices('No: uno aprieta y el otro no, hacen papeles distintos', [
          'Sí: los dos están en la tonalidad',
          'Sí: comparten dos notas',
          'Solo en modo menor',
        ]),
        why: `${fifth.symbol} es dominante y ${fourth.symbol} subdominante. Estar en la tonalidad no basta: la sustitución va por función, no por vecindad.`,
      },
    ],
  };
}

/** Modos: las mismas notas empezando por otro sitio. */
function modesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const root = noteName(tonic, accidental);
  const dorian = scaleNotes(tonic, 'dorian').map((note) => noteName(note, accidental));
  const mixolydian = scaleNotes(tonic, 'mixolydian').map((note) => noteName(note, accidental));
  const phrygian = scaleNotes(tonic, 'phrygian').map((note) => noteName(note, accidental));

  return {
    points: [
      'Un modo no es una escala nueva: son las mismas siete notas tomando otra como centro. Lo que cambia es dónde caen los semitonos.',
      `Dórico sobre ${root}: ${dorian.join(' · ')}. Es un menor con la sexta mayor, así que suena menos triste.`,
      `Mixolidio sobre ${root}: ${mixolydian.join(' · ')}. Mayor con la séptima menor: de ahí sale el bVII del rock.`,
      `Frigio sobre ${root}: ${phrygian.join(' · ')}. Menor con el segundo grado bemol, el semitono pegado a la tónica.`,
    ],
    exercises: [
      {
        prompt: '¿Qué distingue al dórico de la menor natural?',
        choices: choices('La sexta, que es mayor', [
          'La tercera, que es mayor',
          'La séptima, que es mayor',
          'Nada: son la misma escala',
        ]),
        why: 'Dórico y menor natural solo se diferencian en la sexta. Ese semitono es todo el color dórico.',
      },
      {
        prompt: '¿De qué modo sale el bVII que usa medio repertorio de rock?',
        choices: choices('Mixolidio', ['Frigio', 'Dórico', 'Lidio']),
        why: 'El mixolidio es mayor con séptima menor. Sobre esa séptima se arma el bVII, que vuelve a la tónica sin sensible.',
      },
      {
        prompt: '¿Cuál es el modo del semitono pegado encima de la tónica?',
        choices: choices('Frigio', ['Mixolidio', 'Dórico', 'Jónico']),
        why: 'El frigio tiene el segundo grado bemol: un semitono desde la tónica. Es el color del metal y del flamenco.',
      },
    ],
  };
}

/** Cadencias: cómo se cierra una frase. */
function cadencesLesson(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const accidental = accidentalForKey(tonic, mode);
  const triads = diatonicTriads(tonic, scaleOf(mode), accidental);
  const first = triads[0]!;
  const fourth = triads[3]!;
  const fifth = triads[4]!;
  const sixth = triads[5]!;
  const flatSeventh = noteName(up(tonic, 10), accidental);

  return {
    points: [
      `Cadencia auténtica: ${fifth.symbol} a ${first.symbol}. Es la que suena más cerrada, porque la sensible sube medio tono a la tónica.`,
      `Cadencia plagal: ${fourth.symbol} a ${first.symbol}. Cierra, pero con menos empuje: no hay sensible que resolver.`,
      `Cadencia rota: ${fifth.symbol} a ${sixth.symbol}. Prepara el cierre y no lo da, que es justo lo que la hace interesante.`,
      `Y la del rock: ${flatSeventh} a ${first.symbol}, sin sensible ninguna. En un coral sería un error; en un riff es el idioma.`,
    ],
    exercises: [
      {
        prompt: '¿Cuál de estas cierra con más fuerza?',
        choices: choices(`${fifth.symbol} → ${first.symbol}`, [
          `${fourth.symbol} → ${first.symbol}`,
          `${fifth.symbol} → ${sixth.symbol}`,
          `${first.symbol} → ${fourth.symbol}`,
        ]),
        why: 'La auténtica, V a I: la sensible sube medio tono a la tónica y eso es lo que suena a punto final.',
      },
      {
        prompt: `¿Cómo se llama ir de ${fifth.symbol} a ${sixth.symbol} en vez de a ${first.symbol}?`,
        choices: choices('Cadencia rota', [
          'Cadencia plagal',
          'Cadencia auténtica',
          'Sustitución tritonal',
        ]),
        why: 'Rota: la dominante prepara el cierre y se desvía al relativo. Deja la frase abierta a propósito.',
      },
      {
        prompt: `¿Por qué ${flatSeventh} → ${first.symbol} no suena a coral?`,
        choices: choices('Porque no hay sensible: nadie sube medio tono a la tónica', [
          'Porque el bVII no existe en ninguna tonalidad',
          'Porque son dos acordes menores',
          'Porque le falta la quinta',
        ]),
        why: 'El bVII llega desde un tono entero por debajo. Sin sensible no hay ese empujón, y por eso suena a riff y no a cadencia clásica.',
      },
    ],
  };
}

const BUILDERS: Readonly<Record<LessonId, (tonic: PitchClass, mode: KeyMode) => LessonNotes>> = {
  degrees: degreesLesson,
  qualities: qualitiesLesson,
  circle: circleLesson,
  borrowed: borrowedLesson,
  scales: scalesLesson,
  functions: functionsLesson,
  sevenths: seventhsLesson,
  substitutions: substitutionsLesson,
  modes: modesLesson,
  cadences: cadencesLesson,
};

/**
 * Un número estable sacado de un texto (FNV-1a de 32 bits).
 *
 * Cuatro líneas y sin dependencias, que es todo lo que hace falta: no se está
 * cifrando nada, solo repartiendo. `>>> 0` en cada vuelta porque en JavaScript la
 * multiplicación se sale de los 32 bits y sin eso el resultado deja de ser el
 * mismo en máquinas distintas.
 */
function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash ^ text.charCodeAt(i)) * 0x01000193) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

/**
 * Baraja las opciones **sin azar de verdad**, y eso es lo importante.
 *
 * Con `Math.random()` las opciones cambiarían de sitio en cada repintado: bastaría
 * con que React volviera a pintar la pregunta —al contestar, al cambiar de
 * tonalidad, al llegar el cupo de la IA— para que el botón se moviera debajo del
 * dedo. Aquí la misma pregunta con las mismas opciones sale siempre igual, y dos
 * preguntas distintas salen distintas, que es lo único que se pedía.
 *
 * Como la semilla sale del texto de la pregunta y del de sus opciones, y las
 * opciones se generan en tu tonalidad, la misma pregunta en otra tonalidad reparte
 * de otra forma. Fisher-Yates con un generador xorshift de 32 bits.
 */
function shuffled(choices: readonly Choice[], seed: number): readonly Choice[] {
  const out = [...choices];
  let state = seed;

  for (let i = out.length - 1; i > 0; i -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;

    const j = state % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }

  return out;
}

function arranged(exercise: Exercise): Exercise {
  const semilla = seedFrom(
    `${exercise.prompt}|${exercise.choices.map((choice) => choice.text).join('|')}`,
  );
  return { ...exercise, choices: shuffled(exercise.choices, semilla) };
}

/**
 * La lección en tu tonalidad, con las opciones ya repartidas.
 *
 * El reparto se hace aquí, en la única puerta por la que salen las lecciones, y no
 * en cada uno de los cien ejercicios: escribirlos con la buena delante es lo que
 * los hace legibles, y quien lo haga mañana no tiene que acordarse de nada.
 */
export function lessonNotes(id: LessonId, tonic: PitchClass, mode: KeyMode): LessonNotes {
  const notes = BUILDERS[id](tonic, mode);
  return { ...notes, exercises: notes.exercises.map(arranged) };
}
