/**
 * El bucle de un arrastre, sin repetirlo en cada sitio.
 *
 * Los tres gestos del lienzo —mover un bloque, mover una nota, estirar
 * cualquiera de los dos— se escuchan igual: se engancha al `window` en vez de al
 * elemento, porque el puntero se sale de él en cuanto empieza el gesto, y se
 * suelta también con `pointercancel`, que es lo que llega cuando el sistema se
 * queda el gesto —el navegador decide que es un desplazamiento, o entra una
 * llamada—. Sin escuchar ese, la nota se queda pegada al puntero para siempre.
 */
export interface ArrastreOpciones {
  /** Se llama en cada movimiento, con la posición del puntero. */
  readonly mover: (clientX: number, clientY: number) => void;
  /** Al soltar, pase lo que pase. */
  readonly soltar?: () => void;
}

export function arrastrar(opciones: ArrastreOpciones): void {
  const mover = (event: PointerEvent) => {
    // Mientras se arrastra no se selecciona texto ni se desplaza la página.
    event.preventDefault();
    opciones.mover(event.clientX, event.clientY);
  };

  const fin = () => {
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', fin);
    window.removeEventListener('pointercancel', fin);
    opciones.soltar?.();
  };

  window.addEventListener('pointermove', mover, { passive: false });
  window.addEventListener('pointerup', fin);
  window.addEventListener('pointercancel', fin);
}
