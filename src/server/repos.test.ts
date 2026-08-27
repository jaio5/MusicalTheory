import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_PROGRESS, MAX_SONGS, type Song } from '@core/music';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as AiUsage from './ai-usage';
import type * as PasswordReset from './password-reset';
import type * as ProgressRepo from './progress-repo';
import type * as RateLimitDb from './rate-limit-db';
import type * as SongsRepo from './songs-repo';
import type * as Users from './users';

/**
 * Lo que se guarda de ti: canciones, avance, cupos, vales y frecuencia.
 *
 * Todo contra Postgres de verdad, porque lo que aquí puede fallar solo se ve con
 * una base de datos delante: un `on conflict` que no cuadra, un filtro por
 * usuario que falta, dos peticiones a la vez gastando la última del cupo.
 */

let base: BaseDePrueba;
let songs: typeof SongsRepo;
let progreso: typeof ProgressRepo;
let uso: typeof AiUsage;
let vales: typeof PasswordReset;
let frecuencia: typeof RateLimitDb;
let users: typeof Users;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  [songs, progreso, uso, vales, frecuencia, users] = await Promise.all([
    import('./songs-repo'),
    import('./progress-repo'),
    import('./ai-usage'),
    import('./password-reset'),
    import('./rate-limit-db'),
    import('./users'),
  ]);
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
});

/** Una cuenta de verdad, porque las claves foráneas se comprueban. */
async function cuenta(email = 'a@b.c'): Promise<string> {
  const result = await users.createUser({ email, password: 'unaContrasenaLarga' });
  if (result.kind !== 'ok') {
    throw new Error(result.kind);
  }
  return result.user.id;
}

const CANCION: Song = {
  id: 'nueva',
  name: 'La mía',
  tonic: 0,
  mode: 'major',
  bpm: 100,
  sections: [{ name: 'A', degrees: ['I', 'V', 'vi', 'IV'] }],
  updatedAt: 1,
};

describe('las canciones', () => {
  it('se guardan y se leen', async () => {
    const userId = await cuenta();

    const guardada = await songs.createSong(userId, CANCION);
    expect(guardada.kind).toBe('ok');

    const lista = await songs.listSongs(userId);
    expect(lista).toHaveLength(1);
    expect(lista?.[0]?.name).toBe('La mía');
  });

  it('cada cual ve las suyas y solo las suyas', async () => {
    // Es la garantía que sostiene la función entera, y la única forma de
    // comprobarla es con dos cuentas y una base de datos.
    const mia = await cuenta('a@b.c');
    const tuya = await cuenta('otro@b.c');
    await songs.createSong(mia, CANCION);

    expect(await songs.listSongs(tuya)).toHaveLength(0);
  });

  it('no se puede escribir en la canción de otra persona', async () => {
    const mia = await cuenta('a@b.c');
    const tuya = await cuenta('otro@b.c');
    const guardada = await songs.createSong(mia, CANCION);
    const id = guardada.kind === 'ok' ? guardada.song.id : '';

    const intento = await songs.updateSong(tuya, { ...CANCION, id, name: 'Robada' });

    expect(intento.kind).toBe('no-existe');
    expect((await songs.listSongs(mia))?.[0]?.name).toBe('La mía');
  });

  it('ni borrarla', async () => {
    const mia = await cuenta('a@b.c');
    const tuya = await cuenta('otro@b.c');
    const guardada = await songs.createSong(mia, CANCION);
    const id = guardada.kind === 'ok' ? guardada.song.id : '';

    expect(await songs.removeSong(tuya, id)).toBe('no-existe');
    expect(await songs.listSongs(mia)).toHaveLength(1);
  });

  it('borrar la tuya sí', async () => {
    const userId = await cuenta();
    const guardada = await songs.createSong(userId, CANCION);
    const id = guardada.kind === 'ok' ? guardada.song.id : '';

    expect(await songs.removeSong(userId, id)).toBe('ok');
    expect(await songs.listSongs(userId)).toHaveLength(0);
  });

  it('un identificador que no lo es no borra nada', async () => {
    const userId = await cuenta();
    await songs.createSong(userId, CANCION);

    expect(await songs.removeSong(userId, 42)).toBe('no-existe');
    expect(await songs.listSongs(userId)).toHaveLength(1);
  });

  it('hay un tope, y se avisa en vez de guardar la que sobra', async () => {
    const userId = await cuenta();
    for (let i = 0; i < MAX_SONGS; i += 1) {
      await songs.createSong(userId, { ...CANCION, name: `La ${i}` });
    }

    expect((await songs.createSong(userId, CANCION)).kind).toBe('llena');
    expect(await songs.listSongs(userId)).toHaveLength(MAX_SONGS);
  });

  it('actualizar una que no existe no la crea', async () => {
    const userId = await cuenta();

    expect(
      (await songs.updateSong(userId, { ...CANCION, id: '00000000-0000-0000-0000-000000000000' }))
        .kind,
    ).toBe('no-existe');
    expect(await songs.listSongs(userId)).toHaveLength(0);
  });
});

