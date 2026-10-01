/*
 * GENERADO por arte/portada/build.py. No se edita a mano: se cambia el script y
 * se vuelve a ejecutar (`python3 arte/portada/build.py`).
 *
 * Las medidas de la escena de la portada en píxeles del dibujo, no de pantalla:
 * la hoja de estilos las multiplica por `--px`, que es el tamaño entero al que se
 * pinta cada píxel.
 */

/** El lienzo entero: lo que se ve y la pared de sobra alrededor. */
export const LIENZO = { ancho: 216, alto: 164 } as const;

/** Lo que se ve en la caja más pequeña de verdad, centrado en el lienzo. */
export const SEGURO = { x: 48, y: 34, ancho: 120, alto: 96 } as const;

/** La hoja de lo que se mueve (`_escena/vida.png`). */
export const HOJA = { ancho: 255, alto: 84 } as const;

export type CapaDeLaEscena = 'fondo' | 'medio' | 'frente';

export interface Tira {
  /** Dónde se pinta, en el lienzo. */
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  /** En qué fila de la hoja empieza, y cuántos fotogramas tiene. */
  readonly fila: number;
  readonly marcos: number;
  readonly capa: CapaDeLaEscena;
}

export const TIRAS = {
  mascota: { x: 108, y: 36, ancho: 32, alto: 32, fila: 0, marcos: 4, capa: 'medio' },
  vumetro: { x: 102, y: 75, ancho: 15, alto: 4, fila: 32, marcos: 17, capa: 'medio' },
  valvulas: { x: 104, y: 70, ancho: 40, alto: 2, fila: 36, marcos: 3, capa: 'medio' },
  piloto: { x: 143, y: 75, ancho: 4, alto: 4, fila: 38, marcos: 2, capa: 'medio' },
  neon: { x: 146, y: 42, ancho: 24, alto: 26, fila: 42, marcos: 3, capa: 'fondo' },
  corchea: { x: 141, y: 60, ancho: 5, alto: 8, fila: 68, marcos: 1, capa: 'medio' },
  corcheas: { x: 98, y: 59, ancho: 8, alto: 8, fila: 76, marcos: 1, capa: 'medio' },
} as const satisfies Record<string, Tira>;
