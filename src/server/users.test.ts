import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as Users from './users';

/**
 * Las cuentas, contra Postgres de verdad.
 *
 * **Esta era la deuda más vieja del proyecto.** Lo puro estaba probado —el
 * cifrado, los planes, los permisos— pero las consultas no, y las dos veces que
 * se ejecutaron a mano salieron fallos que ningún test veía. El porqué de que
 * ahora se pueda, en `db/para-tests.ts`.
 *
 * Lo que se prueba aquí es lo que solo se ve con una base de datos delante: que
 * el índice único haga su trabajo, que borrar una cuenta se lleve lo suyo por
 * delante, y que cambiar la contraseña eche a las demás sesiones.
 */

let base: BaseDePrueba;
let users: typeof Users;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  users = await import('./users');
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
});

const CONTRASENA = 'unaContrasenaLarga';

async function crear(email = 'a@b.c', name = 'Javi') {
  const result = await users.createUser({ email, password: CONTRASENA, name });
  if (result.kind !== 'ok') {
    throw new Error(`no se ha podido crear: ${result.kind}`);
  }
  return result.user;
}

describe('crear una cuenta', () => {
  it('la guarda con su plan gratis', async () => {
    const user = await crear();

    expect(user).toMatchObject({ email: 'a@b.c', name: 'Javi', plan: 'gratis' });
    expect(user.id).toBeTruthy();
  });

  it('el mismo correo dos veces lo para la base de datos, no el código', async () => {
    // Comprobar antes «¿existe ya?» y luego insertar deja una rendija entre las
    // dos consultas por la que se cuelan dos registros a la vez. Quien lo impide
    // de verdad es el índice único, y esto comprueba que está.
    await crear();

    const otra = await users.createUser({ email: 'a@b.c', password: CONTRASENA });

    expect(otra.kind).toBe('ya-existe');
  });

  it('el correo se normaliza, así que las mayúsculas no crean otra cuenta', async () => {
    await crear('a@b.c');

    expect((await users.createUser({ email: '  A@B.C ', password: CONTRASENA })).kind).toBe(
      'ya-existe',
    );
  });

  it('un correo que no lo es no llega a la base de datos', async () => {
    expect((await users.createUser({ email: 'esto no', password: CONTRASENA })).kind).toBe(
      'correo-invalido',
    );
  });

  it('una contraseña corta tampoco', async () => {
    expect((await users.createUser({ email: 'a@b.c', password: 'corta' })).kind).toBe(
      'contrasena-corta',
    );
  });

  it('la contraseña no se guarda en claro', async () => {
    // Lo que se busca es que quien se lleve la tabla entera no pueda entrar en
    // ninguna cuenta con lo que hay dentro.
    const user = await crear();
    const encontrado = await users.findUserWithPassword('a@b.c');

    expect(encontrado?.passwordHash).not.toContain(CONTRASENA);
    expect(encontrado?.passwordHash).toMatch(/^scrypt\$/);
    expect(encontrado?.user.id).toBe(user.id);
  });
});

