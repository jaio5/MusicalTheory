import { describe, expect, it } from 'vitest';

import { HUECO, MARGEN, cajaIluminada, colocarTarjeta, union } from './colocar';

// La pantalla entera como marco: lo que pasa cuando no hay cabecera ni barra.
const PORTATIL = { x: 0, y: 0, ancho: 1280, alto: 800 };
const TELEFONO = { x: 0, y: 0, ancho: 390, alto: 844 };
const TARJETA = { ancho: 384, alto: 200 };

describe('dónde va la tarjeta', () => {
  it('sin pieza que señalar, en medio', () => {
    expect(colocarTarjeta(null, TARJETA, PORTATIL)).toEqual({ x: 448, y: 300, lado: 'centro' });
  });

  it('en medio aunque no quepa, sin salirse por arriba ni por la izquierda', () => {
    expect(colocarTarjeta(null, { ancho: 500, alto: 900 }, TELEFONO)).toEqual({
      x: MARGEN,
      y: MARGEN,
      lado: 'centro',
    });
  });

  it('debajo de la pieza, si cabe', () => {
    const pieza = { x: 600, y: 60, ancho: 300, alto: 56 };
    expect(colocarTarjeta(pieza, TARJETA, PORTATIL)).toEqual({
      x: 558,
      y: 60 + 56 + HUECO,
      lado: 'debajo',
    });
  });

  it('encima, si debajo no cabe', () => {
    const pieza = { x: 0, y: 733, ancho: 1280, alto: 67 };
    expect(colocarTarjeta(pieza, TARJETA, PORTATIL)).toEqual({
      x: 448,
      y: 733 - HUECO - 200,
      lado: 'encima',
    });
  });

  it('a la derecha si es alta y hay sitio al lado', () => {
    const pieza = { x: 0, y: 112, ancho: 326, alto: 630 };
    expect(colocarTarjeta(pieza, TARJETA, PORTATIL)).toMatchObject({
      x: 326 + HUECO,
      lado: 'derecha',
    });
  });

  it('a la izquierda si el sitio está ese lado', () => {
    const pieza = { x: 900, y: 112, ancho: 380, alto: 630 };
    expect(colocarTarjeta(pieza, TARJETA, PORTATIL)).toMatchObject({
      x: 900 - HUECO - 384,
      lado: 'izquierda',
    });
  });

  /**
   * La rueda abierta en un teléfono ocupa casi toda la pantalla: no hay sitio
   * limpio y se pega al borde que menos tape.
   */
  it('sin sitio limpio, contra el borde que menos tape', () => {
    const tarjeta = { ancho: 358, alto: 240 };
    const rueda = { x: 0, y: 112, ancho: 390, alto: 523 };
    expect(colocarTarjeta(rueda, tarjeta, TELEFONO)).toEqual({ x: 16, y: 588, lado: 'abajo' });

    const abajoDelTodo = { x: 0, y: 200, ancho: 390, alto: 644 };
    expect(colocarTarjeta(abajoDelTodo, tarjeta, TELEFONO)).toEqual({
      x: 16,
      y: MARGEN,
      lado: 'arriba',
    });
  });

  /**
   * El afinador a 360×640: 430 de alto entre una cabecera de 60 y una barra de
   * pantallas de 71. Sin sitio limpio, la tarjeta se queda en el hueco de
   * trabajo y no tapa ni la cabecera ni la navegación.
   */
  it('sin sitio limpio, dentro del hueco de trabajo y sin tapar cabecera ni navegación', () => {
    const hueco = { x: 0, y: 60, ancho: 360, alto: 509 };
    const afinador = { x: 11, y: 143, ancho: 338, alto: 430 };
    const sitio = colocarTarjeta(afinador, { ancho: 328, alto: 210 }, hueco);

    expect(sitio).toEqual({ x: 16, y: 60 + MARGEN, lado: 'arriba' });
    expect(sitio.y + 210).toBeLessThanOrEqual(hueco.y + hueco.alto);
  });

  it('en medio del hueco, no de la ventana', () => {
    const hueco = { x: 0, y: 60, ancho: 1280, alto: 740 };
    expect(colocarTarjeta(null, TARJETA, hueco)).toEqual({ x: 448, y: 330, lado: 'centro' });
  });
});

describe('lo que se enciende', () => {
  it('la pieza con un poco de aire', () => {
    expect(cajaIluminada({ x: 100, y: 100, ancho: 50, alto: 20 }, PORTATIL)).toEqual({
      x: 94,
      y: 94,
      ancho: 62,
      alto: 32,
    });
  });

  it('recortada a la pantalla, para que se vea dónde acaba', () => {
    expect(cajaIluminada({ x: -20, y: 700, ancho: 2000, alto: 400 }, PORTATIL)).toEqual({
      x: 0,
      y: 694,
      ancho: 1280,
      alto: 106,
    });
    expect(cajaIluminada({ x: 2000, y: 0, ancho: 10, alto: 10 }, PORTATIL).ancho).toBe(0);
  });

  it('la que abarca varias, sin contar las vacías', () => {
    expect(
      union([
        { x: 10, y: 10, ancho: 100, alto: 20 },
        { x: 0, y: 40, ancho: 50, alto: 300 },
        { x: 999, y: 999, ancho: 0, alto: 0 },
      ]),
    ).toEqual({ x: 0, y: 10, ancho: 110, alto: 330 });
    expect(union([{ x: 1, y: 1, ancho: 0, alto: 5 }])).toBeNull();
  });
});
