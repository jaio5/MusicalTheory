import { describe, expect, it } from 'vitest';

import { BOLITA, CLAVE_DE_SOL, contornoDeTrazo, ESPACIO_CLAVE, TRAZO } from './clef';

/**
 * La clave de sol.
 *
 * Esto no prueba que sea bonita —eso se mira— sino **lo que tiene que cumplir
 * para significar lo que significa**, que es lo que se torció dos veces:
 *
 * - El centro de la espiral va en el origen, porque el origen se planta sobre la
 *   línea del Sol. Una clave de sol cuyo bucle no rodea esa línea no es una clave
 *   de sol, es un adorno.
 * - El trazo se cruza dos veces con el mástil. Esos dos cruces son lo que la hace
 *   reconocible, y la primera versión no los tenía: era una espiral con un palo.
 * - Las proporciones, en espacios de pentagrama, son las de cualquier partitura.
 *   Estuvo desplazada hacia abajo —le faltaba arriba y le sobraba de cola— y se
 *   veía como una clave a la que alguien le había tirado del pie.
 */

/** Los puntos del contorno, para poder medirlo. */
function puntosDe(d: string): Array<[number, number]> {
  return [...d.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map(([, x, y]) => [Number(x), Number(y)]);
}

const PUNTOS = puntosDe(CLAVE_DE_SOL);
const izquierda = Math.min(...PUNTOS.map(([x]) => x));
const derecha = Math.max(...PUNTOS.map(([x]) => x));
const arriba = Math.min(...PUNTOS.map(([, y]) => y));
const abajo = Math.max(...PUNTOS.map(([, y]) => y));

describe('el contorno de la clave', () => {
  it('es un solo trazo cerrado, sin agujeros que dependan del relleno', () => {
    expect(CLAVE_DE_SOL.startsWith('M ')).toBe(true);
    expect(CLAVE_DE_SOL.trimEnd().endsWith('Z')).toBe(true);
    expect(CLAVE_DE_SOL.match(/M /g)).toHaveLength(1);
  });

  it('sale del trazo: mover un punto mueve el dibujo', () => {
    const otro = contornoDeTrazo(TRAZO.map(([x, y, w]) => [x + 5, y, w]));

    expect(otro).not.toBe(CLAVE_DE_SOL);
    expect(Math.min(...puntosDe(otro).map(([x]) => x))).toBeCloseTo(izquierda + 5, 0);
  });
});

describe('lo que la clave tiene que cumplir', () => {
  /**
   * El último punto del trazo es el final de la espiral, y ahí es donde se
   * enrosca: a menos de medio espacio del origen, que es la línea del Sol.
   */
  it('la espiral muere en el origen, que es donde va la línea del Sol', () => {
    const final = TRAZO[TRAZO.length - 1]!;

    expect(Math.hypot(final[0], final[1])).toBeLessThan(ESPACIO_CLAVE * 0.6);
  });

  /**
   * **La cabeza cruza el mástil dos veces**, y eso es la clave de sol.
   *
   * Del gancho de arriba baja un tramo que lo cruza hacia la derecha, y de la
   * panza vuelve otro que lo cruza hacia la izquierda camino de la espiral. Sin
   * esos dos cruces queda una espiral con un palo, que es exactamente lo que
   * había antes y lo que hacía que nadie supiera qué era.
   *
   * Se cuenta desde la punta de arriba, que es donde empieza la cabeza: antes de
   * ella el trazo es la cola y el mástil, y que la cola nazca a la izquierda no
   * dice nada de la forma.
   */
  it('la cabeza cruza el mástil dos veces, que es lo que la hace reconocible', () => {
    const MASTIL = 6;
    const punta = TRAZO.reduce((mejor, p, i) => (p[1] < TRAZO[mejor]![1] ? i : mejor), 0);
    let cruces = 0;

    for (let i = punta + 1; i < TRAZO.length; i += 1) {
      const antes = TRAZO[i - 1]![0] - MASTIL;
      const ahora = TRAZO[i]![0] - MASTIL;
      if (antes < 0 !== ahora < 0) {
        cruces += 1;
      }
    }

    expect(cruces).toBe(2);
  });

  it('sube cuatro espacios sobre la línea del Sol: un espacio por encima del pentagrama', () => {
    // Del Sol a la quinta línea hay tres espacios, y la clave asoma uno más.
    expect(-arriba / ESPACIO_CLAVE).toBeGreaterThan(3.7);
    expect(-arriba / ESPACIO_CLAVE).toBeLessThan(4.3);
  });

  it('y baja hasta la bolita, un espacio por debajo de la primera línea', () => {
    // Del Sol a la primera línea hay un espacio, y la bolita cuelga otro más.
    const fondo = Math.max(abajo, BOLITA.y + BOLITA.r);

    expect(fondo / ESPACIO_CLAVE).toBeGreaterThan(2.1);
    expect(fondo / ESPACIO_CLAVE).toBeLessThan(2.8);
  });

  it('es más alta que ancha, como cualquier clave de sol', () => {
    expect(abajo - arriba).toBeGreaterThan((derecha - izquierda) * 2);
  });
});
