// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alCambiarElPermiso,
  contar,
  cuentaVueltas,
  permitirContarVueltas,
  pideQueNoLeSigan,
} from './metricas';

/**
 * Lo que sale del navegador para contar, y lo que se queda en él.
 *
 * Lo que se promete en la política de privacidad, comprobado: sin decir que sí no
 * se guarda nada en el aparato; con DNT o GPC no se manda nada; decir que no
 * borra lo que había.
 */

const enviado = vi.fn<(url: string, cuerpo: Blob) => boolean>(() => true);

async function cuerpoDe(llamada: number): Promise<Record<string, unknown>> {
  return JSON.parse(await enviado.mock.calls[llamada]![1].text()) as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
  enviado.mockClear();
  Object.defineProperty(navigator, 'sendBeacon', { value: enviado, configurable: true });
  Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
  Object.defineProperty(navigator, 'globalPrivacyControl', {
    value: undefined,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sin haber dicho que sí', () => {
  it('se manda el evento y nada con qué reconocerte', async () => {
    contar('visita', '/afinar');

    expect(enviado.mock.calls[0]![0]).toBe('/api/metricas');
    expect(await cuerpoDe(0)).toEqual({ evento: 'visita', ruta: '/afinar' });
    expect(localStorage.length).toBe(0);
    expect(cuentaVueltas()).toBe(false);
  });

  it('lo que no es una visita va sin ruta', async () => {
    contar('toma-grabada');
    expect(await cuerpoDe(0)).toEqual({ evento: 'toma-grabada' });
  });
});

describe('diciendo que sí', () => {
  it('se guarda un identificador aleatorio y viaja con cada evento', async () => {
    permitirContarVueltas(true);
    contar('unidad-terminada');

    const { visitante } = await cuerpoDe(0);
    expect(visitante).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(cuentaVueltas()).toBe(true);
  });

  it('decirlo dos veces no cambia el identificador', () => {
    permitirContarVueltas(true);
    const primero = localStorage.getItem('caos-ordenado:contar-vueltas');
    permitirContarVueltas(true);
    expect(localStorage.getItem('caos-ordenado:contar-vueltas')).toBe(primero);
  });

  it('decir que no lo borra del aparato, y avisa a quien pinta el interruptor', () => {
    const oyente = vi.fn();
    const soltar = alCambiarElPermiso(oyente);
    permitirContarVueltas(true);
    permitirContarVueltas(false);
    soltar();

    expect(localStorage.length).toBe(0);
    expect(oyente).toHaveBeenLastCalledWith(false);
    expect(oyente).toHaveBeenCalledTimes(2);
  });
});

describe('lo que pide el navegador', () => {
  it('con Do Not Track no sale nada', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    expect(pideQueNoLeSigan()).toBe(true);
    contar('visita', '/');
    expect(enviado).not.toHaveBeenCalled();
  });

  it('con Global Privacy Control tampoco', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    contar('visita', '/');
    expect(enviado).not.toHaveBeenCalled();
  });
});

describe('cuando el navegador no ayuda', () => {
  it('sin sendBeacon no se cuenta, y no se intenta otra cosa', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    const pedido = vi.fn();
    vi.stubGlobal('fetch', pedido);

    contar('visita', '/');

    expect(pedido).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('si mandar revienta, la pantalla no se entera', () => {
    enviado.mockImplementation(() => {
      throw new Error('cuota');
    });
    expect(() => contar('visita', '/')).not.toThrow();
  });

  it('sin almacenamiento, ni sí ni no rompen nada', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(cuentaVueltas()).toBe(false);
    expect(() => permitirContarVueltas(false)).not.toThrow();
  });
});

describe('fuera del navegador', () => {
  it('no hace nada y no pregunta por lo que no existe', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('localStorage', undefined);
    expect(pideQueNoLeSigan()).toBe(false);
    expect(cuentaVueltas()).toBe(false);
    expect(() => contar('visita', '/')).not.toThrow();
    vi.unstubAllGlobals();
  });
});
