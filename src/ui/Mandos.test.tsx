// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Mando, Mandos, ValorDelMando } from './Mandos';

describe('Mandos', () => {
  function pintar(onMenos = vi.fn(), onMas = vi.fn()) {
    render(
      <Mandos etiqueta="Lo que dura" className="w-full">
        <Mando primero onClick={onMenos} ariaLabel="Un pulso menos" disabled>
          −
        </Mando>
        <ValorDelMando>4 pulsos</ValorDelMando>
        <Mando onClick={onMas} ariaLabel="Un pulso más">
          +
        </Mando>
      </Mandos>,
    );
    return { onMenos, onMas };
  }

  // Una pieza con nombre y borde: sueltos se leían como texto.
  it('es un grupo con nombre, con el carril del segmentado', () => {
    pintar();
    const grupo = screen.getByRole('group', { name: 'Lo que dura' });

    expect(grupo).toHaveClass('border', 'rounded-md', 'w-full');
    expect(grupo).toHaveTextContent('−4 pulsos+');
  });

  // El primero no lleva raya a la izquierda; los demás sí, que es lo que los une.
  it('solo los de detras llevan la raya que los une', () => {
    pintar();

    expect(screen.getByRole('button', { name: 'Un pulso menos' })).not.toHaveClass('border-l');
    expect(screen.getByRole('button', { name: 'Un pulso más' })).toHaveClass('border-l');
  });

  it('pulsa lo que se deja y no lo apagado', async () => {
    const { onMenos, onMas } = pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Un pulso menos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un pulso más' }));

    expect(onMenos).not.toHaveBeenCalled();
    expect(onMas).toHaveBeenCalledOnce();
  });

  // Sin `className`, el carril va solo con lo suyo.
  it('sin clase de fuera tambien se pinta', () => {
    render(
      <Mandos etiqueta="Mover">
        <Mando primero onClick={() => {}}>
          Antes
        </Mando>
      </Mandos>,
    );

    expect(screen.getByRole('group', { name: 'Mover' })).toBeInTheDocument();
  });
});
