// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// El menú lee la dirección para cerrarse al navegar, y el botón de salir pide
// repintar. Ninguna de las dos cosas es lo que se prueba aquí.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/aprender',
}));

import { ANONYMOUS, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { AccountMenu } from './AccountMenu';

const DENTRO: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 12,
  aiLeftMonth: 90,
};

function pintar(account: Account, accounts = true) {
  return render(
    <AccountProvider account={account} accounts={accounts}>
      <AccountMenu />
    </AccountProvider>,
  );
}

describe('El avatar sin cuenta', () => {
  // Un desplegable con una sola opción es un clic de más para llegar al mismo
  // sitio.
  it('es un enlace directo a registrarse, sin desplegable', () => {
    pintar(ANONYMOUS);

    expect(screen.getByRole('link', { name: /crear tu cuenta/i })).toHaveAttribute(
      'href',
      '/registro',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // Sin base de datos ni secreto no hay cuentas que crear: un botón que lleva a
  // un formulario que no puede funcionar es peor que no tenerlo.
  it('no aparece si esta copia no tiene cuentas', () => {
    const { container } = pintar(ANONYMOUS, false);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('El avatar con cuenta', () => {
  it('enseña la inicial y dice de quién es', () => {
    pintar(DENTRO);

    const boton = screen.getByRole('button', { name: /javier.*plan medio/i });
    expect(boton).toHaveTextContent('J');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('abre el desplegable con los cuatro sitios y con salir', async () => {
    pintar(DENTRO);

    await userEvent.click(screen.getByRole('button', { name: /javier/i }));

    expect(screen.getByRole('button', { name: /javier/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const menu = screen.getByRole('menu');
    expect(menu).toHaveTextContent('javier@example.com');

    for (const [nombre, destino] of [
      [/tu perfil/i, '/cuenta#perfil'],
      [/tu suscripción/i, '/cuenta#suscripcion'],
      [/contraseña/i, '/cuenta#contrasena'],
      [/privacidad/i, '/cuenta#privacidad'],
    ] as const) {
      expect(screen.getByRole('menuitem', { name: nombre })).toHaveAttribute('href', destino);
    }

    expect(screen.getByRole('button', { name: /salir de la cuenta/i })).toBeInTheDocument();
  });

  // Escape cierra y el foco vuelve al botón: si se queda dentro de lo que acaba
  // de desaparecer, quien navega con teclado se queda sin sitio.
  it('se cierra con Escape y devuelve el foco', async () => {
    pintar(DENTRO);
    const boton = screen.getByRole('button', { name: /javier/i });

    await userEvent.click(boton);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
  });

  it('se cierra al pulsar fuera', async () => {
    render(
      <AccountProvider account={DENTRO} accounts>
        <AccountMenu />
        <button type="button">Otra cosa</button>
      </AccountProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /javier/i }));
    await userEvent.click(screen.getByRole('button', { name: /otra cosa/i }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
