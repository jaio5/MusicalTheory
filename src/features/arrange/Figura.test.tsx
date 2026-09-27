// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NOTE_LENGTHS } from '@core/music';

import { Figura, nombreDeFigura } from './Figura';

/**
 * Las figuras, dibujadas y con su nombre.
 *
 * El dibujo es lo que se mira y el nombre lo que se oye: una fila de redondeles
 * sin nombre no dice nada a quien usa lector de pantalla, y un «1 pulso» sin
 * dibujo no dice nada al que lee partituras.
 *
 * **Se recorre `NOTE_LENGTHS` y no una lista escrita a mano**, y esa es la
 * corrección que trae este fichero. Estaba enumerado —las seis de entonces— así
 * que cuando la rejilla bajó a la semicorchea
 * ([adr/0049](../../../docs/adr/0049-la-rejilla-llega-a-la-semicorchea.md)) la
 * séptima entró sin que nada la mirara: salía llamada «0.25 pulsos» y dibujada con
 * un corchete, igual que la corchea. Tres mil tests en verde y el selector roto.
 */
describe('el nombre de una figura', () => {
  it('todas las que el modelo sabe escribir tienen nombre propio', () => {
    for (const length of NOTE_LENGTHS) {
      expect(nombreDeFigura(length), `${length} sin nombre de figura`).not.toContain('pulsos');
    }
    // Y son los de siempre, para que un cambio de nombre se vea.
    expect(NOTE_LENGTHS.map(nombreDeFigura)).toEqual([
      'semicorchea',
      'corchea',
      'negra',
      'negra con puntillo',
      'blanca',
      'blanca con puntillo',
      'redonda',
    ]);
  });

  /**
   * Y lo que no es una de ellas se dice en pulsos: una nota estirada a mano
   * puede durar tres, y «3 pulsos» es más honesto que inventarle una figura.
   */
  it('lo que no lo es se dice en pulsos', () => {
    expect(nombreDeFigura(5)).toBe('5 pulsos');
    expect(nombreDeFigura(7.5)).toBe('7.5 pulsos');
  });
});

describe('el dibujo de una figura', () => {
  /** Los trazos con los que se dibuja esa duración. */
  function partes(length: number) {
    const { container } = render(<Figura length={length} />);
    return {
      hueca: container.querySelector('ellipse')?.getAttribute('fill') === 'none',
      punto: container.querySelectorAll('circle').length > 0,
      plica: container.querySelectorAll('line').length > 0,
      corchetes: container.querySelectorAll('path').length,
    };
  }

  it('se pinta y no se anuncia: el nombre lo pone quien la usa', () => {
    const { container } = render(<Figura length={2} />);

    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  /**
   * Cada figura se dibuja con lo suyo y con nada más: la redonda es hueca y sin
   * plica, la corchea lleva corchete y las de puntillo llevan su punto. Es lo
   * único que separa unas de otras a este tamaño.
   */
  it('cada una lleva sus trazos y no los de las demas', () => {
    expect(partes(4)).toEqual({ hueca: true, punto: false, plica: false, corchetes: 0 });
    expect(partes(2)).toEqual({ hueca: true, punto: false, plica: true, corchetes: 0 });
    expect(partes(3)).toEqual({ hueca: true, punto: true, plica: true, corchetes: 0 });
    expect(partes(1)).toEqual({ hueca: false, punto: false, plica: true, corchetes: 0 });
    expect(partes(0.5)).toEqual({ hueca: false, punto: false, plica: true, corchetes: 1 });
  });

  /**
   * **Y se cuentan los corchetes, no si hay alguno.** Contándolos como un sí o no,
   * la semicorchea y la corchea salían iguales y el test no lo veía: el número de
   * corchetes **es** la figura.
   */
  it('la semicorchea lleva dos corchetes', () => {
    expect(partes(0.25)).toEqual({ hueca: false, punto: false, plica: true, corchetes: 2 });
  });

  // Ninguna de las que se pueden escribir se dibuja igual que otra: si dos
  // salieran con los mismos trazos, en pantalla no se distinguirían.
  it('ninguna se dibuja igual que otra', () => {
    const dibujos = NOTE_LENGTHS.map((length) => JSON.stringify(partes(length)));

    expect(new Set(dibujos).size, 'dos figuras se dibujan igual').toBe(NOTE_LENGTHS.length);
  });
});
