// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_ARRANGEMENT, writtenBlock, type Arrangement } from '@core/music';

import { guardarElLienzo, RETRASO_DEL_GUARDADO, useArrangementStore } from './arrangement-store';
import { MemoriaDelLienzo, type AlmacenDelLienzo } from './session-storage';

/**
 * Que la canción sobreviva a recargar la página.
 *
 * Sin plan no hay canciones en la cuenta, y el lienzo vivía solo en memoria: un
 * F5 y se perdía entero. Medido en el navegador: C G Am F escritos, recargar, y
 * el lienzo vacío. Aquí se prueba el enchufe entre el almacén y lo guardado; la
 * mitad que habla con IndexedDB está en `indexed-db-session-storage.test.ts`.
 */

const acciones = () => useArrangementStore.getState().actions;

const AYER: Arrangement = {
  parts: [
    {
      id: 'estrofa',
      name: 'Estrofa',
      blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'V', 4)],
      notes: [],
      bars: 4,
    },
  ],
};

/** Un almacén en memoria que cuenta cuántas veces se escribe. */
function lienzoQueCuenta(guardado: Arrangement | null = null) {
  const memoria = new MemoriaDelLienzo();
  const listo = guardado === null ? Promise.resolve() : memoria.guardar(guardado);
  const guardar = vi.fn((arrangement: Arrangement) => memoria.guardar(arrangement));
  const lienzo: AlmacenDelLienzo = {
    guardar,
    leer: async () => {
      await listo;
      return memoria.leer();
    },
  };
  return { lienzo, guardar, memoria };
}

/** Deja correr las promesas pendientes: la lectura y las escrituras en fila. */
async function soltar(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

let dejar: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
});

afterEach(() => {
  dejar?.();
  dejar = null;
  acciones().endGesture();
  vi.useRealTimers();
});

describe('al abrir', () => {
  it('lo que había la última vez vuelve al lienzo, sin deshacer detrás', async () => {
    const { lienzo } = lienzoQueCuenta(AYER);

    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();

    expect(useArrangementStore.getState().arrangement).toEqual(AYER);
    // Recuperar lo de ayer no es un cambio que se deshaga: es como estaba.
    expect(useArrangementStore.getState().past).toEqual([]);
  });

  /**
   * La lectura es asíncrona. Si para cuando llega alguien ya ha escrito, lo suyo
   * manda: pisarlo con lo de la última vez sería borrar lo que acaba de hacer.
   */
  it('si alguien escribió mientras se leía, lo suyo se queda y se guarda', async () => {
    const { lienzo, memoria } = lienzoQueCuenta(AYER);

    dejar = guardarElLienzo(useArrangementStore, lienzo);
    const parte = acciones().addPart('Ahora');
    acciones().addBlock(parte, 'IV', 4);
    await soltar();

    expect(useArrangementStore.getState().arrangement.parts[0]?.name).toBe('Ahora');

    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    await soltar();
    expect((await memoria.leer())?.parts[0]?.name).toBe('Ahora');
  });

  it('sin nada guardado, el lienzo se queda vacío', async () => {
    const { lienzo, guardar } = lienzoQueCuenta();

    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);

    expect(useArrangementStore.getState().arrangement).toBe(EMPTY_ARRANGEMENT);
    expect(guardar).not.toHaveBeenCalled();
  });

  // Un lienzo guardado vacío es lo mismo que nada: no hay por qué reemplazar.
  it('un lienzo guardado vacío no reemplaza nada', async () => {
    const { lienzo } = lienzoQueCuenta({ parts: [] });

    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();

    expect(useArrangementStore.getState().arrangement).toBe(EMPTY_ARRANGEMENT);
  });

  /**
   * **Primero se lee y después se guarda.** Un cambio que llega antes de leer no
   * escribe: escribiría el lienzo a medias encima de lo guardado antes de
   * haberlo leído.
   */
  it('antes de leer no se escribe nada', async () => {
    let soltarLectura!: (valor: Arrangement | null) => void;
    const guardar = vi.fn(async () => {});
    const lienzo: AlmacenDelLienzo = {
      guardar,
      leer: () =>
        new Promise((resolver) => {
          soltarLectura = resolver;
        }),
    };

    dejar = guardarElLienzo(useArrangementStore, lienzo);
    acciones().addPart();
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO * 3);
    expect(guardar).not.toHaveBeenCalled();

    soltarLectura(null);
    await soltar();
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    await soltar();
    expect(guardar).toHaveBeenCalledTimes(1);
  });
});

