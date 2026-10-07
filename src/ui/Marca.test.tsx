// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Marca } from './Marca';

/**
 * El punto de tres estados: **con forma, no solo con color**.
 *
 * Verde contra rojo es justo la pareja que no distingue la deficiencia de color
 * más común, así que cada tono lleva además su forma. Lo que se prueba aquí es
 * eso: que las tres se dibujan distinto aunque alguien no vea el color.
 */
function pintar(props: Parameters<typeof Marca>[0]) {
  const { container } = render(<Marca {...props} />);
  return container.firstElementChild!;
}

describe('la marca de tres estados', () => {
  it('cada tono tiene su forma, y ninguna es la misma', () => {
    const entra = pintar({ tono: 'entra' }).className;
    const color = pintar({ tono: 'color' }).className;
    const fuera = pintar({ tono: 'fuera' }).className;

    // Círculo lleno, anillo y rombo: se distinguen sin mirar el color.
    expect(color).toContain('border-2');
    expect(fuera).toContain('rotate-45');
    expect(entra).not.toContain('border-2');
    expect(entra).not.toContain('rotate-45');
  });

  // Apagada usa el tono de relleno y no el de escribir: es para filos y adornos.
  it('apagada usa el color de relleno', () => {
    for (const tono of ['entra', 'color', 'fuera'] as const) {
      const viva = pintar({ tono }).className;
      const apagada = pintar({ tono, apagada: true }).className;

      expect(apagada, tono).not.toBe(viva);
      expect(apagada, tono).not.toContain('-bright');
    }
  });

  /**
   * Y con `senal` sobrevive al velo de grabar: mientras se graba, `globals.css`
   * deja transparente todo lo que no lo lleve, y la marca es de lo poco que da
   * tiempo a mirar tocando.
   */
  it('la que es señal se marca para sobrevivir al velo', () => {
    expect(pintar({ tono: 'entra', senal: true })).toHaveAttribute('data-senal');
    expect(pintar({ tono: 'entra' })).not.toHaveAttribute('data-senal');
  });

  // Y no se anuncia: lo que significa ya está escrito al lado.
  it('no la lee el lector de pantalla', () => {
    expect(pintar({ tono: 'fuera' })).toHaveAttribute('aria-hidden', 'true');
  });
});
