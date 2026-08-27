import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lo que el navegador hace con la cuenta.
 *
 * No es un envoltorio de `fetch`: aquí se decide **qué se le dice a quien está
 * mirando** cuando algo sale mal, y esas frases son la mitad de la función. Un
 * «no hemos podido» genérico donde el servidor había explicado el motivo obliga a
 * adivinar; y al revés, dejar salir el error crudo del servidor cuenta cosas que
 * no son de nadie.
 *
 * `next-auth/react` se sustituye porque en Node no carga. Lo que se prueba es lo
 * de aquí: cuándo se llama, con qué, y qué se contesta según lo que pase.
 */

const signIn = vi.fn();
const signOut = vi.fn();

vi.mock('next-auth/react', () => ({
  signIn: (...a: unknown[]) => signIn(...a),
  signOut: (...a: unknown[]) => signOut(...a),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

const { signInWithPassword, registerAccount, signOutHere, updateAccount } =
  await import('./account');

/** Una respuesta de `fetch` como la que da el servidor. */
function respuesta(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchFalso = vi.fn();

beforeEach(() => {
  signIn.mockReset();
  signIn.mockResolvedValue({ error: null });
  signOut.mockReset();
  fetchFalso.mockReset();
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('entrar', () => {
  it('no recarga la página al entrar', async () => {
    // Una recarga completa perdería la tonalidad detectada y el micro abierto.
    await signInWithPassword('a@b.c', 'contrasena');

    expect(signIn).toHaveBeenCalledWith('credentials', {
      email: 'a@b.c',
      password: 'contrasena',
      redirect: false,
    });
  });

  it('el mensaje de error no dice cuál de los dos campos falló', async () => {
    // Decirlo convertiría la pantalla de entrar en un buscador de cuentas.
    signIn.mockResolvedValue({ error: 'CredentialsSignin' });

    const result = await signInWithPassword('a@b.c', 'mal');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).not.toMatch(/correo no existe|no registrado/i);
    expect(result.ok === false && result.message).toMatch(/correo o la contraseña/i);
  });

  it('si la red falla, lo dice sin culpar a las credenciales', async () => {
    signIn.mockRejectedValue(new Error('red'));

    const result = await signInWithPassword('a@b.c', 'contrasena');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/vuelve a intentarlo/i);
  });

  it('salir tampoco recarga', async () => {
    await signOutHere();

    expect(signOut).toHaveBeenCalledWith({ redirect: false });
  });
});

describe('registrarse', () => {
  it('crea la cuenta y entra con ella, que es lo que espera quien se registra', async () => {
    fetchFalso.mockResolvedValue(respuesta(201, { email: 'a@b.c' }));

    const result = await registerAccount('a@b.c', 'contrasenaLarga', 'Javi');

    expect(result.ok).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('el nombre solo viaja si lo hay', async () => {
    fetchFalso.mockResolvedValue(respuesta(201, {}));

    await registerAccount('a@b.c', 'contrasenaLarga');

    const enviado = JSON.parse((fetchFalso.mock.calls[0]![1] as { body: string }).body) as Record<
      string,
      unknown
    >;

    expect(enviado).not.toHaveProperty('name');
  });

  it('usa la frase que ha escrito el servidor, no una genérica', async () => {
    // El servidor ya sabe si el correo está repetido o si la contraseña es corta,
    // y su frase dice qué hacer. Sustituirla por un «no hemos podido» obliga a
    // adivinar.
    fetchFalso.mockResolvedValue(
      respuesta(409, { error: { message: 'Ese correo ya tiene cuenta.' } }),
    );

    const result = await registerAccount('a@b.c', 'contrasenaLarga');

    expect(result.message).toBe('Ese correo ya tiene cuenta.');
  });

  it('si el servidor falla sin explicarse, hay una frase de respaldo', async () => {
    fetchFalso.mockResolvedValue(new Response('vaya', { status: 500 }));

    const result = await registerAccount('a@b.c', 'contrasenaLarga');

    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('si la cuenta se crea pero no se puede entrar, se dice tal cual', async () => {
    // Es un caso raro y confuso: la cuenta existe. Decir «no hemos podido crear
    // la cuenta» haría que se intentara otra vez y saliera «ya existe».
    fetchFalso.mockResolvedValue(respuesta(201, {}));
    signIn.mockResolvedValue({ error: 'algo' });

    const result = await registerAccount('a@b.c', 'contrasenaLarga');

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/creada/i);
  });

  it('sin red, lo dice', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));

    expect((await registerAccount('a@b.c', 'contrasenaLarga')).ok).toBe(false);
  });
});

describe('cambiar lo tuyo', () => {
  it('lo que no se manda no se toca', async () => {
    // Mandar `name: ''` sí borra el nombre —vacío es «no lo he dicho»— y no
    // mandarlo lo deja como estaba. Son dos cosas distintas a propósito.
    fetchFalso.mockResolvedValue(respuesta(200, {}));

    await updateAccount({ passwordActual: 'a', passwordNueva: 'bbbbbbbb' });

    const enviado = JSON.parse((fetchFalso.mock.calls[0]![1] as { body: string }).body) as Record<
      string,
      unknown
    >;

    expect(enviado).not.toHaveProperty('name');
    expect(enviado).toHaveProperty('passwordNueva');
  });

  it('usa la frase del servidor cuando la hay', async () => {
    fetchFalso.mockResolvedValue(
      respuesta(403, { error: { message: 'La contraseña actual no es esa.' } }),
    );

    const result = await updateAccount({ passwordActual: 'mal', passwordNueva: 'bbbbbbbb' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe('La contraseña actual no es esa.');
  });

  it('y una de respaldo cuando no', async () => {
    fetchFalso.mockResolvedValue(new Response('', { status: 500 }));

    const result = await updateAccount({ name: 'Otro' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBeTruthy();
  });

  it('sin red, no se queda callado', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));

    expect((await updateAccount({ name: 'Otro' })).ok).toBe(false);
  });
});
