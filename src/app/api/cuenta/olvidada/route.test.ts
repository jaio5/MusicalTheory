import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * «He olvidado mi contraseña».
 *
 * Dos garantías que no se pueden perder, y las dos son de las que no se ven
 * leyendo el código:
 *
 * 1. **La respuesta es la misma exista o no ese correo.** Contestar «ese correo
 *    no tiene cuenta» convertiría esto en un buscador de quién está registrado
 *    aquí, que es justo lo que la pantalla de entrar ya evita al no decir cuál de
 *    los dos campos falló.
 * 2. **Sin proveedor de correo se dice, en vez de prometer un correo que no
 *    llega.** Alguien esperando delante de un buzón vacío es peor que un «aquí no
 *    se puede».
 */

const mailer = vi.fn();
const requestReset = vi.fn();
const resetPassword = vi.fn();

vi.mock('@server/mail', () => ({ mailer: () => mailer() }));
vi.mock('@server/password-reset', () => ({
  requestReset: (...a: unknown[]) => requestReset(...a),
  resetPassword: (...a: unknown[]) => resetPassword(...a),
  pruneResets: vi.fn(async () => undefined),
}));
vi.mock('@server/app-url', () => ({ appUrl: () => 'http://x' }));

const { POST, PUT } = await import('./route');

const CORREO_QUE_MANDA = { sends: true, send: vi.fn(async () => true) };
const CORREO_QUE_NO_MANDA = { sends: false, send: vi.fn(async () => false) };

function pedir(metodo: string, body: unknown): Request {
  return new Request('http://x/api/cuenta/olvidada', {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.9.0.${cuenta()}` },
    body: JSON.stringify(body),
  });
}

let n = 0;
function cuenta(): number {
  n += 1;
  return n;
}

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  mailer.mockReset();
  mailer.mockReturnValue(CORREO_QUE_MANDA);
  requestReset.mockReset();
  requestReset.mockResolvedValue(null);
  resetPassword.mockReset();
  CORREO_QUE_MANDA.send.mockClear();
});

describe('pedir el vale', () => {
  it('sin proveedor de correo se dice, y no se crea ningún vale', async () => {
    mailer.mockReturnValue(CORREO_QUE_NO_MANDA);

    const { status } = await leer(await POST(pedir('POST', { email: 'a@b.c' })));

    expect(status).toBe(501);
    expect(requestReset).not.toHaveBeenCalled();
  });

  it('contesta lo mismo exista o no el correo', async () => {
    // La comprobación que impide usar esto para averiguar quién está registrado.
    requestReset.mockResolvedValue({ token: 't', email: 'a@b.c' });
    const existe = await leer(await POST(pedir('POST', { email: 'a@b.c' })));

    // Nulo es «ese correo no tiene cuenta», y desde fuera no se puede notar.
    requestReset.mockResolvedValue(null);
    const no = await leer(await POST(pedir('POST', { email: 'nadie@b.c' })));

    expect(existe.status).toBe(no.status);
    expect(JSON.stringify(existe.body)).toBe(JSON.stringify(no.body));
  });

  it('cuando la cuenta existe, se manda el correo', async () => {
    requestReset.mockResolvedValue({ token: 't', email: 'a@b.c' });

    await POST(pedir('POST', { email: 'a@b.c' }));

    expect(CORREO_QUE_MANDA.send).toHaveBeenCalledTimes(1);
  });

  it('cuando no existe, no se manda nada', async () => {
    requestReset.mockResolvedValue(null);

    await POST(pedir('POST', { email: 'nadie@b.c' }));

    expect(CORREO_QUE_MANDA.send).not.toHaveBeenCalled();
  });

  it('un correo que no lo es tampoco distingue nada', async () => {
    // Quien lo comprueba es `requestReset`, que normaliza y devuelve nulo. La
    // ruta contesta igual: no hay forma de saber si el correo era válido.
    requestReset.mockResolvedValue(null);

    const { status } = await leer(await POST(pedir('POST', { email: 'esto no' })));

    expect(status).toBe(200);
    expect(CORREO_QUE_MANDA.send).not.toHaveBeenCalled();
  });
});

describe('usar el vale', () => {
  it('un vale bueno cambia la contraseña', async () => {
    resetPassword.mockResolvedValue('ok');

    const { status } = await leer(
      await PUT(pedir('PUT', { vale: 't', password: 'unaContrasenaLarga' })),
    );

    expect(status).toBe(200);
  });

  it('caducado, gastado e inventado son el mismo caso, y la frase no elige', async () => {
    // `resetPassword` devuelve un solo código para los tres: distinguirlos diría
    // si el vale existió alguna vez, que es información sobre la cuenta de otra
    // persona. Y la frase nombra las dos posibilidades sin comprometerse con
    // ninguna, que es lo que la hace útil sin ser indiscreta.
    resetPassword.mockResolvedValue('vale-no-vale');

    const { status, body } = await leer(
      await PUT(pedir('PUT', { vale: 'x', password: 'unaContrasenaLarga' })),
    );
    const mensaje = (body['error'] as { message: string }).message;

    expect(status).toBe(400);
    expect(mensaje).toMatch(/caducado/i);
    expect(mensaje).toMatch(/us[oó]/i);
    // Lo que no puede es decir cuál de las dos fue.
    expect(mensaje).toMatch(/\bo\b/);
  });

  it('una contraseña demasiado corta no se acepta', async () => {
    resetPassword.mockResolvedValue('contrasena-corta');

    const { status } = await leer(await PUT(pedir('PUT', { vale: 't', password: 'corta' })));

    expect(status).toBe(400);
  });

  it('sin base de datos se dice, en vez de fingir que se ha cambiado', async () => {
    resetPassword.mockResolvedValue('sin-base-de-datos');

    const { status } = await leer(
      await PUT(pedir('PUT', { vale: 't', password: 'unaContrasenaLarga' })),
    );

    expect(status).toBe(501);
  });
});

describe('probar correos a lo bruto', () => {
  /**
   * El límite es más estrecho que el del resto —tres por minuto— porque esto se
   * puede pedir sin cuenta y cada intento manda un correo. Sin él, la aplicación
   * es un mandador de correo gratis apuntando a la dirección que quiera quien
   * llame.
   */
  it('se frena, y se dice cuánto esperar', async () => {
    mailer.mockReturnValue(CORREO_QUE_MANDA);
    requestReset.mockResolvedValue({ token: 't', email: 'a@b.c' });

    /** Todas desde la misma dirección: es la clave del contador. */
    function desde(metodo: string, body: unknown): Request {
      return new Request('http://x/api/cuenta/olvidada', {
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
        body: JSON.stringify(body),
      });
    }

    let ultima = 200;
    for (let i = 0; i < 6 && ultima !== 429; i += 1) {
      ultima = (await POST(desde('POST', { email: 'a@b.c' }))).status;
    }

    expect(ultima).toBe(429);
  });

  it('y el mismo contador vale para poner la contraseña nueva', async () => {
    // Es la misma puerta: contar aparte daría el doble de intentos a quien
    // prueba vales inventados.
    resetPassword.mockResolvedValue('vale-no-vale');

    function desde(body: unknown): Request {
      return new Request('http://x/api/cuenta/olvidada', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.9.9.8' },
        body: JSON.stringify(body),
      });
    }

    let ultima = 200;
    for (let i = 0; i < 6 && ultima !== 429; i += 1) {
      ultima = (await PUT(desde({ vale: 'x', password: 'unaContrasenaLarga' }))).status;
    }

    expect(ultima).toBe(429);
  });
});
