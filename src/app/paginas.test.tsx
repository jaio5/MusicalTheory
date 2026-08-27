// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';

/**
 * Las direcciones: qué se abre en cada una.
 *
 * Una página de Next es cuatro líneas —el marco y la pantalla— y por eso no
 * tienen test propio cada una. Lo que sí tiene sentido probar, y solo se ve
 * montándolas, es **el mapa**: que cada dirección abre la pantalla que dice su
 * nombre, que cada una lleva su título de pestaña, y que las tres que deciden
 * algo lo deciden bien —una unidad que no existe, un plan que no existe y la
 * contraseña olvidada con vale o sin él—.
 *
 * Sin esto, un `import` cruzado entre dos páginas no lo nota nadie hasta abrir
 * el navegador.
 */

vi.mock('next/navigation', async () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/',
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));

// `server/` lo abre solo `app/`, y una de estas páginas le pregunta al cobrador
// y otra al correo. En un test no hay ni base de datos ni proveedor.
vi.mock('@server/auth', () => ({ authAvailable: () => authDisponible() }));
vi.mock('@server/mail', () => ({ mailer: () => ({ sends: mandaCorreo() }) }));
vi.mock('@server/billing', () => ({ billing: () => ({ charges: false }) }));

const authDisponible = vi.fn(() => true);
const mandaCorreo = vi.fn(() => true);

function pintar(elemento: React.ReactElement) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={false}>
      {elemento}
    </AccountProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  authDisponible.mockReturnValue(true);
  mandaCorreo.mockReturnValue(true);
});

describe('las pantallas de trabajo', () => {
  const DIRECCIONES = [
    ['/afinar', () => import('./afinar/page'), 'Afinar'],
    ['/aprender', () => import('./aprender/page'), 'Aprender'],
    ['/componer', () => import('./componer/page'), 'Componer'],
    ['/profesor', () => import('./profesor/page'), 'Profesor'],
    ['/planes', () => import('./planes/page'), 'Planes'],
    ['/registro', () => import('./registro/page'), 'Crear tu cuenta'],
    ['/cuenta', () => import('./cuenta/page'), 'Tu cuenta'],
    ['/aprender/repaso', () => import('./aprender/repaso/page'), 'Repaso'],
  ] as const;

  it.each(DIRECCIONES)('%s abre su pantalla y lleva su titulo', async (_ruta, importar) => {
    const modulo = (await importar()) as {
      default: () => React.ReactElement;
      metadata?: { title?: string };
    };

    pintar(modulo.default());

    expect(modulo.metadata?.title).toMatch(/Caos ordenado/);
    expect(document.querySelectorAll('h1').length).toBeGreaterThan(0);
  });
});

describe('una unidad por direccion', () => {
  it('la que existe se abre con su titulo de pestaña', async () => {
    const {
      default: Unidad,
      generateMetadata,
      generateStaticParams,
    } = await import('./aprender/[unidad]/page');
    const unidad = UNIT_ORDER[0]!;

    pintar(await Unidad({ params: Promise.resolve({ unidad }) }));

    const meta = await generateMetadata({ params: Promise.resolve({ unidad }) });
    expect(meta.title).toMatch(/Caos ordenado/);
    // Las unidades del temario se conocen de antemano: son fijas.
    expect(generateStaticParams()).toHaveLength(UNIT_ORDER.length);
  });

  it('la que no existe no revienta: lo dice la pantalla', async () => {
    // Esta página no decide si se puede entrar —eso depende del avance y del
    // plan— así que un identificador inventado llega hasta la pantalla.
    const { default: Unidad, generateMetadata } = await import('./aprender/[unidad]/page');

    pintar(await Unidad({ params: Promise.resolve({ unidad: 'inventada' }) }));

    expect(screen.getByRole('heading', { name: /no existe/ })).toBeInTheDocument();
    expect(
      (await generateMetadata({ params: Promise.resolve({ unidad: 'inventada' }) })).title,
    ).toMatch(/no encontrada/);
  });
});

describe('la ventana de pago de un plan', () => {
  it('los tres de pago tienen la suya', async () => {
    const { default: Plan, generateStaticParams } = await import('./planes/[plan]/page');

    pintar(await Plan({ params: Promise.resolve({ plan: 'pro' }) }));

    expect(screen.getByRole('heading', { name: /Plan Pro/ })).toBeInTheDocument();
    expect(generateStaticParams()).toHaveLength(3);
  });

  it('un nombre viejo sigue llevando a su plan, no a un 404', async () => {
    // Un renombrado no puede romper un enlace guardado.
    const { default: Plan } = await import('./planes/[plan]/page');

    pintar(await Plan({ params: Promise.resolve({ plan: 'estudiante' }) }));

    expect(screen.getByRole('heading', { name: /^Plan / })).toBeInTheDocument();
  });

  it('el gratis no es una compra: esa direccion no existe', async () => {
    // Una ventana de pago para el plan gratis sería una pantalla que no puede
    // terminar en nada.
    const { default: Plan, generateMetadata } = await import('./planes/[plan]/page');

    await expect(Plan({ params: Promise.resolve({ plan: 'gratis' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect((await generateMetadata({ params: Promise.resolve({ plan: 'gratis' }) })).title).toMatch(
      /no encontrado/,
    );
  });
});

describe('la contraseña olvidada', () => {
  it('sin vale pide el correo', async () => {
    const { default: Olvidada } = await import('./olvidada/page');

    pintar(await Olvidada({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'Contraseña olvidada' })).toBeInTheDocument();
  });

  it('con vale pide la contraseña nueva: quien vuelve del buzon esta terminando', async () => {
    const { default: Olvidada } = await import('./olvidada/page');

    pintar(await Olvidada({ searchParams: Promise.resolve({ vale: 'abc' }) }));

    expect(screen.getByRole('heading', { name: 'Contraseña nueva' })).toBeInTheDocument();
  });

  it('si esta copia no manda correo, se dice en vez de prometerlo', async () => {
    // Un formulario que no puede terminar en nada deja a alguien esperando
    // delante de un buzón vacío.
    mandaCorreo.mockReturnValue(false);
    const { default: Olvidada } = await import('./olvidada/page');

    pintar(await Olvidada({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/no manda correo/)).toBeInTheDocument();
  });

  it('y sin cuentas configuradas, tampoco', async () => {
    authDisponible.mockReturnValue(false);
    const { default: Olvidada } = await import('./olvidada/page');

    pintar(await Olvidada({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/no manda correo/)).toBeInTheDocument();
  });
});

describe('la portada', () => {
  it('dice de qué va esto y lleva a las pantallas', async () => {
    const { default: Portada, metadata } = await import('./page');

    pintar(Portada());

    expect(metadata.title).toMatch(/aprende música y compón/i);
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
  });

  it('promete que el audio no sale del equipo, que es la regla del proyecto', async () => {
    const { default: Portada } = await import('./page');

    pintar(Portada());

    expect(screen.getByText(/0 bytes de audio enviados/)).toBeInTheDocument();
  });
});
