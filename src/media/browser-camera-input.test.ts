// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserCameraInput } from './browser-camera-input';

/**
 * Pedir la cámara, que es lo único que pide vídeo en todo el proyecto.
 *
 * Lo que se prueba aquí no es el vídeo: es **lo que se le dice a quien acaba de
 * denegar el permiso**. Un «no se ha podido abrir la cámara» donde había que
 * decir «lo has denegado tú, se vuelve a dar desde el icono de la barra de
 * direcciones» deja a alguien pulsando un botón que nunca va a funcionar.
 */

const getUserMedia = vi.fn();
const enumerateDevices = vi.fn();
const paradas: string[] = [];

/** Un flujo de vídeo como el que devuelve el navegador. */
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
  enumerateDevices.mockReset();
  enumerateDevices.mockResolvedValue([]);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('abrir la camara', () => {
  it('empieza parada: se puede tocar sin camara', () => {
    // El permiso se pide solo cuando alguien decide grabarse, y la aplicación
    // entera funciona sin tocar esto.
    const camara = new BrowserCameraInput();

    expect(camara.state).toBe('idle');
    expect(camara.stream).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('al abrirla queda en marcha y con su flujo', async () => {
    const camara = new BrowserCameraInput();

    await camara.start();

    expect(camara.state).toBe('running');
    expect(camara.stream).not.toBeNull();
    expect(camara.errorMessage).toBeNull();
  });

  it('avisa de cada cambio de estado, y se puede dejar de escuchar', async () => {
    const estados: string[] = [];
    const camara = new BrowserCameraInput();
    const dejar = camara.subscribe((e) => estados.push(e));

    await camara.start();
    dejar();
    await camara.stop();

    expect(estados).toEqual(['requesting', 'running']);
  });

  it('pide la resolucion que se le diga, y una por defecto si no', async () => {
    const camara = new BrowserCameraInput();

    await camara.start({ width: 640, height: 480, frameRate: 15, deviceId: 'cam-2' });

    expect(getUserMedia.mock.calls[0]![0]).toEqual({
      video: {
        deviceId: { exact: 'cam-2' },
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15 },
      },
      audio: false,
    });
  });

  it('no pide audio: el sonido lo lleva otra capa', async () => {
    await new BrowserCameraInput().start();

    expect((getUserMedia.mock.calls[0]![0] as { audio: boolean }).audio).toBe(false);
  });

  it('abrirla dos veces no pide permiso dos veces', async () => {
    const camara = new BrowserCameraInput();

    await camara.start();
    await camara.start();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe('cuando no se puede', () => {
  it('un navegador sin camara lo dice, y dice con cual si', async () => {
    vi.stubGlobal('navigator', {});
    const camara = new BrowserCameraInput();

    await camara.start();

    expect(camara.state).toBe('unsupported');
    expect(camara.errorMessage).toMatch(/Chrome, Edge o Firefox/);
  });

  it('denegar el permiso se distingue de que la camara falle', async () => {
    // Son dos frases distintas porque son dos arreglos distintos: una se
    // resuelve en la barra de direcciones y la otra cerrando otro programa.
    const denegada = new BrowserCameraInput();
    getUserMedia.mockRejectedValue(fallo('NotAllowedError'));
    await denegada.start();

    const rota = new BrowserCameraInput();
    getUserMedia.mockRejectedValue(fallo('NotReadableError'));
    await rota.start();

    expect(denegada.state).toBe('denied');
    expect(denegada.errorMessage).toMatch(/barra de direcciones/);
    expect(rota.state).toBe('error');
    expect(rota.errorMessage).toMatch(/otra aplicación/);
  });

  it('un contexto sin https cuenta como denegado', async () => {
    // `SecurityError` es lo que sale al abrir la aplicación por http desde otro
    // equipo de la red, y el arreglo se parece más a un permiso que a una avería.
    getUserMedia.mockRejectedValue(fallo('SecurityError'));
    const camara = new BrowserCameraInput();

    await camara.start();

    expect(camara.state).toBe('denied');
  });

  it('algo que no es un Error tampoco revienta', async () => {
    getUserMedia.mockRejectedValue('vaya');
    const camara = new BrowserCameraInput();

    await camara.start();

    expect(camara.state).toBe('error');
  });
});

describe('cerrar la camara', () => {
  it('apaga las pistas, que es lo que apaga la luz del portatil', async () => {
    // Sin esto la luz sigue encendida después de parar de grabar, y eso asusta.
    const camara = new BrowserCameraInput();
    await camara.start();

    await camara.stop();

    expect(paradas).toHaveLength(1);
    expect(camara.stream).toBeNull();
    expect(camara.state).toBe('idle');
  });

  it('cerrar una que fallo no la deja como parada normal', async () => {
    // El mensaje de error tiene que seguir en pantalla.
    getUserMedia.mockRejectedValue(fallo('NotReadableError'));
    const camara = new BrowserCameraInput();
    await camara.start();

    await camara.stop();

    expect(camara.state).toBe('error');
  });

  it('cerrar sin haber abierto no falla', async () => {
    await expect(new BrowserCameraInput().stop()).resolves.toBeUndefined();
  });
});

describe('listar camaras', () => {
  it('solo las de video', async () => {
    enumerateDevices.mockResolvedValue([
      { kind: 'videoinput', deviceId: 'cam' },
      { kind: 'audioinput', deviceId: 'mic' },
    ]);

    const dispositivos = await new BrowserCameraInput().listDevices();

    expect(dispositivos.map((d) => d.deviceId)).toEqual(['cam']);
  });

  it('sin navegador que las sepa listar, ninguna', async () => {
    vi.stubGlobal('navigator', {});

    expect(await new BrowserCameraInput().listDevices()).toEqual([]);
  });
});
