import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  requesterKey,
  saltosDeConfianza,
  SIN_DIRECCION,
  SlidingWindowRateLimiter,
} from './rate-limit';
import { esperaPorFrecuencia } from './rate-limit-db';

describe('límite de frecuencia', () => {
  it('deja pasar hasta el tope', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000 });

    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('a', 10).allowed).toBe(true);
    expect(limiter.check('a', 20).allowed).toBe(true);
    expect(limiter.check('a', 30).allowed).toBe(false);
  });

  it('va descontando lo que queda', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000 });

    expect(limiter.check('a', 0).remaining).toBe(2);
    expect(limiter.check('a', 10).remaining).toBe(1);
    expect(limiter.check('a', 20).remaining).toBe(0);
  });

  it('vuelve a dejar pasar cuando la ventana avanza', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000 });

    limiter.check('a', 0);
    limiter.check('a', 100);
    expect(limiter.check('a', 200).allowed).toBe(false);
    expect(limiter.check('a', 1100).allowed).toBe(true);
  });

  it('dice cuánto hay que esperar, y nunca cero', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 60_000 });

    limiter.check('a', 0);
    const blocked = limiter.check('a', 100);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(limiter.check('a', 59_500).retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('cuenta por separado a cada quien', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000 });

    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 10).allowed).toBe(false);
  });

  it('suelta lo que ya no cuenta, para no crecer sin fin', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000 });

    for (let index = 0; index < 100; index += 1) {
      limiter.check(`ip-${index}`, 0);
    }
    expect(limiter.size).toBe(100);

    limiter.prune(5000);
    expect(limiter.size).toBe(0);
  });

  it('no suelta lo que todavía cuenta', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000 });
    limiter.check('a', 0);
    limiter.prune(500);
    expect(limiter.size).toBe(1);
  });
});

describe('identificación de quien pide', () => {
  /*
    La auditoría lo reprodujo así: doce POST seguidos, cada uno con su
    `X-Forwarded-For` inventado, y ninguno frenado, porque cada cabecera nueva era
    un contador nuevo. Lo que se fija aquí es que la clave sale de lo que pusieron
    nuestros proxies —contando desde la derecha— y que, sin decir cuántos hay, no
    se cree ninguna cabecera.
  */
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Doce peticiones cambiando la cabecera, como las de la auditoría. */
  async function doceConCabecerasInventadas(proxy?: string): Promise<(number | null)[]> {
    const memoria = new SlidingWindowRateLimiter({ limit: 10, windowMs: 60_000 });
    const esperas: (number | null)[] = [];
    for (let i = 0; i < 12; i += 1) {
      const inventada = `198.51.100.${i}`;
      const request = new Request('http://x/api/teacher', {
        method: 'POST',
        headers: {
          'x-forwarded-for': proxy === undefined ? inventada : `${inventada}, ${proxy}`,
          'x-real-ip': inventada,
        },
      });
      esperas.push(await esperaPorFrecuencia(request, memoria, 'profesor', undefined, 1_000));
    }
    return esperas;
  }

  it('sin proxy de confianza, cambiar la cabecera no da un contador nuevo', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '');

    const esperas = await doceConCabecerasInventadas();

    expect(esperas.slice(0, 10).every((e) => e === null)).toBe(true);
    expect(esperas[10]).toBeGreaterThan(0);
    expect(esperas[11]).toBeGreaterThan(0);
  });

  it('con un proxy delante, lo que manda el cliente a la izquierda tampoco', async () => {
    // El proxy añade a la derecha la dirección de quien le habló: es la misma en
    // las doce, por mucho que el cliente escriba delante.
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');

    const esperas = await doceConCabecerasInventadas('203.0.113.7');

    expect(esperas[10]).toBeGreaterThan(0);
  });

  it('con un proxy, la última de la cadena', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
    const headers = new Headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.5 , 10.0.0.2' });
    expect(requesterKey(headers)).toBe('10.0.0.2');
  });

  it('con dos, la penúltima: la última la puso el segundo proxy', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    const headers = new Headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.5, 10.0.0.2' });
    expect(requesterKey(headers)).toBe('203.0.113.5');
  });

  it('con menos entradas que proxies, la de más a la izquierda', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '3');
    expect(requesterKey(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.2' }))).toBe(
      '203.0.113.5',
    );
  });

  it('con proxy y sin cabecera, no revienta', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
    expect(requesterKey(new Headers({ 'x-forwarded-for': ' , ' }))).toBe('desconocido');
    expect(requesterKey(new Headers())).toBe('desconocido');
  });

  it('X-Real-IP no se cree nunca', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
    expect(requesterKey(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('desconocido');
  });

  it('un número mal escrito cuenta como ninguno', () => {
    for (const malo of ['uno', '-1', '1.5']) {
      vi.stubEnv('TRUSTED_PROXY_HOPS', malo);
      expect(saltosDeConfianza(), malo).toBe(0);
    }
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    expect(saltosDeConfianza()).toBe(2);
  });

  it('en producción, sin proxy, se avisa una vez en el registro', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '');
    vi.stubEnv('NODE_ENV', 'production');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(requesterKey(new Headers({ 'x-forwarded-for': '1.1.1.1' }))).toBe(SIN_DIRECCION);
    requesterKey(new Headers());

    expect(aviso).toHaveBeenCalledTimes(1);
    expect(String(aviso.mock.calls[0]?.[0])).toContain('TRUSTED_PROXY_HOPS');
  });
});
