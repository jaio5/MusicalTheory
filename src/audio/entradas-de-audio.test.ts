import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  conocerEntradas,
  listAudioInputDevices,
  pistaDe,
  vigilarEntradas,
} from './entradas-de-audio';

describe('las entradas de audio', () => {
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

  // En el servidor no hay `navigator`: el afinador se pinta allí también.
  it('sin navegador, ninguna', async () => {
    vi.stubGlobal('navigator', undefined);

    expect(await listAudioInputDevices()).toEqual([]);
  });
});

describe('lo que se sabe de las entradas', () => {
  const aparato = (deviceId: string, label: string) =>
    ({ deviceId, label, kind: 'audioinput' }) as MediaDeviceInfo;

  /**
   * Chromium añade `default` y, en Windows, `communications`, que repiten otra
   * entrada de la lista: la interfaz ya tiene su «El del sistema».
   */
  it('sin los alias del sistema, y con el nombre del que usa por defecto', () => {
    expect(
      conocerEntradas([
        aparato('default', 'Por defecto - Portátil'),
        aparato('communications', 'Comunicaciones - Portátil'),
        aparato('portatil', 'Portátil'),
      ]),
    ).toEqual({
      entradas: [{ id: 'portatil', nombre: 'Portátil' }],
      delSistema: 'Por defecto - Portátil',
      conNombres: true,
    });
  });

  // Sin permiso, una sola entrada sin nombre ni identificador.
  it('sin permiso no hay nombres, ni nada que elegir', () => {
    expect(conocerEntradas([aparato('', '')])).toEqual({
      entradas: [],
      delSistema: null,
      conNombres: false,
    });
    expect(conocerEntradas([aparato('default', '')]).delSistema).toBeNull();
  });
});

describe('vigilar si se enchufa algo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('se apunta a devicechange y se desapunta', () => {
    const poner = vi.fn();
    const quitar = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: { addEventListener: poner, removeEventListener: quitar },
    });
    const oyente = () => {};

    const dejar = vigilarEntradas(oyente);
    dejar();

    expect(poner).toHaveBeenCalledWith('devicechange', oyente);
    expect(quitar).toHaveBeenCalledWith('devicechange', oyente);
  });

  it('sin navegador no vigila nada', () => {
    vi.stubGlobal('navigator', undefined);
    expect(() => vigilarEntradas(() => {})()).not.toThrow();
    vi.stubGlobal('navigator', {});
    expect(() => vigilarEntradas(() => {})()).not.toThrow();
  });
});

describe('de qué aparato sale una entrada', () => {
  const pista = (deviceId: string | undefined, readyState: string) => ({
    stream: {
      getAudioTracks: () => [{ getSettings: () => ({ deviceId }), readyState }],
    },
  });

  it('lo dice su pista, y si sigue viva', () => {
    expect(pistaDe(pista('tarjeta', 'live'))).toEqual({ dispositivo: 'tarjeta', viva: true });
    expect(pistaDe(pista(undefined, 'ended'))).toEqual({ dispositivo: null, viva: false });
  });

  it('sin flujo o sin pista no lo sabe', () => {
    expect(pistaDe({})).toBeNull();
    expect(pistaDe({ stream: null })).toBeNull();
    expect(pistaDe({ stream: { getAudioTracks: () => [] } })).toBeNull();
  });
});
