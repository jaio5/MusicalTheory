// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserMicInput } from './browser-mic-input';

/**
 * Pedir el micrófono para grabar, que no es lo mismo que pedirlo para escuchar.
 *
 * Lo que se prueba aquí no es el sonido: es **lo que se le dice a quien acaba de
 * denegar el permiso**. Un «no se ha podido abrir el micrófono» donde había que
 * decir «lo has denegado tú, se vuelve a dar desde el icono de la barra de
 * direcciones» deja a alguien pulsando un botón que nunca va a funcionar.
 *
 * Y una cosa más, que es de la guitarra y no del navegador: **las mejoras de
 * llamada van apagadas**. La supresión de ruido y el control automático de
 * volumen están pensados para una voz, y con una guitarra delante se comen los
 * armónicos y bajan el volumen en cuanto una nota se sostiene.
 */

const getUserMedia = vi.fn();
const paradas: string[] = [];

function flujo(): MediaStream {
  return {
    getTracks: () => [{ stop: () => paradas.push('parada') }],
  } as unknown as MediaStream;
}

/** Un error como los que lanza `getUserMedia`, que se distinguen por el nombre. */
function fallo(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

beforeEach(() => {
  paradas.length = 0;
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue(flujo());
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('abrir el microfono para grabar', () => {
  it('empieza parado: el permiso se pide al decidir grabar', () => {
    const micro = new BrowserMicInput();

    expect(micro.state).toBe('idle');
    expect(micro.stream).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('al abrirlo queda en marcha y con su flujo', async () => {
    const micro = new BrowserMicInput();

    await micro.start();

    expect(micro.state).toBe('running');
    expect(micro.stream).not.toBeNull();
    expect(micro.errorMessage).toBeNull();
  });

  it('no pide video: esto graba sonido y nada mas', async () => {
    await new BrowserMicInput().start();

    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
  });

  it('apaga las mejoras de llamada, que con una guitarra estorban', async () => {
    await new BrowserMicInput().start();

    const audio = getUserMedia.mock.calls[0]?.[0]?.audio as Record<string, unknown>;
    expect(audio).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
  });

  it('a quien lo deniega le dice como volver a darlo', async () => {
    getUserMedia.mockRejectedValue(fallo('NotAllowedError'));
    const micro = new BrowserMicInput();

    await micro.start();

    expect(micro.state).toBe('denied');
    expect(micro.errorMessage).toMatch(/barra de direcciones/i);
  });

  it('si lo tiene cogido otra aplicacion lo dice, y no culpa al permiso', async () => {
    getUserMedia.mockRejectedValue(fallo('NotReadableError'));
    const micro = new BrowserMicInput();

    await micro.start();

    expect(micro.state).toBe('error');
    expect(micro.errorMessage).toMatch(/otra aplicación/i);
  });

  it('sin mediaDevices lo dice en vez de reventar', async () => {
    vi.stubGlobal('navigator', {});
    const micro = new BrowserMicInput();

    await micro.start();

    expect(micro.state).toBe('unsupported');
    expect(micro.errorMessage).toMatch(/no puede usar el micrófono/i);
  });

  it('al pararlo suelta las pistas: el piloto del navegador se apaga', async () => {
    const micro = new BrowserMicInput();

    await micro.start();
    await micro.stop();

    expect(paradas).toHaveLength(1);
    expect(micro.stream).toBeNull();
    expect(micro.state).toBe('idle');
  });

  it('avisa de cada cambio de estado a quien se haya suscrito', async () => {
    const micro = new BrowserMicInput();
    const vistos: string[] = [];
    micro.subscribe((estado) => vistos.push(estado));

    await micro.start();
    await micro.stop();

    expect(vistos).toEqual(['requesting', 'running', 'idle']);
  });
});
