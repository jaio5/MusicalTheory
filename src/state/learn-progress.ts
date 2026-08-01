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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Modo privado o cuota llena: se pierde el avance, no la sesión que estás
    // tocando ahora mismo.
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

/**
 * El día de hoy en `AAAA-MM-DD`, en hora local.
 *
 * Vive aquí y no en el dominio porque leer el reloj es efecto, no teoría. En
 * local y no en UTC: la racha la cuenta quien toca, y para quien toca a las once
 * de la noche en Madrid el día es el suyo, no el de Greenwich.
 */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
