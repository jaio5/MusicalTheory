'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { EstadoObservable } from '@core/estado-observable';
import type { Part } from '@core/music';

/**
 * Por qué bloque va la reproducción, **fuera del estado de React**.
 *
 * Era un `useState` del reproductor, y el reproductor vive en el lienzo: cada
 * acorde que sonaba repintaba el lienzo entero —la barra, la columna de
 * propuestas y el reparto de todas las filas— para encender un solo bloque. Con
 * el cabezal aparte, el lienzo no se entera de que la canción avanza: **solo la
 * fila donde está el bloque que suena** se suscribe y se repinta, y las demás
 * siguen leyendo nulo
 * ([adr/0119](../../../docs/adr/0119-la-partitura-llena-su-hueco-y-el-lienzo-se-parte.md)).
 *
 * Es un `EstadoObservable`, que ya compara antes de avisar: dos pasos seguidos
 * del mismo bloque —una nota del punteo encima— no despiertan a nadie.
 */
export type Cabezal = Pick<EstadoObservable<string | null>, 'valor' | 'suscribir'>;

/** El cabezal con su mando: solo el reproductor lo mueve. */
export function crearCabezal(): EstadoObservable<string | null> {
  return new EstadoObservable<string | null>(null);
}

/** En el servidor no suena nada. */
const NADA_SUENA = () => null;

/**
 * El bloque de esta parte que suena ahora, o nulo si el que suena es de otra.
 *
 * Devuelve un identificador o nulo, que se comparan por valor: mientras la
 * reproducción recorre otra parte, esta fila lee nulo una y otra vez y React no
 * la repinta.
 */
export function useBloqueQueSuena(cabezal: Cabezal, part: Part): string | null {
  // Atada y estable: `suscribir` es un método, y una función nueva en cada
  // pintado haría que React se diera de baja y de alta cada vez.
  const suscribir = useCallback((aviso: () => void) => cabezal.suscribir(aviso), [cabezal]);
  return useSyncExternalStore(
    suscribir,
    () => {
      const id = cabezal.valor;
      return id !== null && part.blocks.some((block) => block.id === id) ? id : null;
    },
    NADA_SUENA,
  );
}
