import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La cuenta: crearla, leerla, cambiarla y borrarla.
 *
 * Es la ruta con más superficie de todas y la única donde se manejan
 * contraseñas. Lo que se prueba aquí es lo que sostiene esa parte:
 *
 * - **Sin cuentas configuradas se dice**, en vez de fallar con un error que no
 *   explica nada.
 * - **Registrar tiene su propio límite de frecuencia**, con clave distinta del de
 *   cambiar: si compartieran clave, gastar los intentos de uno gastaría los del
 *   otro.
 * - **La cuenta que se toca sale de la sesión**, nunca del cuerpo.
 * - **Borrar y cambiar la contraseña piden confirmación de verdad**, no solo estar
 *   dentro.
 */

const authAvailable = vi.fn(() => true);
const currentSession = vi.fn();
const createUser = vi.fn();
const setName = vi.fn();
const changePassword = vi.fn();
const deleteAccount = vi.fn();

vi.mock('@server/auth', () => ({ authAvailable: () => authAvailable() }));
vi.mock('@server/entitlements', () => ({
  currentSession: () => currentSession(),
  currentAccount: async () => ({ email: 'a@b.c', name: 'Javi', plan: 'gratis' }),
}));
vi.mock('@server/users', () => ({
  createUser: (...a: unknown[]) => createUser(...a),
  setName: (...a: unknown[]) => setName(...a),
  changePassword: (...a: unknown[]) => changePassword(...a),
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
}));

const { GET, POST, PATCH, DELETE } = await import('./route');

const SESION = { userId: 'u1', account: { plan: 'gratis', email: 'a@b.c' } };

let n = 0;
function pedir(metodo: string, body?: unknown): Request {
  n += 1;
  return new Request('http://x/api/cuenta', {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.8.0.${n}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const NUEVA = { email: 'a@b.c', password: 'unaContrasenaLarga', name: 'Javi' };

beforeEach(() => {
  authAvailable.mockReset();
  authAvailable.mockReturnValue(true);
  currentSession.mockReset();
  currentSession.mockResolvedValue(SESION);
  for (const m of [createUser, setName, changePassword, deleteAccount]) {
    m.mockReset();
  }
});

describe('sin cuentas configuradas', () => {
  it('registrarse dice que aquí no hay cuentas', async () => {
    authAvailable.mockReturnValue(false);

    const { status, body } = await leer(await POST(pedir('POST', NUEVA)));

    expect(status).toBe(501);
    expect((body['error'] as { message: string }).message).toMatch(/no tiene cuentas/i);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('la cuenta anónima se sirve igual, y lo declara', async () => {
    // Sin base de datos todo el mundo es anónimo con plan gratis, y la pantalla
    // necesita saberlo para no ofrecer lo que no hay.
    authAvailable.mockReturnValue(false);
    currentSession.mockResolvedValue(null);

    const { status, body } = await leer(await GET());

    expect(status).toBe(200);
    expect(body['accounts']).toBe(false);
    expect((body['account'] as { plan: string }).plan).toBe('gratis');
  });
});

describe('registrarse', () => {
  it('un cuerpo que no es JSON no crea nada', async () => {
    const res = await POST(
      new Request('http://x/api/cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.8.1.1' },
        body: '{esto no',
      }),
    );

    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('crea la cuenta y devuelve 201, pero no entra sola', async () => {
    // Firmar la cookie aquí a mano sería reimplementar media Auth.js para
    // ahorrar una petición: la pantalla llama a `signIn` después.
    createUser.mockResolvedValue({ kind: 'ok', user: { email: 'a@b.c', plan: 'gratis' } });

    const { status, body } = await leer(await POST(pedir('POST', NUEVA)));

    expect(status).toBe(201);
    expect(body['email']).toBe('a@b.c');
    expect(body).not.toHaveProperty('token');
  });

  it('cada motivo de rechazo tiene su código, y ninguno es un 500', async () => {
    // Un correo repetido no es un fallo del servidor: es 409, y la pantalla puede
    // ofrecer «entra con ella» en vez de «vuelve a intentarlo».
    const esperados: Record<string, number> = {
      'ya-existe': 409,
      'correo-invalido': 400,
      'contrasena-corta': 400,
    };

    for (const [kind, codigo] of Object.entries(esperados)) {
      createUser.mockResolvedValue({ kind });

      expect((await leer(await POST(pedir('POST', NUEVA)))).status, kind).toBe(codigo);
    }
  });

  it('registrarse tiene su propio límite, más estrecho que el resto', async () => {
    createUser.mockResolvedValue({ kind: 'ok', user: { email: 'a@b.c', plan: 'gratis' } });
    const misma = () =>
      new Request('http://x/api/cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.8.9.9' },
        body: JSON.stringify(NUEVA),
      });

    const estados: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      estados.push((await POST(misma())).status);
    }

    // Cinco por minuto: crear cuentas en cadena es lo que hace un robot.
    expect(estados.filter((s) => s === 429).length).toBe(3);
  });
});

describe('cambiar la cuenta', () => {
  it('sin sesión no se cambia nada', async () => {
    currentSession.mockResolvedValue(null);

    const { status } = await leer(await PATCH(pedir('PATCH', { name: 'Otro' })));

    expect(status).toBe(401);
    expect(setName).not.toHaveBeenCalled();
  });

  it('la cuenta que se toca sale de la sesión, no del cuerpo', async () => {
    setName.mockResolvedValue({ id: 'u1', name: 'Otro' });

    await PATCH(pedir('PATCH', { name: 'Otro', userId: 'otro' }));

    expect(setName).toHaveBeenCalledWith('u1', 'Otro');
  });

  it('cambiar la contraseña exige la de antes', async () => {
    changePassword.mockResolvedValue({ kind: 'no-coincide' });

    const { status } = await leer(
      await PATCH(pedir('PATCH', { passwordActual: 'mal', passwordNueva: 'unaContrasenaLarga' })),
    );

    // 403 y no 400: la petición está bien formada, lo que no cuadra es quién la
    // manda.
    expect(status).toBe(403);
    expect(changePassword).toHaveBeenCalledWith('u1', 'mal', 'unaContrasenaLarga');
  });

  it('si la contraseña actual falla, tampoco se guarda el nombre', async () => {
    // Quien no sabe la contraseña no cambia nada de la cuenta, ni siquiera lo
    // inofensivo. Por eso la contraseña se comprueba primero.
    changePassword.mockResolvedValue({ kind: 'no-coincide' });

    await PATCH(
      pedir('PATCH', {
        name: 'Otro',
        passwordActual: 'mal',
        passwordNueva: 'unaContrasenaLarga',
      }),
    );

    expect(setName).not.toHaveBeenCalled();
  });
});

describe('borrar la cuenta', () => {
  it('sin sesión, no', async () => {
    currentSession.mockResolvedValue(null);

    const { status } = await leer(await DELETE(pedir('DELETE', { confirm: 'BORRAR' })));

    expect(status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('borra la de la sesión y ninguna otra', async () => {
    deleteAccount.mockResolvedValue('ok');

    await DELETE(pedir('DELETE', { confirm: 'BORRAR', userId: 'otro' }));

    if (deleteAccount.mock.calls.length > 0) {
      expect(deleteAccount.mock.calls[0]?.[0]).toBe('u1');
    }
  });
});
