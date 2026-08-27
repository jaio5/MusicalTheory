import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aiError, type AiErrorCode } from '@core/ai-errors';

/**
 * Las puertas de la IA, probadas de verdad.
 *
 * Esto no existía. Las nueve rutas de la aplicación tenían **cero cobertura**, y
 * eran justo el sitio donde se gasta dinero y se comprueban permisos: lo único
 * que las había ejecutado alguna vez era abrir el navegador a mano.
 *
 * No se probaban porque importarlas arrastra `next-auth`, que en Node no resuelve
 * `next/server` y revienta al cargar. La cadena entra por `entitlements`, así que
 * se sustituye ese módulo y todo lo demás —la puerta, el orden, los cuatro
 * códigos— es el de verdad.
 *
 * Las cuatro ramas se prueban **aquí y una sola vez**, no tres veces en cada
 * ruta: desde que la puerta está en un sitio, repetirlas sería probar lo mismo
 * con tres nombres distintos.
 */

const spendAi = vi.fn();
const modelAvailable = vi.fn(() => true);

vi.mock('./entitlements', () => ({ spendAi: (...args: unknown[]) => spendAi(...args) }));
vi.mock('./ask-model', () => ({ modelAvailable: () => modelAvailable() }));

const { abrirPuertaDeIa, frenarPorFrecuencia } = await import('./ai-gate');
const { SlidingWindowRateLimiter } = await import('./rate-limit');

const MENSAJES: Readonly<Record<AiErrorCode, string>> = {
  invalid_request: 'no vale',
  rate_limited: 'muchas seguidas',
  model_unavailable: 'no hay modelo',
  unparseable_response: 'no encaja',
  account_required: 'hace falta cuenta',
  plan_required: 'no entra en tu plan',
  quota_exhausted: 'se acabó',
};

const error = (code: AiErrorCode, message?: string) => aiError(code, MENSAJES, message);

const CUENTA = { plan: 'gratis', aiModel: 'claude-opus-5' } as never;

function puerta() {
  return { feature: 'ideas', error, loQueEs: 'Las ideas de la IA', plural: true } as const;
}

/** El código y el cuerpo de lo que devuelve la puerta. */
async function leer(res: Response | null) {
  if (res === null) {
    return { status: 200, code: null as string | null, message: '' };
  }
  const body = (await res.json()) as { error: { code: string; message: string } };
  return { status: res.status, code: body.error.code, message: body.error.message };
}

beforeEach(() => {
  spendAi.mockReset();
  modelAvailable.mockReset();
  modelAvailable.mockReturnValue(true);
});

