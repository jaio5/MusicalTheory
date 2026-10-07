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

const { abrirPuertaDeIa, fraseDelTope, frenarPorCuenta, frenarPorDireccion, LIMITE_POR_DIRECCION } =
  await import('./ai-gate');
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
  return {
    feature: 'versiones',
    error,
    loQueEs: 'Las salidas de lo que tocas',
    plural: true,
  } as const;
}

/** El código y el cuerpo de lo que devuelve la puerta. */
async function leer(res: Response | object | null) {
  if (!(res instanceof Response)) {
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
    spendAi.mockResolvedValue({ kind: 'ok', account: CUENTA, leftMonth: 10, reserva: null });

    expect(await abrirPuertaDeIa(puerta())).toEqual({ reserva: null });
  });

  it('y devuelve lo reservado del techo de gasto, para asentarlo', async () => {
    const reserva = { mes: '2026-10', dia: '2026-10-07', micros: 5, gratis: true };
    spendAi.mockResolvedValue({ kind: 'ok', account: CUENTA, leftMonth: 10, reserva });

    expect(await abrirPuertaDeIa(puerta())).toEqual({ reserva });
  });

  it('pasa a la cuenta la sesión que ya se ha leído', async () => {
    const sesion = { userId: 'u', account: CUENTA };
    spendAi.mockResolvedValue({ kind: 'sin-cuenta' });

    await abrirPuertaDeIa(puerta(), sesion);

    expect(spendAi).toHaveBeenCalledWith('versiones', sesion);
  });

  /**
   * **El techo de gasto de todos** (adr/0114): un 503 que dice que no es el cupo
   * de quien pide, hasta cuándo, y cuánto esperar en la cabecera.
   */
  it('con el techo de gasto alcanzado, 503 para todos y hasta cuándo', async () => {
    spendAi.mockResolvedValue({
      kind: 'tope-global',
      account: CUENTA,
      quien: 'todos',
      cuando: 'dia',
    });

    const res = (await abrirPuertaDeIa(puerta())) as Response;
    const { status, code, message } = await leer(res);

    expect(status).toBe(503);
    expect(code).toBe('model_unavailable');
    expect(message).toContain('para nadie hasta mañana');
    expect(message).toContain('No es tu cupo');
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(Number(res.headers.get('Retry-After'))).toBeLessThanOrEqual(86_400);
  });

  it('el del plan gratis lo dice, y dice que pagando no hay que esperar', async () => {
    spendAi.mockResolvedValue({
      kind: 'tope-global',
      account: CUENTA,
      quien: 'gratis',
      cuando: 'mes',
    });

    const { status, message } = await leer(await abrirPuertaDeIa(puerta()));

    expect(status).toBe(503);
    expect(message).toContain(
      'En el plan gratis, las salidas de lo que tocas no están disponibles',
    );
    expect(message).toContain('hasta el mes que viene');
    expect(message).toContain('con un plan de pago');
  });

  it('la frase del techo concuerda con un sujeto singular', () => {
    expect(
      fraseDelTope({ quien: 'todos', cuando: 'mes' }, 'Preguntarle al profesor', false),
    ).toContain('Preguntarle al profesor no está disponible para nadie hasta el mes que viene');
  });

  it('sin proveedor contesta 503 y no gasta cupo', async () => {
    // El fallo que costó dinero de verdad: `spendAi` cuenta la petición **antes**
    // de hablar con el modelo, así que comprobar el proveedor después dejaba a
    // alguien sin sus peticiones del mes por una variable de entorno que faltaba.
    modelAvailable.mockReturnValue(false);
    spendAi.mockResolvedValue({ kind: 'ok', account: CUENTA, leftMonth: 10, reserva: null });

    const { status, code } = await leer(await abrirPuertaDeIa(puerta()));

    expect(status).toBe(503);
    expect(code).toBe('model_unavailable');
    expect(spendAi).not.toHaveBeenCalled();
  });

  /**
   * **Y lo dice como lo que es, no como un fallo de red.**
   *
   * La frase de serie —«no hemos podido contactar con el modelo, vuelve a
   * intentarlo en un minuto»— es mentira aquí: nadie ha intentado contactar con
   * nada, porque no hay ninguno puesto. Además invita a reintentar algo que no va
   * a funcionar nunca. Es lo que veía quien levantaba la aplicación con
   * `docker compose up` sin clave.
   */
  it('sin proveedor, la frase no habla de contactar ni de reintentar', async () => {
    modelAvailable.mockReturnValue(false);

    const { message } = await leer(await abrirPuertaDeIa(puerta()));

    expect(message).toContain('no tiene ningún modelo configurado');
    expect(message).not.toMatch(/contactar|vuelve a intentarlo/i);
    // Y en los términos de lo que se pedía, con su número: «Las salidas... no están».
    expect(message).toContain('las salidas de lo que tocas');
    expect(message).toContain('no están disponibles');
  });

  // Y con un sujeto singular concuerda: «preguntarle al profesor no está».
  it('sin proveedor, el verbo concuerda con un sujeto singular', async () => {
    modelAvailable.mockReturnValue(false);

    const { message } = await leer(
      await abrirPuertaDeIa({ ...puerta(), loQueEs: 'Preguntarle al profesor', plural: false }),
    );

    expect(message).toContain('preguntarle al profesor no está disponible');
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
    expect(message).toContain('Las salidas de lo que tocas');
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
      needed: { id: 'medio', name: 'Medio', monthlyCents: 999 },
    });

    const singular = await leer(
      await abrirPuertaDeIa({ ...puerta(), loQueEs: 'Preguntarle al profesor', plural: false }),
    );

    expect(singular.message).toContain('Preguntarle al profesor');
  });
});

