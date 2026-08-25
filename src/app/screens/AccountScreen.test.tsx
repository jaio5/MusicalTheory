// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { AccountScreen } from './AccountScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/cuenta',
}));

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
      <AccountScreen />
    </AccountProvider>,
  );
}

describe('La ventana de usuario', () => {
  /**
   * Entrar aquí es casi siempre mirar —cuánto llevo, qué plan tengo— y solo de
   * vez en cuando cambiar algo, así que la ficha va antes que los formularios.
   */
  it('empieza por quién eres: nombre, correo y plan', () => {
    pintar(DENTRO);

    expect(screen.getByText('Javier')).toBeInTheDocument();
    expect(screen.getByText('javier@example.com')).toBeInTheDocument();
    expect(screen.getByText(/plan medio/i)).toBeInTheDocument();
  });

  it('enseña lo que llevas hecho en números', () => {
    pintar(DENTRO);

    for (const que of ['XP', 'Racha', 'Unidades', 'Medallas']) {
      expect(screen.getByText(que)).toBeInTheDocument();
    }
  });

  // Las cuatro secciones que enlaza el desplegable del avatar tienen que existir
  // con su ancla, o el menú lleva a ninguna parte.
  it('tiene las cuatro secciones a las que apunta el avatar', () => {
    const { container } = pintar(DENTRO);

    for (const ancla of ['perfil', 'suscripcion', 'contrasena', 'privacidad']) {
      expect(container.querySelector(`#${ancla}`), ancla).not.toBeNull();
    }
  });

  // Sin sesión esto no son los ajustes de nadie: lo único que se puede hacer es
  // entrar, y se ofrece eso en vez de cuatro secciones vacías.
  it('sin haber entrado ofrece entrar y no la ficha', () => {
    pintar(ANONYMOUS);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Entrar');
    expect(screen.queryByText('Medallas')).not.toBeInTheDocument();
  });
});
