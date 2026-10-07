/**
 * Lo que llevas aprendido, guardado en el equipo.
 *
 * Va en `localStorage` y no en IndexedDB a propósito, al contrario que las
 * sesiones: son cuatro números y una lista corta de identificadores, se escribe
 * una vez por unidad terminada y hace falta **antes** de pintar la escalera. Una
 * lectura asíncrona ahí obligaría a enseñar todo bloqueado durante un instante,
 * y ver los candados y que luego se abran solos es peor que esperar.
 *
 * Interpretar lo guardado no se hace aquí: lo hace `parseProgress`, que vive en
 * el dominio porque protege esta puerta y también la de la base de datos, y una
 * de las dos puertas tenía que quedarse sin vigilancia si había dos funciones.
 *
 * Este avance es el del navegador, y sigue existiendo con cuenta y sin ella. Con
 * cuenta es la copia de trabajo que se sube; sin cuenta es lo único que hay.
 */

import { EMPTY_PROGRESS, parseProgress, type Progress } from '@core/music';

import { today } from './hoy';
import { contar } from './metricas';

const STORAGE_KEY = 'caos-ordenado:aprender';

export function loadProgress(): Progress {
  if (typeof localStorage === 'undefined') {
    return EMPTY_PROGRESS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? EMPTY_PROGRESS : parseProgress(JSON.parse(raw));
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: Progress): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  contarLaUnidadTerminada(loadProgress(), progress);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Modo privado o cuota llena: se pierde el avance, no la sesión que estás
    // tocando ahora mismo.
  }
}

/**
 * Una unidad terminada se cuenta aquí, que es por donde pasan todas
 * ([adr/0110](../../docs/adr/0110-contar-sin-seguir.md)).
 *
 * **Solo si entra exactamente una, y hoy.** Por aquí pasa también juntar el
 * avance de la cuenta con el del navegador al entrar, y eso puede traer varias
 * unidades hechas en otro aparato otro día: contarlas sería contar dos veces lo
 * que ya se contó allí. Terminar una unidad añade una y pone la fecha de hoy.
 *
 * Lo que no distingue es una fusión que traiga justo una unidad hecha hoy en otro
 * aparato. Es raro, y el día que estorbe se cuenta desde quien la termina.
 */
function contarLaUnidadTerminada(antes: Progress, despues: Progress): void {
  const nuevas = despues.done.filter((unidad) => !antes.done.includes(unidad));
  if (nuevas.length === 1 && despues.lastDay === today()) {
    contar('unidad-terminada');
  }
}

/** Borra el avance. Lo pide la pantalla, con confirmación. */
export function clearProgress(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Igual que arriba: no hay nada que hacer y no es fatal.
  }
}

/** El día de hoy. Vive en `hoy.ts` para que pedir la fecha no traiga el temario. */
export { today } from './hoy';