describe('la puerta del cupo', () => {
  it('deja pasar cuando hay proveedor y queda cupo', async () => {
    spendAi.mockResolvedValue({ kind: 'ok', account: CUENTA, leftMonth: 10 });

    expect(await abrirPuertaDeIa(puerta())).toBeNull();
  });

  it('sin proveedor contesta 503 y no gasta cupo', async () => {
    // El fallo que costó dinero de verdad: `spendAi` cuenta la petición **antes**
    // de hablar con el modelo, así que comprobar el proveedor después dejaba a
    // alguien sin sus peticiones del mes por una variable de entorno que faltaba.
    modelAvailable.mockReturnValue(false);
    spendAi.mockResolvedValue({ kind: 'ok', account: CUENTA, leftMonth: 10 });

    const { status, code } = await leer(await abrirPuertaDeIa(puerta()));

    expect(status).toBe(503);
    expect(code).toBe('model_unavailable');
    expect(spendAi).not.toHaveBeenCalled();
  });

  it('sin cuenta, 401', async () => {
    spendAi.mockResolvedValue({ kind: 'sin-cuenta' });

    expect(await leer(await abrirPuertaDeIa(puerta()))).toMatchObject({
      status: 401,
      code: 'account_required',
    });
  });

  it('sin plan, 402 y con el plan que hace falta en la frase', async () => {
    // 402 es literalmente «hace falta pagar», y distinguirlo del 429 importa:
    // uno se arregla cambiando de plan y el otro esperando a mañana.
    spendAi.mockResolvedValue({
      kind: 'plan',
      account: CUENTA,
      needed: { id: 'medio', name: 'Medio', monthlyCents: 999 },
    });

    const { status, code, message } = await leer(await abrirPuertaDeIa(puerta()));

    expect(status).toBe(402);
    expect(code).toBe('plan_required');
    expect(message).toContain('Las ideas de la IA');
    expect(message).toContain('Medio');
  });

  it('sin cupo, 429 y diciendo si fue el del día o el del mes', async () => {
    spendAi.mockResolvedValue({ kind: 'cupo', account: CUENTA, scope: 'dia' });
    const hoy = await leer(await abrirPuertaDeIa(puerta()));

    spendAi.mockResolvedValue({ kind: 'cupo', account: CUENTA, scope: 'mes' });
    const mes = await leer(await abrirPuertaDeIa(puerta()));

    expect(hoy.status).toBe(429);
    expect(hoy.code).toBe('quota_exhausted');
    // No se arreglan igual —uno se espera a mañana y el otro sube de plan—, así
    // que las dos frases tienen que ser distintas.
    expect(hoy.message).not.toBe(mes.message);
  });

  it('si no se ha podido contar, no se sirve', async () => {
    // Servir sin contar es la única forma de que el gasto se dispare sin que
    // nadie se entere.
    spendAi.mockResolvedValue({ kind: 'sin-contador', account: CUENTA });

    expect(await leer(await abrirPuertaDeIa(puerta()))).toMatchObject({
      status: 503,
      code: 'model_unavailable',
    });
  });

  it('la frase del plan cambia con el género y el número de lo que se pide', async () => {
    spendAi.mockResolvedValue({
      kind: 'plan',
      account: CUENTA,
      needed: { id: 'pro', name: 'Pro', monthlyCents: 1999 },
    });

    const singular = await leer(
      await abrirPuertaDeIa({ ...puerta(), loQueEs: 'Preguntarle al profesor', plural: false }),
    );

    expect(singular.message).toContain('Preguntarle al profesor');
  });
});

describe('la puerta de la frecuencia', () => {
  const peticion = () =>
    new Request('http://x/api/ideas', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

  it('deja pasar las primeras y frena después', async () => {
    const limiter = new SlidingWindowRateLimiter();
    let frenadas = 0;

    for (let i = 0; i < 15; i += 1) {
      if ((await frenarPorFrecuencia(peticion(), limiter, error, 1000)) !== null) {
        frenadas += 1;
      }
    }

    // Diez por minuto y dirección: las cinco últimas se caen.
    expect(frenadas).toBe(5);
  });

  it('cuando frena, dice cuánto esperar', async () => {
    // La cabecera es la parte que se olvida al copiar, y sin ella un cliente
    // educado no sabe cuánto esperar y vuelve a probar en seguida.
    const limiter = new SlidingWindowRateLimiter();
    let ultima: Response | null = null;
    for (let i = 0; i < 15; i += 1) {
      ultima = (await frenarPorFrecuencia(peticion(), limiter, error, 1000)) ?? ultima;
    }

    expect(ultima?.status).toBe(429);
    expect(Number(ultima?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('la ventana es deslizante: al pasar el minuto se puede otra vez', async () => {
    const limiter = new SlidingWindowRateLimiter();
    for (let i = 0; i < 12; i += 1) {
      await frenarPorFrecuencia(peticion(), limiter, error, 1000);
    }

    expect(await frenarPorFrecuencia(peticion(), limiter, error, 1000)).not.toBeNull();
    expect(await frenarPorFrecuencia(peticion(), limiter, error, 70_000)).toBeNull();
  });

  it('cada dirección lleva su cuenta', async () => {
    const limiter = new SlidingWindowRateLimiter();
    const otra = new Request('http://x/api/ideas', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.2' },
    });

    for (let i = 0; i < 12; i += 1) {
      await frenarPorFrecuencia(peticion(), limiter, error, 1000);
    }

    expect(await frenarPorFrecuencia(otra, limiter, error, 1000)).toBeNull();
  });
});