describe('el avance', () => {
  it('la primera vez está vacío, no roto', async () => {
    const userId = await cuenta();

    expect((await progreso.loadAccountProgress(userId)).kind).toBe('vacio');
  });

  it('se guarda y se recupera igual', async () => {
    const userId = await cuenta();
    const mio = { ...EMPTY_PROGRESS, done: ['e1-grados'], xp: 20 };

    expect(await progreso.saveAccountProgress(userId, mio)).toBe(true);
    const leido = await progreso.loadAccountProgress(userId);

    expect(leido.kind).toBe('ok');
    expect(leido.kind === 'ok' && leido.progress.done).toEqual(['e1-grados']);
  });

  it('guardar dos veces actualiza en vez de duplicar', async () => {
    // Una fila por cuenta: si se insertara otra, leerlo devolvería la primera y
    // el avance parecería congelado.
    const userId = await cuenta();

    await progreso.saveAccountProgress(userId, { ...EMPTY_PROGRESS, done: ['e1-grados'] });
    await progreso.saveAccountProgress(userId, { ...EMPTY_PROGRESS, done: ['e1-repaso'] });

    const leido = await progreso.loadAccountProgress(userId);
    expect(leido.kind === 'ok' && leido.progress.done).toEqual(['e1-repaso']);
  });
});

describe('los dos cupos de la IA', () => {
  const limites = { monthly: 3, daily: 2 };

  it('deja pasar mientras quede, y va contando', async () => {
    const userId = await cuenta();

    const primera = await uso.spendAiRequest(userId, limites);
    const segunda = await uso.spendAiRequest(userId, limites);

    expect(primera.kind).toBe('ok');
    expect(segunda.kind).toBe('ok');
    expect(segunda.kind === 'ok' && segunda.usage).toEqual({ month: 2, today: 2 });
  });

  it('el tope del día se agota antes que el del mes, y se dice cuál', async () => {
    // No se arreglan igual: uno se espera a mañana y el otro sube de plan.
    const userId = await cuenta();
    await uso.spendAiRequest(userId, limites);
    await uso.spendAiRequest(userId, limites);

    expect((await uso.spendAiRequest(userId, limites)).kind).toBe('sin-cupo-diario');
  });

  it('al día siguiente el contador del día empieza de cero y el del mes sigue', async () => {
    // Sin esto haría falta borrar filas todas las noches; con el `case` del
    // contador diario no hay nada que limpiar nunca.
    const userId = await cuenta();
    const hoy = new Date('2026-08-26T10:00:00Z');
    const manana = new Date('2026-08-27T10:00:00Z');

    await uso.spendAiRequest(userId, limites, hoy);
    await uso.spendAiRequest(userId, limites, hoy);
    const otroDia = await uso.spendAiRequest(userId, limites, manana);

    expect(otroDia.kind).toBe('ok');
    expect(otroDia.kind === 'ok' && otroDia.usage).toEqual({ month: 3, today: 1 });
  });

  it('el tope del mes también para, aunque sea otro día', async () => {
    const userId = await cuenta();
    const dias = ['26', '27', '28', '29'].map((d) => new Date(`2026-08-${d}T10:00:00Z`));

    const resultados = [];
    for (const dia of dias) {
      resultados.push((await uso.spendAiRequest(userId, limites, dia)).kind);
    }

    expect(resultados).toEqual(['ok', 'ok', 'ok', 'sin-cupo-mensual']);
  });

  it('un plan sin cupo no gasta ni una', async () => {
    const userId = await cuenta();

    expect((await uso.spendAiRequest(userId, { monthly: 0, daily: 0 })).kind).toBe(
      'sin-cupo-mensual',
    );
    expect(await uso.aiUsageOf(userId)).toEqual({ month: 0, today: 0 });
  });

  it('lo gastado se puede consultar sin gastar nada', async () => {
    const userId = await cuenta();
    await uso.spendAiRequest(userId, limites);

    expect(await uso.aiUsageOf(userId)).toEqual({ month: 1, today: 1 });
    expect(await uso.aiUsageOf(userId)).toEqual({ month: 1, today: 1 });
  });

  it('cada cuenta lleva la suya', async () => {
    const mia = await cuenta('a@b.c');
    const tuya = await cuenta('otro@b.c');
    await uso.spendAiRequest(mia, limites);

    expect(await uso.aiUsageOf(tuya)).toEqual({ month: 0, today: 0 });
  });
});

