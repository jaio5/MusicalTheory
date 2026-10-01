// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './Chip';

describe('la pastilla', () => {
  it('normal: 14 px; compacto: 13 px, los dos con alto y ancho de dedo', () => {
    const { rerender } = render(<Chip onClick={() => {}}>Do</Chip>);
    expect(screen.getByRole('button')).toHaveClass('text-sm', 'px-3.5', 'min-h-tap', 'min-w-tap');

    rerender(
      <Chip onClick={() => {}} tamano="compacto">
        Do
      </Chip>,
    );
    expect(screen.getByRole('button')).toHaveClass('text-[13px]', 'px-3', 'min-h-tap');
    expect(screen.getByRole('button')).not.toHaveClass('text-sm');
  });

  it('avisa al pulsar y anuncia el estado y el atajo', () => {
    const alPulsar = vi.fn();
    render(
      <Chip onClick={alPulsar} pressed atajo="K" ariaLabel="Do mayor">
        Do
      </Chip>,
    );
    const boton = screen.getByRole('button', { name: 'Do mayor' });

    fireEvent.click(boton);
    expect(alPulsar).toHaveBeenCalledOnce();
    expect(boton).toHaveAttribute('aria-pressed', 'true');
    expect(boton).toHaveAttribute('aria-keyshortcuts', 'K');
    expect(boton).toHaveAttribute('title', 'Do mayor · K');
    expect(boton).toHaveClass('border-brass-bright');
  });

  it('un título sin atajo va tal cual; lo corregido no se apaga ni se tiñe de latón', () => {
    render(
      <>
        <Chip onClick={() => {}} title="Sol" disabled tone="acierto" pressed>
          Sol
        </Chip>
        <Chip onClick={() => {}} disabled tone="quiet">
          La
        </Chip>
        <Chip onClick={() => {}} atajo="J">
          Re
        </Chip>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Sol' })).toHaveAttribute('title', 'Sol');
    expect(screen.getByRole('button', { name: 'Sol' })).not.toHaveClass('disabled:opacity-40');
    expect(screen.getByRole('button', { name: 'Sol' })).toHaveClass('border-tube-bright');
    expect(screen.getByRole('button', { name: 'La' })).toHaveClass('disabled:opacity-40');
    expect(screen.getByRole('button', { name: 'Re' })).toHaveAttribute('title', '· J');
  });
});
