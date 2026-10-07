import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  acotarClave,
  agruparDireccion,
  avisarSiFaltaElProxy,
  avisoDeProxy,
  huellaDeCorreo,
  MAX_CLAVE,
  proxyDeclarado,
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

/**
 * **Una IPv6 cuenta por su /64** (adr/0113).
 *
 * Una casa o un servidor alquilado reciben un /64 entero, y cambiar de dirección
 * dentro de él es gratis. Tres auditorías lo reprodujeron —contra entrar, contra
 * la IA y contra las métricas—: cien direcciones del mismo /64 eran cien
 * contadores, y ninguna petición se frenaba.
 */
describe('las direcciones de una misma red', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('doce IPv6 del mismo /64 comparten contador: la undécima se frena', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
    const memoria = new SlidingWindowRateLimiter({ limit: 10, windowMs: 60_000 });
    const esperas: (number | null)[] = [];
    for (let i = 0; i < 12; i += 1) {
      const request = new Request('http://x/api/teacher', {
        method: 'POST',
        headers: { 'x-forwarded-for': `2001:db8:1:2::${(i + 1).toString(16)}` },
      });
      esperas.push(await esperaPorFrecuencia(request, memoria, 'profesor', undefined, 1_000));
    }

    expect(esperas.slice(0, 10).every((e) => e === null)).toBe(true);
    expect(esperas[10]).toBeGreaterThan(0);
  });

  it('una IPv6 se queda con su /64, la escriba como la escriba', () => {
    const red = '2001:db8:1:2::/64';
    for (const forma of [
      '2001:db8:1:2::1',
      '2001:0DB8:0001:0002:ffff:0:0:9',
      '2001:db8:1:2:aaaa:bbbb:cccc:dddd',
      '[2001:db8:1:2::7]:443',
      '[2001:db8:1:2::7]',
      '2001:db8:1:2::1%eth0',
      ' 2001:DB8:1:2::1 ',
      '2001:db8:1:2:0:0:1.2.3.4',
    ]) {
      expect(agruparDireccion(forma), forma).toBe(red);
    }
    expect(agruparDireccion('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64');
    expect(agruparDireccion('::1')).toBe('0:0:0:0::/64');
    expect(agruparDireccion('fe80::')).toBe('fe80:0:0:0::/64');
  });

  it('una IPv4 escrita como IPv6 vuelve a ser la IPv4, y una IPv4 se queda entera', () => {
    expect(agruparDireccion('::ffff:192.0.2.1')).toBe('192.0.2.1');
    expect(agruparDireccion('::FFFF:c000:0201')).toBe('192.0.2.1');
    expect(agruparDireccion('[::ffff:192.0.2.1]:80')).toBe('192.0.2.1');
    expect(agruparDireccion('192.0.2.1:8080')).toBe('192.0.2.1');
    expect(agruparDireccion('192.000.002.001')).toBe('192.0.2.1');
    // `::1.2.3.4` es la forma vieja «compatible», no la mapeada: es una IPv6.
    expect(agruparDireccion('::1.2.3.4')).toBe('0:0:0:0::/64');
  });

  it('lo que no se sabe leer se queda como está, recortado', () => {
    for (const rara of [
      'desconocido',
      '1:2:3',
      '1::2::3',
      '1:2:3:4:5:6:7:8:9',
      '1:2:3:4:5:6:7::8',
      'g::1',
      '::ffff:300.1.1.1',
      '1.2.3',
      '1.2.3.999',
    ]) {
      expect(agruparDireccion(rara), rara).toBe(rara);
    }
    expect(agruparDireccion('x'.repeat(500))).toHaveLength(64);
  });
});

/**
 * **El correo de la clave, con huella y de largo fijo** (adr/0113). Entero, uno
 * de 4 MB reventaba el índice de `rate_limits.key` y el tope caía al contador de
 * memoria, que lo guardaba un cuarto de hora: veinte entradas así llevaron el
 * proceso de 46 a 687 MB.
 */