describe('encontrar una cuenta', () => {
  it('por correo, con su cifrado', async () => {
    await crear();

    expect(await users.findUserWithPassword('a@b.c')).not.toBeNull();
    expect(await users.findUserWithPassword('nadie@b.c')).toBeNull();
  });

  it('por identificador', async () => {
    const user = await crear();

    expect((await users.findUserById(user.id))?.email).toBe('a@b.c');
    expect(await users.findUserById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});

describe('cambiar lo tuyo', () => {
  it('el nombre se guarda, y vacío lo borra', async () => {
    const user = await crear();

    expect((await users.setName(user.id, 'Otro'))?.name).toBe('Otro');
    expect((await users.setName(user.id, ''))?.name).toBeNull();
  });

  it('cambiar la contraseña exige la de antes', async () => {
    const user = await crear();

    expect((await users.changePassword(user.id, 'la que no es', 'otraLargaTambien')).kind).toBe(
      'no-coincide',
    );
    expect((await users.changePassword(user.id, CONTRASENA, 'corta')).kind).toBe(
      'contrasena-corta',
    );
    expect((await users.changePassword(user.id, CONTRASENA, 'otraLargaTambien')).kind).toBe('ok');
  });

  it('y con la nueva se entra, con la vieja ya no', async () => {
    const user = await crear();
    await users.changePassword(user.id, CONTRASENA, 'otraLargaTambien');

    const guardado = await users.findUserWithPassword('a@b.c');
    const { verifyPassword } = await import('./password');

    expect(await verifyPassword('otraLargaTambien', guardado!.passwordHash)).toBe(true);
    expect(await verifyPassword(CONTRASENA, guardado!.passwordHash)).toBe(false);
  });

  it('cambiar la contraseña echa a las demás sesiones', async () => {
    // Quien la cambia suele estar haciéndolo porque alguien más entró, y dejar
    // viva esa sesión sería recuperar la cuenta a medias.
    const user = await crear();
    const antes = (await users.findUserById(user.id))!.sessionVersion;

    await users.changePassword(user.id, CONTRASENA, 'otraLargaTambien');

    expect((await users.findUserById(user.id))!.sessionVersion).toBeGreaterThan(antes);
  });
});

describe('el plan', () => {
  it('se cambia y se lee', async () => {
    const user = await crear();

    expect(await users.setPlan(user.id, 'pro')).toBe('ok');
    expect((await users.findUserById(user.id))?.plan).toBe('pro');
  });

  it('una cuenta que no existe no se puede cambiar', async () => {
    expect(await users.setPlan('00000000-0000-0000-0000-000000000000', 'pro')).toBe('no-existe');
  });
});

describe('borrar la cuenta', () => {
  it('pide la contraseña, no solo estar dentro', async () => {
    const user = await crear();

    expect(await users.deleteAccount(user.id, 'la que no es')).toBe('no-coincide');
    expect(await users.findUserById(user.id)).not.toBeNull();
  });

  it('con la contraseña buena se borra de verdad', async () => {
    const user = await crear();

    expect(await users.deleteAccount(user.id, CONTRASENA)).toBe('ok');
    expect(await users.findUserById(user.id)).toBeNull();
  });

  it('y se lleva por delante lo que colgaba de ella', async () => {
    // Si el avance o las canciones sobrevivieran a la cuenta, quedarían filas
    // apuntando a un usuario que ya no existe: datos de alguien que pidió que se
    // borraran, guardados igualmente.
    const user = await crear();
    const { saveAccountProgress } = await import('./progress-repo');
    const { EMPTY_PROGRESS } = await import('@core/music');

    await saveAccountProgress(user.id, EMPTY_PROGRESS);
    await users.deleteAccount(user.id, CONTRASENA);

    const { loadAccountProgress } = await import('./progress-repo');
    expect((await loadAccountProgress(user.id)).kind).not.toBe('ok');
  });
});

describe('sin base de datos', () => {
  it('todo contesta que aquí no hay cuentas, en vez de reventar', async () => {
    const url = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];

    try {
      expect(
        (await users.createUser({ email: 'a@b.c', password: CONTRASENA })).kind,
        'createUser',
      ).toBe('sin-base-de-datos');
      expect(await users.findUserById('x'), 'findUserById').toBeNull();
      // `setPlan` es la excepción, y a propósito: su tipo solo tiene tres casos
      // porque lo que le importa al webhook es distinguir «esa cuenta ya no
      // está» —no reintentes— de «no se ha podido» —reintenta—. Sin base de
      // datos no hay cuentas, así que nadie ha podido pagar y el caso no se da.
      expect(await users.setPlan('x', 'pro'), 'setPlan').toBe('error');
      expect(await users.deleteAccount('x', CONTRASENA), 'deleteAccount').toBe('sin-base-de-datos');
    } finally {
      process.env['DATABASE_URL'] = url;
    }
  });
});
