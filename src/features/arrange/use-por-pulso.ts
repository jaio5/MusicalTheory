'use client';

import { drawnBars, type Arrangement } from '@core/music';
import { useAncho } from '@ui/use-medida';

import { pulsoQueCabe } from './BlockButton';

/**
 * El ancho del lienzo, medido, y la escala que sale de él.
 *
 * Los bloques y el punteo medían un pulso en veinticuatro píxeles fijos, así que
 * una parte de cuatro compases ocupaba 384 de los mil y pico que hay en un
 * portátil y el resto era hueco. Ahora se mide y se reparte.
 *
 * **Una escala para todo el lienzo, sacada de la parte más larga**, y no una por
 * fila: si cada parte se justificara a su ancho, una de ocho compases mediría lo
 * mismo que una de cuatro y el carril de bloques dejaría de decir con su tamaño
 * lo que dura cada cosa, que es para lo que está.
 */
export function usePorPulso(arrangement: Arrangement, beatsPerBar: number) {
  // Solo el ancho: la caja crece a lo alto con las filas, y su alto nuevo no
  // cambia la escala ni debe pintar el lienzo otra vez.
  const { ref, ancho } = useAncho<HTMLDivElement>();
  const pulsosDeLaMasLarga = arrangement.parts.reduce(
    (largo, part) => Math.max(largo, drawnBars(part, beatsPerBar) * beatsPerBar),
    beatsPerBar,
  );
  // El respiro es el de la propia fila: sin descontarlo, la parte más larga sale
  // justa y aparece una barra de desplazamiento que no hacía falta.
  return { anchoRef: ref, porPulso: pulsoQueCabe(ancho - 32, pulsosDeLaMasLarga) };
}
