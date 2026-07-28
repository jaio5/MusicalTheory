// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { ChordSearch } from './ChordSearch';

const C = pitchClassFromName('C');

function inKeyOfC() {
  useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
}

describe('Buscar un acorde', () => {
  it('dice que un acorde de la tonalidad entra', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('searchbox'), 'Am');

    expect(await screen.findByText('Entra')).toBeInTheDocument();
    expect(screen.getByText(/todas sus notas están en la tonalidad/i)).toBeInTheDocument();
  });

  it('dice que un prestado cabe como color y por qué', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('searchbox'), 'Bb');

    expect(await screen.findByText('Cabe como color')).toBeInTheDocument();
    expect(screen.getByText(/bVII/)).toBeInTheDocument();
  });

  it('avisa cuando se va fuera', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('searchbox'), 'C#m7');

    expect(await screen.findByText('Se va fuera')).toBeInTheDocument();
  });

  it('no se inventa nada con lo que no reconoce', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('searchbox'), 'Hmaj');

    expect(await screen.findByText(/no conozco ese acorde/i)).toBeInTheDocument();
  });

  it('lo añade al camino al pulsarlo', async () => {
    inKeyOfC();
    const onPick = vi.fn();
    render(<ChordSearch onPick={onPick} />);

    await userEvent.type(screen.getByRole('searchbox'), 'F#m7');
    await userEvent.click(await screen.findByRole('button', { name: /F#m7/ }));

    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick.mock.calls[0]![0]).toMatchObject({ symbol: 'F#m7' });
  });

  it('pide tonalidad antes de juzgar nada', async () => {
    render(<ChordSearch onPick={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'Am');

    expect(
      await screen.findByText(/elige una tonalidad y te digo si Am pega/i),
    ).toBeInTheDocument();
  });
});
