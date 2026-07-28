// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { ChordSearch } from './ChordSearch';

const C = pitchClassFromName('C');

function inKeyOfC() {
  useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
}

/** La fila de la lista que empieza por ese cifrado exacto. */
function option(symbol: string): HTMLElement {
  const rows = screen.getAllByRole('option');
  const found = rows.find(
    (row) => within(row).getByRole('button').textContent?.startsWith(symbol) === true,
  );
  if (found === undefined) {
    throw new Error(`No hay ninguna opción para ${symbol}`);
  }
  return found;
}

describe('Buscar un acorde', () => {
  it('con la fundamental ya propone acordes', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('combobox'), 'A');

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(option('Am')).toBeInTheDocument();
    expect(option('A7')).toBeInTheDocument();
  });

  it('dice cuál entra, cuál es color y cuál se va fuera', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('combobox'), 'A');

    // Am es el vi de C mayor; A7 es la dominante de Dm, prestada pero de uso
    // conocido; Amaj7 trae C# y G#, y eso no lo justifica nadie.
    expect(within(await screen.findByRole('listbox')).getAllByText('Entra').length).toBeGreaterThan(
      0,
    );
    expect(within(option('A7')).getByText('Color')).toBeInTheDocument();
    expect(within(option('Amaj7')).getByText('Fuera')).toBeInTheDocument();
  });

  it('afina la lista según se escribe', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('combobox'), 'Am7');

    const symbols = screen
      .getAllByRole('option')
      .map((row) => within(row).getByRole('button').textContent);
    expect(symbols[0]).toContain('Am7');
    expect(symbols.every((symbol) => symbol?.startsWith('Am7'))).toBe(true);
  });

  it('no se inventa nada con lo que no reconoce', async () => {
    inKeyOfC();
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('combobox'), 'Hmaj');

    expect(await screen.findByText(/no conozco ese acorde/i)).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('lo añade al camino al pulsarlo', async () => {
    inKeyOfC();
    const onPick = vi.fn();
    render(<ChordSearch onPick={onPick} />);

    await userEvent.type(screen.getByRole('combobox'), 'F#m7');
    await userEvent.click(within(option('F#m7')).getByRole('button'));

    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick.mock.calls[0]![0]).toMatchObject({ symbol: 'F#m7' });
  });

  it('se puede elegir con el teclado, sin ratón', async () => {
    inKeyOfC();
    const onPick = vi.fn();
    render(<ChordSearch onPick={onPick} />);

    await userEvent.type(screen.getByRole('combobox'), 'A');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onPick.mock.calls[0]![0]).toMatchObject({ symbol: 'Am' });
  });

  it('pide tonalidad antes de juzgar nada', async () => {
    render(<ChordSearch onPick={() => {}} />);

    await userEvent.type(screen.getByRole('combobox'), 'Am');

    expect(await screen.findByText(/elige una tonalidad y te digo si pegan/i)).toBeInTheDocument();
    expect(screen.queryByText('Entra')).not.toBeInTheDocument();
  });
});
