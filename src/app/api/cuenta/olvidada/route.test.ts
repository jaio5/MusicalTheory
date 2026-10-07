import type * as NextServer from 'next/server';
import type * as RateLimitDb from '@server/rate-limit-db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

// El limitador de verdad, con un espía delante para ver con qué clave cuenta.
const clavesDelTope: string[] = [];
vi.mock('@server/rate-limit-db', async (original) => {
  const real = await original<typeof RateLimitDb>();
  return {
    ...real,
    limitRequest: (input: Parameters<typeof real.limitRequest>[0]) => {
      clavesDelTope.push(input.key);
      return real.limitRequest(input);
    },
  };
});

/**
 * `after` de Next, a mano: guarda lo que se deja para después de contestar, y el
 * test decide cuándo esperarlo. Así se ve que la respuesta no espera al correo.
 */
const pendientes: Promise<unknown>[] = [];
vi.mock('next/server', async (original) => ({
  ...(await original<typeof NextServer>()),
  after: (trabajo: () => Promise<unknown>) => {
    pendientes.push(Promise.resolve().then(trabajo));
  },
}));

async function despuesDeContestar(): Promise<void> {
  await Promise.all(pendientes.splice(0));
}

// Como detrás de un proxy: si no, no se cree `X-Forwarded-For` y todas las
// peticiones de aquí compartirían dirección.
process.env['TRUSTED_PROXY_HOPS'] = '1';
afterAll(() => {
  delete process.env['TRUSTED_PROXY_HOPS'];
});

const { POST, PUT } = await import('./route');

const CORREO_QUE_MANDA = { sends: true, send: vi.fn(async () => true) };
const CORREO_QUE_NO_MANDA = { sends: false, send: vi.fn(async () => false) };

function pedir(metodo: string, body: unknown): Request {
  // Cada petición con su dirección y, si no se dice, su correo: los dos topes
  // tienen sus propios tests abajo.
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
  CORREO_QUE_MANDA.send.mockReset();
  CORREO_QUE_MANDA.send.mockResolvedValue(true);
  pendientes.length = 0;
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

    await POST(pedir('POST', { email: 'existe@b.c' }));
    await despuesDeContestar();

    expect(CORREO_QUE_MANDA.send).toHaveBeenCalledTimes(1);
  });

  /**
   * **La respuesta no espera al correo.** Antes se esperaba a crear el vale y a
   * mandarlo, y eso solo pasa cuando la cuenta existe: medido desde fuera, un
   * correo registrado tardaba más que uno inventado.
   */
  it('contesta sin esperar a crear el vale ni a mandar el correo', async () => {
    let soltar: () => void = () => undefined;
    requestReset.mockReturnValue(
      new Promise((resolve) => {
        soltar = () => resolve({ token: 't', email: 'a@b.c' });
      }),
    );

    const res = await POST(pedir('POST', { email: 'lento@b.c' }));

    expect(res.status).toBe(200);
    expect(CORREO_QUE_MANDA.send).not.toHaveBeenCalled();
    soltar();
    await despuesDeContestar();
    expect(CORREO_QUE_MANDA.send).toHaveBeenCalledTimes(1);
  });

  it('si el proveedor de correo revienta, ya se había contestado y no pasa nada', async () => {
    requestReset.mockResolvedValue({ token: 't', email: 'a@b.c' });
    CORREO_QUE_MANDA.send.mockRejectedValue(new Error('sin red'));

    expect((await POST(pedir('POST', { email: 'roto@b.c' }))).status).toBe(200);
    await expect(despuesDeContestar()).resolves.toBeUndefined();
  });

  it('cuando no existe, no se manda nada', async () => {
    requestReset.mockResolvedValue(null);

    await POST(pedir('POST', { email: 'nadie@b.c' }));
    await despuesDeContestar();

    expect(CORREO_QUE_MANDA.send).not.toHaveBeenCalled();
  });

  it('un correo que no lo es tampoco distingue nada', async () => {
    // Quien lo comprueba es `requestReset`, que normaliza y devuelve nulo. La
    // ruta contesta igual: no hay forma de saber si el correo era válido.
    requestReset.mockResolvedValue(null);

    const { status } = await leer(await POST(pedir('POST', { email: 'esto no' })));
    await despuesDeContestar();

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

    const { status, body } = await leer(await PUT(pedir('PUT', { vale: 't', password: 'corta' })));

    expect(status).toBe(400);
    // Y dice las dos medidas: corta o enorme es el mismo código (adr/0113).
    expect((body['error'] as { message: string }).message).toMatch(/entre 8 y 1024/);
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

  /**
   * **Y por correo**, porque cambiando de dirección se podía llenar de enlaces el
   * buzón de una persona concreta. Pasado el tope se contesta lo mismo y no se
   * manda nada: tampoco dice si ese correo tiene cuenta.
   */
  it('cambiar de dirección no manda más de tres enlaces al mismo correo', async () => {
    requestReset.mockResolvedValue({ token: 't', email: 'buzon@b.c' });

    for (let i = 0; i < 5; i += 1) {
      const { status, body } = await leer(await POST(pedir('POST', { email: ' Buzon@B.c ' })));
      expect(status).toBe(200);
      expect(body['message']).toMatch(/Si ese correo tiene cuenta/);
    }
    await despuesDeContestar();

    expect(CORREO_QUE_MANDA.send).toHaveBeenCalledTimes(3);
  });

  it('un correo que no es una cadena cuenta en el mismo tope, sin revelar nada', async () => {
    const { status, body } = await leer(await POST(pedir('POST', { email: 42 })));
    await despuesDeContestar();

    expect(status).toBe(200);
    expect(body['message']).toMatch(/Si ese correo tiene cuenta/);
  });

  /**
   * **El correo va en la clave con su huella** (adr/0113). Entero, uno de 100 KB
   * —cabe en el cuerpo— reventaba el índice de la tabla de topes, y el tope caía
   * al de memoria, que es por proceso.
   */
  it('la clave del tope por correo lleva su huella, no el correo', async () => {
    clavesDelTope.length = 0;
    const enorme = `${'z'.repeat(100 * 1024)}@b.c`;

    await POST(pedir('POST', { email: enorme }));

    const porCorreo = clavesDelTope.filter((clave) => clave.startsWith('olvidada:correo:'));
    expect(porCorreo).toEqual([expect.stringMatching(/^olvidada:correo:[0-9a-f]{32}$/)]);
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
