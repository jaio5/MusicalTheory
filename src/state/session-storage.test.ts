import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from '@core/music';

import {
  describeSession,
  MAX_STORED_SESSIONS,
  MemorySessionStorage,
  pruneSessions,
  type StoredSession,
} from './session-storage';

function session(id: string, savedAt: number): StoredSession {
  return {
    id,
    savedAt,
    key: { tonic: pitchClassFromName('A'), mode: 'minor' },
    scaleId: 'minorPentatonic',
    notes: ['A', 'C', 'E'],
    chords: ['Am'],
  };
}

describe('retención', () => {
  it('deja las más recientes primero', () => {
    const pruned = pruneSessions([session('a', 100), session('b', 300), session('c', 200)]);
    expect(pruned.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('no guarda más de la cuenta', () => {
    const many = Array.from({ length: 40 }, (_, index) => session(`s${index}`, index));
    expect(pruneSessions(many)).toHaveLength(MAX_STORED_SESSIONS);
  });

  it('respeta un límite distinto si se lo dan', () => {
    const many = Array.from({ length: 10 }, (_, index) => session(`s${index}`, index));
    expect(pruneSessions(many, 3)).toHaveLength(3);
  });
});

describe('almacén en memoria', () => {
  it('guarda y devuelve', async () => {
    const storage = new MemorySessionStorage();
    await storage.save(session('a', 100));

    const stored = await storage.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.notes).toEqual(['A', 'C', 'E']);
  });

  it('guardar con el mismo identificador reemplaza, no duplica', async () => {
    const storage = new MemorySessionStorage();
    await storage.save(session('a', 100));
    await storage.save({ ...session('a', 200), notes: ['G'] });

    const stored = await storage.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.notes).toEqual(['G']);
  });

  it('borra una sola', async () => {
    const storage = new MemorySessionStorage();
    await storage.save(session('a', 100));
    await storage.save(session('b', 200));
    await storage.remove('a');

    expect((await storage.list()).map((item) => item.id)).toEqual(['b']);
  });

  it('borra todo', async () => {
    const storage = new MemorySessionStorage();
    await storage.save(session('a', 100));
    await storage.clear();

    expect(await storage.list()).toEqual([]);
  });

  it('aplica la retención al guardar', async () => {
    const storage = new MemorySessionStorage();
    for (let index = 0; index < 30; index += 1) {
      await storage.save(session(`s${index}`, index));
    }

    expect(await storage.list()).toHaveLength(MAX_STORED_SESSIONS);
  });
});

describe('resumen de una sesión', () => {
  it('lleva fecha, hora y cuántas notas', () => {
    const saved = new Date(2026, 6, 28, 19, 5).getTime();
    expect(describeSession({ ...session('a', saved) })).toBe('28/07 19:05 · 3 notas');
  });

  it('concuerda en singular', () => {
    const saved = new Date(2026, 6, 28, 9, 5).getTime();
    expect(describeSession({ ...session('a', saved), notes: ['A'] })).toBe('28/07 09:05 · 1 nota');
  });

  it('lo dice cuando no se ha tocado nada', () => {
    const saved = new Date(2026, 6, 28, 9, 5).getTime();
    expect(describeSession({ ...session('a', saved), notes: [] })).toContain('sin notas');
  });
});
