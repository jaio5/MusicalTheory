// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressRing } from './ProgressRing';

/**
 * El anillo crece con las duraciones de la casa: llevaba `400ms ease-out`
 * escritos a mano, los únicos de la aplicación fuera de `--duracion-*` y
 * `ease-salida`, y nadie lo vigilaba.
 */
describe('el anillo de avance', () => {
  it('crece con la duración de entrada y la curva de la casa', () => {
    render(<ProgressRing part={0.5} label="Meta del día" />);

    const [, hecho] = [
      ...screen.getByRole('img', { name: 'Meta del día' }).querySelectorAll('circle'),
    ];
    expect(hecho!.style.transition).toBe(
      'stroke-dashoffset var(--duracion-entrada) var(--ease-salida)',
    );
  });

  it('recorta lo que se salga de 0 a 1', () => {
    const { rerender } = render(<ProgressRing part={2} label="Meta" size={64} ancho={5} />);
    const circulo = () => screen.getByRole('img').querySelectorAll('circle')[1]!;

    expect(circulo().getAttribute('stroke-dashoffset')).toBe('0');
    expect(circulo()).toHaveClass('text-tube-bright');

    rerender(<ProgressRing part={-1} label="Meta" size={64} ancho={5} />);
    expect(Number(circulo().getAttribute('stroke-dashoffset'))).toBeCloseTo(
      Number(circulo().getAttribute('stroke-dasharray')),
    );
    expect(circulo()).toHaveClass('text-brass-bright');
  });
});
