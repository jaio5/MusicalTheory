/**
 * Dónde se cruzan el plan y el temario.
 *
 * Esta es la única dirección que existe entre las dos mitades del dominio:
 * `billing/` conoce el temario, y `music/` no sabe que el dinero existe. Al
 * revés sería peor: la teoría musical no cambia según lo que pagues, y un
 * `core/music` que importase precios dejaría de poder probarse solo.
 */

import {
  COURSES,
  findUnit,
  isUnitDone,
  isUnitUnlocked,
  startIndex,
  UNIT_ORDER,
  type Course,
  type GradeId,
  type Progress,
} from '../music';

import { can, type PlanId } from './plans';

/** El grado que hay que pagar. El Elemental entero entra en los tres planes. */
const GRADE_DE_PAGO: GradeId = 'profesional';

export function isGradeIncluded(planId: unknown, grade: GradeId): boolean {
  return grade !== GRADE_DE_PAGO || can(planId, 'grado-profesional');
}

export function isCourseIncluded(planId: unknown, course: Course): boolean {
  return isGradeIncluded(planId, course.grade);
}

/** Una unidad que no existe se trata como no incluida: no hay nada que abrir. */
export function isUnitIncluded(planId: unknown, unitId: string): boolean {
  const found = findUnit(unitId);
  return found !== null && isGradeIncluded(planId, found.course.grade);
}

/**
 * En qué estado se enseña una unidad.
 *
 * Son cuatro y no dos porque los dos candados no se abren igual: el del temario
 * se abre terminando la unidad anterior y el del plan se abre pagando. Pintarlos
 * con el mismo icono haría que quien va por el cuarto curso creyera que le falta
 * estudiar cuando lo que le falta es un plan.
 *
 * El candado del plan pesa más que la marca de superada: quien pagó, hizo los
 * cursos del Profesional y volvió a gratis los ve como hechos —borrarlos sería
 * mentir sobre lo que hizo— pero no puede volver a entrar hasta pagar otra vez.
 */
export type UnitAccess = 'hecha' | 'abierta' | 'por-temario' | 'por-plan';

export function unitAccess(progress: Progress, planId: unknown, unitId: string): UnitAccess {
  if (!isUnitIncluded(planId, unitId)) {
    return 'por-plan';
  }
  if (isUnitDone(progress, unitId)) {
    return 'hecha';
  }
  return isUnitUnlocked(progress, unitId) ? 'abierta' : 'por-temario';
}

export function canEnterUnit(progress: Progress, planId: unknown, unitId: string): boolean {
  const access = unitAccess(progress, planId, unitId);
  return access === 'abierta' || access === 'hecha';
}

/**
 * Por dónde seguir sin tropezar con un candado: la primera unidad sin hacer que
 * el plan incluya.
 *
 * Devuelve nulo cuando lo siguiente está detrás del plan, y entonces la pantalla
 * ofrece subir en vez de abrir una unidad que no se puede abrir. `nextUnit` de
 * `music/` sigue existiendo y sigue contestando lo mismo que antes: cuál es la
 * siguiente del temario, sin saber de planes.
 */
export function nextAllowedUnit(progress: Progress, planId: PlanId): string | null {
  const libre = (id: string): boolean => !isUnitDone(progress, id) && isUnitIncluded(planId, id);
  // Desde donde se puso quien estudia, igual que `nextUnit`, y solo si por delante
  // no queda nada se ofrece lo que se saltó.
  const desde = startIndex(progress);
  return UNIT_ORDER.slice(desde).find(libre) ?? UNIT_ORDER.find(libre) ?? null;
}

/**
 * Los cursos por los que se puede elegir empezar con este plan.
 *
 * Ofrecer un curso que el plan no incluye sería vender un punto de partida que se
 * cierra en la cara al elegirlo. Los que quedan fuera se enseñan aparte, con su
 * candado y su precio.
 */
export function startableCourses(planId: unknown): readonly Course[] {
  return COURSES.filter((course) => isCourseIncluded(planId, course));
}
