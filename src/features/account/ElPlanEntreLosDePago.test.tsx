// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ANONYMOUS, PAID_PLANS, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { ElPlanEntreLosDePago } from './ElPlanEntreLosDePago';

/**
 * Este plan entre los otros dos, al lado de la ventana de pago.
 *
 * Lo que se defiende es que se pueda **dudar sin salir de aquí**: los de pago con
 * su precio, el que miras sin enlace a sí mismo y el otro llevando a su
 * ventana. Y que el tuyo se diga, para no comprar dos veces lo mismo.
 */
const MEDIO = PAID_PLANS.find((p) => p.id === 'medio')!;

function pintar(account: Account = ANONYMOUS) {
  return render(
    <AccountProvider account={account} accounts>
      <ElPlanEntreLosDePago plan={MEDIO} />
    </AccountProvider>,
  );
}

describe('el plan entre los de pago', () => {
  it('estan los dos, con su precio', () => {
    pintar();

    for (const plan of PAID_PLANS) {
      expect(screen.getByText(plan.claim)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('el que miras se enciende y no es un enlace; los otros llevan a su ventana', () => {
    pintar();

    const este = screen.getByText(MEDIO.claim).closest('[aria-current="page"]');
    expect(este).not.toBeNull();
    expect(screen.getByText('El que miras')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Medio/ })).toBeNull();
    expect(screen.getByRole('link', { name: /^Básico/ })).toHaveAttribute('href', '/planes/basico');
  });

  it('dice cual es el tuyo, y si es el mismo que miras', () => {
    const { unmount } = pintar({ ...ANONYMOUS, email: 'a@b.c', plan: 'basico' });
    expect(screen.getByRole('link', { name: /^Básico/ })).toHaveTextContent('El tuyo');
    unmount();

    pintar({ ...ANONYMOUS, email: 'a@b.c', plan: 'medio' });
    expect(screen.getByText('El que miras, y el tuyo')).toBeInTheDocument();
  });

  it('y recuerda que la guitarra no va con ningun plan', () => {
    pintar();

    expect(screen.getByText(/Con ningún plan cambia la guitarra/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compararlos con calma' })).toHaveAttribute(
      'href',
      '/planes',
    );
  });
});
