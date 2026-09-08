// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { PitchEngine } from '@audio/pitch-engine';
import { keyName, pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { EmpezarPorTonalidad } from './EmpezarPorTonalidad';

/**
 * Por dónde se empieza en componer.
 *
 * Era una frase gris flotando en mitad de setecientos píxeles de negro: «Elige
 * una tonalidad en la rueda y empezamos». Decía qué hacer y no ofrecía dónde, y
 * la rueda de al lado tampoco parecía elegible. Lo que se prueba aquí son las
 * **tres salidas** que ahora sí se ofrecen, porque las tres estaban escritas en
 * el texto y ninguna tenía botón.
 */

class EntradaFalsa implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;

  async start(): Promise<void> {
    this.state = 'running';
  }
  async stop(): Promise<void> {
    this.state = 'idle';
  }
  readTimeDomain(): boolean {
    return true;
  }
  readSpectrum(): boolean {
    return true;
  }
  subscribe(): () => void {
    return () => {};
  }
}

class MotorCallado implements PitchEngine {
  readonly options = {} as PitchEngine['options'];
  running = false;
  async start(): Promise<void> {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  subscribe(): () => void {
    return () => {};
  }
  subscribeLevel(): () => void {
    return () => {};
  }
}

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
});

describe('empezar por la tonalidad', () => {
  /**
   * Cuatro y no doce: la rueda entera está al lado. Son las que salen sin
   * alteraciones o con una sola, que en guitarra es donde caen los acordes al
   * aire, y existen para quien todavía no sabe cuál elegir.
   */
  it('trae cuatro tonalidades de salida, a un toque', async () => {
    render(<EmpezarPorTonalidad />);

    await userEvent.click(
      screen.getByRole('button', { name: keyName(pitchClassFromName('A'), 'minor') }),
    );

    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('A'),
      mode: 'minor',
    });
  });

  /**
   * El texto decía «o toca unos compases y la detectamos sola» y no había forma
   * de abrir el micro desde aquí: el botón estaba arriba en la barra, sin nada
   * que lo relacionara con esa frase. Es la promesa de la portada contada en el
   * sitio donde pasa y sin manera de aceptarla.
   */
  it('y ofrece abrir el micro, que es la salida que solo estaba mencionada', async () => {
    const entrada = new EntradaFalsa();
    render(
      <EmpezarPorTonalidad
        deps={{ createInput: () => entrada, createEngine: () => new MotorCallado() }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /abrir el micrófono/i }));

    await waitFor(() => expect(entrada.state).toBe('running'));
  });

  it('escuchando ya, no lo vuelve a ofrecer: entonces lo que toca es tocar', () => {
    useSessionStore.getState().actions.setListening('listening');

    render(<EmpezarPorTonalidad />);

    expect(screen.queryByRole('button', { name: /abrir el micrófono/i })).not.toBeInTheDocument();
  });
});
