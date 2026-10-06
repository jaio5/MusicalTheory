/**
 * La escalera: qué se aprende, en qué orden y agrupado en cursos.
 *
 * Dos grados como en el conservatorio —Elemental de cuatro cursos y Profesional
 * de seis—, con el temario en el orden en el que allí se estudia, pero por
 * dentro funciona como una aplicación de idiomas: cada curso son unas pocas
 * **unidades** cortas, de las que se hacen en tres minutos con la guitarra en
 * las manos. Una unidad larga se abandona a la mitad; cinco cortas
 * se terminan.
 *
 * Aquí no hay preguntas escritas: una unidad dice **de qué va** y quién genera
 * sus ejercicios es `lessons.ts` para la teoría, `ear.ts` para el oído y el
 * ejercicio de escala para lo que se toca. Así el contenido se calcula en la tonalidad de quien estudia y no
 * se desincroniza del resto del dominio. Lo que se cuenta al entrar en cada
 * unidad tampoco está aquí, sino en `presentaciones.ts`: el temario lo lee todo
 * el que lee el avance, y ese texto solo lo pintan dos pantallas.
 *
 * El orden importa y no es decorativo: cada curso solo usa lo que ya se ha
 * explicado antes. Las funciones armónicas van después de los grados porque no
 * se puede hablar de dominante sin saber qué es el quinto.
 */

import type { EarKind } from './ear';
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
    summary: 'Lenguaje musical: leer notas y ritmo, escalas, intervalos, tonalidades y acordes.',
  },
  {
    id: 'profesional',
    name: 'Grado Profesional',
    summary: 'Armonía: funciones, cadencias, enlace, séptimas, modulación, cromatismo y modos.',
  },
];

/**
 * De qué tipo es una unidad.
 *
 * `theory` se contesta con el ratón, `ear` con el oído y `play` con la guitarra.
 * Un curso mezcla las tres a propósito: saber que el quinto grado es dominante,
 * reconocerlo cuando suena y encontrarlo en el mástil son tres cosas distintas,
 * y esta aplicación existe por las dos últimas.
 *
 * El oído se añadió el último y es el que faltaba: sin él, todo lo que se
 * aprendía aquí daba por hecho que ya sabías cómo suena lo que estabas
 * estudiando. Y es lo que hace falta para lo que la aplicación hace de verdad:
 * si el motor de croma dice «Am» y no sabes si suena a Am, no puedes corregirlo
 * cuando se equivoca.
 */
export type UnitKind = 'theory' | 'ear' | 'play';

