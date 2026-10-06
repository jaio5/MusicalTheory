// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ReferenceTone } from '@audio/reference-tone';
import { midiToFrequency, pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { HOLD_MS } from './exercise';
import { LearnPanel } from './LearnPanel';

class FakeTone implements ReferenceTone {
  played: number[] = [];
  async play(frequency: number): Promise<void> {
    this.played.push(frequency);
  }
  stop(): void {}
  async dispose(): Promise<void> {}
}

/**
 * Simula que suena una nota afinada en ese instante, dejando que React procese
 * la lectura antes de la siguiente. En la aplicación real llegan cada 50 ms;
 * encadenarlas sin esperar haría que se saltase estados intermedios que sí
 * ocurren de verdad.
 */
async function play(midi: number, at: number) {
  await act(async () => {
    useSessionStore.getState().actions.setPitch(midiToFrequency(midi), 0.99, at);
  });
}

describe('Panel de aprender', () => {
  let tone: FakeTone;

  beforeEach(() => {
    tone = new FakeTone();
    // El ejercicio se contesta tocando, así que el panel enciende el micro al
    // empezar y dice que está cerrado mientras no lo esté. Estos tests meten las
    // notas en el store a mano, sin aparato ninguno, así que se da por abierto.
    useSessionStore.setState({ listening: 'listening' });
  });

  function renderPanel() {
    render(<LearnPanel createTone={() => tone} />);
  }

  it('pide una tonalidad antes de poder practicar', () => {
    renderPanel();
    expect(screen.getByText(/elige una tonalidad o toca unas notas sueltas/i)).toBeInTheDocument();
  });

  it('propone la escala de la tonalidad activa', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();

    expect(
      await screen.findByText(/pentatónica menor de A, subiendo y bajando/i),
    ).toBeInTheDocument();
    // Cinco notas más la octava subiendo, cinco bajando.
    expect(screen.getAllByRole('listitem')).toHaveLength(11);
  });

  /**
   * Con la letra de su grado, como la lección de al lado: con los doce nombres,
   * Fa# mayor decía F donde la escala tiene E#, y la letra F salía dos veces.
   */
  it('escribe las notas con la letra de su grado: E# en Fa# mayor', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('F#'), mode: 'major' });
    render(<LearnPanel createTone={() => tone} scaleId="major" />);

    expect(await screen.findByText(/mayor de F#, subiendo y bajando/i)).toBeInTheDocument();
    const notas = screen.getAllByRole('listitem').map((nota) => nota.textContent);
    expect(notas.slice(0, 8)).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#', 'F#']);
    expect(notas).not.toContain('F');

    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));
    expect(await screen.findByText(/toca F#/i)).toBeInTheDocument();
    // Las seis primeras, sostenidas, y la que pide entonces es la séptima.
    let at = 0;
    for (const midi of [42, 44, 46, 47, 49, 51]) {
      await play(midi, at);
      await play(midi, at + HOLD_MS + 100);
      at += HOLD_MS * 2;
    }
    expect(await screen.findByText(/toca E#/i)).toBeInTheDocument();
  });

  it('en Sol# menor armónica, la sensible es F##', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('G#'), mode: 'minor' });
    render(<LearnPanel createTone={() => tone} scaleId="harmonicMinor" />);

    expect(await screen.findByText(/menor armónica de G#/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[6]).toHaveTextContent(/^F##$/);
  });

  it('deja oír la nota que toca', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /oír la nota/i }));

    expect(tone.played).toHaveLength(1);
    expect(tone.played[0]).toBeCloseTo(midiToFrequency(45), 1);
  });

  it('avanza cuando la nota se sostiene y no antes', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    expect(await screen.findByText(/toca A/i)).toBeInTheDocument();

    // Rozarla no basta.
    await play(45, 0);
    await play(45, HOLD_MS - 100);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    // Sostenerla sí.
    await play(45, HOLD_MS + 100);
    expect(await screen.findByText(/toca C/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('no avanza con la nota equivocada', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    await play(47, 0);
    await play(47, HOLD_MS * 3);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('avisa al terminar la escala', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    // La pentatónica menor de A: A, C, D, E, G, A, y de vuelta.
    const sequence = [45, 48, 50, 52, 55, 57, 55, 52, 50, 48, 45];
    let clock = 0;
    for (const midi of sequence) {
      await play(midi, clock);
      clock += HOLD_MS + 50;
      await play(midi, clock);
      clock += 50;
    }

    expect(await screen.findByText(/escala completa/i)).toBeInTheDocument();
  });

  /**
   * Y con el micro cerrado se dice, en vez de pedir una nota que nadie oye.
   *
   * Es lo que pasaba: se pulsaba «Empezar», salía «Toca C» y no ocurría nada
   * nunca, con el micro tachado en la cabecera y sin una palabra que lo
   * relacionara. Toda una familia de unidades —las de tocar— no se podía
   * terminar sin saber que primero había que abrir el micro por tu cuenta.
   */
  it('con el micro cerrado lo dice y ofrece abrirlo', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useSessionStore.setState({ listening: 'idle' });
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    // Empezar lo pide, y aquí no hay micro que dar: se queda cerrado.
    expect(await screen.findByText(/el micrófono está cerrado/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Toca /)).not.toBeInTheDocument();
    const cerrado = useSessionStore.getState().listening;
    const cambios: string[] = [];
    const dejar = useSessionStore.subscribe((state) => cambios.push(state.listening));

    // Y desde ahí se vuelve a pedir: es el sitio donde se descubre que hacía falta.
    await userEvent.click(screen.getByRole('button', { name: 'Abrirlo' }));
    dejar();

    expect(cerrado).not.toBe('requesting');
    expect(cambios).toContain('requesting');
  });

  /**
   * Mientras el navegador pregunta por el permiso, el micro no está cerrado: se
   * está abriendo. Decía «está cerrado. Abrirlo.» justo después de pulsar
   * «Empezar», y ofrecía pedir otra vez lo que ya se estaba pidiendo.
   */
  it('mientras se abre el micro, dice que se está abriendo y no ofrece abrirlo', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    act(() => useSessionStore.setState({ listening: 'requesting' }));

    expect(screen.getByText('Abriendo el micrófono…')).toBeInTheDocument();
    expect(screen.queryByText(/el micrófono está cerrado/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrirlo' })).not.toBeInTheDocument();
  });

  /**
   * Y mientras se sostiene la nota se dice: sostenerla es justo lo que cuenta,
   * y sin decirlo parece que no la está cogiendo.
   */
  it('mientras se sostiene la nota, lo dice', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    await play(48, 0);

    expect(await screen.findByText(/sostenla/)).toBeInTheDocument();
  });

  it('empieza de nuevo al cambiar de escala', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }));

    await play(45, 0);
    await play(45, HOLD_MS + 100);
    expect(await screen.findByText(/toca C/i)).toBeInTheDocument();

    await act(async () => {
      actions.setScale('blues');
    });

    expect(await screen.findByText(/pulsa «empezar»/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
