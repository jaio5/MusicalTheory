// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@state/session-store';

import { LandingWheel } from './LandingWheel';

/**
 * La rueda de la portada, que es la de verdad.
 *
 * Lo que se prueba es justamente eso: **lo que elijas aquí ya está elegido al
 * entrar**. La tonalidad vive en la sesión y no en la pantalla, así que pulsar
 * una en la portada es empezar antes de entrar, y el enlace que aparece lleva a
 * componer en esa misma tonalidad.
 */

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('la rueda de la portada', () => {
  it('sin tonalidad, invita a pulsar una y no ofrece ir a ningun sitio', () => {
    render(<LandingWheel />);

    expect(screen.getByText('Pulsa una tonalidad')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('al elegir una, se queda elegida y ofrece componer en ella', async () => {
    render(<LandingWheel />);

    await userEvent.click(screen.getByRole('button', { name: /A mayor/ }));

    expect(useSessionStore.getState().pinnedKey).not.toBeNull();
    expect(screen.getByRole('link', { name: /Componer en A mayor/ })).toHaveAttribute(
      'href',
      '/componer',
    );
  });
});
