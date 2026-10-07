/**
 * Si el sistema pide menos movimiento.
 *
 * La hoja de estilos ya anula transiciones y animaciones CSS, así que lo que se
 * mueve con CSS no tiene que preguntar nada. Esto es para lo que decide desde
 * JavaScript si se mueve o no: la escena de la portada, un muñeco que se
 * asoma. La rueda de quintas preguntaba aquí mientras la movía GSAP, que se
 * saltaba la regla; ya no ([adr/0057](../../docs/adr/0057-la-rueda-gira-sin-gsap.md)).
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
