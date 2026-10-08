// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BlockButton, duracionEnLaEsquina, ZONA_ESTIRAR_PX } from './BlockButton';

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

/**
 * Cuánto dura, contado como se cuenta tocando: un bloque estirado a mano salía
 * «11,75», la división tal cual.
 */
describe('La duración en la esquina del bloque', () => {
  it('en compases enteros, y lo que sobra en pulsos', () => {
    expect(duracionEnLaEsquina(4, 4)).toBeNull();
    expect(duracionEnLaEsquina(8, 4)).toBe('2');
    expect(duracionEnLaEsquina(47, 4)).toBe('11 + 3 p');
    expect(duracionEnLaEsquina(2, 4)).toBe('2 p');
    expect(duracionEnLaEsquina(6.5, 3)).toBe('2 + 0,5 p');
  });

  it('y no se ve el decimal en el bloque', () => {
    render(<BlockButton blockId="a" symbol="C" degree="I" beats={47} beatsPerBar={4} />);

    expect(screen.getByText('11 + 3 p')).toBeInTheDocument();
    expect(screen.queryByText(/11,75/)).not.toBeInTheDocument();
  });

  it('el lector dice «1 pulso», no «1 pulsos»', () => {
    render(<BlockButton blockId="a" symbol="C" degree="I" beats={1} beatsPerBar={4} />);

    expect(screen.getByRole('button', { name: /, 1 pulso$/ })).toBeInTheDocument();
  });
});
