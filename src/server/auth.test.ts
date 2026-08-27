import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as Auth from './auth';
import type * as Users from './users';

/**
 * Entrar y salir.
 *
 * Auth.js no se ejecuta —eso pide un servidor de Next entero— pero **la
 * configuración que se le pasa sí**, y ahí es donde están las decisiones de este
 * fichero: comprobar la contraseña también cuando el correo no existe, no decir
 * cuál de los dos campos falló, y meter en la cookie la versión de la sesión pero
 * no el plan.
 *
 * El truco es quedarse con el objeto que recibe `NextAuth` y llamar a sus
 * funciones a mano. Lo que hay debajo de ellas —contraseñas, base de datos— es de
 * verdad.
 */

let configuracion: Record<string, never>;
const authFalso = vi.fn();

vi.mock('next-auth', () => ({
  default: (config: Record<string, never>) => {
    configuracion = config;
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: () => authFalso() };
  },
}));

// El proveedor de credenciales devuelve sus propias opciones, que es lo que hay
// que poder llamar.
vi.mock('next-auth/providers/credentials', () => ({
  default: (opciones: unknown) => opciones,
}));

let base: BaseDePrueba;
let auth: typeof Auth;
let users: typeof Users;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  process.env['AUTH_SECRET'] = 'un-secreto-de-prueba';
  auth = await import('./auth');
  users = await import('./users');
});

afterAll(async () => {
  delete process.env['AUTH_SECRET'];
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  authFalso.mockReset();
  authFalso.mockResolvedValue(null);
});

/** El `authorize` del proveedor de correo y contraseña. */
function autorizar(credenciales: Record<string, unknown>) {
  const proveedor = (
    configuracion['providers'] as unknown as {
      authorize: (raw: unknown) => Promise<unknown>;
    }[]
  )[0]!;
  return proveedor.authorize(credenciales);
}

function callbacks() {
  return configuracion['callbacks'] as unknown as {
    jwt: (a: { token: Record<string, unknown>; user?: Record<string, unknown> }) => unknown;
    session: (a: { session: Record<string, unknown>; token: Record<string, unknown> }) => never;
  };
}

describe('si esta copia tiene cuentas', () => {
  it('hacen falta las dos cosas: base de datos y secreto', () => {
    expect(auth.authAvailable()).toBe(true);

    delete process.env['AUTH_SECRET'];
    expect(auth.authAvailable()).toBe(false);

    process.env['AUTH_SECRET'] = '';
    expect(auth.authAvailable()).toBe(false);

    process.env['AUTH_SECRET'] = 'un-secreto-de-prueba';
  });
});

describe('la configuracion que recibe Auth.js', () => {
  it('la sesion va en cookie firmada, sin tabla de sesiones', () => {
    expect(configuracion['session']).toEqual({ strategy: 'jwt' });
  });

  it('se fia del anfitrion, porque detras hay un proxy', () => {
    // La cabecera del anfitrión la pone el proxy con certificado, y sin esto
    // Auth.js no se la cree.
    expect(configuracion['trustHost']).toBe(true);
  });
});

