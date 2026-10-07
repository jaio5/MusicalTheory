import { describe, expect, it } from 'vitest';

import { sameHex } from './constant-time';

/**
 * Comparar dos cosas secretas sin que el reloj cuente por dónde se parecen.
 *
 * `===` sobre cadenas se para en el primer carácter distinto, y esa diferencia
 * se mide desde fuera: probando un carácter cada vez se reconstruye un secreto
 * entero sin acertar ninguno. Un test no puede medir eso de forma fiable, así
 * que lo que se fija aquí es lo que sí se puede: **que acepta lo que debe,
 * rechaza lo que debe y no lanza con basura**, que es lo que la convierte en una
 * comparación utilizable donde llega texto de fuera.
 */

const UNO = 'a3f1'.repeat(16);
const OTRO = 'a3f2'.repeat(16);

describe('comparar dos hexadecimales', () => {
  it('dos iguales son iguales', () => {
    expect(sameHex(UNO, UNO)).toBe(true);
  });

  it('dos distintos no', () => {
    expect(sameHex(UNO, OTRO)).toBe(false);
  });

  it('longitudes distintas se rechazan de entrada, y eso no filtra nada', () => {
    // Lo que mide un HMAC-SHA256 no es secreto: es una constante que conoce
    // cualquiera. Lo que hay que ocultar es en qué carácter dejan de parecerse.
    expect(sameHex(UNO, `${UNO}ff`)).toBe(false);
    expect(sameHex('', UNO)).toBe(false);
  });

  it('lo que no es hexadecimal se rechaza en vez de reventar', () => {
    // Llega de fuera: una excepción aquí sería un 500 donde corresponde un «eso
    // no vale».
    expect(sameHex('zzzz'.repeat(16), UNO)).toBe(false);
    expect(sameHex(UNO, '¡¡¡¡'.repeat(16))).toBe(false);
  });

  it('dos vacios son iguales, que es lo que dice la aritmetica', () => {
    // No es un caso que llegue: quien llama compara siempre huellas de longitud
    // fija. Está escrito para que se vea que no lanza.
    expect(sameHex('', '')).toBe(true);
  });
});
