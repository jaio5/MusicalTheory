// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './Chip';

describe('la pastilla', () => {
  it('normal: 14 px; compacto: 13 px; grande: 16 y más alto, todos con alto y ancho de dedo', () => {
    const { rerender } = render(<Chip onClick={() => {}}>Do</Chip>);
    expect(screen.getByRole('button')).toHaveClass('text-sm', 'px-3.5', 'min-h-tap', 'min-w-tap');

    rerender(
      <Chip onClick={() => {}} tamano="compacto">
        Do
      </Chip>,
    );
    expect(screen.getByRole('button')).toHaveClass('text-[0.8125rem]', 'px-3', 'min-h-tap');
    expect(screen.getByRole('button')).not.toHaveClass('text-sm');

    rerender(
      <Chip onClick={() => {}} tamano="grande">
        Do
      </Chip>,
    );
    expect(screen.getByRole('button')).toHaveClass('text-base', 'py-4', 'min-h-tap');
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
    // Lo puesto lleva su piloto encendido, además del atributo.
    expect(boton).toHaveClass('piloto');
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

  /**
   * Las respuestas de una pregunta eran `quiet`: lo más gris y pequeño de la
   * pantalla, sin borde ni fondo hasta pasar el ratón. `opcion` las pinta como
   * lo que son, un control que se elige, y lo corregido conserva ese fondo.
   */
  it('una opción lleva borde de control y fondo, y lo corregido también', () => {
    render(
      <>
        <Chip onClick={() => {}} tone="opcion">
          Do
        </Chip>
        <Chip onClick={() => {}} tone="acierto" disabled>
          Re
        </Chip>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Do' })).toHaveClass(
      'border-border-strong',
      'bg-surface',
      'text-text',
    );
    expect(screen.getByRole('button', { name: 'Re' })).toHaveClass('bg-surface');
  });
});
