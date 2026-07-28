import { describe, expect, it } from 'vitest';

import { requesterKey, SlidingWindowRateLimiter } from './rate-limit';

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
  it('se queda con el primero de la cadena de proxies', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2' });
    expect(requesterKey(headers)).toBe('203.0.113.5');
  });

  it('acepta la cabecera alternativa', () => {
    expect(requesterKey(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('no revienta si no hay ninguna', () => {
    expect(requesterKey(new Headers())).toBe('desconocido');
  });
});