describe('al escribir', () => {
  it('una ráfaga de cambios es una sola escritura, al cabo de un momento', async () => {
    const { lienzo, guardar, memoria } = lienzoQueCuenta();
    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();

    const parte = acciones().addPart();
    for (const grado of ['I', 'V', 'vi', 'IV'] as const) {
      acciones().addBlock(parte, grado, 4);
    }
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO - 1);
    expect(guardar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await soltar();
    expect(guardar).toHaveBeenCalledTimes(1);
    expect((await memoria.leer())?.parts[0]?.blocks.map((b) => b.degree)).toEqual([
      'I',
      'V',
      'vi',
      'IV',
    ]);
  });

  /**
   * A mitad de un arrastre no se escribe: el montaje cambia en cada hueco por el
   * que pasa el bloque, y serían decenas de escrituras para quedarse con la
   * última. Se escribe al soltar.
   */
  it('a mitad de un arrastre no se guarda, y al soltar sí', async () => {
    const { lienzo, guardar } = lienzoQueCuenta();
    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();
    const parte = acciones().addPart();
    const nota = acciones().addNote(parte, 0, 0, 1);
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    await soltar();
    guardar.mockClear();

    acciones().beginGesture();
    for (let i = 1; i <= 6; i += 1) {
      acciones().moveNote(nota, i, i);
      vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    }
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO * 4);
    expect(guardar).not.toHaveBeenCalled();

    acciones().endGesture();
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    await soltar();
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  // Recargar justo después de escribir no puede perder el último acorde: al
  // irse de la página se escribe lo pendiente sin esperar.
  it('al irse de la página se guarda lo pendiente', async () => {
    const { lienzo, guardar } = lienzoQueCuenta();
    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();

    acciones().addPart();
    window.dispatchEvent(new Event('pagehide'));
    await soltar();

    expect(guardar).toHaveBeenCalledTimes(1);
    // Y no vuelve a escribir al cumplirse la espera, que ya está hecho.
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    await soltar();
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('irse sin nada pendiente no escribe', async () => {
    const { lienzo, guardar } = lienzoQueCuenta();
    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();

    window.dispatchEvent(new Event('pagehide'));
    await soltar();

    expect(guardar).not.toHaveBeenCalled();
  });
});

describe('cuando el navegador no deja', () => {
  /**
   * Modo privado o cuota llena: se pierde el guardado y no la sesión. Ni leer ni
   * escribir pueden tumbar el lienzo que hay en memoria.
   */
  it('si no se puede leer ni escribir, se sigue componiendo', async () => {
    const guardar = vi.fn(() => Promise.reject(new Error('cuota')));
    const lienzo: AlmacenDelLienzo = {
      guardar,
      leer: () => Promise.reject(new Error('bloqueado')),
    };

    dejar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();
    acciones().addPart('Sigue');
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    await soltar();
    acciones().addPart('Y sigue');
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO);
    await soltar();

    expect(guardar).toHaveBeenCalledTimes(2);
    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(2);
  });
});

describe('al dejar de guardar', () => {
  it('ni lo pendiente ni lo de después se escribe', async () => {
    const { lienzo, guardar } = lienzoQueCuenta();
    const quitar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();

    acciones().addPart();
    quitar();
    acciones().addPart();
    window.dispatchEvent(new Event('pagehide'));
    vi.advanceTimersByTime(RETRASO_DEL_GUARDADO * 2);
    await soltar();

    expect(guardar).not.toHaveBeenCalled();
  });

  it('sin nada pendiente, quitarlo no hace nada más', async () => {
    const { lienzo, guardar } = lienzoQueCuenta();
    const quitar = guardarElLienzo(useArrangementStore, lienzo);
    await soltar();

    quitar();

    expect(guardar).not.toHaveBeenCalled();
  });
});
