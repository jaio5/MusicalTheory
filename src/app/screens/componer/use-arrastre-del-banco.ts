'use client';

import { useCallback, useRef } from 'react';

import { aLaDecima } from '@state/banco';

/** Las medidas del banco que se arrastran, y la variable CSS que lleva cada una. */
const VARIABLES = {
  izquierda: '--banco-izquierda',
  derecha: '--banco-derecha',
  alto: '--banco-alto',
} as const;

type MedidaDelBanco = keyof typeof VARIABLES;

/** Las tres variables, para el `style` de la caja que las reparte. */
export function variablesDelBanco(medidas: Readonly<Record<MedidaDelBanco, number>>) {
  return Object.fromEntries(
    (Object.keys(VARIABLES) as MedidaDelBanco[]).map((medida) => [
      VARIABLES[medida],
      `${medidas[medida]}rem`,
    ]),
  );
}

/**
 * Arrastrar un divisor **sin pasar por el almacén**.
 *
 * Cada movimiento del puntero iba al almacén del banco, y componer entero lee el
 * reparto: sesenta repintados por segundo de la pantalla más cargada de la
 * aplicación, con el lienzo y su partitura dentro, para mover una raya. Los
 * anchos ya viajan como variables CSS (`--banco-*`) y lo único que tiene que
 * cambiar durante el arrastre es su valor: se escribe directamente en la caja,
 * y el almacén se entera **una vez, al soltar** (`onCambio` del divisor).
 *
 * Componer no se repinta, pero **lo que reparte por su ancho sí**: el lienzo y
 * cada pentagrama miden su caja (`useAncho`), y una caja que cambia de ancho es
 * un pintado suyo por fotograma. Solo el suyo, y solo por el ancho.
 *
 * Se redondea como redondea el almacén (`aLaDecima`).
 */
export function useArrastreDelBanco() {
  const caja = useRef<HTMLDivElement>(null);

  const arrastrar = useCallback((medida: MedidaDelBanco, rem: number) => {
    // Montada siempre que hay un divisor que arrastrar: los divisores van dentro.
    caja.current!.style.setProperty(VARIABLES[medida], `${aLaDecima(rem)}rem`);
  }, []);

  return { caja, arrastrar };
}
