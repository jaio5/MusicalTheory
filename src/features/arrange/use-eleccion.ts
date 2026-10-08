'use client';

import { useCallback, useState } from 'react';

import { useArrangementStore } from '@state/arrangement-store';

/**
 * Lo elegido en el lienzo, que es **uno y solo uno**: un acorde o una nota,
 * nunca los dos.
 *
 * Eran dos estados sueltos y podían estar los dos puestos a la vez, así que
 * «quitar lo elegido» no tenía respuesta. Elegir una cosa suelta la otra.
 *
 * **El bloque elegido vive en el almacén y la nota no.** No es una asimetría
 * gratuita: al bloque elegido lo miran desde fuera la columna del acorde —que
 * enseña cómo se toca— y las propuestas, que salen desde él. La nota elegida no
 * sale del lienzo.
 */
export function useEleccion() {
  const selectedBlockId = useArrangementStore((state) => state.selectedBlockId);
  const elegirEnElAlmacen = useArrangementStore((state) => state.actions.elegirBloque);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const elegirBloque = useCallback(
    (id: string | null) => {
      elegirEnElAlmacen(id);
      if (id !== null) {
        setSelectedNoteId(null);
      }
    },
    [elegirEnElAlmacen],
  );

  const elegirNota = useCallback(
    (id: string | null) => {
      setSelectedNoteId(id);
      if (id !== null) {
        elegirEnElAlmacen(null);
      }
    },
    [elegirEnElAlmacen],
  );

  const soltarTodo = useCallback(() => {
    elegirEnElAlmacen(null);
    setSelectedNoteId(null);
  }, [elegirEnElAlmacen]);

  return { selectedBlockId, selectedNoteId, elegirBloque, elegirNota, soltarTodo };
}
