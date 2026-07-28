/**
 * Si el sistema pide menos movimiento.
 *
 * La hoja de estilos ya anula transiciones y animaciones CSS, pero GSAP escribe
 * el transform directamente y se salta esa regla: quien anime con GSAP tiene
 * que preguntar aquí.
 *
 * Comprueba que `matchMedia` existe antes de llamarla: no está en el servidor
 * ni en algunos entornos de prueba, y dar por hecho que sí rompía el render.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duración en segundos para GSAP, ya con el ajuste de accesibilidad aplicado. */
export function motionSeconds(milliseconds: number): number {
  return prefersReducedMotion() ? 0 : milliseconds / 1000;
}
