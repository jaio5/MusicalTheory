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
  const result = await users.createUser({ mayorDe14: true, email, password: CONTRASENA, name });
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

    const otra = await users.createUser({ mayorDe14: true, email: 'a@b.c', password: CONTRASENA });

    expect(otra.kind).toBe('ya-existe');
  });

  it('el correo se normaliza, así que las mayúsculas no crean otra cuenta', async () => {
    await crear('a@b.c');

    expect(
      (await users.createUser({ mayorDe14: true, email: '  A@B.C ', password: CONTRASENA })).kind,
    ).toBe('ya-existe');
  });

  it('un correo que no lo es no llega a la base de datos', async () => {
    expect(
      (await users.createUser({ mayorDe14: true, email: 'esto no', password: CONTRASENA })).kind,
    ).toBe('correo-invalido');
  });

  it('sin declarar catorce años o más no se crea, y antes de mirar nada más', async () => {
    // LOPDGDD art. 7. Lo que vale es `true`: un «sí» o un 1 en el cuerpo no es
    // haberlo declarado.
    for (const mayorDe14 of [undefined, false, 'si', 1]) {
      expect(
        (await users.createUser({ mayorDe14, email: 'esto no', password: 'corta' })).kind,
        String(mayorDe14),
      ).toBe('menor');
    }
    expect(await users.findUserWithPassword('a@b.c')).toBeNull();
  });

  it('la declaración se guarda con su fecha', async () => {
    const user = await crear();
    const { db } = await import('./db/client');
    const { users: tabla } = await import('./db/schema');
    const { eq } = await import('drizzle-orm');
    const [fila] = await db()!.select().from(tabla).where(eq(tabla.id, user.id));

    expect(fila?.mayorDe14En).toBeInstanceOf(Date);
  });

  it('una contraseña corta tampoco', async () => {
    expect(
      (await users.createUser({ mayorDe14: true, email: 'a@b.c', password: 'corta' })).kind,
    ).toBe('contrasena-corta');
  });

  /**
   * **Ni una enorme** (adr/0113). No había tope, y una de 10 MB en ligaduras —que
   * NFKC triplica— llegaba entera a `scrypt`. Mil caracteres sobran para cualquier
   * gestor de contraseñas.
   */
  it('una contraseña de más de mil caracteres tampoco, y una de mil sí', async () => {
    expect(
      (await users.createUser({ mayorDe14: true, email: 'a@b.c', password: 'x'.repeat(1025) }))
        .kind,
    ).toBe('contrasena-corta');
    expect(
      (await users.createUser({ mayorDe14: true, email: 'a@b.c', password: 'x'.repeat(1024) }))
        .kind,
    ).toBe('ok');
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

  it('la nueva tampoco puede pasar de mil caracteres, ni la de antes comprobarse', async () => {
    const user = await crear();

    expect((await users.changePassword(user.id, CONTRASENA, 'x'.repeat(1025))).kind).toBe(
      'contrasena-corta',
    );
    // La de ahora, enorme, no puede ser la buena: se dice que no sin derivar nada.
    expect((await users.changePassword(user.id, 'x'.repeat(2048), 'otraLargaTambien')).kind).toBe(
      'no-coincide',
    );
    expect(await users.deleteAccount(user.id, 'x'.repeat(2048))).toBe('no-coincide');
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

    expect(await users.setPlan(user.id, 'basico')).toBe('ok');
    expect((await users.findUserById(user.id))?.plan).toBe('basico');
  });

  it('una cuenta que no existe no se puede cambiar', async () => {
    expect(await users.setPlan('00000000-0000-0000-0000-000000000000', 'basico')).toBe('no-existe');
  });
});

