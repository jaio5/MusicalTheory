// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { CLAVE_TEMA } from '@state/theme';

import { ThemeToggle } from './ThemeToggle';

/**
 * El conmutador de tema.
 *
 * Dos estados y nada más: un ciclo de tres —claro, oscuro, lo que diga el
 * sistema— obliga a pasar por el que no quieres para volver al que sí, y nadie
 * entiende qué hace el tercer clic.
 *
 * Lo que se prueba con cuidado es que **enseña el tema al que va, no el que
 * hay**: con el de luna se entiende sin leer que pulsando se apaga la luz. Y que
 * volver al oscuro **borra** la preferencia en vez de escribir «oscuro», que es
 * lo que hace que el día que cambie el tema base cambie para todos.
 */

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
});

describe('el conmutador', () => {
  it('en oscuro ofrece ir al claro', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Cambiar al tema claro' })).toBeInTheDocument();
  });

  it('al pulsarlo cambia el documento y lo recuerda', async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button'));

    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro');
    expect(screen.getByRole('button', { name: 'Cambiar al tema oscuro' })).toBeInTheDocument();
  });

  it('volver al oscuro borra la preferencia, no escribe «oscuro»', async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('button'));

    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull();
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('el nombre lo dice con palabras, que es lo que oye quien no ve el icono', async () => {
    render(<ThemeToggle />);
    const boton = screen.getByRole('button');

    expect(boton).toHaveAccessibleName(/tema claro/i);
    await userEvent.click(boton);
    expect(screen.getByRole('button')).toHaveAccessibleName(/tema oscuro/i);
  });
});
