// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Figura, nombreDeFigura } from './Figura';

/**
 * Las figuras, dibujadas y con su nombre.
 *
 * El dibujo es lo que se mira y el nombre lo que se oye: una fila de seis
 * redondeles sin nombre no dice nada a quien usa lector de pantalla, y un
 * «1 pulso» sin dibujo no dice nada al que lee partituras.
 */
describe('el nombre de una figura', () => {
  it('las seis que el modelo sabe escribir tienen nombre propio', () => {
    expect(nombreDeFigura(0.5)).toBe('corchea');
    expect(nombreDeFigura(1)).toBe('negra');
    expect(nombreDeFigura(1.5)).toBe('negra con puntillo');
    expect(nombreDeFigura(2)).toBe('blanca');
    expect(nombreDeFigura(3)).toBe('blanca con puntillo');
    expect(nombreDeFigura(4)).toBe('redonda');
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
    function partes(length: number) {
      const { container } = render(<Figura length={length} />);
      return {
        hueca: container.querySelector('ellipse')?.getAttribute('fill') === 'none',
        punto: container.querySelectorAll('circle').length > 0,
        plica: container.querySelectorAll('line').length > 0,
        corchete: container.querySelectorAll('path').length > 0,
      };
    }

    expect(partes(4)).toEqual({ hueca: true, punto: false, plica: false, corchete: false });
    expect(partes(2)).toEqual({ hueca: true, punto: false, plica: true, corchete: false });
    expect(partes(3)).toEqual({ hueca: true, punto: true, plica: true, corchete: false });
    expect(partes(1)).toEqual({ hueca: false, punto: false, plica: true, corchete: false });
    expect(partes(0.5)).toEqual({ hueca: false, punto: false, plica: true, corchete: true });
  });
});
