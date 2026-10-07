// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La política de privacidad y el aviso legal: que digan **lo que hace esta
 * copia**. A quién va la pregunta depende del modelo configurado, si se manda
 * correo depende del proveedor, y quién publica depende del entorno; si cambia
 * una de las tres, la página tiene que cambiar con ella y no quedarse diciendo
 * lo de siempre.
 */

const modelProvider = vi.fn(() => 'anthropic');
const authAvailable = vi.fn(() => true);
const mailConfigured = vi.fn(() => false);

vi.mock('@server/ai-model', () => ({ modelProvider: () => modelProvider() }));
vi.mock('@server/auth', () => ({ authAvailable: () => authAvailable() }));
vi.mock('@server/mail', () => ({ mailConfigured: () => mailConfigured() }));

const { default: Privacidad, metadata: metaPrivacidad } = await import('./(marco)/privacidad/page');
const { default: AvisoLegal, metadata: metaAviso } = await import('./(marco)/aviso-legal/page');

const TITULAR = {
  TITULAR_NOMBRE: 'Ana Pérez',
  TITULAR_NIF: '00000000T',
  TITULAR_DOMICILIO: 'Calle Mayor 1, Madrid',
  TITULAR_CORREO: 'hola@ejemplo.test',
  TITULAR_ALOJAMIENTO: 'Un proveedor, Alemania',
};

function conTitular(): void {
  for (const [v, valor] of Object.entries(TITULAR)) {
    vi.stubEnv(v, valor);
  }
}

beforeEach(() => {
  for (const v of Object.keys(TITULAR)) {
    vi.stubEnv(v, '');
  }
  modelProvider.mockReturnValue('anthropic');
  authAvailable.mockReturnValue(true);
  mailConfigured.mockReturnValue(false);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('la política de privacidad', () => {
  it('lleva su título de pestaña', () => {
    expect(metaPrivacidad.title).toMatch(/Privacidad/);
  });

  it('sin titular configurado lo dice, con lo que falta, en vez de inventarlo', () => {
    render(<Privacidad />);

    expect(screen.getByText(/no dice todavía quién la publica/)).toHaveTextContent(
      'TITULAR_NOMBRE, TITULAR_NIF',
    );
    expect(screen.getAllByText('sin configurar').length).toBeGreaterThan(0);
  });

  it('con titular, sus datos y ningún aviso', () => {
    conTitular();
    render(<Privacidad />);

    expect(screen.queryByText(/no dice todavía/)).not.toBeInTheDocument();
    expect(screen.getByText('hola@ejemplo.test')).toBeInTheDocument();
    expect(screen.getByText(/Un proveedor, Alemania/)).toBeInTheDocument();
  });

  it('promete lo que la aplicación cumple: el audio no sale', () => {
    render(<Privacidad />);
    expect(
      screen.getByText(/Lo que oye el micrófono se analiza en tu navegador/),
    ).toBeInTheDocument();
  });

  it('dice que se habla con una IA (AI Act, art. 50)', () => {
    render(<Privacidad />);
    expect(screen.getByText(/hablas con una IA/)).toBeInTheDocument();
  });

  it('a quién va la pregunta depende del modelo configurado', () => {
    const { unmount } = render(<Privacidad />);
    expect(screen.getByText(/Anthropic, PBC \(Estados Unidos\)/)).toBeInTheDocument();
    expect(screen.getByText(/Marco de Privacidad de Datos UE-EE. UU./)).toBeInTheDocument();
    unmount();

    modelProvider.mockReturnValue('local');
    const local = render(<Privacidad />);
    expect(screen.getByText(/no sale a ningún otro proveedor/)).toBeInTheDocument();
    expect(screen.queryByText(/Anthropic/)).not.toBeInTheDocument();
    local.unmount();

    modelProvider.mockReturnValue('ninguno');
    render(<Privacidad />);
    expect(screen.getByText(/no hay modelo configurado/)).toBeInTheDocument();
  });

  it('el proveedor de correo sale solo si se manda correo', () => {
    const { unmount } = render(<Privacidad />);
    expect(screen.queryByText(/Resend/)).not.toBeInTheDocument();
    unmount();

    mailConfigured.mockReturnValue(true);
    render(<Privacidad />);
    expect(screen.getByText(/Resend, Inc./)).toBeInTheDocument();
  });

  it('sin cuentas dice que hoy no se guarda nada de eso', () => {
    authAvailable.mockReturnValue(false);
    render(<Privacidad />);
    expect(screen.getByText(/no tiene cuentas: hoy no se guarda nada/)).toBeInTheDocument();
  });

  it('la analítica: sin cookies, y el sí o el no ahí mismo', () => {
    render(<Privacidad />);
    expect(screen.getByText(/sin cookies y sin servicios de fuera/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Contar mis vueltas/ })).toBeInTheDocument();
  });

  it('enlaza el aviso legal y la cuenta, que es donde se borra', () => {
    render(<Privacidad />);
    expect(screen.getByRole('link', { name: 'aviso legal' })).toHaveAttribute(
      'href',
      '/aviso-legal',
    );
    expect(screen.getByRole('link', { name: 'tu cuenta' })).toHaveAttribute(
      'href',
      '/cuenta#privacidad',
    );
  });
});

describe('el aviso legal', () => {
  it('lleva su título de pestaña', () => {
    expect(metaAviso.title).toMatch(/Aviso legal/);
  });

  it('sin titular lo dice; el alojamiento no es cosa suya', () => {
    render(<AvisoLegal />);
    const aviso = screen.getByText(/no dice todavía quién la publica/);
    expect(aviso).toHaveTextContent('TITULAR_CORREO');
    expect(aviso).not.toHaveTextContent('TITULAR_ALOJAMIENTO');
  });

  it('con titular, sus datos, y enlaza la privacidad', () => {
    conTitular();
    render(<AvisoLegal />);
    expect(screen.queryByText(/no dice todavía/)).not.toBeInTheDocument();
    expect(screen.getByText('00000000T')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad',
    );
  });
});
