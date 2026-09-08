// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MicInput, MicState } from '@media/mic-input';
import type { Recording, RecorderState, SessionRecorder } from '@media/session-recorder';

import { Grabadora } from './Grabadora';

/**
 * Grabar lo que tocas.
 *
 * Lo que se prueba es **el final**, que es lo que cambió de raíz. Antes se
 * paraba y salía un botón para descargar un vídeo que no habías visto; ahora
 * sale el reproductor, así que lo primero que puedes hacer es escucharte, y
 * descargar y tirar vienen después. Ese es el orden en que se decide si una toma
 * vale, y por eso es lo que hay que defender.
 *
 * Lo demás es lo de siempre y no menos importante: que un micrófono denegado se
 * explique en vez de dejar el botón muerto, y que irse de la pantalla apague el
 * piloto del navegador.
 */

class MicroFalso implements MicInput {
  state: MicState = 'idle';
  stream: MediaStream | null = null;
  errorMessage: string | null = null;
  paradas = 0;

  constructor(private readonly falla: MicState | null = null) {}

  async start(): Promise<void> {
    if (this.falla !== null) {
      this.state = this.falla;
      this.errorMessage = 'Has denegado el micrófono.';
      return;
    }
    this.state = 'running';
    this.stream = {} as MediaStream;
  }
  async stop(): Promise<void> {
    this.paradas += 1;
    this.state = 'idle';
    this.stream = null;
  }
  subscribe(): () => void {
    return () => {};
  }
}

class GrabadorFalso implements SessionRecorder {
  state: RecorderState = 'idle';
  errorMessage: string | null = null;

  constructor(private readonly arranca = true) {}

  async start(): Promise<void> {
    if (!this.arranca) {
      this.errorMessage = 'Este navegador no puede grabar sonido.';
      this.state = 'unsupported';
      return;
    }
    this.state = 'recording';
  }
  pause(): void {}
  resume(): void {}
  async stop(): Promise<Recording> {
    this.state = 'idle';
    return {
      blob: new Blob(['sonido'], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      durationMs: 9_000,
      filename: 'caos-ordenado-2026-09-08-1905.webm',
    };
  }
  subscribe(): () => void {
    return () => {};
  }
}

const creadas: string[] = [];
const sueltas: string[] = [];

beforeEach(() => {
  creadas.length = 0;
  sueltas.length = 0;
  let contador = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => {
      const url = `blob:toma-${(contador += 1)}`;
      creadas.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => sueltas.push(url),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function grabarYParar(micro = new MicroFalso(), grabador = new GrabadorFalso()) {
  const vista = render(<Grabadora createMic={() => micro} createRecorder={() => grabador} />);

  await userEvent.click(screen.getByRole('button', { name: /grabar lo que tocas/i }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /parar la grabación/i })).toBeInTheDocument(),
  );
  await userEvent.click(screen.getByRole('button', { name: /parar la grabación/i }));

  return vista;
}

describe('la grabadora', () => {
  it('apagada ofrece grabar, y dice que el sonido no sale de aqui', () => {
    render(
      <Grabadora createMic={() => new MicroFalso()} createRecorder={() => new GrabadorFalso()} />,
    );

    expect(screen.getByRole('button', { name: /grabar lo que tocas/i })).toBeInTheDocument();
    expect(screen.getByText(/no sale de tu equipo/i)).toBeInTheDocument();
  });

  it('mientras graba, el boton pasa a parar', async () => {
    render(
      <Grabadora createMic={() => new MicroFalso()} createRecorder={() => new GrabadorFalso()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabar lo que tocas/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /parar la grabación/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  /**
   * Lo primero que sale al parar es **el reproductor**, no el botón de
   * descargar: hasta oírla no se sabe si la toma vale, y bajar un fichero para
   * abrirlo en otro programa es el camino largo para averiguarlo.
   */
  it('al parar sale el reproductor antes que nada', async () => {
    await grabarYParar();

    expect(await screen.findByLabelText('Lo que acabas de tocar')).toBeInTheDocument();
  });

  it('y con el, descargarla o tirarla', async () => {
    await grabarYParar();

    expect(await screen.findByRole('button', { name: /descargar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descartar la toma/i })).toBeInTheDocument();
  });

  it('tirar la toma suelta su memoria: un blob retenido no vuelve', async () => {
    await grabarYParar();

    await userEvent.click(await screen.findByRole('button', { name: /descartar la toma/i }));

    expect(sueltas).toEqual(creadas);
    expect(screen.queryByLabelText('Lo que acabas de tocar')).not.toBeInTheDocument();
  });

  it('al parar cierra el microfono: el piloto del navegador se apaga', async () => {
    const micro = new MicroFalso();

    await grabarYParar(micro);

    expect(micro.paradas).toBeGreaterThan(0);
  });

  it('un microfono denegado se explica, y no deja el boton muerto', async () => {
    render(
      <Grabadora
        createMic={() => new MicroFalso('denied')}
        createRecorder={() => new GrabadorFalso()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabar lo que tocas/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/denegado el micrófono/i);
    expect(screen.getByRole('button', { name: /grabar lo que tocas/i })).toBeInTheDocument();
  });

  it('un navegador que no sabe grabar lo dice y suelta el microfono', async () => {
    const micro = new MicroFalso();
    render(<Grabadora createMic={() => micro} createRecorder={() => new GrabadorFalso(false)} />);

    await userEvent.click(screen.getByRole('button', { name: /grabar lo que tocas/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no puede grabar sonido/i);
    expect(micro.paradas).toBe(1);
  });

  it('irse de la pantalla grabando no deja el microfono abierto', async () => {
    const micro = new MicroFalso();
    const { unmount } = render(
      <Grabadora createMic={() => micro} createRecorder={() => new GrabadorFalso()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabar lo que tocas/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /parar la grabación/i })).toBeInTheDocument(),
    );
    unmount();

    expect(micro.paradas).toBe(1);
  });
});
