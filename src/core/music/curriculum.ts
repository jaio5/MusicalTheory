/**
 * La escalera: qué se aprende, en qué orden y agrupado en cursos.
 *
 * Dos grados como en el conservatorio —Elemental de cuatro cursos y Profesional
 * de seis— pero por dentro funciona como una aplicación de idiomas: cada curso
 * son unas pocas **unidades** cortas, de las que se hacen en tres minutos con la
 * guitarra en las manos. Una unidad larga se abandona a la mitad; cinco cortas
 * se terminan.
 *
 * Aquí no hay preguntas escritas: una unidad dice **de qué va** y quién genera
 * sus ejercicios es `lessons.ts` para la teoría y el ejercicio de escala para lo
 * que se toca. Así el contenido se calcula en la tonalidad de quien estudia y no
 * se desincroniza del resto del dominio.
 *
 * El orden importa y no es decorativo: cada curso solo usa lo que ya se ha
 * explicado antes. Las funciones armónicas van después de los grados porque no
 * se puede hablar de dominante sin saber qué es el quinto.
 */

import type { LessonId } from './lessons';
import type { ScaleId } from './scales';

export type GradeId = 'elemental' | 'profesional';

export interface Grade {
  readonly id: GradeId;
  readonly name: string;
  /** Qué se saca de este grado, en una frase. */
  readonly summary: string;
}

export const GRADES: readonly Grade[] = [
  {
    id: 'elemental',
    name: 'Grado Elemental',
    summary: 'De no saber qué es una tonalidad a tocar sus acordes y su escala.',
  },
  {
    id: 'profesional',
    name: 'Grado Profesional',
    summary: 'Funciones, cuatríadas, sustituciones y modos: por qué funciona lo que tocas.',
  },
];

/**
 * De qué tipo es una unidad.
 *
 * `theory` se contesta con el ratón y `play` con la guitarra. Un curso mezcla
 * las dos a propósito: saber que el quinto grado es dominante y encontrarlo en
 * el mástil son dos cosas distintas, y esta aplicación existe por la segunda.
 */
export type UnitKind = 'theory' | 'play';

interface BaseUnit {
  readonly id: string;
  readonly title: string;
  /** Cuánto suma al terminarla. */
  readonly xp: number;
}

export interface TheoryUnit extends BaseUnit {
  readonly kind: 'theory';
  /** De dónde salen las preguntas. */
  readonly lesson: LessonId;
}

export interface PlayUnit extends BaseUnit {
  readonly kind: 'play';
  /** Qué escala hay que tocar, subiendo y bajando, validada por el micro. */
  readonly scaleId: ScaleId;
}

export type Unit = TheoryUnit | PlayUnit;

export interface Course {
  readonly id: string;
  readonly grade: GradeId;
  /** El curso dentro del grado: 1 a 4 en Elemental, 1 a 6 en Profesional. */
  readonly year: number;
  readonly title: string;
  readonly summary: string;
  readonly units: readonly Unit[];
}

/** Lo que suma una unidad. Tocar da más que contestar: cuesta más. */
const THEORY_XP = 20;
const PLAY_XP = 35;

function theory(id: string, title: string, lesson: LessonId): TheoryUnit {
  return { id, title, kind: 'theory', lesson, xp: THEORY_XP };
}

function play(id: string, title: string, scaleId: ScaleId): PlayUnit {
  return { id, title, kind: 'play', scaleId, xp: PLAY_XP };
}

/**
 * Los diez cursos, en orden.
 *
 * El Elemental se apoya en las lecciones que ya existían; el Profesional en las
 * que se escribieron para él —funciones, cuatríadas, sustituciones, modos y
 * cadencias—, que son justamente la teoría que la pantalla de componer usa sin
 * explicar.
 */
