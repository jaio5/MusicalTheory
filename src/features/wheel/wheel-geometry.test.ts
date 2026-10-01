import { describe, expect, it } from 'vitest';

import {
  DIANA,
  escalaDesdeElCentro,
  HOLGURA,
  INNER_RADIUS,
  pointAt,
  RING_RADIUS,
} from './WheelOfFifths';

/**
 * Estas pruebas existen por un fallo concreto: `Math.cos` devolvía el último
 * bit distinto en Node y en el navegador, el SVG salía con coordenadas que no
 * coincidían y React abortaba la hidratación. Redondear lo arregla, y esto lo
 * fija para que no vuelva.
 */
describe('coordenadas de la rueda', () => {
  it('no arrastra decimales que dependan de la implementación', () => {
    for (let position = 0; position < 12; position += 1) {
      for (const radius of [104, 66]) {
        const point = pointAt(position, radius);
        expect(Number.isInteger(point.x * 1000)).toBe(true);
        expect(Number.isInteger(point.y * 1000)).toBe(true);
      }
    }
  });

  it('coloca la primera posición justo arriba', () => {
    expect(pointAt(0, 104)).toEqual({ x: 130, y: 26 });
  });

  it('reparte las doce posiciones alrededor del centro', () => {
    const distances = Array.from({ length: 12 }, (_, position) => {
      const point = pointAt(position, 104);
      return Math.hypot(point.x - 130, point.y - 130);
    });

    for (const distance of distances) {
      expect(distance).toBeCloseTo(104, 2);
    }
  });

  it('la sexta posición cae justo enfrente de la primera', () => {
    const top = pointAt(0, 104);
    const bottom = pointAt(6, 104);
    expect(bottom.x).toBeCloseTo(top.x, 2);
    expect(bottom.y).toBeCloseTo(260 - top.y, 2);
  });
});

/**
 * La escala de los anillos sale del render y no solo del efecto.
 *
 * Es otro fallo concreto: la encogía **solo** el efecto de layout, que en el
 * servidor no corre, así que el HTML que llegaba traía los veinticuatro nombres
 * pisados unos encima de otros —«A♯m» encima de «A♭m»— hasta que bajaba el
 * JavaScript. Se veía sin JavaScript y se veía en el primer fotograma.
 */
describe('la escala de los anillos', () => {
  it('el anillo de fuera no se toca', () => {
    expect(escalaDesdeElCentro(1)).toBe('translate(0px, 0px) scale(1)');
  });

  // Encogido a la mitad, el centro se queda donde estaba: si la traslación no
  // compensara, el anillo de dentro se iría a la esquina de arriba.
  it('el de dentro encoge sin moverse del centro', () => {
    expect(escalaDesdeElCentro(0.5)).toBe('translate(65px, 65px) scale(0.5)');
  });

  it('no arrastra decimales que dependan de la implementacion', () => {
    const escrito = escalaDesdeElCentro(66 / 104);
    for (const numero of escrito.match(/[\d.]+/g) ?? []) {
      expect(Number.isInteger(Number(numero) * 1000)).toBe(true);
    }
  });
});

/**
 * Las dianas de las veinticuatro tonalidades: que midan lo mismo y que no se
 * pisen. Se pisaban —el borde de dentro de cada mayor caía siete unidades encima
 * de su relativa menor— y desde fuera no se veía: pulsar la parte baja de la «C»
 * elegía La menor.
 */
describe('las dianas de la rueda', () => {
  const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it('dos vecinas del anillo de dentro no se tocan', () => {
    for (let position = 0; position < 12; position += 1) {
      const aqui = pointAt(position, INNER_RADIUS);
      const alLado = pointAt(position + 1, INNER_RADIUS);
      expect(distancia(aqui, alLado)).toBeGreaterThanOrEqual(DIANA + HOLGURA);
    }
  });

  it('una mayor y su relativa menor tampoco, aunque compartan sitio', () => {
    for (let position = 0; position < 12; position += 1) {
      const fuera = pointAt(position, RING_RADIUS);
      const dentro = pointAt(position, INNER_RADIUS);
      expect(distancia(fuera, dentro)).toBeGreaterThanOrEqual(DIANA + HOLGURA);
    }
  });

  it('la de fuera cabe en el lienzo', () => {
    expect(RING_RADIUS + DIANA / 2).toBeLessThanOrEqual(130);
  });
});
