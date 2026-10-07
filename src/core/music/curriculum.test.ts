import { describe, expect, it } from 'vitest';

import { COURSES, findUnit, GRADES, TOTAL_XP, UNIT_ORDER, type Unit } from './curriculum';
import { LESSONS } from './lessons';

/**
 * Lo que tiene que cumplir el temario aunque se reordene.
 *
 * Se reescribió al estilo del conservatorio y por el camino salió a la luz que
 * cinco unidades repetían palabra por palabra la lección de otra: prometían algo
 * nuevo en el camino y daban lo mismo. Nada lo vigilaba. Estas pruebas no miran
 * qué se enseña —eso es del temario— sino que el temario no se contradiga ni deje
 * a nadie con un avance que ya no encaja.
 */

const UNIDADES: readonly Unit[] = COURSES.flatMap((course) => course.units);

/**
 * Las unidades que han existido alguna vez, tal cual se guardaban.
 *
 * Es una lista fija a propósito: el avance de quien ya estudió las guarda por
 * este nombre —en su navegador y en su cuenta—, y renombrar una sin más le
 * borraría lo hecho sin avisar. Sale de la historia de `curriculum.ts`.
 */
const LAS_QUE_HABIA = [
  'e1-grados',
  'e1-escala',
  'e1-oido',
  'e1-repaso',
  'e2-calidades',
  'e2-menor',
  'e2-repaso',
  'e3-rueda',
  'e3-oido',
  'e3-pentatonica',
  'e4-escalas',
  'e4-pentatonica',
  'e4-blues',
  'p1-funciones',
  'p1-oido',
  'p1-escala',
  'p1-repaso',
  'p2-cuatriadas',
  'p2-cifrado',
  'p2-oido',
  'p3-prestados',
  'p3-oido',
  'p3-mixolidio',
  'p4-sustituciones',
  'p4-tritono',
  'p4-oido',
  'p5-modos',
  'p5-oido',
  'p5-dorico',
  'p5-frigio',
  'p6-cadencias',
  'p6-armonica',
  'p6-oido',
  'p6-repaso',
];

/**
 * Las que se quitaron, y por qué: las cinco repetían la lección de otra unidad
 * —los dos «repaso» de grados y de funciones, el de cadencias, el sustituto
 * tritonal y la escala mayor tocada otra vez—. Lo que tuviera hecho alguien en
 * ellas se suelta al leer el avance (`parseProgress`).
 */
const RETIRADAS = ['e1-repaso', 'p1-escala', 'p1-repaso', 'p4-tritono', 'p6-repaso'];

/** Los cursos por los que alguien pudo elegir empezar, que también se guardan. */
const CURSOS_QUE_HABIA = [
  'elemental-1',
  'elemental-2',
  'elemental-3',
  'elemental-4',
  'profesional-1',
  'profesional-2',
  'profesional-3',
  'profesional-4',
  'profesional-5',
  'profesional-6',
];

/** Los valores que salen más de una vez, una vez por cada repetición. */
function repetidos(valores: readonly string[]): readonly string[] {
  return valores.filter((valor, indice) => valores.indexOf(valor) !== indice);
}