/**
 * **El límite por minuto es de la cuenta, no de la dirección** (adr/0114).
 *
 * Era por dirección y antes de leer la sesión: sin `TRUSTED_PROXY_HOPS` todas
 * las peticiones comparten dirección, y diez anónimas seguidas dejaban sin IA a
 * todas las cuentas a la vez.
 */
describe('la puerta de la frecuencia, por cuenta', () => {
  it('deja pasar las primeras y frena después, con cuánto esperar', async () => {
    const limiter = new SlidingWindowRateLimiter();
    let frenadas = 0;
    let ultima: Response | null = null;

    for (let i = 0; i < 15; i += 1) {
      const frenada = await frenarPorCuenta('cuenta-a', limiter, error, 1000);
      if (frenada !== null) {
        frenadas += 1;
        ultima = frenada;
      }
    }

    // Diez por minuto y cuenta: las cinco últimas se caen.
    expect(frenadas).toBe(5);
    expect(ultima?.status).toBe(429);
    expect(Number(ultima?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('la ventana es deslizante: al pasar el minuto se puede otra vez', async () => {
    const limiter = new SlidingWindowRateLimiter();
    for (let i = 0; i < 12; i += 1) {
      await frenarPorCuenta('cuenta-a', limiter, error, 1000);
    }

    expect(await frenarPorCuenta('cuenta-a', limiter, error, 1000)).not.toBeNull();
    expect(await frenarPorCuenta('cuenta-a', limiter, error, 70_000)).toBeNull();
  });

  it('cada cuenta lleva la suya, aunque vengan de la misma dirección', async () => {
    const limiter = new SlidingWindowRateLimiter();
    for (let i = 0; i < 12; i += 1) {
      await frenarPorCuenta('cuenta-a', limiter, error, 1000);
    }

    expect(await frenarPorCuenta('cuenta-b', limiter, error, 1000)).toBeNull();
  });
});

describe('la capa barata de la dirección', () => {
  const desde = (ip: string) =>
    new Request('http://x/api/versiones', { method: 'POST', headers: { 'x-forwarded-for': ip } });

  it('es más ancha que la de la cuenta, y frena pasado su tope', async () => {
    let frenadas = 0;
    for (let i = 0; i < LIMITE_POR_DIRECCION.limit + 3; i += 1) {
      if ((await frenarPorDireccion(desde('10.9.0.1'), error, 5000)) !== null) {
        frenadas += 1;
      }
    }

    expect(LIMITE_POR_DIRECCION.limit).toBeGreaterThan(10);
    expect(frenadas).toBe(3);
    expect((await frenarPorDireccion(desde('10.9.0.2'), error, 5000)) === null).toBe(true);
  });

  /**
   * El ataque de la auditoría: sin proxy de confianza todas las peticiones son
   * «la misma dirección», y el tope común dejaba sin IA a todo el mundo. Sin
   * dirección, esta capa no frena: frena la de la cuenta.
   */
  it('sin proxy de confianza no hay dirección, y no frena a nadie', async () => {
    const antes = process.env['TRUSTED_PROXY_HOPS'];
    delete process.env['TRUSTED_PROXY_HOPS'];
    try {
      for (let i = 0; i < LIMITE_POR_DIRECCION.limit * 2; i += 1) {
        expect(await frenarPorDireccion(desde('10.9.0.3'), error, 9000)).toBeNull();
      }
    } finally {
      process.env['TRUSTED_PROXY_HOPS'] = antes;
    }
  });
});
