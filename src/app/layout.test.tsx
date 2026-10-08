// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { GUION_TEMA } from '@state/theme';

/*
  El número de un solo uso que en la aplicación pone `proxy.ts`.

  `headers()` solo existe dentro de una petición, y aquí el layout se pinta
  suelto: sin este doble, pintarlo revienta con «headers was called outside a
  request scope». Se devuelve un número reconocible para poder comprobar que
  acaba en el guion del tema.
*/
let numeroEnLaCabecera: string | null = 'numerodeprueba';
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers(numeroEnLaCabecera === null ? {} : { 'x-nonce': numeroEnLaCabecera }),
}));

// Las letras las carga el compilador de Next, que aquí no está: lo que se prueba
// de ellas vive en `fuentes.test.ts`, y aquí solo importa que lleguen al `<html>`.
vi.mock('./fuentes', () => ({ CLASES_DE_FUENTES: 'las-tres-letras' }));

const { default: RootLayout, dynamic, metadata } = await import('./layout');

/**
 * El marco de todas las páginas.
 *
 * Se pinta en el servidor —`renderToStaticMarkup`, que es lo que hace Next— y no
 * en el navegador, porque las dos cosas que decide son de servidor:
 *
 * - **`dynamic = 'force-dynamic'`**, que no es una precaución sino un fallo que
 *   ya estaba puesto: sin él, un build hecho sin `DATABASE_URL` concluye que
 *   estas páginas son estáticas y prerenderiza la cuenta anónima dentro del HTML.
 *   Luego se arranca el contenedor con las variables y todo el mundo entra como
 *   anónimo hasta que despierta el JavaScript. Es el camino del contenedor que
 *   documenta `DESPLIEGUE.md`.
 * - **El guion del tema, dentro del `<head>` y antes de nada**, que es lo que
 *   evita el fogonazo.
 */

async function pintar(): Promise<string> {
  return renderToStaticMarkup(await RootLayout({ children: <p>El contenido</p> }));
}

describe('el marco', () => {
  it('no se prerenderiza, y eso no es una precaucion', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  /** El nombre va una vez, aquí: cada página pone solo el suyo. */
  it('lleva su titulo, que remata el de cada pagina, y su descripcion', () => {
    expect(metadata.title).toEqual({ default: 'Caos ordenado', template: '%s · Caos ordenado' });
    expect(metadata.description).toMatch(/guitarra/);
  });

  it('el guion del tema va dentro del head, antes de nada', async () => {
    const html = await pintar();
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

    // Con su número puesto: sin él, la política de seguridad lo bloquea y
    // vuelve el fogonazo que este guion existe para evitar.
    expect(head).toContain('<script nonce="numerodeprueba">');
    expect(html).toContain(GUION_TEMA);
  });

  it('esta en español y pinta lo que le metan dentro', async () => {
    const html = await pintar();

    expect(html).toContain('lang="es"');
    expect(html).toContain('El contenido');
  });

  it('las tres letras cuelgan del html, que es donde las lee la hoja', async () => {
    const html = await pintar();

    expect(html).toMatch(/<html[^>]*class="las-tres-letras"/);
  });
});

/** La cuenta la lee el layout de `(marco)`: la portada cuelga de aquí y no la usa. */
describe('la cuenta', () => {
  it('no la lee ni la baja: no hay proveedor alrededor de la portada', async () => {
    const html = await pintar();

    expect(html).toContain('<body class="antialiased"><p>El contenido</p>');
  });
});

describe('sin numero en la cabecera', () => {
  /**
   * El número lo pone el proxy. Si no llegara —una ruta que se sirve sin
   * pasar por él— el guion va sin número: lo peor que puede pasar es que la
   * política lo bloquee y se vea un fogonazo, no que reviente el render.
   */
  it('el guion del tema va sin numero, y la pagina se pinta igual', async () => {
    numeroEnLaCabecera = null;

    const html = renderToStaticMarkup(await RootLayout({ children: <p>dentro</p> }));

    expect(html).toContain('dentro');
    expect(html).not.toContain('nonce=');
    numeroEnLaCabecera = 'numerodeprueba';
  });
});
