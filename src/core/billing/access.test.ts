import { describe, expect, it } from 'vitest';

import { completeUnit, COURSES, EMPTY_PROGRESS, findUnit, nextUnit, type Progress } from '../music';

import {
  canEnterUnit,
  isCourseIncluded,
  isGradeIncluded,
  isUnitIncluded,
  nextAllowedUnit,
  unitAccess,
} from './access';

const DIA = '2026-07-30';

/** Termina unidades en orden, que es la única forma de que se abran. */
function tras(ids: readonly string[]): Progress {
  return ids.reduce((progress, id) => completeUnit(progress, id, DIA), EMPTY_PROGRESS);
}

const ELEMENTAL_ENTERO = COURSES.filter((course) => course.grade === 'elemental').flatMap(
  (course) => course.units.map((unit) => unit.id),
);

describe('isGradeIncluded', () => {
  it('regala el Elemental en los tres planes', () => {
    for (const plan of ['gratis', 'basico', 'medio']) {
      expect(isGradeIncluded(plan, 'elemental')).toBe(true);
    }
  });

  it('cobra el Profesional', () => {
    expect(isGradeIncluded('gratis', 'profesional')).toBe(false);
    expect(isGradeIncluded('basico', 'profesional')).toBe(true);
  });
});

describe('isUnitIncluded', () => {
  it('mira el grado del curso al que pertenece la unidad', () => {
    expect(isUnitIncluded('gratis', 'e1-grados')).toBe(true);
    expect(isUnitIncluded('gratis', 'p1-funciones')).toBe(false);
    expect(isUnitIncluded('basico', 'p1-funciones')).toBe(true);
  });

  it('una unidad que no existe no está incluida en ningún plan', () => {
    expect(isUnitIncluded('medio', 'no-existe')).toBe(false);
  });

  // El temario se reordenó y hubo unidades que cambiaron de curso conservando su
  // id: `p6-armonica` vive ahora en 1º de Profesional. El plan mira el grado en
  // el que está la unidad hoy, no lo que diga su nombre.
  it('cada unidad se cobra según el grado en el que está ahora', () => {
    for (const course of COURSES) {
      for (const unit of course.units) {
        expect(isUnitIncluded('gratis', unit.id), unit.id).toBe(course.grade === 'elemental');
        expect(isUnitIncluded('basico', unit.id), unit.id).toBe(true);
      }
    }
    expect(isUnitIncluded('gratis', 'p6-armonica')).toBe(false);
  });

  it('coincide con isCourseIncluded para el curso de esa unidad', () => {
    const found = findUnit('p6-cadencias')!;
    expect(isCourseIncluded('gratis', found.course)).toBe(false);
    expect(isCourseIncluded('medio', found.course)).toBe(true);
  });
});

describe('unitAccess', () => {
  it('la primera está abierta desde el principio', () => {
    expect(unitAccess(EMPTY_PROGRESS, 'gratis', 'e1-notas')).toBe('abierta');
  });

  it('lo que va después está cerrado por temario', () => {
    expect(unitAccess(EMPTY_PROGRESS, 'gratis', 'e1-claves')).toBe('por-temario');
  });

  it('lo hecho se ve hecho', () => {
    expect(unitAccess(tras(['e1-notas']), 'gratis', 'e1-notas')).toBe('hecha');
  });

  // Los dos candados no se abren igual, así que no pueden ser el mismo estado:
  // uno se abre estudiando y el otro pagando.
  it('distingue el candado del plan del candado del temario', () => {
    const alDia = tras(ELEMENTAL_ENTERO);
    expect(unitAccess(alDia, 'gratis', 'p1-funciones')).toBe('por-plan');
    expect(unitAccess(alDia, 'basico', 'p1-funciones')).toBe('abierta');
  });

  it('el candado del plan pesa más que la marca de superada', () => {
    const pagando = tras([...ELEMENTAL_ENTERO, 'p1-funciones']);
    expect(unitAccess(pagando, 'basico', 'p1-funciones')).toBe('hecha');
    // Volver a gratis no borra lo hecho, pero cierra la puerta.
    expect(unitAccess(pagando, 'gratis', 'p1-funciones')).toBe('por-plan');
    expect(canEnterUnit(pagando, 'gratis', 'p1-funciones')).toBe(false);
  });
});

describe('nextAllowedUnit', () => {
  it('sin nada hecho, manda a la primera', () => {
    expect(nextAllowedUnit(EMPTY_PROGRESS, 'gratis')).toBe('e1-notas');
  });

  it('salta lo que el plan no incluye', () => {
    const alDia = tras(ELEMENTAL_ENTERO);
    // El temario dice que lo siguiente es el Profesional...
    expect(nextUnit(alDia)).toBe('p1-funciones');
    // ...pero en gratis no hay nada más que abrir, y eso es una oferta de plan,
    // no una unidad.
    expect(nextAllowedUnit(alDia, 'gratis')).toBeNull();
    expect(nextAllowedUnit(alDia, 'basico')).toBe('p1-funciones');
  });

  it('devuelve nulo cuando está todo hecho', () => {
    const todo = tras(COURSES.flatMap((course) => course.units.map((unit) => unit.id)));
    expect(nextAllowedUnit(todo, 'medio')).toBeNull();
  });
});
