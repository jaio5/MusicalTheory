// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { PitchEngine } from '@audio/pitch-engine';
import { useSessionStore } from '@state/session-store';

import { HeardChord } from './HeardChord';

/** Un micrófono que se abre y se cierra sin tocar el navegador. */
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

function escuchando(): void {
  useSessionStore.getState().actions.setListening('listening');
}

/** Deja de reconocer acorde, como cuando sueltas las cuerdas. */
function silencio(): void {
  useSessionStore.getState().actions.setHeardChord(null);
}

/** Sin alternativas y con margen amplio: acordes que se oyeron sin dudar. */
const SIN_DUDA = { margin: 0.2, alternatives: [] };
const AM = {
  symbol: 'Am',
  root: 9 as const,
  notes: [9, 0, 4] as const,
  score: 0.93,
  at: 0,
  ...SIN_DUDA,
};
const F = {
  symbol: 'F',
  root: 5 as const,
  notes: [5, 9, 0] as const,
  score: 0.88,
  at: 1,
  ...SIN_DUDA,
};

describe('El acorde que suena', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  /**
   * Con el micro cerrado, **lo ofrece**.
   *
   * Esta zona se quedaba en blanco, y con ella se quedaba callada la cosa que
   * esta aplicación dice de sí misma en la portada: que te oye tocar. Estaba a un
   * botón de distancia —el de la barra de arriba— y nada lo decía aquí, que es
   * donde pasa.
   */
  it('con el micro cerrado ofrece abrirlo, en vez de quedarse en blanco', () => {
    render(<HeardChord />);

    expect(screen.getByRole('button', { name: /abrir el micrófono/i })).toBeInTheDocument();
  });

  it('y al pulsarlo, escucha', async () => {
    const entrada = new EntradaFalsa();
    render(
      <HeardChord deps={{ createInput: () => entrada, createEngine: () => new MotorCallado() }} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /abrir el micrófono/i }));

    await waitFor(() => expect(entrada.state).toBe('running'));
  });

  it('pide un acorde entero mientras no reconoce ninguno', () => {
    escuchando();
    render(<HeardChord />);

    expect(screen.getByText(/toca un acorde entero/i)).toBeInTheDocument();
  });

  it('enseña el acorde con sus notas y cómo se hace', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    render(<HeardChord />);

    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByText('A · C · E')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /formas de hacer am/i })).toBeInTheDocument();
  });

  /**
   * No entra solo, y **entra en la canción** cuando hay dónde escribirla: tocar
   * un acorde y quedárselo es componer, no explorar
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
   */
  it('no lo mete solo, y con sitio donde escribir va a la cancion', () => {
    // Con tonalidad: un acorde solo tiene grado dentro de una, y sin grado no
    // hay bloque que escribir.
    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    const puestos: Array<[string, string | undefined]> = [];
    render(<HeardChord onPoner={(degree, seventh) => puestos.push([degree, seventh])} />);

    expect(puestos).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: /meterlo en la canción/i }));

    // La menor en La menor es el grado i, y sin séptima.
    expect(puestos).toEqual([['i', undefined]]);
    expect(useSessionStore.getState().path).toEqual([]);
  });

  // Sin sitio donde escribir hace lo de siempre: al camino, a probarlo.
  it('sin donde escribir, sigue yendo al camino', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    render(<HeardChord />);

    fireEvent.click(screen.getByRole('button', { name: /^Probarlo$/ }));

    expect(useSessionStore.getState().path.at(-1)?.symbol).toBe('Am');
  });

  it('no ofrece meter otra vez el acorde en el que ya estás', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    render(<HeardChord />);
    fireEvent.click(screen.getByRole('button', { name: /^Probarlo$/ }));

    expect(screen.queryByRole('button', { name: /^Probarlo$/ })).not.toBeInTheDocument();
  });
});

/**
 * Lo que suena se apaga al soltar las cuerdas, y antes se llevaba por delante
 * lo que acababas de tocar. Con las dos manos en la guitarra no da tiempo a
 * llegar al botón, así que el último se queda.
 */
describe('El último acorde tocado se mantiene', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  it('sigue en pantalla cuando dejas de tocarlo', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    silencio();
    render(<HeardChord />);

    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /formas de hacer am/i })).toBeInTheDocument();
  });

  it('todavía se puede meter en el camino después de soltarlo', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    silencio();
    render(<HeardChord />);

    fireEvent.click(screen.getByRole('button', { name: /^Probarlo$/ }));

    expect(useSessionStore.getState().path.at(-1)?.symbol).toBe('Am');
  });

  it('el rótulo distingue lo que suena de lo que sonó', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    const sonando = render(<HeardChord />);
    expect(screen.getByText('Suena')).toBeInTheDocument();
    sonando.unmount();

    silencio();
    render(<HeardChord />);
    expect(screen.getByText('Último')).toBeInTheDocument();
  });

  it('se queda con el último, no con el primero', () => {
    escuchando();
    const { actions } = useSessionStore.getState();
    actions.setHeardChord(AM);
    actions.setHeardChord(F);
    silencio();
    render(<HeardChord />);

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.queryByText('Am')).not.toBeInTheDocument();
  });

  it('aguanta aunque se deje de escuchar del todo', () => {
    escuchando();
    useSessionStore.getState().actions.setHeardChord(AM);
    silencio();
    useSessionStore.getState().actions.setListening('idle');
    render(<HeardChord />);

    expect(screen.getByText('Am')).toBeInTheDocument();
  });
});
