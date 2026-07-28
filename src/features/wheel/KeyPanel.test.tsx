// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { midiToFrequency, pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { KeyPanel } from './KeyPanel';

/** Toca una melodía clara de La menor, con instantes separados. */
function playAMinor() {
  const { actions } = useSessionStore.getState();
  [45, 48, 52, 45, 55, 52, 50, 48, 45, 52, 45, 57].forEach((midi, index) => {
    actions.setPitch(midiToFrequency(midi), 0.99, index * 300);
  });
}

describe('Panel de tonalidad', () => {
  it('dice que hay que tocar algo antes de detectar nada', () => {
    render(<KeyPanel />);
    expect(screen.getByText(/toca unos compases y la detectamos sola/i)).toBeInTheDocument();
  });

  it('describe la rueda para quien no la ve', () => {
    render(<KeyPanel />);
    expect(
      screen.getByRole('img', { name: /rueda de quintas.*todavía no hay tonalidad/i }),
    ).toBeInTheDocument();
  });

  it('detecta La menor al tocarla y lo dice', async () => {
    playAMinor();
    render(<KeyPanel />);

    expect(await screen.findByText(/detectada: La menor/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /rueda de quintas con La menor arriba/i }),
    ).toBeInTheDocument();
  });

  it('enseña las tres candidatas con su puntuación', async () => {
    playAMinor();
    render(<KeyPanel />);

    const candidates = await screen.findByText(/lo que mejor encaja/i);
    expect(candidates).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('deja fijar una tonalidad a mano', async () => {
    playAMinor();
    render(<KeyPanel />);

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /tonalidad/i }),
      `${pitchClassFromName('E')}:major`,
    );

    expect(await screen.findByText(/fijada a mano: Mi mayor/i)).toBeInTheDocument();
    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('E'),
      mode: 'major',
    });
  });

  it('la tonalidad fijada manda sobre la detectada', async () => {
    playAMinor();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('E'), mode: 'major' });

    render(<KeyPanel />);

    expect(await screen.findByText(/fijada a mano: Mi mayor/i)).toBeInTheDocument();
  });

  it('permite volver a la detección', async () => {
    playAMinor();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('E'), mode: 'major' });

    render(<KeyPanel />);
    await userEvent.click(screen.getByRole('button', { name: /volver a la detección/i }));

    expect(await screen.findByText(/detectada: La menor/i)).toBeInTheDocument();
    expect(useSessionStore.getState().pinnedKey).toBeNull();
  });
});

describe('pulsar en la rueda', () => {
  it('cada tonalidad de la rueda es un botón de verdad', () => {
    render(<KeyPanel />);

    // Doce mayores y doce menores.
    const wheelKeys = screen
      .getAllByRole('button')
      .filter((button) => /mayor|menor/.test(button.getAttribute('title') ?? ''));
    expect(wheelKeys).toHaveLength(24);
  });

  it('fija la tonalidad al pulsarla', async () => {
    render(<KeyPanel />);

    await userEvent.click(screen.getByTitle('Mi menor'));

    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('E'),
      mode: 'minor',
    });
    expect(await screen.findByText(/fijada a mano: Mi menor/i)).toBeInTheDocument();
  });

  it('se puede usar con el teclado, sin ratón', async () => {
    render(<KeyPanel />);

    const key = screen.getByTitle('Sol mayor');
    key.focus();
    expect(key).toHaveFocus();

    await userEvent.keyboard('{Enter}');

    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('G'),
      mode: 'major',
    });
  });

  it('marca cuál está activa para quien no ve la rueda', async () => {
    render(<KeyPanel />);
    await userEvent.click(screen.getByTitle('Fa mayor'));

    expect(screen.getByTitle('Fa mayor')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('Sol mayor')).toHaveAttribute('aria-pressed', 'false');
  });

  it('escribe cada tonalidad como toca: Sib, no La#', () => {
    render(<KeyPanel />);
    expect(screen.getByTitle('Sib mayor')).toBeInTheDocument();
    expect(screen.queryByTitle('La# mayor')).not.toBeInTheDocument();
  });
});

describe('los anillos se dan la vuelta', () => {
  it('con una mayor, las mayores van por fuera', async () => {
    render(<KeyPanel />);
    await userEvent.click(screen.getByTitle('Sol mayor'));

    expect(
      await screen.findByRole('img', { name: /las mayores en el anillo de fuera/i }),
    ).toBeInTheDocument();
  });

  it('con una menor, las menores pasan a fuera', async () => {
    render(<KeyPanel />);
    await userEvent.click(screen.getByTitle('Mi menor'));

    expect(
      await screen.findByRole('img', { name: /las menores en el anillo de fuera/i }),
    ).toBeInTheDocument();
  });

  it('las posiciones no cambian: la relativa sigue en el mismo sitio', async () => {
    render(<KeyPanel />);

    // Do mayor y La menor comparten armadura, así que comparten posición: al
    // pasar de una a otra la rueda no gira.
    await userEvent.click(screen.getByTitle('Do mayor'));
    const doMayor = screen.getByTitle('Do mayor').closest('foreignObject');
    const laMenor = screen.getByTitle('La menor').closest('foreignObject');

    expect(doMayor?.getAttribute('transform')).toBe(laMenor?.getAttribute('transform'));
  });
});
