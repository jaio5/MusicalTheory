import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Metricas from '@server/metricas';
import type * as NextServer from 'next/server';
import type * as RateLimitDb from '@server/rate-limit-db';

/**
 * La ruta de la analítica: qué se apunta, qué no, y quién lo lee.
 *
 * Lo que se vigila es lo que se prometió en la política de privacidad: que con
 * `DNT` o `GPC` no se apunta nada, que sin base de datos no se hace nada, que la
 * dirección no llega a la clave del tope tal cual, y que leer pide la clave.
 */

const authAvailable = vi.fn(() => true);
const currentCookie = vi.fn();
const findUserById = vi.fn();
const registrarEvento = vi.fn();
const leerMetricas = vi.fn();
const hasDatabase = vi.fn(() => true);
const limitRequest = vi.fn();

vi.mock('@server/auth', () => ({
  authAvailable: () => authAvailable(),
  currentCookie: () => currentCookie(),
}));
vi.mock('@server/users', () => ({ findUserById: (id: string) => findUserById(id) }));

/**
 * `after` solo existe dentro de una petición de Next. Aquí guarda lo que la ruta
 * deja para después de contestar, y `enviar` lo espera.
 */
const despues = vi.hoisted((): Promise<unknown>[] => []);
vi.mock('next/server', async (original) => ({
  ...(await original<typeof NextServer>()),
  after: (tarea: () => Promise<unknown>) => {
    despues.push(tarea());
  },
}));
vi.mock('@server/db/client', () => ({ hasDatabase: () => hasDatabase() }));
vi.mock('@server/metricas', async (original) => ({
  ...(await original<typeof Metricas>()),
  registrarEvento: (...a: unknown[]) => registrarEvento(...a),
  leerMetricas: (...a: unknown[]) => leerMetricas(...a),
}));
vi.mock('@server/rate-limit-db', async (original) => ({
  ...(await original<typeof RateLimitDb>()),
  limitRequest: (...a: unknown[]) => limitRequest(...a),
}));

const { GET, POST: contestar } = await import('./route');

/** La petición entera: la respuesta y lo que se apunta después de darla. */
async function POST(request: Request): Promise<Response> {
  const respuesta = await contestar(request);
  await Promise.all(despues.splice(0));
  return respuesta;
}
const { seudonimo } = await import('@server/metricas');

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function apuntar(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://x/api/metricas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  });
}

function leer(headers: Record<string, string> = {}): Request {
  return new Request('http://x/api/metricas', {
    headers: { 'X-Forwarded-For': '203.0.113.8', ...headers },
  });
}