export const COURSES: readonly Course[] = [
  {
    id: 'elemental-1',
    grade: 'elemental',
    year: 1,
    title: 'Los siete grados',
    summary: 'Una tonalidad da siete acordes. Cuáles son y cómo se llaman.',
    units: [
      theory('e1-grados', 'Qué es un grado', 'degrees'),
      play('e1-escala', 'La escala mayor, entera', 'major'),
      theory('e1-repaso', 'Repaso de los grados', 'degrees'),
    ],
  },
  {
    id: 'elemental-2',
    grade: 'elemental',
    year: 2,
    title: 'Mayor, menor y el raro',
    summary: 'Por qué unos grados suenan alegres, otros tristes y uno no se sostiene.',
    units: [
      theory('e2-calidades', 'Las calidades', 'qualities'),
      play('e2-menor', 'La menor natural', 'naturalMinor'),
      theory('e2-repaso', 'Distinguirlas de oído', 'qualities'),
    ],
  },
  {
    id: 'elemental-3',
    grade: 'elemental',
    year: 3,
    title: 'La rueda de quintas',
    summary: 'Qué tonalidades son vecinas, dónde está la relativa y por qué.',
    units: [
      theory('e3-rueda', 'Vecinas y relativas', 'circle'),
      play('e3-pentatonica', 'La pentatónica mayor', 'majorPentatonic'),
    ],
  },
  {
    id: 'elemental-4',
    grade: 'elemental',
    year: 4,
    title: 'Qué escala tocar',
    summary: 'Cuál encaja encima de la tonalidad y qué cambia de una a otra.',
    units: [
      theory('e4-escalas', 'Elegir la escala', 'scales'),
      play('e4-pentatonica', 'La pentatónica menor', 'minorPentatonic'),
      play('e4-blues', 'La de blues, con su quinta bemol', 'blues'),
    ],
  },
  {
    id: 'profesional-1',
    grade: 'profesional',
    year: 1,
    title: 'Funciones armónicas',
    summary: 'Tónica, subdominante y dominante: qué hace cada acorde, no solo cómo se llama.',
    units: [
      theory('p1-funciones', 'Reposo, salida y tensión', 'functions'),
      play('p1-escala', 'La mayor, otra vez, ya sabiendo qué es cada grado', 'major'),
      theory('p1-repaso', 'Repartir los grados', 'functions'),
    ],
  },
  {
    id: 'profesional-2',
    grade: 'profesional',
    year: 2,
    title: 'Cuatríadas',
    summary: 'La séptima cambia lo que el acorde hace, y cada especie la cambia distinto.',
    units: [
      theory('p2-cuatriadas', 'Las siete especies', 'sevenths'),
      theory('p2-cifrado', 'Escribirlas sin confundirlas', 'sevenths'),
    ],
  },
  {
    id: 'profesional-3',
    grade: 'profesional',
    year: 3,
    title: 'Prestados y dominantes',
    summary: 'Los acordes de fuera que llevan usándose toda la vida.',
    units: [
      theory('p3-prestados', 'Prestar del modo paralelo', 'borrowed'),
      play('p3-mixolidio', 'El mixolidio, de donde sale el bVII', 'mixolydian'),
    ],
  },
  {
    id: 'profesional-4',
    grade: 'profesional',
    year: 4,
    title: 'Sustituciones',
    summary: 'Por qué un acorde puede ir donde iría otro, y cuándo no.',
    units: [
      theory('p4-sustituciones', 'Cambiar un acorde por otro', 'substitutions'),
      theory('p4-tritono', 'El sustituto tritonal', 'substitutions'),
    ],
  },
  {
    id: 'profesional-5',
    grade: 'profesional',
    year: 5,
    title: 'Los modos',
    summary: 'Las mismas notas empezando por otro sitio, y lo que eso cambia.',
    units: [
      theory('p5-modos', 'Qué es un modo', 'modes'),
      play('p5-dorico', 'El dórico, el menor menos triste', 'dorian'),
      play('p5-frigio', 'El frigio, con el semitono de arriba', 'phrygian'),
    ],
  },
  {
    id: 'profesional-6',
    grade: 'profesional',
    year: 6,
    title: 'Cadencias',
    summary: 'Cómo se termina una frase, y por qué unas suenan cerradas y otras no.',
    units: [
      theory('p6-cadencias', 'Las cadencias que se usan', 'cadences'),
      play('p6-armonica', 'La menor armónica, la de la sensible', 'harmonicMinor'),
      theory('p6-repaso', 'Reconocerlas por el camino', 'cadences'),
    ],
  },
];

/** Todas las unidades en el orden en el que se estudian. */
export const UNIT_ORDER: readonly string[] = COURSES.flatMap((course) =>
  course.units.map((unit) => unit.id),
);

export function coursesOfGrade(grade: GradeId): readonly Course[] {
  return COURSES.filter((course) => course.grade === grade);
}

export function findCourse(id: string): Course | null {
  return COURSES.find((course) => course.id === id) ?? null;
}

export function findUnit(id: string): { course: Course; unit: Unit } | null {
  for (const course of COURSES) {
    const unit = course.units.find((candidate) => candidate.id === id);
    if (unit !== undefined) {
      return { course, unit };
    }
  }
  return null;
}

/** Cuánto XP se puede sacar en total. Sirve para pintar el avance global. */
export const TOTAL_XP: number = COURSES.reduce(
  (total, course) => total + course.units.reduce((sum, unit) => sum + unit.xp, 0),
  0,
);
