// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebAudioInput } from './web-audio-input';

/**
 * El contexto de audio, fingido lo justo.
 *
 * Estos tests existen por un fallo que solo apareció tocando: el sistema
 * suspende el contexto por su cuenta —al bloquear la pantalla, al cambiar de
 * dispositivo de sonido, al entrar en reposo— y `getFloatTimeDomainData` sigue
 * contestando, pero escribe ceros. La pantalla decía «escuchando» y no oía nada,
 * y había que parar y arrancar.
 */
class ContextoFalso extends EventTarget {
  state: 'running' | 'suspended' | 'closed' = 'running';
  resume = vi.fn(async () => {
    this.state = 'running';
    this.dispatchEvent(new Event('statechange'));
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });

  createAnalyser() {
    return {
      fftSize: 0,
      smoothingTimeConstant: 0,
      getFloatTimeDomainData: (target: Float32Array) => target.fill(0.5),
      getFloatFrequencyData: (target: Float32Array) => target.fill(-30),
    } as unknown as AnalyserNode;
  }

  createMediaStreamSource() {
    return { connect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
  }

  /** Lo que hace el sistema cuando le apetece, sin avisar a nadie. */
  dormir() {
    this.state = 'suspended';
    this.dispatchEvent(new Event('statechange'));
  }
}

let contexto: ContextoFalso;

beforeEach(() => {
  contexto = new ContextoFalso();
  // `function` y no una flecha: `new AudioContext()` necesita un constructor, y
  // una flecha no lo es.
  vi.stubGlobal('AudioContext', function AudioContextFalso() {
    return contexto;
  });
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
    },
  });
});

async function escuchando(): Promise<WebAudioInput> {
  const input = new WebAudioInput();
  await input.start();
  return input;
}

describe('mientras se escucha', () => {
  it('arranca y lee', async () => {
    const input = await escuchando();
    const buffer = new Float32Array(input.frameSize);

    expect(input.state).toBe('running');
    expect(input.readTimeDomain(buffer)).toBe(true);
    expect(buffer[0]).toBe(0.5);
  });

  it('despierta el contexto si el sistema lo duerme', async () => {
    const input = await escuchando();

    contexto.dormir();
    await vi.waitFor(() => expect(contexto.resume).toHaveBeenCalled());

    expect(contexto.state).toBe('running');
    expect(input.state).toBe('running');
  });

  it('dormido, leer devuelve falso en vez de ceros', async () => {
    // Un contexto suspendido **no falla**: escribe ceros y devuelve como si
    // nada. Eso llega al motor como silencio, y silencio es indistinguible de
    // no estar tocando. `false` dice que no hay dato, que no es lo mismo.
    const input = await escuchando();
    const buffer = new Float32Array(input.frameSize);

    contexto.state = 'suspended';

    expect(input.readTimeDomain(buffer)).toBe(false);
    expect(input.readSpectrum(new Float32Array(64))).toBe(false);
  });

  it('si no se puede despertar, se dice en vez de fingir que se oye', async () => {
    const input = await escuchando();
    contexto.resume = vi.fn(async () => {
      throw new Error('no se puede');
    });

    contexto.dormir();

    await vi.waitFor(() => expect(input.state).toBe('error'));
    expect(input.error?.message).toMatch(/dormido/i);
  });

  it('al parar, deja de vigilar', async () => {
    const input = await escuchando();
    await input.stop();

    const antes = contexto.resume.mock.calls.length;
    contexto.dormir();
    await new Promise((listo) => setTimeout(listo, 10));

    // Parado, un contexto dormido es lo correcto: despertarlo sería encender el
    // micro de alguien que lo apagó.
    expect(contexto.resume.mock.calls.length).toBe(antes);
  });

  it('parada y arranque siguen funcionando, que es lo que hacía la gente', async () => {
    const input = await escuchando();
    await input.stop();
    expect(input.state).toBe('idle');

    contexto = new ContextoFalso();
    await input.start();

    expect(input.state).toBe('running');
    expect(input.readTimeDomain(new Float32Array(input.frameSize))).toBe(true);
  });
});
