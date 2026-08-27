// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { ReviewScreen } from './ReviewScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/aprender/repaso',
}));

/**
 * El repaso.
 *
 * Pantalla propia porque es una sesión con principio y final, como una unidad: la
 * cola se congela al entrar, se contesta y se sale. Metida en una pestaña del
 * camino se olvidaba, y era justo lo que no podía pasar con lo que uno ya ha
 * fallado una vez.
 *
 * Lo que se prueba con más cuidado es el candado: **lo que fallas se apunta
 * igual** aunque no haya plan. Decir lo contrario haría que quien pague empiece
 * con la cola vacía, y decir esto y no cumplirlo sería peor.
 */

const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

function pintar(account: Account = ANONYMOUS) {
  return render(
    <AccountProvider account={account} accounts>
      <ReviewScreen />
    </AccountProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('sin plan', () => {
  it('se dice que va con plan, y que lo fallado se apunta igual', () => {
    pintar();

    expect(screen.getByRole('heading', { name: /va con plan/ })).toBeInTheDocument();
    expect(screen.getByText(/se apunta de todas formas/)).toBeInTheDocument();
  });

  it('y hay vuelta al camino, que es de donde se llega', () => {
    pintar();

    expect(screen.getByRole('link', { name: /Camino/ })).toHaveAttribute('href', '/aprender');
  });
});

describe('con plan', () => {
  it('se entra al repaso, con la tonalidad a la vista', () => {
    // La cola se genera otra vez en la tonalidad de hoy, así que hay que verla.
    pintar(CON_PLAN);

    expect(screen.getByRole('heading', { name: 'Repaso' })).toBeInTheDocument();
    expect(screen.getAllByText(/sin tonalidad/).length).toBeGreaterThan(0);
  });

  it('sin tonalidad puesta se ofrece la rueda para elegir una', () => {
    pintar(CON_PLAN);

    expect(screen.getByText(/Lo que fallaste, otra vez/)).toBeInTheDocument();
  });
});
