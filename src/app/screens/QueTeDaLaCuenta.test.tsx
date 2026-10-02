// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { AccountProvider } from '@state/account';

import { QueTeDaLaCuenta } from './QueTeDaLaCuenta';

function pintar(accounts: boolean) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={accounts}>
      <QueTeDaLaCuenta accounts={accounts} />
    </AccountProvider>,
  );
}

/**
 * Lo que va al lado del formulario de la cuenta.
 *
 * Lo que se prueba es que **no promete lo que aquí no hay**: sin cuentas
 * configuradas, ofrecer «tu avance en tu cuenta» al lado de «aquí no hay
 * cuentas» sería decir una cosa y su contraria en la misma pantalla.
 */
describe('Lo que va al lado de la cuenta', () => {
  it('con cuentas, dice lo que da y enlaza a los planes', () => {
    pintar(true);

    expect(screen.getByRole('region', { name: 'Qué te da la cuenta' })).toBeInTheDocument();
    expect(screen.getByText('Tu avance, en tu cuenta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver los tres planes' })).toHaveAttribute(
      'href',
      '/planes',
    );
  });

  it('sin cuentas, no promete nada de la cuenta y lleva a lo que ya funciona', () => {
    pintar(false);

    expect(screen.queryByText('Tu avance, en tu cuenta')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Lo que funciona sin cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /El camino/ })).toHaveAttribute('href', '/aprender');
    expect(screen.getByRole('link', { name: /Componer/ })).toHaveAttribute('href', '/componer');
    expect(screen.getByRole('link', { name: /Afinar/ })).toHaveAttribute('href', '/afinar');
  });

  /**
   * **Lo que no hay, dicho entero.** Decía «lo único que pide cuenta es la IA», y
   * el repaso y guardar las canciones van con un plan, que va con una cuenta.
   */
  it('no dice que lo unico que falta sea la IA', () => {
    for (const accounts of [false, true]) {
      const { unmount } = pintar(accounts);

      expect(document.body).not.toHaveTextContent(/Lo único que pide cuenta es la IA/);
      expect(document.body).not.toHaveTextContent(/entera menos la IA/);
      expect(document.body).toHaveTextContent(/el repaso de lo que fallaste/);
      expect(document.body).toHaveTextContent(/guardar tus canciones en la cuenta/);
      unmount();
    }
  });
});
