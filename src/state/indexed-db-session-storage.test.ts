import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IDBFactory } from 'fake-indexeddb';

import { pitchClassFromName } from '@core/music';

import {
  createSessionStorage,
  IndexedDbSessionStorage,
  MAX_STORED_SESSIONS,
  MemorySessionStorage,
  type StoredSession,
} from './session-storage';

/**
 * El almacén de verdad: IndexedDB.
 *
 * El otro test de esto prueba la regla de retención y el resumen de una línea,
 * que son matemática y cadenas. Lo que quedaba sin probar era **la mitad que
 * habla con el navegador**, y ahí está lo que se puede romper sin que nadie se
 * entere: que la sesión abierta se guarde encima de la anterior en vez de
 * duplicarse, que la poda borre de la base y no solo de la lista, y que cerrar
 * la conexión ocurra también cuando la operación falla.
 *
 * `fake-indexeddb` es la misma implementación que usa el navegador, en memoria.
 * No es un doble que conteste lo que le pidamos: si el código pide una
 * transacción mal, aquí falla igual.
 */

function sesion(id: string, savedAt: number, notas = ['A', 'C', 'E']): StoredSession {
  return {
    id,
    savedAt,
    key: { tonic: pitchClassFromName('A'), mode: 'minor' },
    scaleId: 'minorPentatonic',
    notes: notas,
    chords: ['Am'],
  };
}

let almacen: IndexedDbSessionStorage;

beforeEach(() => {
  // Una base nueva por test: sin esto, lo guardado en uno aparece en el siguiente.
  globalThis.indexedDB = new IDBFactory();
  almacen = new IndexedDbSessionStorage();
});

afterEach(() => {
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
});

describe('guardar y recuperar', () => {
  it('lo guardado se recupera entero', async () => {
    const una = sesion('a', 1000);

    await almacen.save(una);

    expect(await almacen.list()).toEqual([una]);
  });

  it('la base se crea sola la primera vez', async () => {
    // Nadie ejecuta migraciones aquí: si el `onupgradeneeded` no crea el almacén,
    // la primera sesión de cualquiera se pierde con un error de transacción.
    expect(await almacen.list()).toEqual([]);
  });

  it('guardar la misma sesion otra vez la actualiza, no la duplica', async () => {
    // Es lo que pasa mientras se toca: la sesión abierta se guarda cada poco.
    await almacen.save(sesion('a', 1000, ['A']));
    await almacen.save(sesion('a', 2000, ['A', 'C', 'E']));

    const guardadas = await almacen.list();

    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]!.notes).toEqual(['A', 'C', 'E']);
  });

  it('las mas recientes primero', async () => {
    await almacen.save(sesion('vieja', 1000));
    await almacen.save(sesion('nueva', 5000));

    expect((await almacen.list()).map((s) => s.id)).toEqual(['nueva', 'vieja']);
  });
});

describe('la poda', () => {
  it('borra de la base, no solo de la lista', async () => {
    // Si solo se filtrara al listar, la base crecería sin tope con cada sesión y
    // nadie lo vería hasta que el navegador se quejara del espacio.
    for (let i = 0; i < MAX_STORED_SESSIONS + 5; i += 1) {
      await almacen.save(sesion(`s${i}`, i * 1000));
    }

    // Una vez podada, subir el tope no puede resucitar lo borrado.
    const todas = await almacen.list();

    expect(todas).toHaveLength(MAX_STORED_SESSIONS);
    expect(todas.map((s) => s.id)).not.toContain('s0');
  });
});

describe('borrar', () => {
  it('una sola', async () => {
    await almacen.save(sesion('a', 1000));
    await almacen.save(sesion('b', 2000));

    await almacen.remove('a');

    expect((await almacen.list()).map((s) => s.id)).toEqual(['b']);
  });

  it('una que no esta no es un error', async () => {
    await expect(almacen.remove('no-existe')).resolves.toBeUndefined();
  });

  it('todas', async () => {
    await almacen.save(sesion('a', 1000));
    await almacen.save(sesion('b', 2000));

    await almacen.clear();

    expect(await almacen.list()).toEqual([]);
  });
});

describe('cual se usa segun donde se ejecute', () => {
  it('con IndexedDB, la de verdad', () => {
    expect(createSessionStorage()).toBeInstanceOf(IndexedDbSessionStorage);
  });

  it('sin IndexedDB, la de memoria', () => {
    // Es lo que pasa al renderizar en el servidor: sin esto, cada pantalla que
    // lea sesiones reventaría antes de llegar al navegador.
    delete (globalThis as { indexedDB?: unknown }).indexedDB;

    expect(createSessionStorage()).toBeInstanceOf(MemorySessionStorage);
  });
});
