import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from './middleware';

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
  return middleware(new NextRequest(`https://ejemplo.test${ruta}`)).headers;
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

  /** Y el número llega a quien lo necesita: el guion del tema, en `layout.tsx`. */
  it('el numero viaja en una cabecera de la peticion, para el layout', () => {
    const peticion = new NextRequest('https://ejemplo.test/');
    const csp = middleware(peticion).headers.get('Content-Security-Policy') ?? '';
    const numero = /'nonce-([a-f0-9]{32})'/.exec(csp)?.[1];

    expect(numero).toBeDefined();
    expect(csp).toContain(`'nonce-${numero}'`);
  });
});
