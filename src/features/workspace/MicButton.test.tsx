// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { PitchEngine } from '@audio/pitch-engine';
import { useSessionStore } from '@state/session-store';

import { MicButton } from './MicButton';

/**
 * El botón de escuchar.
 *
 * Redondo y grande, como el de grabar de la cámara del móvil: se entiende sin
 * leer nada. Y por eso mismo **el nombre accesible tiene que decirlo con
 * palabras**, que es lo único que oye quien no ve el círculo rojo. Es lo que se
 * prueba aquí, junto con lo otro que no se ve mirando el componente: que la nota
 * que suena vive dentro del propio botón, y no en un segundo sitio de la barra.
 */

class EntradaFalsa implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;
  readonly #oyentes = new Set<(estado: AudioInputState) => void>();

  async start(): Promise<void> {
    this.#pasar('running');
  }
  async stop(): Promise<void> {
    this.#pasar('idle');
  }
  readTimeDomain(): boolean {
    return true;
  }
  readSpectrum(): boolean {
    return true;
  }
  // Avisa de verdad: el botón traduce el estado del dispositivo al de la
  // interfaz, y sin aviso se quedaría siempre en «pidiendo permiso».
  subscribe(oyente: (estado: AudioInputState) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }

  #pasar(estado: AudioInputState): void {
    this.state = estado;
    for (const oyente of this.#oyentes) {
      oyente(estado);
    }
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

function pintar() {
  // La misma entrada en todas las llamadas: el micro es uno.
  const entrada = new EntradaFalsa();
  return render(<MicButton createInput={() => entrada} createEngine={() => new MotorCallado()} />);
}

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('el boton de escuchar', () => {
  it('parado, invita a escuchar y lo dice con palabras', () => {
    pintar();

    const boton = screen.getByRole('button');
    expect(boton).toHaveAccessibleName('Escuchar la guitarra');
    expect(boton).toHaveAttribute('aria-pressed', 'false');
  });

  it('al pulsarlo escucha, y el nombre cambia a lo contrario', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName('Dejar de escuchar la guitarra'),
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('y al volver a pulsarlo, para', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false'),
    );
  });

  /**
   * Apagado, esto es **un botón y nada más**.
   *
   * Estuvo al revés: un hueco fijo con un guion y el rótulo «sin escuchar»
   * debajo, en la esquina más cara de la pantalla y esté pasando algo o no. En la
   * cabecera de una aplicación que se usa con la guitarra puesta, media franja
   * izquierda reservada a decir que no pasa nada es sitio robado a lo que sí
   * pasa. Lo que se prueba es que ese hueco ya no existe.
   */
  it('apagado no reserva sitio para una lectura que no hay', () => {
    pintar();

    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('esperando')).not.toBeInTheDocument();
  });

  it('la nota que suena sale al lado del boton en cuanto se escucha', async () => {
    useSessionStore.setState({
      reading: { name: 'A', pitchClass: 9, octave: 2, cents: -7, frequency: 110, midi: 45 },
      hasSignal: true,
    });

    pintar();
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('A2')).toBeInTheDocument();
    expect(screen.getByText('-7¢')).toBeInTheDocument();
  });

  it('una desviacion hacia arriba lleva su signo', async () => {
    useSessionStore.setState({
      reading: { name: 'A', pitchClass: 9, octave: 2, cents: 12, frequency: 111, midi: 45 },
      hasSignal: true,
    });

    pintar();
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('+12¢')).toBeInTheDocument();
  });

  it('un problema con el micro se anuncia, no se traga', () => {
    // Va con `role="alert"`: quien esté mirando el mástil y no el botón tiene que
    // enterarse de que no se le está oyendo.
    useSessionStore.setState({ message: 'Has denegado el acceso al micrófono.' });

    pintar();

    expect(screen.getByRole('alert')).toHaveTextContent(/denegado/);
  });
});
