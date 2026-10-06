// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buscarPieza, medirPieza, partirSelector, traerPiezaALaVista } from './pieza';

/** jsdom no maqueta: cada caja se le dice a mano. */
function ponerCaja(elemento: Element, x: number, y: number, ancho: number, alto: number): void {
  elemento.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      width: ancho,
      height: alto,
      right: x + ancho,
      bottom: y + alto,
    }) as DOMRect;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('partir la lista de selectores', () => {
  it('por las comas de fuera, sin romper las que van entre comillas', () => {
    expect(
      partirSelector('nav[aria-label="Pantallas"], nav[aria-label="Pantallas, abajo"],  ,x'),
    ).toEqual(['nav[aria-label="Pantallas"]', 'nav[aria-label="Pantallas, abajo"]', 'x']);
    expect(partirSelector("[title='a, b'] > p")).toEqual(["[title='a, b'] > p"]);
  });
});

describe('buscar la pieza', () => {
  it('la primera que se vea, por el orden de la lista y no por el del documento', () => {
    document.body.innerHTML = `
      <section aria-label="Ensayo"><div data-tour="dentro"></div></section>
      <div data-tour="escondida"></div>`;
    const area = document.querySelector('section')!;
    const dentro = document.querySelector('[data-tour="dentro"]')!;
    ponerCaja(area, 0, 0, 500, 500);
    ponerCaja(dentro, 10, 10, 100, 100);

    expect(buscarPieza('[data-tour="dentro"], section[aria-label="Ensayo"]')).toBe(dentro);
    expect(buscarPieza('[data-tour="escondida"], section')).toBe(area);
    expect(buscarPieza('[data-tour="escondida"]')).toBeNull();
  });

  it('lo que el navegador esconde no cuenta, aunque dé medidas', () => {
    document.body.innerHTML = `<div data-tour="a"></div>`;
    const pieza = document.querySelector('[data-tour="a"]')!;
    ponerCaja(pieza, 0, 0, 10, 10);
    pieza.checkVisibility = () => false;

    expect(buscarPieza('[data-tour="a"]')).toBeNull();
  });
});

describe('medirla', () => {
  it('su caja, o con lo que cuelga de ella si flota fuera', () => {
    document.body.innerHTML = `<div id="barra"><div id="panel"></div><span id="nada"></span></div>`;
    const barra = document.getElementById('barra')!;
    ponerCaja(barra, 0, 100, 390, 45);
    ponerCaja(document.getElementById('panel')!, 10, 145, 370, 480);
    ponerCaja(document.getElementById('nada')!, 0, 0, 0, 0);

    expect(medirPieza(barra)).toEqual({ x: 0, y: 100, ancho: 390, alto: 45 });
    expect(medirPieza(barra, true)).toEqual({ x: 0, y: 100, ancho: 390, alto: 525 });
  });
});

describe('traerla a la vista', () => {
  /** Una caja que se desplaza en un eje, con sus medidas puestas a mano. */
  function caja(estilo: string, medidas: Partial<Record<string, number>>): HTMLElement {
    const nodo = document.createElement('div');
    nodo.setAttribute('style', estilo);
    for (const [clave, valor] of Object.entries(medidas)) {
      Object.defineProperty(nodo, clave, { value: valor, configurable: true });
    }
    return nodo;
  }

  it('mueve solo lo que se desplaza, en los dos ejes, y deja lo que recorta', () => {
    const recorta = caja('overflow: hidden', { scrollHeight: 2000, clientHeight: 500 });
    const columna = caja('overflow-y: auto', { scrollHeight: 2000, clientHeight: 500 });
    const fila = caja('overflow-x: auto', { scrollWidth: 900, clientWidth: 390 });
    const quieta = caja('overflow: auto', { scrollHeight: 10, clientHeight: 10 });
    const pieza = document.createElement('button');
    recorta.append(columna);
    columna.append(fila);
    fila.append(quieta);
    quieta.append(pieza);
    document.body.append(recorta);

    ponerCaja(recorta, 0, 0, 390, 500);
    ponerCaja(columna, 0, 0, 390, 500);
    ponerCaja(fila, 0, 0, 390, 50);
    ponerCaja(quieta, 0, 0, 390, 50);
    // Por debajo de la columna y por la derecha de la fila.
    ponerCaja(pieza, 500, 700, 80, 40);

    traerPiezaALaVista(pieza);

    expect(columna.scrollTop).toBe(700 + 40 - 500 + 8);
    expect(fila.scrollLeft).toBe(580 - 390 + 8);
    expect(recorta.scrollTop).toBe(0);
  });

  it('una pieza por encima se trae a su principio, y una más alta que el hueco, desde arriba', () => {
    const columna = caja('overflow-y: scroll', { scrollHeight: 3000, clientHeight: 400 });
    const pieza = document.createElement('div');
    columna.append(pieza);
    document.body.append(columna);
    ponerCaja(columna, 0, 100, 390, 400);

    columna.scrollTop = 500;
    ponerCaja(pieza, 0, 20, 390, 50);
    traerPiezaALaVista(pieza);
    expect(columna.scrollTop).toBe(500 + (20 - 100 - 8));

    columna.scrollTop = 0;
    ponerCaja(pieza, 0, 300, 390, 900);
    traerPiezaALaVista(pieza);
    expect(columna.scrollTop).toBe(300 - 100 - 8);

    columna.scrollTop = 0;
    ponerCaja(pieza, 0, 150, 390, 50);
    traerPiezaALaVista(pieza);
    expect(columna.scrollTop).toBe(0);
  });
});
