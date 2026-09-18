'use client';

import { useMemo } from 'react';

import { findBlock, resolveDegree, type ResolvedChord } from '@core/music';

import { useArrangementStore } from './arrangement-store';
import { selectActiveKey, useSessionStore } from './session-store';

/**
 * El acorde del bloque que tienes elegido en la canción.
 *
 * Es el puente que le faltaba a componer. El montaje guarda **grados** —`IV`—
 * porque un grado sigue valiendo cuando cambias de tonalidad; el mástil y las
 * propuestas necesitan **un acorde** —`F`, con sus notas—. Traducir uno en otro
 * hace falta las dos veces, así que se hace una vez aquí.
 *
 * Sin esto, la columna de la derecha y las propuestas solo sabían mirar `path`,
 * que es una segunda progresión paralela a la canción de verdad: elegías un
 * bloque y el mástil seguía enseñando otro acorde
 * ([adr/0032](../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
 *
 * Devuelve nulo cuando no hay nada elegido, cuando no hay tonalidad —sin ella un
 * grado no es ningún acorde— o cuando el bloque elegido ya no está.
 */
export function useAcordeElegido(): ResolvedChord | null {
  const activeKey = useSessionStore(selectActiveKey);
  const arrangement = useArrangementStore((state) => state.arrangement);
  const selectedBlockId = useArrangementStore((state) => state.selectedBlockId);

  return useMemo(() => {
    if (activeKey === null || selectedBlockId === null) {
      return null;
    }
    const sitio = findBlock(arrangement, selectedBlockId);
    if (sitio === null) {
      return null;
    }
    return resolveDegree(activeKey.tonic, activeKey.mode, sitio.block.degree);
  }, [activeKey, arrangement, selectedBlockId]);
}
