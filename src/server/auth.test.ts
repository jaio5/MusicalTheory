import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEMASIADOS_INTENTOS } from '@core/auth-errors';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as Auth from './auth';
import type * as Password from './password';
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

// Las contraseñas de verdad, con un espía en lo que iguala el coste: así se ve si
// entrar lo llama sin medir tiempos, que en un CI compartido no dicen nada.
const igualarCoste = vi.fn<(stored: string) => Promise<number>>();
vi.mock('./password', async (original) => {
  const real = await original<typeof Password>();
  igualarCoste.mockImplementation(real.igualarCoste);
  return { ...real, igualarCoste: (stored: string) => igualarCoste(stored) };
});

vi.mock('next-auth', () => ({
  default: (config: Record<string, never>) => {
    configuracion = config;
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: () => authFalso() };
  },
  // **La clase se trae de verdad**, no una copia: es la que Auth.js reconoce para
  // dejar pasar su `code` hasta el cliente, y una imitación no lo sería.
  CredentialsSignin: class extends Error {
    code = 'credentials';
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
  // Como detrás de un proxy: sin esto no se cree `X-Forwarded-For` y todas las
  // peticiones de estos tests compartirían dirección.
  process.env['TRUSTED_PROXY_HOPS'] = '1';
  auth = await import('./auth');
  users = await import('./users');
});

afterAll(async () => {
  delete process.env['AUTH_SECRET'];
  delete process.env['TRUSTED_PROXY_HOPS'];
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  authFalso.mockReset();
  authFalso.mockResolvedValue(null);
});

/**
 * El `authorize` del proveedor de correo y contraseña.
 *
 * La petición se puede dar o no: sin ella el tope cuenta solo por correo, que es
 * lo que hace el código si Auth.js algún día no la pasara.
 */
function autorizar(credenciales: Record<string, unknown>, request?: Request) {
  const proveedor = (
    configuracion['providers'] as unknown as {
      authorize: (raw: unknown, request?: Request) => Promise<unknown>;
    }[]
  )[0]!;
  return proveedor.authorize(credenciales, request);
}

/** Una petición desde esa dirección, que es lo que mira el tope. */
function desde(ip: string): Request {
  return new Request('https://ejemplo.test/api/auth/callback/credentials', {
    headers: { 'x-forwarded-for': ip },
  });
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

/**
 * **El tope de intentos, que no existía.**
 *
 * Lo tenían el registro, el cambio de cuenta y las tres rutas de IA, y entrar no.
 * Contra probar contraseñas solo estaba el coste de `scrypt`, y eso es el problema
 * al revés: cada intento cuesta cien milisegundos de procesador nuestros y nada de
 * quien lo prueba ([adr/0054](../../docs/adr/0054-entrar-tiene-tope-de-intentos.md)).
 */
describe('el tope de intentos al entrar', () => {
  const CORREO = 'topes@ejemplo.test';

  /** Prueba a entrar con la contraseña mal, tantas veces. */
  async function fallar(veces: number, request?: Request) {
    const salidas: unknown[] = [];
    for (let i = 0; i < veces; i += 1) {
      salidas.push(
        await autorizar({ email: CORREO, password: 'la-que-no-es' }, request).catch(
          (fallo: unknown) => fallo,
        ),
      );
    }
    return salidas;
  }

  it('a la sexta deja de comprobar y lo dice con su codigo', async () => {
    const salidas = await fallar(6, desde('10.0.0.1'));

    // Las cinco primeras contestan que no cuadra; la sexta ya no comprueba.
    expect(salidas.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(salidas[5]).toMatchObject({ code: DEMASIADOS_INTENTOS });
  });

  /**
   * **Y no deja entrar aunque la contraseña sea la buena.** Es la mitad que de
   * verdad para el ataque: si al pasarse de intentos siguiera comprobando, el tope
   * solo molestaría a quien se equivoca.
   */
  it('pasado el tope, no entra ni con la contraseña buena', async () => {
    await users.createUser({ email: CORREO, password: 'la-buena-de-verdad' });
    await fallar(5, desde('10.0.0.2'));

    await expect(
      autorizar({ email: CORREO, password: 'la-buena-de-verdad' }, desde('10.0.0.2')),
    ).rejects.toMatchObject({ code: DEMASIADOS_INTENTOS });
  });

  /**
   * **Cinco intentos ajenos no te dejan fuera.** Con el tope contado solo por
   * correo, cualquiera que supiera el tuyo te tenía esperando un minuto, todos los
   * minutos que quisiera. La clave estrecha es correo y dirección: lo que gasta
   * quien prueba desde su casa no lo pagas tú desde la tuya.
   */
  it('lo que falla otro desde otra direccion no te cierra la puerta', async () => {
    await users.createUser({ email: CORREO, password: 'la-buena-de-verdad' });
    await fallar(6, desde('10.0.1.1'));

    await expect(
      autorizar({ email: CORREO, password: 'la-buena-de-verdad' }, desde('10.0.1.99')),
    ).resolves.toMatchObject({ email: CORREO });
  });

  /**
   * **Y repartir los intentos entre muchas direcciones lo para el tope del
   * correo**, que es más ancho —treinta en un cuarto de hora— para que no sirva
   * para lo de arriba.
   */
  it('cambiar de direccion en cada intento acaba en el tope del correo', async () => {
    for (let i = 0; i < 30; i += 1) {
      expect(await autorizar({ email: CORREO, password: 'no' }, desde(`10.0.4.${i}`))).toBeNull();
    }

    await expect(
      autorizar({ email: CORREO, password: 'no' }, desde('10.0.4.200')),
    ).rejects.toMatchObject({ code: DEMASIADOS_INTENTOS });
  }, 30_000);

  // Y probar muchas cuentas desde un sitio lo para la dirección sola.
  it('probar veinte cuentas desde la misma direccion para a la veintiuna', async () => {
    for (let i = 0; i < 20; i += 1) {
      expect(
        await autorizar({ email: `c${i}@ejemplo.test`, password: 'no' }, desde('10.0.5.1')),
      ).toBeNull();
    }

    await expect(
      autorizar({ email: 'c99@ejemplo.test', password: 'no' }, desde('10.0.5.1')),
    ).rejects.toMatchObject({ code: DEMASIADOS_INTENTOS });
  }, 30_000);

  it('sin peticion, sigue contando por correo', async () => {
    await fallar(5);

    await expect(autorizar({ email: CORREO, password: 'no' })).rejects.toMatchObject({
      code: DEMASIADOS_INTENTOS,
    });
  });

  // Y el tope de una cuenta no cierra la puerta a otra: si no, bastaría con probar
  // cinco veces para dejar sin entrar a quien tú quisieras.
  it('el tope de una cuenta no afecta a otra', async () => {
    await users.createUser({ email: 'otra@ejemplo.test', password: 'la-suya-buena' });
    await fallar(5, desde('10.0.2.1'));

    await expect(
      autorizar({ email: 'otra@ejemplo.test', password: 'la-suya-buena' }, desde('10.0.2.9')),
    ).resolves.toMatchObject({ email: 'otra@ejemplo.test' });
  });

  // El mismo correo en mayúsculas es el mismo cupo: si no, alternar mayúsculas
  // multiplicaría los intentos por cuenta.
  it('las mayusculas del correo no dan otro cupo', async () => {
    await fallar(5, desde('10.0.3.1'));

    await expect(
      autorizar({ email: CORREO.toUpperCase(), password: 'no' }, desde('10.0.3.1')),
    ).rejects.toMatchObject({ code: DEMASIADOS_INTENTOS });
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

describe('las contraseñas cifradas con los parámetros de antes', () => {
  /**
   * Al subir el coste de `scrypt` lo guardado no se invalida —cada fila lleva sus
   * parámetros—, pero tampoco mejora solo. Entrar es el único momento en que se
   * tiene la contraseña en claro, así que es ahí donde se vuelve a cifrar.
   */
  it('al entrar se vuelven a cifrar con los de hoy, sin echar a nadie', async () => {
    const creada = await users.createUser({ email: 'vieja@b.c', password: 'unaContrasenaLarga' });
    if (creada.kind !== 'ok') {
      throw new Error(creada.kind);
    }
    const { scryptSync } = await import('node:crypto');
    const sal = Buffer.from('sal de las viejas');
    const clave = scryptSync('unaContrasenaLarga', sal, 64, { N: 16_384, r: 8, p: 1 });
    const vieja = ['scrypt', 16_384, 8, 1, sal.toString('base64'), clave.toString('base64')].join(
      '$',
    );
    await base.ejecutar(`update users set password_hash = '${vieja}' where email = 'vieja@b.c'`);

    const entrada = await autorizar({ email: 'vieja@b.c', password: 'unaContrasenaLarga' });

    expect(entrada).toMatchObject({ email: 'vieja@b.c', sessionVersion: 0 });
    const ahora = await users.findUserWithPassword('vieja@b.c');
    expect(ahora?.passwordHash.startsWith('scrypt$16384$8$5$')).toBe(true);
    expect(ahora?.user.sessionVersion).toBe(0);
    // Y sigue entrando con la misma.
    await expect(
      autorizar({ email: 'vieja@b.c', password: 'unaContrasenaLarga' }),
    ).resolves.toMatchObject({ email: 'vieja@b.c' });
  });
});

/**
 * **El tiempo al entrar delataba las cuentas viejas.** Con la contraseña mal, una
 * cuenta cifrada con `p=1` contestaba en 31 ms y una de hoy, o un correo que no
 * existe, en 119: la diferencia decía qué correos tienen cuenta desde hace tiempo.
 */
describe('fallar tarda lo mismo con una cuenta vieja', () => {
  async function cuentaVieja(): Promise<string> {
    await users.createUser({ email: 'vieja@b.c', password: 'unaContrasenaLarga' });
    const { scryptSync } = await import('node:crypto');
    const sal = Buffer.from('sal de las viejas');
    const clave = scryptSync('unaContrasenaLarga', sal, 64, { N: 16_384, r: 8, p: 1 });
    const vieja = ['scrypt', 16_384, 8, 1, sal.toString('base64'), clave.toString('base64')].join(
      '$',
    );
    await base.ejecutar(`update users set password_hash = '${vieja}' where email = 'vieja@b.c'`);
    return vieja;
  }

  beforeEach(() => {
    igualarCoste.mockClear();
  });

  it('con la contraseña mal, se deriva lo que le falta para costar lo de hoy', async () => {
    const vieja = await cuentaVieja();

    expect(await autorizar({ email: 'vieja@b.c', password: 'mal' }, desde('10.0.9.1'))).toBeNull();

    expect(igualarCoste).toHaveBeenCalledWith(vieja);
    await expect(igualarCoste.mock.results[0]?.value).resolves.toBe(4);
  });

  it('con una de hoy, o un correo que no existe, no hace falta nada más', async () => {
    await users.createUser({ email: 'nueva@b.c', password: 'unaContrasenaLarga' });

    await autorizar({ email: 'nueva@b.c', password: 'mal' }, desde('10.0.9.2'));
    await autorizar({ email: 'nadie@b.c', password: 'mal' }, desde('10.0.9.3'));

    for (const resultado of igualarCoste.mock.results) {
      await expect(resultado.value).resolves.toBe(0);
    }
    expect(igualarCoste).toHaveBeenCalledTimes(2);
  });

  it('con la buena no se iguala: entrar ya vuelve a cifrar, y eso cuesta lo de hoy', async () => {
    await cuentaVieja();

    await autorizar({ email: 'vieja@b.c', password: 'unaContrasenaLarga' }, desde('10.0.9.4'));

    expect(igualarCoste).not.toHaveBeenCalled();
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
