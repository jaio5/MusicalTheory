'use client';

import { useEffect } from 'react';

import { usePropuestaStore } from './propuesta';

/**
 * `Tab` acepta lo propuesto y `Esc` lo descarta.
 *
 * Son las teclas que fija
 * [adr/0033](../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md), y son las
 * que ya tiene aprendidas quien usa un copiloto en cualquier otro sitio.
 *
 * **Solo mientras hay algo propuesto.** `Tab` es la tecla de mover el foco, y
 * quedársela para siempre dejaría la pantalla sin poder recorrerse con el
 * teclado. Con un fantasma en pantalla la decisión es «esto o nada» y no hay
 * nada más que hacer; sin fantasma, `Tab` vuelve a ser de quien era.
 *
 * Y **nunca mientras se escribe**: dentro del nombre de una parte o del buscador
 * de acordes, `Tab` sigue saltando al campo siguiente.
 *
 * Aceptar y descartar tienen además su botón a la vista: un atajo que es la
 * única manera de hacer algo no es un atajo, es un requisito.
 */

function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) {
    return false;
  }
  return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName);
}

export function useAtajosDeLaPropuesta(): void {
  const hayPropuesta = usePropuestaStore((state) => state.propuesta !== null);

  useEffect(() => {
    if (!hayPropuesta) {
      return;
    }

    function alPulsar(evento: KeyboardEvent): void {
      if (evento.ctrlKey || evento.metaKey || evento.altKey || escribiendo(evento.target)) {
        return;
      }
      const { acciones } = usePropuestaStore.getState();

      if (evento.key === 'Tab') {
        evento.preventDefault();
        // Con Mayúsculas, uno; solo, todos. Al revés sería pedir cuatro
        // pulsaciones para lo que casi siempre se quiere entero.
        if (evento.shiftKey) {
          acciones.aceptar(1);
        } else {
          acciones.aceptarTodo();
        }
        return;
      }

      if (evento.key === 'Escape') {
        evento.preventDefault();
        acciones.descartar();
      }
    }

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [hayPropuesta]);
}
