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

export type LessonId = 'degrees' | 'qualities' | 'circle' | 'borrowed' | 'scales';

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

const BUILDERS: Readonly<Record<LessonId, (tonic: PitchClass, mode: KeyMode) => LessonNotes>> = {
  degrees: degreesLesson,
  qualities: qualitiesLesson,
  circle: circleLesson,
  borrowed: borrowedLesson,
  scales: scalesLesson,
};

export function lessonNotes(id: LessonId, tonic: PitchClass, mode: KeyMode): LessonNotes {
  return BUILDERS[id](tonic, mode);
}