describe('el temario', () => {
  it('no repite identificadores de unidad ni de curso', () => {
    expect(repetidos(UNIT_ORDER)).toEqual([]);
    expect(repetidos(COURSES.map((course) => course.id))).toEqual([]);
  });

  it('el orden de estudio son las unidades de los cursos, una vez cada una', () => {
    expect(UNIT_ORDER).toEqual(UNIDADES.map((unit) => unit.id));
    for (const course of COURSES) {
      for (const unit of course.units) {
        expect(findUnit(unit.id)).toEqual({ course, unit });
      }
    }
    expect(findUnit('no-existe')).toBeNull();
  });

  it('ningún curso está vacío', () => {
    for (const course of COURSES) {
      expect(course.units.length, course.id).toBeGreaterThan(0);
    }
  });

  it('cada curso tiene su año correlativo dentro del grado, empezando por el primero', () => {
    for (const grade of GRADES) {
      const years = COURSES.filter((course) => course.grade === grade.id).map(
        (course) => course.year,
      );
      expect(years.length, grade.id).toBeGreaterThan(0);
      expect(years, grade.id).toEqual(years.map((_, index) => index + 1));
    }
  });

  it('los grados van en orden: todo el Elemental antes que el Profesional', () => {
    const puestos = COURSES.map((course) => GRADES.findIndex((grade) => grade.id === course.grade));
    expect(puestos).toEqual([...puestos].sort((a, b) => a - b));
  });

  it('el total de XP es la suma de las unidades', () => {
    expect(TOTAL_XP).toBe(UNIDADES.reduce((total, unit) => total + unit.xp, 0));
  });
});

/**
 * Lo que coló cinco unidades repetidas: dos unidades con la misma lección son la
 * misma unidad con dos títulos. Lo mismo con el oído y con lo que se toca.
 */
describe('cada unidad enseña algo que no enseña otra', () => {
  it('ninguna lección de teoría la usan dos unidades', () => {
    const lecciones = UNIDADES.flatMap((unit) => (unit.kind === 'theory' ? [unit.lesson] : []));
    expect(repetidos(lecciones)).toEqual([]);
  });

  it('ningún ejercicio de oído lo usan dos unidades', () => {
    const oidos = UNIDADES.flatMap((unit) => (unit.kind === 'ear' ? [unit.ear] : []));
    expect(repetidos(oidos)).toEqual([]);
  });

  it('ninguna escala se toca en dos unidades', () => {
    const escalas = UNIDADES.flatMap((unit) => (unit.kind === 'play' ? [unit.scaleId] : []));
    expect(repetidos(escalas)).toEqual([]);
  });

  it('cada lección escrita la usa alguna unidad', () => {
    // Una lección sin unidad no se ve en ninguna parte: o sobra, o falta su unidad.
    const usadas = new Set(
      UNIDADES.flatMap((unit) => (unit.kind === 'theory' ? [unit.lesson] : [])),
    );
    for (const lesson of LESSONS) {
      expect(usadas, lesson.id).toContain(lesson.id);
    }
  });

  it('cada unidad de teoría apunta a una lección que existe', () => {
    const escritas = new Set(LESSONS.map((lesson) => lesson.id));
    for (const unit of UNIDADES) {
      if (unit.kind === 'theory') {
        expect(escritas, unit.id).toContain(unit.lesson);
      }
    }
  });
});

/**
 * Lo que ya hay guardado se escribió con un temario anterior. Una unidad se puede
 * mover de curso conservando su nombre, pero no desaparecer sin decirlo.
 */
describe('lo que el avance de alguien pudo guardar', () => {
  it('cada unidad que existió sigue en el temario o está retirada a sabiendas', () => {
    const ahora = new Set(UNIT_ORDER);
    const perdidas = LAS_QUE_HABIA.filter((id) => !ahora.has(id) && !RETIRADAS.includes(id));
    expect(perdidas).toEqual([]);
  });

  it('una retirada no vuelve con el mismo nombre', () => {
    // Reaparecer daría por hecha una unidad nueva a quien hizo la vieja, que
    // enseñaba otra cosa. Una unidad nueva lleva un nombre nuevo.
    for (const id of RETIRADAS) {
      expect(findUnit(id), id).toBeNull();
    }
  });

  it('las retiradas son unidades que existieron', () => {
    for (const id of RETIRADAS) {
      expect(LAS_QUE_HABIA).toContain(id);
    }
  });

  it('los cursos por los que se pudo elegir empezar siguen existiendo', () => {
    const ahora = COURSES.map((course) => course.id);
    expect(ahora).toEqual(expect.arrayContaining(CURSOS_QUE_HABIA));
  });
});