describe('la suscripción de Stripe', () => {
  /*
    Lo que hace que cancelar pare el cobro y que la baja encuentre a alguien: el
    pago confirmado guarda la suscripción, y lo que Stripe diga después de ella se
    aplica a quien la tenga guardada, no a quien digan unos metadatos.
  */
  it('un pago confirmado guarda plan, cliente y suscripción de una vez', async () => {
    const user = await crear();

    expect(
      await users.vincularSuscripcion(user.id, {
        plan: 'medio',
        customerId: 'cus_1',
        subscriptionId: 'sub_1',
      }),
    ).toEqual({ kind: 'ok' });

    expect((await users.findUserById(user.id))?.plan).toBe('medio');
    expect(await users.suscripcionDe(user.id)).toEqual({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    });
  });

  it('lo que diga Stripe de la suscripción se aplica a quien la tiene', async () => {
    const user = await crear();
    await users.vincularSuscripcion(user.id, {
      plan: 'medio',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    });

    expect(await users.planDeSuscripcion('sub_1', 'basico', { soltar: false })).toBe('ok');
    expect((await users.findUserById(user.id))?.plan).toBe('basico');

    // La baja la suelta: un aviso viejo de esa misma suscripción que llegue tarde
    // ya no encuentra a nadie, y no puede devolverle el plan de pago.
    expect(await users.planDeSuscripcion('sub_1', 'gratis', { soltar: true })).toBe('ok');
    expect(await users.planDeSuscripcion('sub_1', 'basico', { soltar: false })).toBe('no-existe');
    expect((await users.findUserById(user.id))?.plan).toBe('gratis');
    // El cliente se queda: volver a pagar usa el mismo.
    expect(await users.suscripcionDe(user.id)).toEqual({
      customerId: 'cus_1',
      subscriptionId: null,
    });
  });

  it('soltarla desde aquí deja gratis y sin suscripción', async () => {
    const user = await crear();
    await users.vincularSuscripcion(user.id, {
      plan: 'basico',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    });

    expect(await users.soltarSuscripcion(user.id)).toBe('ok');

    expect((await users.findUserById(user.id))?.plan).toBe('gratis');
    expect((await users.suscripcionDe(user.id))?.subscriptionId).toBeNull();
  });

  /**
   * **Dos Checkout pagados a la vez.** El segundo aviso pisaba la suscripción del
   * primero: aquella seguía cobrando y sus avisos ya no encontraban a nadie.
   * Ahora no pisa, y dice cuál hay guardada para que el webhook decida.
   */
  it('no pisa otra suscripción guardada: dice cuál hay', async () => {
    const user = await crear();
    const pago = { plan: 'medio' as const, customerId: 'cus_1', subscriptionId: 'sub_1' };
    await users.vincularSuscripcion(user.id, pago);

    expect(
      await users.vincularSuscripcion(user.id, {
        ...pago,
        plan: 'basico',
        subscriptionId: 'sub_2',
      }),
    ).toEqual({ kind: 'otra', guardada: 'sub_1' });

    expect((await users.findUserById(user.id))?.plan).toBe('medio');
    expect((await users.suscripcionDe(user.id))?.subscriptionId).toBe('sub_1');
  });

  it('la misma otra vez sí escribe: es el aviso repetido', async () => {
    const user = await crear();
    const pago = { plan: 'medio' as const, customerId: 'cus_1', subscriptionId: 'sub_1' };
    await users.vincularSuscripcion(user.id, pago);

    expect(await users.vincularSuscripcion(user.id, { ...pago, plan: 'basico' })).toEqual({
      kind: 'ok',
    });
    expect((await users.findUserById(user.id))?.plan).toBe('basico');
  });

  it('con `reemplaza`, la nueva ocupa el sitio de esa y de ninguna otra', async () => {
    const user = await crear();
    const pago = { plan: 'medio' as const, customerId: 'cus_1', subscriptionId: 'sub_1' };
    await users.vincularSuscripcion(user.id, pago);
    const nueva = { ...pago, plan: 'basico' as const, subscriptionId: 'sub_2' };

    expect(await users.vincularSuscripcion(user.id, nueva, { reemplaza: 'sub_otra' })).toEqual({
      kind: 'otra',
      guardada: 'sub_1',
    });
    expect(await users.vincularSuscripcion(user.id, nueva, { reemplaza: 'sub_1' })).toEqual({
      kind: 'ok',
    });
    expect(await users.suscripcionDe(user.id)).toEqual({
      customerId: 'cus_1',
      subscriptionId: 'sub_2',
    });
    expect((await users.findUserById(user.id))?.plan).toBe('basico');
  });

  /**
   * Los dos avisos a la vez, de verdad: los dos leen la cuenta vacía antes de que
   * ninguno escriba. Solo uno escribe; el otro no pisa y pide reintento, y al
   * reintentarse ya ve la suscripción del primero.
   */
  it('dos a la vez: uno escribe, el otro no pisa y pide reintento', async () => {
    const user = await crear();
    const pago = { plan: 'medio' as const, customerId: 'cus_1' };

    const [a, b] = await Promise.all([
      users.vincularSuscripcion(user.id, { ...pago, subscriptionId: 'sub_a' }),
      users.vincularSuscripcion(user.id, { ...pago, subscriptionId: 'sub_b' }),
    ]);

    expect([a, b]).toEqual([{ kind: 'ok' }, { kind: 'error' }]);
    expect((await users.suscripcionDe(user.id))?.subscriptionId).toBe('sub_a');
    expect(await users.vincularSuscripcion(user.id, { ...pago, subscriptionId: 'sub_b' })).toEqual({
      kind: 'otra',
      guardada: 'sub_a',
    });
  });

  it('a una cuenta que no está, o con la base rota, no se vincula nada', async () => {
    const pago = { plan: 'medio' as const, customerId: 'cus_1', subscriptionId: 'sub_1' };
    expect(await users.vincularSuscripcion('00000000-0000-4000-8000-000000000000', pago)).toEqual({
      kind: 'no-existe',
    });

    const user = await crear();
    await base.ejecutar('alter table users rename to users_escondida');
    try {
      expect(await users.vincularSuscripcion(user.id, pago)).toEqual({ kind: 'error' });
      expect(await users.suscripcionDe(user.id)).toBeNull();
    } finally {
      await base.ejecutar('alter table users_escondida rename to users');
    }
  });

  it('una cuenta que nunca ha pagado no tiene nada, y una que no existe tampoco', async () => {
    const user = await crear();

    expect(await users.suscripcionDe(user.id)).toEqual({
      customerId: null,
      subscriptionId: null,
    });
    expect(await users.suscripcionDe('00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await users.soltarSuscripcion('00000000-0000-4000-8000-000000000000')).toBe('no-existe');
  });
});

describe('volver a cifrar la contraseña', () => {
  it('solo escribe si lo guardado es lo que se comprobó', async () => {
    // Si entre comprobarla y recifrarla alguien la cambió, pisarla con la vieja
    // sería devolverle la cuenta a quien se quería echar.
    const user = await crear();
    const antes = (await users.findUserWithPassword('a@b.c'))?.passwordHash ?? '';

    await users.recifrarContrasena(user.id, 'otra cosa', CONTRASENA);
    expect((await users.findUserWithPassword('a@b.c'))?.passwordHash).toBe(antes);

    await users.recifrarContrasena(user.id, antes, CONTRASENA);
    const despues = (await users.findUserWithPassword('a@b.c'))?.passwordHash;
    expect(despues).not.toBe(antes);
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
        (await users.createUser({ mayorDe14: true, email: 'a@b.c', password: CONTRASENA })).kind,
        'createUser',
      ).toBe('sin-base-de-datos');
      expect(await users.findUserById('x'), 'findUserById').toBeNull();
      // `setPlan` es la excepción, y a propósito: su tipo solo tiene tres casos
      // porque lo que le importa al webhook es distinguir «esa cuenta ya no
      // está» —no reintentes— de «no se ha podido» —reintenta—. Sin base de
      // datos no hay cuentas, así que nadie ha podido pagar y el caso no se da.
      expect(await users.setPlan('x', 'basico'), 'setPlan').toBe('error');
      expect(await users.suscripcionDe('x'), 'suscripcionDe').toBeNull();
      expect(await users.soltarSuscripcion('x'), 'soltarSuscripcion').toBe('error');
      expect(await users.deleteAccount('x', CONTRASENA), 'deleteAccount').toBe('sin-base-de-datos');
      expect(await users.setName('x', 'Javier'), 'setName').toBeNull();
      expect(
        (await users.changePassword('x', CONTRASENA, 'otraContrasenaLarga')).kind,
        'changePassword',
      ).toBe('sin-base-de-datos');
    } finally {
      process.env['DATABASE_URL'] = url;
    }
  });
});

