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

describe('la suscripción', () => {
  it('con plan de pago se ofrece cambiarlo, no verlos', () => {
    pintar(DENTRO);

    expect(screen.getByRole('link', { name: 'Cambiar de plan' })).toHaveAttribute(
      'href',
      '/planes',
    );
  });

  it('con el gratis se ofrece verlos, que es lo que hay que hacer primero', () => {
    // «Cambiar de plan» delante de quien no tiene ninguno da a entender que ya
    // paga algo.
    pintar({ ...DENTRO, plan: 'gratis' });

    expect(screen.getByRole('link', { name: 'Ver los tres planes' })).toBeInTheDocument();
  });

  /**
   * El precio se dice cuando dice algo que el nombre no diga ya.
   *
   * El plan gratis se llama «Gratis» y su precio es «Gratis», así que la
   * pastilla de arriba ponía «Plan Gratis» y debajo «Gratis» otra vez, y la
   * suscripción lo repetía igual. Repetir una palabra no es informar.
   */
  it('el gratis no dice dos veces que es gratis', () => {
    pintar({ ...DENTRO, plan: 'gratis' });

    expect(screen.getByText('Plan Gratis')).toBeInTheDocument();
    // La única vez que aparece suelto es el nombre del plan en la suscripción.
    expect(screen.getAllByText('Gratis')).toHaveLength(1);
  });

  it('y el de pago si dice lo que cuesta', () => {
    pintar({ ...DENTRO, plan: 'basico' });

    expect(screen.getAllByText('4,99 € al mes').length).toBeGreaterThan(0);
  });

  it('el cupo se cuenta desde lo que queda, no desde lo que da el plan', () => {
    // Lo que hace falta saber antes de pedir otra idea es cuántas quedan.
    pintar(DENTRO);

    expect(screen.getByText(/90 de \d+ peticiones a la IA este mes/)).toBeInTheDocument();
  });

  it('sin contador todavía leído se dice lo que da el plan', () => {
    // Es lo que pasa en la primera carga antes de que el servidor conteste: un
    // hueco ahí parecería que el plan no incluye nada.
    pintar({ ...DENTRO, aiLeftMonth: null });

    expect(screen.getByText(/^\d+ peticiones a la IA al mes$/)).toBeInTheDocument();
  });
});
