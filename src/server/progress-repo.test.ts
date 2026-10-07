import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_PROGRESS } from '@core/music';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as ProgressRepo from './progress-repo';
import type * as Users from './users';

/**
 * Fundir el avance en una transacción, contra Postgres de verdad.
 *
 * Las carreras y los avances inventados se prueban por la ruta, en
 * `app/api/progreso/route.con-base.test.ts`; aquí, lo que la ruta no recorre: el
 * día por defecto y los dos fallos —sin base y con la base rota—, en los que no se
 * escribe nada (adr/0116).
 */

let base: BaseDePrueba;
let repo: typeof ProgressRepo;
let users: typeof Users;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  [repo, users] = await Promise.all([import('./progress-repo'), import('./users')]);
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
});

async function cuenta(): Promise<string> {
  const result = await users.createUser({
    mayorDe14: true,
    email: 'a@b.c',
    password: 'unaContrasenaLarga',
  });
  if (result.kind !== 'ok') {
    throw new Error(result.kind);
  }
  return result.user.id;
}

describe('hoyEnElServidor', () => {
  it('es el día en UTC, no el de la zona del servidor', () => {
    expect(repo.hoyEnElServidor(new Date('2026-10-07T23:30:00-05:00'))).toBe('2026-10-08');
  });
});

describe('fusionarAvance', () => {
  it('sin decirle el día, usa el del servidor', async () => {
    const userId = await cuenta();
    const hoy = repo.hoyEnElServidor();

    const junto = await repo.fusionarAvance(userId, { ...EMPTY_PROGRESS, lastDay: hoy, streak: 1 });

    expect(junto?.lastDay).toBe(hoy);
  });

  it('funde con lo que había, y lo deja escrito', async () => {
    const userId = await cuenta();
    await repo.saveAccountProgress(userId, { ...EMPTY_PROGRESS, done: ['e1-grados'] });

    await repo.fusionarAvance(userId, { ...EMPTY_PROGRESS, done: ['e1-notas'] }, '2026-10-07');

    const leido = await repo.loadAccountProgress(userId);
    expect(leido.kind === 'ok' && [...leido.progress.done].sort()).toEqual([
      'e1-grados',
      'e1-notas',
    ]);
  });

  it('sin base de datos no finge que ha guardado', async () => {
    const guardada = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      expect(await repo.fusionarAvance('u1', EMPTY_PROGRESS)).toBeNull();
    } finally {
      process.env['DATABASE_URL'] = guardada;
    }
  });

  it('con la base rota, tampoco, y no deja nada a medias', async () => {
    const userId = await cuenta();
    await base.ejecutar('alter table progress rename to progress_escondida');
    try {
      expect(await repo.fusionarAvance(userId, EMPTY_PROGRESS)).toBeNull();
    } finally {
      await base.ejecutar('alter table progress_escondida rename to progress');
    }
    expect((await repo.loadAccountProgress(userId)).kind).toBe('vacio');
  });
});