beforeEach(() => {
  authAvailable.mockReturnValue(true);
  currentCookie.mockReset().mockResolvedValue(null);
  findUserById.mockReset().mockResolvedValue(null);
  registrarEvento.mockReset().mockResolvedValue(undefined);
  leerMetricas.mockReset();
  hasDatabase.mockReturnValue(true);
  limitRequest.mockReset().mockResolvedValue({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
  vi.unstubAllEnvs();
});

describe('apuntar', () => {
  it('una visita sin nadie se suma sin seudónimo', async () => {
    const res = await POST(apuntar({ evento: 'visita', ruta: '/afinar' }));

    expect(res.status).toBe(204);
    expect(registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ evento: 'visita', ruta: '/afinar', visitante: null }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('un navegador que ha dicho que sí va con el seudónimo de su identificador', async () => {
    await POST(apuntar({ evento: 'toma-grabada', visitante: ID }));

    expect(registrarEvento.mock.calls[0]![0]).toMatchObject({
      evento: 'toma-grabada',
      ruta: '',
      visitante: seudonimo('navegador', ID),
    });
  });

  /**
   * **Un navegador nuevo gasta del tope de nuevos de su dirección**: diez al día.
   * Un UUID lo inventa cualquiera, y sin esto sesenta por minuto eran sesenta
   * «primera vez» (adr/0113). La prueba contra la base, en `route.con-base.test.ts`.
   */
  it('un navegador nuevo pregunta al tope de nuevos de su dirección, con huella', async () => {
    await POST(apuntar({ evento: 'visita', ruta: '/', visitante: ID }));
    const { admitirNuevo } = registrarEvento.mock.calls[0]![0] as {
      admitirNuevo: () => Promise<boolean>;
    };

    limitRequest.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 9 });
    expect(await admitirNuevo()).toBe(false);
    const { key, options } = limitRequest.mock.calls.at(-1)![0] as {
      key: string;
      options: { limit: number; windowMs: number };
    };
    expect(key).toMatch(/^metricas-nuevos:[0-9a-f]{16}$/);
    expect(options).toEqual({ limit: 10, windowMs: 86_400_000 });
  });

  /**
   * **Contesta antes de apuntar.** Llega por `sendBeacon`, que no lee la
   * respuesta: esperar a la sesión y a las escrituras era tener la petición
   * abierta por nada.
   */
  it('contesta antes de apuntar nada', async () => {
    const res = await contestar(apuntar({ evento: 'visita', ruta: '/afinar' }));

    expect(res.status).toBe(204);
    expect(registrarEvento).not.toHaveBeenCalled();
    await Promise.all(despues.splice(0));
    expect(registrarEvento).toHaveBeenCalledTimes(1);
  });

  it('con la sesión abierta gana la cuenta, que es la misma en dos aparatos', async () => {
    currentCookie.mockResolvedValue({ id: 'u1', sessionVersion: 2 });
    findUserById.mockResolvedValue({ id: 'u1', sessionVersion: 2 });

    await POST(apuntar({ evento: 'visita', ruta: '/', visitante: ID }));

    // Y sin tope de nuevos: una cuenta solo da un seudónimo, y crearla ya tiene el suyo.
    expect(registrarEvento.mock.calls[0]![0]).toEqual({
      evento: 'visita',
      ruta: '/',
      visitante: seudonimo('cuenta', 'u1'),
    });
  });

  /**
   * La cuenta se comprueba con su fila y nada más: ni el plan ni el gasto de la
   * IA, que aquí no hacen falta. Una cookie de antes de cambiar la contraseña, o
   * sin cuentas configuradas, cuenta como el navegador.
   */
  it('una cookie que ya no vale, o sin cuentas, cuenta como el navegador', async () => {
    currentCookie.mockResolvedValue({ id: 'u1', sessionVersion: 1 });
    findUserById.mockResolvedValue({ id: 'u1', sessionVersion: 2 });
    await POST(apuntar({ evento: 'visita', ruta: '/', visitante: ID }));

    authAvailable.mockReturnValue(false);
    await POST(apuntar({ evento: 'visita', ruta: '/', visitante: ID }));

    for (const [evento] of registrarEvento.mock.calls) {
      expect(evento).toMatchObject({ visitante: seudonimo('navegador', ID) });
    }
    expect(findUserById).toHaveBeenCalledTimes(1);
  });

  it('con DNT o GPC no se apunta nada, ni sumado', async () => {
    for (const cabecera of [{ DNT: '1' }, { 'Sec-GPC': '1' }] as Record<string, string>[]) {
      const res = await POST(apuntar({ evento: 'visita', ruta: '/' }, cabecera));
      expect(res.status).toBe(204);
    }
    expect(registrarEvento).not.toHaveBeenCalled();
    expect(limitRequest).not.toHaveBeenCalled();
  });

  it('sin base de datos no hace nada, y no es un error', async () => {
    hasDatabase.mockReturnValue(false);

    expect((await POST(apuntar({ evento: 'visita', ruta: '/' }))).status).toBe(204);
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it('lo que no es un evento se rechaza sin apuntar', async () => {
    expect((await POST(apuntar({ evento: 'cancion-guardada' }))).status).toBe(400);
    expect((await POST(apuntar('nada'))).status).toBe(400);
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it('el tope cuenta con la huella de la dirección, no con la dirección', async () => {
    await POST(apuntar({ evento: 'visita', ruta: '/' }));

    const { key } = limitRequest.mock.calls[0]![0] as { key: string };
    expect(key).toMatch(/^metricas:[0-9a-f]{16}$/);
    expect(key).not.toContain('203.0.113.7');
  });

  it('pasado el tope, 429 con su espera', async () => {
    limitRequest.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 12 });

    const res = await POST(apuntar({ evento: 'visita', ruta: '/' }));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
    expect(registrarEvento).not.toHaveBeenCalled();
  });
});

describe('leer', () => {
  it('sin clave configurada la ruta no existe', async () => {
    expect((await GET(leer({ Authorization: 'Bearer algo' }))).status).toBe(404);
    vi.stubEnv('METRICAS_CLAVE', '');
    expect((await GET(leer({ Authorization: 'Bearer ' }))).status).toBe(404);
  });

  it('con otra clave, o sin ninguna, 401', async () => {
    vi.stubEnv('METRICAS_CLAVE', 'la-buena');
    expect((await GET(leer({ Authorization: 'Bearer la-mala' }))).status).toBe(401);
    expect((await GET(leer())).status).toBe(401);
    expect(leerMetricas).not.toHaveBeenCalled();
  });

  it('con la clave, lo que hay, sin caché', async () => {
    vi.stubEnv('METRICAS_CLAVE', 'la-buena');
    leerMetricas.mockResolvedValue({ hoy: '2026-10-07', retencion: {}, ultimos30: [] });

    const res = await GET(leer({ Authorization: 'Bearer la-buena' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ hoy: '2026-10-07' });
  });

  it('sin base de datos lo dice', async () => {
    vi.stubEnv('METRICAS_CLAVE', 'la-buena');
    leerMetricas.mockResolvedValue(null);

    expect((await GET(leer({ Authorization: 'Bearer la-buena' }))).status).toBe(503);
  });

  it('probar claves a lo bruto tiene tope', async () => {
    vi.stubEnv('METRICAS_CLAVE', 'la-buena');
    limitRequest.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 30 });

    expect((await GET(leer({ Authorization: 'Bearer x' }))).status).toBe(429);
  });
});