interface BaseUnit {
  /**
   * El nombre fijo con el que el avance la guarda. **No dice el curso**: se
   * conservan aunque la unidad cambie de sitio, porque renombrarlo borraría lo
   * hecho de quien ya la pasó.
   */
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

export interface EarUnit extends BaseUnit {
  readonly kind: 'ear';
  /** Qué se pregunta: la especie, el grado o la cadencia. */
  readonly ear: EarKind;
}

export interface PlayUnit extends BaseUnit {
  readonly kind: 'play';
  /** Qué escala hay que tocar, subiendo y bajando, validada por el micro. */
  readonly scaleId: ScaleId;
}

export type Unit = TheoryUnit | EarUnit | PlayUnit;

export interface Course {
  readonly id: string;
  readonly grade: GradeId;
  /** El curso dentro del grado: 1 a 4 en Elemental, 1 a 6 en Profesional. */
  readonly year: number;
  readonly title: string;
  readonly summary: string;
  readonly units: readonly Unit[];
}

/**
 * Lo que suma una unidad, y por qué no valen lo mismo.
 *
 * Contestar leyendo es lo más barato. Reconocer de oído cuesta más —hay que
 * haberlo oído antes, no basta con haberlo entendido— y tocarlo es lo que más,
 * porque además hay que encontrarlo en el mástil.
 */
const THEORY_XP = 20;
const EAR_XP = 25;
const PLAY_XP = 35;

function theory(id: string, title: string, lesson: LessonId): TheoryUnit {
  return { id, title, kind: 'theory', lesson, xp: THEORY_XP };
}

function ear(id: string, title: string, kind: EarKind): EarUnit {
  return { id, title, kind: 'ear', ear: kind, xp: EAR_XP };
}

function play(id: string, title: string, scaleId: ScaleId): PlayUnit {
  return { id, title, kind: 'play', scaleId, xp: PLAY_XP };
}

/**
 * Los diez cursos, en el orden del conservatorio.
 *
 * El Elemental sigue a **Lenguaje Musical**: primero cómo se escribe el sonido
 * —notas, claves, figuras y compás—, luego la escala mayor y los intervalos, las
 * tonalidades con sus armaduras y el modo menor, y al final los acordes. El
 * Profesional sigue a **Armonía**: funciones y cadencias, inversiones y enlace,
 * la séptima de dominante, dominantes secundarias y modulación, cromatismo, y
 * los modos como cierre.
 *
 * Antes el Elemental empezaba por los grados, que es empezar por el tejado: no
 * se puede contar «el quinto grado» sin saber qué es una escala ni medir una
 * tercera sin saber qué es un semitono. Y había seis unidades que repetían la
 * lección de otra —los «repaso», «el sustituto tritonal», «la mayor, otra vez» y
 * «escribirlas sin confundirlas»—: prometían algo nuevo y daban lo mismo. Las
 * cinco primeras se fueron, porque repasar ya lo hace `/aprender/repaso` con lo
 * que de verdad se falló; la última se quedó con lección propia, la séptima de
 * dominante y su cifrado, que es lo que su título prometía.
 *
 * Las escalas que no son de conservatorio —pentatónicas, blues— se quedan,
 * porque esta aplicación es para tocar, y van donde ya se tiene la teoría que
 * las explica.
 */
export const COURSES: readonly Course[] = [
  {
    id: 'elemental-1',
    grade: 'elemental',
    year: 1,
    title: 'El sonido escrito',
    summary: 'Cómo se llaman las notas, dónde van en el pentagrama y cómo se mide el tiempo.',
    units: [
      theory('e1-notas', 'Las notas y sus alteraciones', 'notas'),
      theory('e1-claves', 'El pentagrama y las claves', 'claves'),
      theory('e1-ritmo', 'Figuras, silencios y compás', 'ritmo'),
    ],
  },
  {
    id: 'elemental-2',
    grade: 'elemental',
    year: 2,
    title: 'La escala mayor y los intervalos',
    summary: 'De qué está hecha una escala y cómo se mide la distancia entre dos notas.',
    units: [
      theory('e2-escala-mayor', 'Cómo se construye la escala mayor', 'escalaMayor'),
      play('e1-escala', 'La escala mayor, entera', 'major'),
      theory('e2-intervalos', 'Medir un intervalo', 'intervalos'),
      ear('e2-oido-intervalos', 'Reconocer intervalos de oído', 'interval'),
      play('e3-pentatonica', 'La pentatónica mayor', 'majorPentatonic'),
    ],
  },
  {
    id: 'elemental-3',
    grade: 'elemental',
    year: 3,
    title: 'Tonalidades y modo menor',
    summary: 'Armaduras, el círculo de quintas y las tres escalas menores.',
    units: [
      theory('e3-rueda', 'Armaduras y círculo de quintas', 'circle'),
      ear('e3-oido', 'La relativa y la vecina', 'circle'),
      theory('e3-menores', 'Las tres escalas menores', 'escalasMenores'),
      play('e2-menor', 'La menor natural', 'naturalMinor'),
      play('e4-pentatonica', 'La pentatónica menor', 'minorPentatonic'),
      play('e4-blues', 'La de blues, con su quinta bemol', 'blues'),
    ],
  },
  {
    id: 'elemental-4',
    grade: 'elemental',
    year: 4,
    title: 'Los acordes de la tonalidad',
    summary: 'Tríadas, sus cuatro especies y los siete grados con su cifrado.',
    units: [
      theory('e2-calidades', 'Las cuatro especies de tríada', 'qualities'),
      ear('e2-repaso', 'Distinguirlas de oído', 'quality'),
      theory('e1-grados', 'Los grados y su cifrado', 'degrees'),
      ear('e1-oido', 'Reconocer el I, el IV y el V', 'degree'),
      theory('e4-escalas', 'Pentatónicas y blues', 'scales'),
    ],
  },
  {
    id: 'profesional-1',
    grade: 'profesional',
    year: 1,
    title: 'Funciones tonales y cadencias',
    summary: 'Tónica, subdominante y dominante, y cómo se termina una frase.',
    units: [
      theory('p1-funciones', 'Tónica, subdominante y dominante', 'functions'),
      ear('p1-oido', 'Qué papel hace el acorde', 'functions'),
      theory('p6-cadencias', 'Las cadencias', 'cadences'),
      ear('p6-oido', 'Si cierra o se queda colgada', 'cadence'),
      play('p6-armonica', 'La menor armónica, la de la sensible', 'harmonicMinor'),
    ],
  },
  {
    id: 'profesional-2',
    grade: 'profesional',
    year: 2,
    title: 'Inversiones y enlace de acordes',
    summary: 'Qué nota va en el bajo, cómo se cifra y cómo se pasa de un acorde a otro.',
    units: [
      theory('p2-inversiones', 'Estado fundamental e inversiones', 'inversiones'),
      theory('p2-enlaces', 'El enlace de acordes', 'enlaces'),
    ],
  },
  {
    id: 'profesional-3',
    grade: 'profesional',
    year: 3,
    title: 'Acordes de séptima',
    summary: 'La cuarta nota del acorde, y la séptima de dominante con sus inversiones.',
    units: [
      theory('p2-cuatriadas', 'Las especies de séptima', 'sevenths'),
      theory('p2-cifrado', 'La séptima de dominante', 'septimaDominante'),
      ear('p2-oido', 'Qué añade la séptima', 'sevenths'),
    ],
  },
  {
    id: 'profesional-4',
    grade: 'profesional',
    year: 4,
    title: 'Dominantes secundarias y modulación',
    summary: 'Cómo se tonicaliza un grado y cómo se pasa de una tonalidad a otra.',
    units: [
      theory('p4-secundarias', 'Dominantes secundarias', 'secundarias'),
      theory('p4-modulacion', 'Modular a los tonos vecinos', 'modulacion'),
      theory('p3-prestados', 'Intercambio modal', 'borrowed'),
      ear('p3-oido', 'Si el acorde es de casa o viene de fuera', 'borrowed'),
    ],
  },
  {
    id: 'profesional-5',
    grade: 'profesional',
    year: 5,
    title: 'Cromatismo y armonía moderna',
    summary: 'La napolitana, las sextas aumentadas y las sustituciones.',
    units: [
      theory('p5-napolitana', 'La sexta napolitana y la sexta aumentada', 'cromaticos'),
      theory('p4-sustituciones', 'Sustituciones', 'substitutions'),
      ear('p4-oido', 'Si es el acorde o el que hace su papel', 'substitutions'),
    ],
  },
  {
    id: 'profesional-6',
    grade: 'profesional',
    year: 6,
    title: 'Los modos',
    summary: 'Las mismas notas empezando por otro sitio, y lo que eso cambia.',
    units: [
      theory('p5-modos', 'Los siete modos', 'modes'),
      ear('p5-oido', 'Con sensible y sin ella', 'modes'),
      play('p5-dorico', 'El dórico, el menor menos triste', 'dorian'),
      play('p5-frigio', 'El frigio, con el semitono de arriba', 'phrygian'),
      play('p3-mixolidio', 'El mixolidio, de donde sale el bVII', 'mixolydian'),
    ],
  },
];

/** Todas las unidades en el orden en el que se estudian. */
export const UNIT_ORDER: readonly string[] = COURSES.flatMap((course) =>
  course.units.map((unit) => unit.id),
);

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
