// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listAudioInputDevices, WebAudioInput } from './web-audio-input';

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

  sampleRate = 48_000;

  /** Lo que devuelve el navegador al decodificar lo grabado. */
  decodeAudioData = vi.fn(async () => ({
    sampleRate: 48_000,
    getChannelData: () => new Float32Array(64).fill(0.25),
  }));

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

/** Un `MediaRecorder` de mentira: el de verdad no existe en jsdom. */
class GrabadoraFalsa {
  static ultima: GrabadoraFalsa | null = null;
  static construible = true;
  state: 'inactive' | 'recording' = 'inactive';
  readonly oyentes = new Map<string, ((e: unknown) => void)[]>();

  constructor() {
    if (!GrabadoraFalsa.construible) {
      throw new Error('no se puede grabar de aquí');
    }
    GrabadoraFalsa.ultima = this;
  }

  addEventListener(tipo: string, oyente: (e: unknown) => void) {
    this.oyentes.set(tipo, [...(this.oyentes.get(tipo) ?? []), oyente]);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    for (const oyente of this.oyentes.get('stop') ?? []) {
      oyente({});
    }
  }

  /** Un trozo de audio, como los que va soltando la de verdad. */
  soltar(bytes: number) {
    for (const oyente of this.oyentes.get('dataavailable') ?? []) {
      oyente({ data: new Blob([new Uint8Array(bytes)]) });
    }
  }
}

describe('cuando no se puede escuchar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('un navegador sin micro lo dice, y dice con cual si', async () => {
    vi.stubGlobal('navigator', {});
    const input = new WebAudioInput();

    await input.start();

    expect(input.state).toBe('unsupported');
    expect(input.error?.message).toMatch(/Chrome, Edge o Firefox/);
  });

  it('cada motivo tiene su frase, porque cada uno se arregla distinto', async () => {
    // Un permiso denegado se resuelve en la barra de direcciones; una tarjeta
    // que no está, conectándola; una ocupada, cerrando el otro programa. Un
    // mensaje único obligaría a probarlas todas.
    const casos = [
      ['NotAllowedError', 'denied', /barra de direcciones/],
      ['SecurityError', 'denied', /barra de direcciones/],
      ['NotFoundError', 'error', /entrada de audio/],
      ['OverconstrainedError', 'error', /entrada de audio/],
      ['NotReadableError', 'error', /Otra aplicación/],
      ['CualquierOtro', 'error', /permisos del navegador/],
    ] as const;

    for (const [nombre, estado, frase] of casos) {
      const error = new Error(nombre);
      error.name = nombre;
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => Promise.reject(error)) },
      });

      const input = new WebAudioInput();
      await input.start();

      expect(input.state, nombre).toBe(estado);
      expect(input.error?.message, nombre).toMatch(frase);
    }
  });

  it('algo que no es un Error tampoco revienta', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => Promise.reject('vaya')) },
    });
    const input = new WebAudioInput();

    await input.start();

    expect(input.state).toBe('error');
  });

  it('si el contexto de audio no se puede crear, se dice y se suelta el micro', async () => {
    vi.stubGlobal('AudioContext', function AudioContextRoto() {
      throw new Error('sin dispositivo de salida');
    });
    const input = new WebAudioInput();

    await input.start();

    expect(input.state).toBe('error');
    expect(input.error?.message).toMatch(/entrada de audio/);
  });

  it('arrancar dos veces no pide permiso dos veces', async () => {
    const input = await escuchando();
    const pedidas = (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock.calls
      .length;

    await input.start();

    expect(
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(pedidas);
  });
});

