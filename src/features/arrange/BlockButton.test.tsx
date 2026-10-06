// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BlockButton, ZONA_ESTIRAR_PX } from './BlockButton';

function pintar() {
  render(<BlockButton blockId="a" symbol="C" degree="I" beats={4} beatsPerBar={4} />);
  return screen.getByRole('button', { name: /^C, grado I/ });
}

/**
 * Lo que el bloque le deja al navegador con el dedo.
 *
 * Con `touch-action: none` en todo el bloque, un barrido que naciera en él no
 * desplazaba ni la tira —238 px fuera de la vista a 390 con ocho acordes— ni la
 * columna. El cuerpo deja pasar los dos ejes y el arrastre llega sujetándolo
 * (`use-block-drag`); la franja de estirar es la única que se queda el gesto,
 * porque de ahí se tira al instante.
 */
describe('Un bloque bajo el dedo', () => {
  it('deja desplazar la tira y la columna', () => {
    expect(pintar()).toHaveStyle({ touchAction: 'pan-x pan-y' });
  });

  it('y solo la franja de estirar se queda el gesto', () => {
    const franja = pintar().querySelector('.cursor-ew-resize') as HTMLElement;

    expect(franja).toHaveStyle({ touchAction: 'none', width: `${ZONA_ESTIRAR_PX}px` });
  });

  // Sujetar un texto medio segundo lo selecciona, y sujetar es cómo se coge.
  it('no se le selecciona el texto al sujetarlo', () => {
    expect(pintar()).toHaveClass('select-none');
  });
});