describe('con la base rota', () => {
  /**
   * No es lo mismo que no tener base de datos.
   *
   * Sin `DATABASE_URL` es un clon recién bajado y todo el mundo es anónimo, que
   * está previsto. Con la base puesta y una consulta que revienta —una migración
   * a medias, un despliegue en marcha— lo que hay que garantizar es que **nadie
   * entra por error**: una excepción tragada que devolviera algo con forma de
   * cuenta sería una puerta abierta.
   *
   * Se finge cambiándole el nombre a la tabla: la consulta falla igual que con
   * la tabla ausente, y se deshace sin rehacer las migraciones.
   */
  async function conLaTablaEscondida(hacer: () => Promise<void>): Promise<void> {
    await base.ejecutar('alter table users rename to users_escondida');
    try {
      await hacer();
    } finally {
      await base.ejecutar('alter table users_escondida rename to users');
    }
  }

  it('nadie entra, nadie se crea y nada se cambia', async () => {
    await conLaTablaEscondida(async () => {
      expect(
        (await users.createUser({ mayorDe14: true, email: 'a@b.c', password: CONTRASENA })).kind,
      ).toBe('error');
      expect(await users.findUserById('u1')).toBeNull();
      expect(await users.findUserWithPassword('a@b.c')).toBeNull();
      expect(await users.setName('u1', 'Otro')).toBeNull();
      expect(await users.setPlan('u1', 'basico')).toBe('error');
      expect((await users.changePassword('u1', CONTRASENA, CONTRASENA)).kind).toBe('error');
      expect(await users.deleteAccount('u1', CONTRASENA)).toBe('error');
      expect(await users.suscripcionDe('u1')).toBeNull();
      expect(await users.planDeSuscripcion('sub_1', 'gratis', { soltar: true })).toBe('error');
      // Y recifrar no revienta: entrar no puede fallar por no mejorar cómo se guarda.
      await expect(users.recifrarContrasena('u1', 'x', CONTRASENA)).resolves.toBeUndefined();
    });
  });
});

