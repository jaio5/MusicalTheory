/**
 * Medir lo que tarda algo, para las pruebas de reloj (`*.reloj.test.ts`).
 *
 * Esas pruebas corren aparte, un fichero cada vez y sin la cobertura midiendo
 * (`vitest.config.ts`, adr/0121): por eso los topes son los de verdad y no el
 * triple que hacía falta cuando corrían al lado de todo lo demás.
 */

/** Lo que puede tardar una función que recibe 128 KB de quien escribe. */
export const TOPE_128_KB_MS = 50;

export const KB_128 = 128 * 1024;

/**
 * Lo que tarda en hacerse, **lo menos de tres veces**: la primera calienta el
 * compilador, y una vuelta suelta mide lo que esté haciendo la máquina en ese
 * instante, no la función.
 */
export function tarda(hacer: () => unknown): number {
  hacer();
  let menos = Infinity;
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    const inicio = performance.now();
    hacer();
    menos = Math.min(menos, performance.now() - inicio);
  }
  return menos;
}