describe('entrar con correo y contraseña', () => {
  it('con las dos buenas, entra y se lleva la version de la sesion', async () => {
    const creada = await users.createUser({
      email: 'a@b.c',
      password: 'unaContrasenaLarga',
      name: 'Javi',
    });
    if (creada.kind !== 'ok') {
      throw new Error(creada.kind);
    }

    const entrada = (await autorizar({
      email: 'a@b.c',
      password: 'unaContrasenaLarga',
    })) as Record<string, unknown>;

    expect(entrada['id']).toBe(creada.user.id);
    expect(entrada['name']).toBe('Javi');
    // Cuando alguien cambie la contraseña, la de la fila subirá y esta cookie
    // dejará de cuadrar: eso es echar a las demás sesiones.
    expect(entrada['sessionVersion']).toBe(creada.user.sessionVersion);
  });

  it('con la contraseña mal, no entra', async () => {
    await users.createUser({ email: 'a@b.c', password: 'unaContrasenaLarga' });

    expect(await autorizar({ email: 'a@b.c', password: 'otraCosa' })).toBeNull();
  });

  it('con un correo que no existe, tampoco', async () => {
    expect(await autorizar({ email: 'nadie@b.c', password: 'unaContrasenaLarga' })).toBeNull();
  });

  it('sin credenciales, tampoco, y no revienta', async () => {
    expect(await autorizar({})).toBeNull();
    expect(await autorizar({ email: 42, password: null })).toBeNull();
  });

  it('un correo desconocido tarda lo mismo que uno conocido', async () => {
    // Sin la contraseña cifrada que no es de nadie, entrar con un correo
    // desconocido contesta en un milisegundo y entrar con uno conocido tarda
    // cien: la diferencia se mide desde fuera y regala una lista de quién tiene
    // cuenta aquí. El margen es holgado a propósito —esto mide un reloj de
    // pared en un CI compartido— y aun así pilla la diferencia de dos ordenes de
    // magnitud que hay entre comprobar un `scrypt` y no comprobar nada.
    await users.createUser({ email: 'a@b.c', password: 'unaContrasenaLarga' });

    const empiezaConocido = performance.now();
    await autorizar({ email: 'a@b.c', password: 'mal' });
    const conocido = performance.now() - empiezaConocido;

    const empiezaDesconocido = performance.now();
    await autorizar({ email: 'nadie@b.c', password: 'mal' });
    const desconocido = performance.now() - empiezaDesconocido;

    expect(desconocido).toBeGreaterThan(conocido / 5);
  });
});

describe('lo que va en la cookie', () => {
  it('el identificador y la version, y el plan no', async () => {
    // Una cookie se firma una vez y dura días; el plan cambia en el momento en
    // que alguien lo cambia. Si el plan fuese dentro, quien acaba de pagar
    // seguiría viendo candados.
    const token = callbacks().jwt({
      token: {},
      user: { id: 'u1', sessionVersion: 3, plan: 'pro' },
    }) as Record<string, unknown>;

    expect(token['sub']).toBe('u1');
    expect(token['sv']).toBe(3);
    expect(token).not.toHaveProperty('plan');
  });

  it('sin usuario, el token se deja como estaba', () => {
    // Pasa en cada petición posterior a la de entrar: el `user` solo viene la
    // primera vez.
    expect(callbacks().jwt({ token: { sub: 'u1', sv: 3 } })).toEqual({ sub: 'u1', sv: 3 });
  });

  it('una cookie sin version cuenta como cero', () => {
    // Las cuentas que nunca han cambiado la contraseña tienen cero, así que
    // nadie se queda fuera por haber entrado el día antes del despliegue.
    const session = callbacks().session({ session: { user: {} }, token: { sub: 'u1' } });

    expect((session['user'] as Record<string, unknown>)['sessionVersion']).toBe(0);
  });

  it('la sesion lleva el identificador y la version', () => {
    const session = callbacks().session({
      session: { user: { email: 'a@b.c' } },
      token: { sub: 'u1', sv: 7 },
    });

    expect(session['user']).toMatchObject({ id: 'u1', sessionVersion: 7, email: 'a@b.c' });
  });

  it('sin identificador en el token, la sesion pasa tal cual', () => {
    const session = { user: {} };

    expect(callbacks().session({ session, token: {} })).toBe(session);
  });
});

describe('quien pide', () => {
  it('sin cuentas configuradas, nadie', async () => {
    delete process.env['AUTH_SECRET'];

    expect(await auth.currentCookie()).toBeNull();

    process.env['AUTH_SECRET'] = 'un-secreto-de-prueba';
  });

  it('sin haber entrado, nadie', async () => {
    expect(await auth.currentCookie()).toBeNull();
  });

  it('con sesion, el identificador y la version', async () => {
    authFalso.mockResolvedValue({ user: { id: 'u1', sessionVersion: 4 } });

    expect(await auth.currentCookie()).toEqual({ id: 'u1', sessionVersion: 4 });
  });

  it('una cookie firmada con otro secreto es como no haber entrado', async () => {
    // Pasa al cambiar `AUTH_SECRET`. Que reviente la petición entera por eso
    // sería dejar sin aplicación a quien solo tiene una cookie vieja.
    authFalso.mockRejectedValue(new Error('JWTSessionError'));

    expect(await auth.currentCookie()).toBeNull();
  });
});
