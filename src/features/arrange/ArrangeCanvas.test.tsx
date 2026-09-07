// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_ARRANGEMENT, pitchClassFromName } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { ArrangeCanvas } from './ArrangeCanvas';

const C = pitchClassFromName('C');

beforeEach(() => {
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
  useSessionStore.getState().actions.reset();
});

function conTonalidad() {
  useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
}

/** Los cifrados de una parte, en el orden en que están. */
function acordesDe(parte: string): string[] {
  return within(screen.getByRole('list', { name: `Acordes de ${parte}` }))
    .getAllByRole('button')
    .map((boton) => boton.getAttribute('aria-label')?.split(',')[0] ?? '');
}

describe('sin tonalidad', () => {
  it('no enseña el lienzo, dice qué falta', () => {
    render(<ArrangeCanvas />);
    expect(screen.getByText(/Elige una tonalidad/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escuchar la canción/ })).not.toBeInTheDocument();
  });
});

describe('montar', () => {
  it('el primer acorde crea la primera parte', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.getByText(/empieza la primera parte/)).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('complementary')).getAllByRole('button')[0]!);

    expect(acordesDe('Estrofa')).toEqual(['C']);
  });

  // Es lo que hace que se pueda encadenar sin elegir parte antes de cada acorde.
  it('los acordes siguientes van a la misma parte', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    for (let i = 0; i < 3; i += 1) {
      await userEvent.click(within(screen.getByRole('complementary')).getAllByRole('button')[0]!);
    }
    expect(acordesDe('Estrofa')).toHaveLength(3);
  });

  // Se crea una parte para meter cosas en ella. Sin esto, los acordes seguían
  // cayendo en la anterior y la nueva se quedaba vacía.
  it('una parte nueva se lleva los acordes que se pulsen después', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.click(within(screen.getByRole('complementary')).getAllByRole('button')[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Parte nueva' }));
    await userEvent.click(within(screen.getByRole('complementary')).getAllByRole('button')[0]!);

    expect(acordesDe('Estrofa')).toHaveLength(1);
    expect(acordesDe('Parte 2')).toHaveLength(1);
  });

  it('lo que se propone sale del último acorde puesto', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.getByRole('heading', { name: /Para empezar/ })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('complementary')).getAllByRole('button')[0]!);
    expect(screen.getByRole('heading', { name: /Después de Estrofa/ })).toBeInTheDocument();
  });
});

describe('el teclado, que es lo que un arrastre no da', () => {
  async function conDosAcordes() {
    conTonalidad();
    render(<ArrangeCanvas />);
    const panel = screen.getByRole('complementary');
    await userEvent.click(within(panel).getAllByRole('button')[0]!);
    await userEvent.click(within(panel).getAllByRole('button')[1]!);
  }

  it('las flechas mueven el bloque de sitio', async () => {
    await conDosAcordes();
    const antes = acordesDe('Estrofa');

    const primero = within(screen.getByRole('list', { name: 'Acordes de Estrofa' })).getAllByRole(
      'button',
    )[0]!;
    primero.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(acordesDe('Estrofa')).toEqual([antes[1], antes[0]]);
  });

  it('con Shift, las flechas estiran', async () => {
    await conDosAcordes();
    const primero = within(screen.getByRole('list', { name: 'Acordes de Estrofa' })).getAllByRole(
      'button',
    )[0]!;
    primero.focus();
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');

    expect(
      within(screen.getByRole('list', { name: 'Acordes de Estrofa' }))
        .getAllByRole('button')[0]!
        .getAttribute('aria-label'),
    ).toMatch(/5 pulsos/);
  });

  it('Supr quita el bloque', async () => {
    await conDosAcordes();
    const primero = within(screen.getByRole('list', { name: 'Acordes de Estrofa' })).getAllByRole(
      'button',
    )[0]!;
    primero.focus();
    await userEvent.keyboard('{Delete}');

    expect(acordesDe('Estrofa')).toHaveLength(1);
  });
});

describe('deshacer', () => {
  it('empieza apagado y se enciende al hacer algo', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    await userEvent.click(within(screen.getByRole('complementary')).getAllByRole('button')[0]!);
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
  });

  it('quita el último acorde puesto', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    const panel = screen.getByRole('complementary');
    await userEvent.click(within(panel).getAllByRole('button')[0]!);
    await userEvent.click(within(panel).getAllByRole('button')[0]!);

    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(acordesDe('Estrofa')).toHaveLength(1);
  });
});

describe('lo grabado', () => {
  it('no se ofrece si no se ha grabado nada', () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    expect(screen.queryByRole('button', { name: 'Traer lo grabado' })).not.toBeInTheDocument();
  });

  /**
   * El puente que faltaba: el motor ya medía cuánto duraba cada acorde y eso solo
   * servía para pedirle salidas a la IA. Aquí cae como una parte más, y **con sus
   * duraciones**, que es lo que `capturedDegrees` tiraba para poder guardar.
   */
  it('entra como una parte, con los compases que ocupaba de verdad', async () => {
    conTonalidad();
    const acciones = useSessionStore.getState().actions;
    acciones.setTempo(120, 4);
    acciones.startCapture(0);
    // Do dos compases y Sol uno, a 120 bpm: 500 ms el pulso.
    acciones.replaceCapture([
      { root: C, notes: [0, 4, 7], at: 0 },
      { root: 7, notes: [7, 11, 2], at: 4000 },
    ]);
    acciones.stopCapture(6000);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));

    const bloques = within(
      screen.getByRole('list', { name: 'Acordes de Lo que has tocado' }),
    ).getAllByRole('button');

    expect(bloques[0]).toHaveAttribute('aria-label', expect.stringContaining('8 pulsos'));
    expect(bloques[1]).toHaveAttribute('aria-label', expect.stringContaining('4 pulsos'));
  });
});