describe('el vale de la contraseña olvidada', () => {
  it('se crea para una cuenta que existe, y no para una que no', async () => {
    await cuenta('a@b.c');
    const ahora = new Date();

    expect(await vales.requestReset('a@b.c', ahora)).not.toBeNull();
    expect(await vales.requestReset('nadie@b.c', ahora)).toBeNull();
  });

  it('lo que se guarda es la huella, no el vale', async () => {
    // Quien se lleve la tabla entera no puede entrar en ninguna cuenta con lo
    // que hay dentro. Es el mismo motivo que las contraseñas.
    await cuenta();
    const pedido = await vales.requestReset('a@b.c', new Date());

    expect(pedido?.token).toBeTruthy();
    expect(vales.hashResetToken(pedido!.token)).not.toBe(pedido!.token);
  });

  it('cambia la contraseña, y el vale ya no vale otra vez', async () => {
    const userId = await cuenta();
    const pedido = await vales.requestReset('a@b.c', new Date());

    expect(await vales.resetPassword(pedido!.token, 'otraLargaTambien', new Date())).toBe('ok');
    expect(await vales.resetPassword(pedido!.token, 'terceraLarga', new Date())).toBe(
      'vale-no-vale',
    );
    expect((await users.findUserById(userId))?.id).toBe(userId);
  });

  it('caducado no sirve', async () => {
    await cuenta();
    const pedido = await vales.requestReset('a@b.c', new Date('2026-08-26T10:00:00Z'));

    expect(
      await vales.resetPassword(
        pedido!.token,
        'otraLargaTambien',
        new Date('2026-08-26T12:00:00Z'),
      ),
    ).toBe('vale-no-vale');
  });

  it('pedir uno nuevo gasta los anteriores', async () => {
    // Si no, pedir tres correos dejaría tres puertas abiertas.
    await cuenta();
    const primero = await vales.requestReset('a@b.c', new Date());
    await vales.requestReset('a@b.c', new Date());

    expect(await vales.resetPassword(primero!.token, 'otraLargaTambien', new Date())).toBe(
      'vale-no-vale',
    );
  });

  it('usarlo echa a las demás sesiones', async () => {
    const userId = await cuenta();
    const antes = (await users.findUserById(userId))!.sessionVersion;
    const pedido = await vales.requestReset('a@b.c', new Date());

    await vales.resetPassword(pedido!.token, 'otraLargaTambien', new Date());

    expect((await users.findUserById(userId))!.sessionVersion).toBeGreaterThan(antes);
  });

  it('una contraseña corta no gasta el vale', async () => {
    await cuenta();
    const pedido = await vales.requestReset('a@b.c', new Date());

    expect(await vales.resetPassword(pedido!.token, 'corta', new Date())).toBe('contrasena-corta');
    expect(await vales.resetPassword(pedido!.token, 'otraLargaTambien', new Date())).toBe('ok');
  });

  it('los caducados se pueden barrer sin tocar los vivos', async () => {
    await cuenta();
    const vivo = await vales.requestReset('a@b.c', new Date());

    await vales.pruneResets(new Date('2020-01-01T00:00:00Z'));

    expect(await vales.resetPassword(vivo!.token, 'otraLargaTambien', new Date())).toBe('ok');
  });
});

describe('el límite de frecuencia compartido', () => {
  it('cuenta por clave y frena al pasarse', async () => {
    const memoria = new (await import('./rate-limit')).SlidingWindowRateLimiter();
    const opciones = { limit: 3, windowMs: 60_000 };

    const estados: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      estados.push(
        (await frecuencia.limitRequest({ memoria, key: 'uno', now: 1000, options: opciones }))
          .allowed,
      );
    }

    expect(estados).toEqual([true, true, true, false, false]);
  });

  it('cada clave lleva la suya', async () => {
    const memoria = new (await import('./rate-limit')).SlidingWindowRateLimiter();
    const opciones = { limit: 1, windowMs: 60_000 };

    await frecuencia.limitRequest({ memoria, key: 'uno', now: 1000, options: opciones });

    expect(
      (await frecuencia.limitRequest({ memoria, key: 'otro', now: 1000, options: opciones }))
        .allowed,
    ).toBe(true);
  });

  it('al pasar la ventana se puede otra vez', async () => {
    const memoria = new (await import('./rate-limit')).SlidingWindowRateLimiter();
    const opciones = { limit: 1, windowMs: 60_000 };

    await frecuencia.limitRequest({ memoria, key: 'uno', now: 1000, options: opciones });

    expect(
      (await frecuencia.limitRequest({ memoria, key: 'uno', now: 70_000, options: opciones }))
        .allowed,
    ).toBe(true);
  });

  it('cuando frena, dice cuánto esperar', async () => {
    const memoria = new (await import('./rate-limit')).SlidingWindowRateLimiter();
    const opciones = { limit: 1, windowMs: 60_000 };

    await frecuencia.limitRequest({ memoria, key: 'uno', now: 1000, options: opciones });
    const frenada = await frecuencia.limitRequest({
      memoria,
      key: 'uno',
      now: 2000,
      options: opciones,
    });

    expect(frenada.retryAfterSeconds).toBeGreaterThan(0);
  });
});