describe('las claves que llevan algo de fuera', () => {
  it('el correo va con huella, normalizado como se guarda', () => {
    expect(huellaDeCorreo(' Ana@Ejemplo.TEST ')).toBe(huellaDeCorreo('ana@ejemplo.test'));
    expect(huellaDeCorreo('ana@ejemplo.test')).toMatch(/^[0-9a-f]{32}$/);
    expect(huellaDeCorreo('ana@ejemplo.test')).not.toBe(huellaDeCorreo('eva@ejemplo.test'));
    expect(huellaDeCorreo(`${'a'.repeat(8 * 1024 * 1024)}@x.es`)).toHaveLength(32);
    // Lo que no es una cadena cuenta como la vacía: un cupo para todo lo raro.
    expect(huellaDeCorreo(42)).toBe(huellaDeCorreo(''));
  });

  it('una clave larga se cambia por su huella; una normal se queda', () => {
    expect(acotarClave('entrar:direccion:192.0.2.1')).toBe('entrar:direccion:192.0.2.1');
    expect(acotarClave('x'.repeat(MAX_CLAVE))).toBe('x'.repeat(MAX_CLAVE));
    const larga = acotarClave('x'.repeat(MAX_CLAVE + 1));
    expect(larga).toMatch(/^huella:[0-9a-f]{32}$/);
    expect(acotarClave('x'.repeat(MAX_CLAVE + 1))).toBe(larga);
  });

  it('el de memoria tampoco guarda la clave enorme', async () => {
    const memoria = new SlidingWindowRateLimiter({ limit: 1, windowMs: 60_000 });
    const { limitRequest } = await import('./rate-limit-db');
    const enorme = 'a'.repeat(1024 * 1024);

    await limitRequest({ memoria, key: enorme, now: 1_000 });
    const segunda = await limitRequest({ memoria, key: enorme, now: 1_000 });

    expect(segunda.allowed).toBe(false);
    expect(memoria.check(acotarClave(enorme), 1_000).allowed).toBe(false);
    expect(memoria.size).toBe(1);
  });
});

/**
 * **Sin `TRUSTED_PROXY_HOPS` en producción, un aviso que se ve** (adr/0113). Con
 * un contador para todos, diez peticiones de cualquiera dejan a todos sin IA, sin
 * registro y sin entrar. No se niega a arrancar —el Docker de casa sirve sin proxy
 * y ahí no hay valor correcto—, pero tampoco calla.
 */
describe('el aviso de arranque', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('en producción y sin la variable, un bloque de error al arrancar', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_PROXY_HOPS', '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    avisarSiFaltaElProxy();

    expect(error).toHaveBeenCalledTimes(1);
    const texto = String(error.mock.calls[0]?.[0]);
    expect(texto).toContain('TRUSTED_PROXY_HOPS no está puesta');
    expect(texto).toContain('comparten un solo contador');
    expect(texto).toContain('docs/DESPLIEGUE.md');
  });

  it('sin definir del todo, lo mismo; con un valor mal escrito, dice cuál', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env['TRUSTED_PROXY_HOPS'];
    expect(avisoDeProxy()).toContain('no está puesta');
    vi.stubEnv('TRUSTED_PROXY_HOPS', 'uno');
    expect(avisoDeProxy()).toContain('«uno» no es un entero no negativo');
  });

  it('con un cero puesto a sabiendas se calla, y el registro de las peticiones también', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_PROXY_HOPS', '0');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    avisarSiFaltaElProxy();
    expect(requesterKey(new Headers({ 'x-forwarded-for': '1.1.1.1' }))).toBe(SIN_DIRECCION);

    expect(proxyDeclarado()).toBe(true);
    expect(saltosDeConfianza()).toBe(0);
    expect(error).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
  });

  it('fuera de producción, o con proxy, nada', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(avisoDeProxy()).toBeNull();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
    expect(avisoDeProxy()).toBeNull();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    avisarSiFaltaElProxy();
    expect(error).not.toHaveBeenCalled();
  });

  it('src/instrumentation.ts lo llama al arrancar en Node, y en el borde no', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_PROXY_HOPS', '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { register } = await import('../instrumentation');

    vi.stubEnv('NEXT_RUNTIME', 'edge');
    await register();
    expect(error).not.toHaveBeenCalled();

    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('AUTH_SECRET', '');
    await register();
    expect(error).toHaveBeenCalledTimes(1);

    // Y un secreto que no vale también se dice al arrancar (`server/secreto.ts`).
    vi.stubEnv('AUTH_SECRET', 'corto');
    await register();
    expect(error).toHaveBeenLastCalledWith(expect.stringMatching(/AUTH_SECRET tiene 5 caracteres/));
  });
});
