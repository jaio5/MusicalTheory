/**
 * Cuántas preguntas tiene cada unidad, para la cola de repaso.
 *
 * La cola guarda la unidad y la **posición** de la pregunta, y el temario se
 * reescribe: una lección que tenía cinco preguntas puede quedarse en tres, y una
 * unidad puede cambiar de lección conservando su id. Una posición que ya no
 * existe no se puede volver a generar —`ReviewSession` la salta—, pero seguía
 * contando como pendiente en el camino, en la meta del día y en la pantalla del
 * repaso: «tienes una pregunta para repasar» encima de «no hay nada que
 * repasar», y para siempre, porque lo que no se pregunta no se puede acertar.
 *
 * **Módulo aparte y no dentro de `progress.ts`** porque contar obliga a generar
 * las lecciones, y `progress.ts` lo lee cada pantalla que enseña el avance. Lo
 * usa el servidor al leer el avance de una cuenta (`parseProgress`).
 */

import type { Unit } from './curriculum';
import { earExercises } from './ear';
import { lessonNotes } from './lessons';
import { SCALES } from './scales';

/** Lo ya contado, por unidad: el temario es código y no cambia mientras corre. */
const CONTADAS = new Map<string, number>();

/**
 * Se cuenta en Do y en los dos modos, y vale el mayor: el número de preguntas no
 * depende de la tónica —es lo que deja repasar en la tonalidad de hoy lo fallado
 * en otra—, pero una lección puede tener alguna pregunta solo para el menor.
 */
export function posicionesDeLaUnidad(unit: Unit): number {
  const contadas = CONTADAS.get(unit.id);
  if (contadas !== undefined) {
    return contadas;
  }
  const cuantas = contar(unit);
  CONTADAS.set(unit.id, cuantas);
  return cuantas;
}

function contar(unit: Unit): number {
  const modos = ['major', 'minor'] as const;
  if (unit.kind === 'theory') {
    return Math.max(...modos.map((mode) => lessonNotes(unit.lesson, 0, mode).exercises.length));
  }
  if (unit.kind === 'ear') {
    return Math.max(...modos.map((mode) => earExercises(unit.ear, 0, mode).length));
  }
  // La escala subiendo hasta la octava y bajando sin repetir el pico: lo que arma
  // `createExercise` en `features/learn/exercise.ts`, y su prueba lo compara con
  // esto. No se importa de allí porque el dominio no mira hacia arriba.
  return SCALES[unit.scaleId].intervals.length * 2 + 1;
}
