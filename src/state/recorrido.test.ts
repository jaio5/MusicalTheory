// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLAVE_RECORRIDO,
  SIN_EMPEZAR,
  estadoDelRecorrido,
  estadoDelRecorridoEnServidor,
  guardarPasoDelRecorrido,
  leerRecorrido,
  marcarRecorridoVisto,
  suscribirseAlRecorrido,
  useRecorrido,
  volverAVerElRecorrido,
} from './recorrido';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lo guardado', () => {
  it('sin nada guardado es la primera visita, sin empezar', () => {
    expect(leerRecorrido(null)).toEqual(SIN_EMPEZAR);
  });

  it('«visto» es visto', () => {
    expect(leerRecorrido('visto')).toEqual({ visto: true });
  });

  it('un recorrido a medias se lee entero, con lo que puso para enseñarse', () => {
    const guardado = JSON.stringify({
      paso: 'componer-tocar',
      origen: '/componer',
      puso: { tonalidad: true, espacio: 'escribir' },
    });

    expect(leerRecorrido(guardado)).toEqual({
      visto: false,
      paso: 'componer-tocar',
      origen: '/componer',
      puso: { tonalidad: true, espacio: 'escribir' },
    });
  });

  /**
   * Lo que no se entiende cuenta como visto: un recorrido que sale en cada carga
   * porque otra versión guardó otra cosa es peor que uno que no sale.
   */
  it('lo que no se entiende se da por visto', () => {
    expect(leerRecorrido('{roto')).toEqual({ visto: true });
    expect(leerRecorrido('[1, 2]')).toEqual({ visto: true });
    expect(leerRecorrido('7')).toEqual({ visto: true });
    expect(leerRecorrido('null')).toEqual({ visto: true });
  });

  it('campo a campo: lo que no vale se cae y lo demás se queda', () => {
    const guardado = JSON.stringify({
      paso: 'x'.repeat(500),
      origen: 3,
      puso: { tonalidad: 'sí', espacio: 'bailar' },
    });

    expect(leerRecorrido(guardado)).toEqual({
      visto: false,
      paso: null,
      origen: null,
      puso: { tonalidad: false, espacio: null },
    });
    expect(leerRecorrido(JSON.stringify({ paso: '' }))).toEqual(SIN_EMPEZAR);
  });
});

describe('el estado en el navegador', () => {
  it('es el mismo objeto mientras no cambie lo guardado', () => {
    guardarPasoDelRecorrido({ paso: 'profesor', origen: '/afinar', puso: SIN_EMPEZAR.puso });

    const primero = estadoDelRecorrido();
    expect(estadoDelRecorrido()).toBe(primero);
    expect(primero).toMatchObject({ visto: false, paso: 'profesor', origen: '/afinar' });
  });

  it('avisa al guardar el paso, al darlo por visto y al pedir verlo otra vez', () => {
    const oyente = vi.fn();
    const dejar = suscribirseAlRecorrido(oyente);

    guardarPasoDelRecorrido({ paso: 'profesor', origen: null, puso: SIN_EMPEZAR.puso });
    marcarRecorridoVisto();
    expect(localStorage.getItem(CLAVE_RECORRIDO)).toBe('visto');
    expect(estadoDelRecorrido()).toEqual({ visto: true });

    volverAVerElRecorrido();
    expect(estadoDelRecorrido()).toEqual(SIN_EMPEZAR);

    expect(oyente).toHaveBeenCalledTimes(3);
    dejar();
    marcarRecorridoVisto();
    expect(oyente).toHaveBeenCalledTimes(3);
  });

  it('en el servidor se da por visto: el HTML sale igual para todos', () => {
    expect(estadoDelRecorridoEnServidor()).toEqual({ visto: true });
  });

  it('el gancho sigue a lo guardado', () => {
    const { result } = renderHook(() => useRecorrido());
    expect(result.current).toEqual(SIN_EMPEZAR);

    act(() => marcarRecorridoVisto());
    expect(result.current).toEqual({ visto: true });
  });
});

/**
 * Sin almacenamiento —un modo privado estricto— no se puede recordar que ya se
 * vio, y sacarlo en cada carga castigaría a quien protege su intimidad.
 */
describe('sin almacenamiento', () => {
  it('se da por visto, y el botón de volver a verlo sigue sirviendo en esta carga', async () => {
    vi.resetModules();
    const modulo = await import('./recorrido');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(modulo.estadoDelRecorrido()).toEqual({ visto: true });

    modulo.volverAVerElRecorrido();
    expect(modulo.estadoDelRecorrido()).toEqual(modulo.SIN_EMPEZAR);
  });
});