describe('cambiar lo tuyo cuando la cuenta ya no está', () => {
  const NO_EXISTE = '00000000-0000-4000-8000-000000000000';

  it('cambiar el nombre de una cuenta que no existe devuelve nulo', () => {
    // Devuelve la fila y no un booleano porque quien llama tiene que contestarle
    // a una pantalla que está enseñando ese nombre.
    return expect(users.setName(NO_EXISTE, 'Otro')).resolves.toBeNull();
  });

  it('cambiar la contraseña de una que no existe es un error, no «no coincide»', async () => {
    // «No coincide» diría que la cuenta está y la contraseña no: dos cosas
    // distintas, y esa distinción es lo que evita usar esta ruta para saber qué
    // identificadores existen.
    expect((await users.changePassword(NO_EXISTE, CONTRASENA, CONTRASENA)).kind).toBe('error');
  });

  it('una contraseña nueva corta no llega a mirar nada', async () => {
    expect((await users.changePassword(NO_EXISTE, CONTRASENA, 'corta')).kind).toBe(
      'contrasena-corta',
    );
  });

  it('y una actual que no es ni una cadena no cuela', async () => {
    const creada = await users.createUser({
      mayorDe14: true,
      email: 'a@b.c',
      password: CONTRASENA,
    });
    const id = creada.kind === 'ok' ? creada.user.id : '';

    expect((await users.changePassword(id, 42, CONTRASENA)).kind).toBe('no-coincide');
  });
});

describe('lo que llega de fuera sin forma', () => {
  it('un correo que no es un correo no se busca siquiera', async () => {
    // `findUserWithPassword` recibe lo que venga del formulario de entrar, así
    // que le llega cualquier cosa.
    for (const raro of [null, undefined, 42, {}, '', 'sin arroba']) {
      expect(await users.findUserWithPassword(raro), JSON.stringify(raro)).toBeNull();
    }
  });

  it('borrar con algo que no es una contraseña no borra nada', async () => {
    const creada = await users.createUser({
      mayorDe14: true,
      email: 'a@b.c',
      password: CONTRASENA,
    });
    const id = creada.kind === 'ok' ? creada.user.id : '';

    expect(await users.deleteAccount(id, 42)).toBe('no-coincide');
    expect(await users.findUserById(id)).not.toBeNull();
  });

  it('borrar una cuenta que ya no esta es un error, no un ok', async () => {
    expect(await users.deleteAccount('00000000-0000-4000-8000-000000000000', CONTRASENA)).toBe(
      'error',
    );
  });

  it('cambiarle el plan a una cuenta que no existe se distingue de un fallo', async () => {
    // Lo que le importa al webhook es distinguir «esa cuenta ya no está» —no
    // reintentes— de «no se ha podido» —reintenta—.
    expect(await users.setPlan('00000000-0000-4000-8000-000000000000', 'basico')).toBe('no-existe');
  });
});