describe('guardar el sonido para volver a mirarlo', () => {
  beforeEach(() => {
    GrabadoraFalsa.ultima = null;
    GrabadoraFalsa.construible = true;
    vi.stubGlobal('MediaRecorder', GrabadoraFalsa);
  });

  it('sin escuchar no se puede grabar', () => {
    expect(new WebAudioInput().startRecording()).toBe(false);
  });

  it('sin MediaRecorder tampoco, y se dice con un falso en vez de reventar', async () => {
    const input = await escuchando();
    vi.stubGlobal('MediaRecorder', undefined);

    expect(input.startRecording()).toBe(false);
  });

  it('si el navegador se niega a construirla, tampoco', async () => {
    const input = await escuchando();
    GrabadoraFalsa.construible = false;

    expect(input.startRecording()).toBe(false);
  });

  it('lo grabado vuelve decodificado en un solo canal', async () => {
    // El micro de una guitarra es mono, y si viniera estéreo los dos canales
    // dicen lo mismo para lo que hace falta aquí.
    const input = await escuchando();
    input.startRecording();
    GrabadoraFalsa.ultima!.soltar(128);

    const grabado = await input.stopRecording();

    expect(grabado?.sampleRate).toBe(48_000);
    expect(grabado?.samples).toHaveLength(64);
  });

  it('parar sin haber grabado no devuelve nada', async () => {
    const input = await escuchando();

    expect(await input.stopRecording()).toBeNull();
  });

  it('una grabacion sin un solo trozo tampoco', async () => {
    const input = await escuchando();
    input.startRecording();

    expect(await input.stopRecording()).toBeNull();
  });

  it('los trozos vacios no cuentan', async () => {
    const input = await escuchando();
    input.startRecording();
    for (const oyente of GrabadoraFalsa.ultima!.oyentes.get('dataavailable') ?? []) {
      oyente({ data: new Blob([]) });
    }

    expect(await input.stopRecording()).toBeNull();
  });

  it('si el navegador no sabe decodificar lo suyo, se pierde la mejora y no mas', async () => {
    // Los acordes que el motor oyó en vivo siguen ahí: por eso esto no enseña
    // ningún error.
    const input = await escuchando();
    contexto.decodeAudioData = vi.fn(async () => Promise.reject(new Error('formato raro')));
    input.startRecording();
    GrabadoraFalsa.ultima!.soltar(128);

    expect(await input.stopRecording()).toBeNull();
  });

  it('el tope corta esta grabacion y solo esta', async () => {
    // Estuvo leyendo la grabadora del momento de disparar y no la suya: grabar
    // diez segundos, parar, y volver a grabar dejaba un reloj vivo que a los
    // tres minutos del primero cortaba la segunda por la mitad, sin motivo
    // visible.
    vi.useFakeTimers();
    try {
      const input = await escuchando();
      input.startRecording();
      const primera = GrabadoraFalsa.ultima!;
      await vi.advanceTimersByTimeAsync(10_000);
      await input.stopRecording();

      input.startRecording();
      const segunda = GrabadoraFalsa.ultima!;
      // Justo pasado el tope de la primera, y aún dentro del de la segunda.
      await vi.advanceTimersByTimeAsync(171_000);

      expect(primera.state).toBe('inactive');
      expect(segunda.state).toBe('recording');
    } finally {
      vi.useRealTimers();
    }
  });

  it('grabar dos veces seguidas corta la primera', async () => {
    const input = await escuchando();
    input.startRecording();
    const primera = GrabadoraFalsa.ultima!;

    input.startRecording();

    expect(primera.state).toBe('inactive');
    expect(GrabadoraFalsa.ultima).not.toBe(primera);
  });

  it('parar la escucha corta la grabacion', async () => {
    const input = await escuchando();
    input.startRecording();
    const grabadora = GrabadoraFalsa.ultima!;

    await input.stop();

    expect(grabadora.state).toBe('inactive');
    expect(await input.stopRecording()).toBeNull();
  });
});

describe('las entradas que hay', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('solo las de audio', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => [
          { kind: 'audioinput', deviceId: 'mic' },
          { kind: 'videoinput', deviceId: 'cam' },
        ]),
      },
    });

    expect((await listAudioInputDevices()).map((d) => d.deviceId)).toEqual(['mic']);
  });

  it('sin navegador que las sepa listar, ninguna', async () => {
    vi.stubGlobal('navigator', {});

    expect(await listAudioInputDevices()).toEqual([]);
  });
});

describe('lo que se puede preguntar sin haber arrancado', () => {
  it('la frecuencia de muestreo la decide el navegador, y hasta arrancar no se sabe', async () => {
    const input = new WebAudioInput();

    expect(input.sampleRate).toBe(0);

    await input.start();

    expect(input.sampleRate).toBe(48_000);
  });

  it('leer sin haber arrancado no devuelve ceros: devuelve falso', async () => {
    // Ceros llegarían al motor como silencio, y silencio es indistinguible de no
    // estar tocando.
    const input = new WebAudioInput();

    expect(input.readTimeDomain(new Float32Array(input.frameSize))).toBe(false);
    expect(input.readSpectrum(new Float32Array(input.spectrumSize))).toBe(false);
  });

  it('el espectro se lee con su propia ventana, mas larga que la del tono', async () => {
    // El tono quiere responder rápido y el acorde quiere ver fino, y no hay una
    // ventana que haga las dos cosas.
    const input = await escuchando();
    const espectro = new Float32Array(input.spectrumSize);

    expect(input.spectrumSize).toBeGreaterThan(input.frameSize);
    expect(input.readSpectrum(espectro)).toBe(true);
    expect(espectro[0]).toBe(-30);
  });

  it('quien deja de escuchar los cambios deja de recibirlos', async () => {
    const estados: string[] = [];
    const input = new WebAudioInput();
    const dejar = input.subscribe((estado) => estados.push(estado));

    await input.start();
    dejar();
    await input.stop();

    expect(estados).toEqual(['requesting', 'running']);
  });

  it('el contexto ya despierto no se reanuda por gusto', async () => {
    // Reanudar uno que ya corre es una llamada de más en cada arranque.
    const input = await escuchando();
    const antes = contexto.resume.mock.calls.length;

    await input.stop();

    expect(contexto.resume.mock.calls.length).toBe(antes);
  });

  it('el contexto dormido al arrancar se despierta', async () => {
    // Chrome puede entregarlo suspendido aunque la llamada venga de un gesto.
    contexto.state = 'suspended';
    const input = new WebAudioInput();

    await input.start();

    expect(contexto.resume).toHaveBeenCalled();
    expect(input.state).toBe('running');
  });
});
