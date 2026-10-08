'use client';

import { useCallback, type KeyboardEvent } from 'react';

import { GRID, findBlock, findNote } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';

import type { FocoPendiente } from './use-foco-pendiente';

export interface TeclasDelLienzo {
  /** Las teclas sobre la nota elegida, escuchadas en la caja entera. */
  readonly teclaEnPunteo: (event: KeyboardEvent) => void;
  /** Las teclas sobre un acorde, **las mismas en las dos vistas**. */
  readonly teclaEnBloque: (event: KeyboardEvent<Element>, blockId: string) => void;
}

/**
 * El lienzo con el teclado, que es lo que un arrastre nunca da.
 *
 * Leen la canción **del almacén en el momento de la tecla**, y no de una prop:
 * es lo que hay en pantalla cuando llega el evento, y así `teclaEnBloque` no
 * cambia de identidad con cada cambio de la canción. Va a todas las filas, que
 * van con `memo`, y una función nueva por pintado las repintaría todas
 * ([adr/0059](../../../docs/adr/0059-memo-a-mano-y-no-el-compilador.md)).
 */
export function useTeclasDelLienzo({
  selectedNoteId,
  elegirBloque,
  elegirNota,
  apuntarFoco,
}: {
  readonly selectedNoteId: string | null;
  readonly elegirBloque: (id: string | null) => void;
  readonly elegirNota: (id: string | null) => void;
  readonly apuntarFoco: (destino: FocoPendiente) => void;
}): TeclasDelLienzo {
  const acciones = useArrangementStore((state) => state.actions);

  /**
   * El punteo con el teclado.
   *
   * Más y menos alteran la nota elegida medio tono, que es como se escribe un
   * cromatismo sin moverla de línea; las flechas la mueven en el tiempo y `Supr`
   * la quita. Sin esto, la partitura solo se podría usar con ratón.
   */
  const teclaEnPunteo = useCallback(
    (event: KeyboardEvent) => {
      if (selectedNoteId === null) {
        return;
      }
      const sitio = findNote(useArrangementStore.getState().arrangement, selectedNoteId);
      if (sitio === null) {
        return;
      }
      const { note } = sitio;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        const enOrden = [...sitio.part.notes].sort((a, b) => a.start - b.start);
        const donde = enOrden.findIndex((otra) => otra.id === note.id);
        const vecina = enOrden[donde + 1] ?? enOrden[donde - 1];
        apuntarFoco(
          vecina === undefined
            ? { que: 'parte', id: sitio.part.id }
            : { que: 'nota', id: vecina.id },
        );
        acciones.removeNote(selectedNoteId);
        elegirNota(null);
      } else if (event.key === '+' || event.key === '-') {
        event.preventDefault();
        acciones.moveNote(selectedNoteId, note.start, note.offset + (event.key === '+' ? 1 : -1));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const paso = event.key === 'ArrowLeft' ? -GRID : GRID;
        apuntarFoco({ que: 'nota', id: note.id });
        if (event.shiftKey) {
          acciones.resizeNote(selectedNoteId, note.length + paso * 2);
        } else {
          acciones.moveNote(selectedNoteId, note.start + paso, note.offset);
        }
      }
    },
    [acciones, apuntarFoco, elegirNota, selectedNoteId],
  );

  /**
   * Las flechas mueven el bloque de sitio, con `Shift` lo estiran y `Supr` lo
   * quita. Lo mandan el bloque de la tira y el cifrado de la partitura.
   *
   * Lo que se atiende aquí no sigue subiendo: la caja de la lista escucha las
   * teclas del punteo, y con una nota elegida `Supr` sobre un acorde quitaba
   * también la nota.
   */
  const teclaEnBloque = useCallback(
    (event: KeyboardEvent<Element>, blockId: string) => {
      const sitio = findBlock(useArrangementStore.getState().arrangement, blockId);
      /* v8 ignore next 3 -- el boton y el montaje salen del mismo pintado: el bloque que manda la tecla esta en el */
      if (sitio === null) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        const vecino = sitio.part.blocks[sitio.index + 1] ?? sitio.part.blocks[sitio.index - 1];
        apuntarFoco(
          vecino === undefined
            ? { que: 'parte', id: sitio.part.id }
            : { que: 'bloque', id: vecino.id },
        );
        acciones.removeBlock(blockId);
        elegirBloque(null);
        return;
      }

      const paso = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      if (paso === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      apuntarFoco({ que: 'bloque', id: blockId });

      if (event.shiftKey) {
        acciones.resizeBlock(blockId, sitio.block.beats + paso);
      } else {
        acciones.moveBlock(blockId, sitio.part.id, sitio.index + paso);
      }
    },
    [acciones, apuntarFoco, elegirBloque],
  );

  return { teclaEnPunteo, teclaEnBloque };
}
