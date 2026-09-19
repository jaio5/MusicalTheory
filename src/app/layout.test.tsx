// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { GUION_TEMA } from '@state/theme';

const currentAccount = vi.fn(async () => ANONYMOUS);
const authAvailable = vi.fn(() => true);

/*
  El número de un solo uso que en la aplicación pone `middleware.ts`.

  `headers()` solo existe dentro de una petición, y aquí el layout se pinta
  suelto: sin este doble, pintarlo revienta con «headers was called outside a
  request scope». Se devuelve un número reconocible para poder comprobar que
  acaba en el guion del tema.
*/
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-nonce': 'numerodeprueba' }),
}));

vi.mock('@server/entitlements', () => ({ currentAccount: () => currentAccount() }));
vi.mock('@server/auth', () => ({ authAvailable: () => authAvailable() }));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

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

beforeEach(() => {
  currentAccount.mockClear();
  authAvailable.mockReset();
  authAvailable.mockReturnValue(true);
});

async function pintar(): Promise<string> {
  return renderToStaticMarkup(await RootLayout({ children: <p>El contenido</p> }));
}

describe('el marco', () => {
  it('no se prerenderiza, y eso no es una precaucion', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('lleva su titulo y su descripcion', () => {
    expect(metadata.title).toBe('Caos ordenado');
    expect(metadata.description).toMatch(/guitarra/);
  });

  it('el guion del tema va dentro del head, antes de nada', async () => {
    const html = await pintar();
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

    // Con su número puesto: sin él, la política de seguridad lo bloquea y
    // vuelve el fogonazo blanco que este guion existe para evitar.
    expect(head).toContain('<script nonce="numerodeprueba">');
    expect(html).toContain(GUION_TEMA);
  });

  it('esta en español y pinta lo que le metan dentro', async () => {
    const html = await pintar();

    expect(html).toContain('lang="es"');
    expect(html).toContain('El contenido');
  });
});

describe('la cuenta', () => {
  it('la lee aqui y la baja por el arbol', async () => {
    // Para que ninguna pantalla tenga que pedirla con un `fetch` al montar: quien
    // entra pagando no debe ver medio segundo de candados antes de que se abran.
    await pintar();

    expect(currentAccount).toHaveBeenCalledTimes(1);
  });

  it('sin cuentas configuradas se pinta igual', async () => {
    // Sin `DATABASE_URL` y `AUTH_SECRET` todo el mundo es anónimo y la aplicación
    // funciona entera: fallar aquí la dejaría sin arrancar.
    authAvailable.mockReturnValue(false);

    await expect(pintar()).resolves.toContain('El contenido');
  });
});
