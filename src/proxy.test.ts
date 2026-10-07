import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import nextConfig from '../next.config';

import { llegaPorHttps, proxy } from './proxy';

/**
 * Las cabeceras de seguridad, comprobadas donde se escriben.
 *
 * No estaban: la aplicación se servía sin CSP, sin `nosniff`, sin política de
 * referente y sin declarar que el micrófono es lo único que pide. Nada de eso
 * rompe nada mientras no haya nadie mirando, y por eso se pierde de vista.
 *
 * Lo que se vigila aquí no es la redacción de la política —eso cambiará— sino
 * las tres promesas que la hacen valer algo: que hay un número de un solo uso,
 * que **no** hay `'unsafe-inline'` en los guiones, que no se puede enmarcar la
 * página, y que el micrófono está declarado y el resto de permisos cerrados.
 */
function respuestaDe(ruta = '/'): Headers {
  return proxy(new NextRequest(`https://ejemplo.test${ruta}`)).headers;
}

describe('Las cabeceras de seguridad', () => {
  it('la politica no deja pasar guiones en linea sin numero', () => {
    const csp = respuestaDe().get('Content-Security-Policy') ?? '';
    const guiones = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';

    expect(guiones).toMatch(/'nonce-[a-f0-9]{32}'/);
    expect(guiones).not.toContain('unsafe-inline');
    // `unsafe-eval` solo lo lleva el servidor de desarrollo, y los tests corren
    // con `NODE_ENV=test`: si apareciera aquí, se estaría sirviendo de verdad.
    expect(guiones).not.toContain('unsafe-eval');
  });

  it('y el numero cambia en cada peticion, que si no no es de un solo uso', () => {
    const uno = respuestaDe().get('Content-Security-Policy');
    const otro = respuestaDe().get('Content-Security-Policy');

    expect(uno).not.toBe(otro);
  });

  it('nadie puede enmarcar la pagina ni sacar un formulario fuera', () => {
    const csp = respuestaDe().get('Content-Security-Policy') ?? '';

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  /**
   * El micrófono es la mitad de esta aplicación, así que se declara; y se
   * declara **solo** él, que es la manera de decir que la cámara y la ubicación
   * no se piden nunca.
   */
  it('se pide el microfono y se cierra todo lo demas', () => {
    const permisos = respuestaDe().get('Permissions-Policy') ?? '';

    expect(permisos).toContain('microphone=(self)');
    expect(permisos).toContain('camera=()');
    expect(permisos).toContain('geolocation=()');
  });

  it('las tres cabeceras cortas tambien van', () => {
    const cabeceras = respuestaDe();

    expect(cabeceras.get('X-Content-Type-Options')).toBe('nosniff');
    expect(cabeceras.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(cabeceras.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });

  it('una ventana ajena no se queda con un puntero a esta', () => {
    expect(respuestaDe().get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  // Esta no la pone el proxy sino Next, y se apaga en su configuración.
  it('no se anuncia con qué está hecha', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  /** Y el número llega a quien lo necesita: el guion del tema, en `layout.tsx`. */
  it('el numero viaja en una cabecera de la peticion, para el layout', () => {
    const peticion = new NextRequest('https://ejemplo.test/');
    const csp = proxy(peticion).headers.get('Content-Security-Policy') ?? '';
    const numero = /'nonce-([a-f0-9]{32})'/.exec(csp)?.[1];

    expect(numero).toBeDefined();
    expect(csp).toContain(`'nonce-${numero}'`);
  });
});

describe('en desarrollo', () => {
  /**
   * `next dev` compila con `eval`, así que sin este hueco la consola se llena de
   * avisos de la política en cada recarga —y una consola con ruido es una
   * consola que se deja de mirar—. En lo que se sirve de verdad no entra.
   */
  it('se deja pasar eval, y solo alli', () => {
    const antes = process.env.NODE_ENV;
    const poner = (valor: string) => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: valor,
        configurable: true,
        writable: true,
        enumerable: true,
      });
    };

    poner('development');
    expect(respuestaDe().get('Content-Security-Policy')).toContain("'unsafe-eval'");

    poner('production');
    expect(respuestaDe().get('Content-Security-Policy')).not.toContain("'unsafe-eval'");

    poner(antes ?? 'test');
  });
});

/**
 * `upgrade-insecure-requests`, solo por https.
 *
 * Puesta siempre, rompía la aplicación servida por http desde otra dirección
 * —el Docker de casa abierto desde el móvil—: el navegador pedía por https los
 * guiones y las hojas a un servidor que no lo habla, y la portada perdía
 * dieciocho recursos con `ERR_SSL_PROTOCOL_ERROR`. En `localhost` no se ve,
 * porque el navegador lo exime, y por eso hace falta este test.
 */
describe('subir a https lo que se cuele en http', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const csp = (url: string, cabeceras: Record<string, string> = {}) =>
    proxy(new NextRequest(url, { headers: cabeceras })).headers.get('Content-Security-Policy') ??
    '';

  it('se pide cuando la pagina llega por https', () => {
    expect(csp('https://ejemplo.test/')).toContain('upgrade-insecure-requests');
  });

  it('no se pide servida por http desde la red de casa', () => {
    vi.stubEnv('APP_URL', '');

    expect(csp('http://192.168.1.20:3000/')).not.toContain('upgrade-insecure-requests');
  });

  it('detras de un proxy que hace el tls lo dice su cabecera, y manda el primero', () => {
    vi.stubEnv('APP_URL', '');
    const peticion = (proto: string) =>
      new NextRequest('http://app:3000/', { headers: { 'x-forwarded-proto': proto } });

    expect(llegaPorHttps(peticion('https'))).toBe(true);
    expect(llegaPorHttps(peticion('HTTPS, http'))).toBe(true);
    expect(llegaPorHttps(peticion('http, https'))).toBe(false);
    expect(llegaPorHttps(peticion('httpsx'))).toBe(false);
  });

  it('y si la direccion publica es https, tambien', () => {
    vi.stubEnv('APP_URL', 'https://caos.example');

    expect(llegaPorHttps(new NextRequest('http://app:3000/'))).toBe(true);
  });

  it('sin APP_URL ni cabecera, por http no', () => {
    vi.stubEnv('APP_URL', undefined);

    expect(llegaPorHttps(new NextRequest('http://app:3000/'))).toBe(false);
  });
});
