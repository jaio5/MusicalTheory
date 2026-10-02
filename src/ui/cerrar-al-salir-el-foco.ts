import type { FocusEvent } from 'react';

/**
 * Cierra un `popover` en cuanto el foco sale de él.
 *
 * Los tres paneles de la barra de componer —«Más», el tempo y la tonalidad—
 * son `popover="auto"` ([adr/0065](../../docs/adr/0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md))
 * y llevan velo, así que **parecen modales y no lo son**: el tabulador salía del
 * panel por detrás y seguía por los controles tapados, sin ver dónde estaba. Un
 * `popover` se cierra solo con Escape o tocando fuera; salir con el tabulador
 * es la tercera manera de irse, y ahora también lo cierra.
 *
 * Se descartó hacerlos modales con `<dialog>` y `showModal()`: atrapar el foco
 * es lo que pide un aviso que hay que contestar, y estos son mandos que se
 * tocan de pasada. Cerrar al salir deja el foco donde lo quería quien se fue.
 *
 * **Solo cuando el foco va a otro sitio que se conoce.** Pulsar dentro del panel
 * en algo que no recibe el foco —el rótulo «Tempo»— lo deja sin destino
 * (`relatedTarget` nulo), igual que cambiar de ventana, y ninguna de las dos
 * cosas es irse del panel. Tocar fuera ya lo cierra el navegador.
 */
export function cerrarAlSalirElFoco(event: FocusEvent<HTMLElement>): void {
  const panel = event.currentTarget;
  const destino = event.relatedTarget;
  // Ni cuando va a su propio botón: pulsarlo con el panel abierto lo quita el
  // foco del panel antes del clic, y cerrarlo aquí haría que el clic lo
  // volviera a abrir. Ese clic ya lo cierra, y con el tabulador hacia atrás el
  // panel sigue justo detrás del botón, que es su sitio en el orden.
  if (
    destino === null ||
    panel.contains(destino) ||
    destino.getAttribute('popovertarget') === panel.id
  ) {
    return;
  }
  // La API falta en jsdom; los navegadores a los que va esto la traen desde 2024.
  // Si el foco estaba dentro, el panel está abierto: no hay que preguntarlo.
  if (typeof panel.hidePopover === 'function') {
    panel.hidePopover();
  }
}
