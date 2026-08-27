// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { PlansScreen } from './PlansScreen';

/**
 * La pantalla de planes.
 *
 * Lo que se prueba es el orden de lectura, que es la decisión de esta pantalla:
 * **lo primero que se lee es lo que no cuesta dinero**. Casi todo pasa en el
 * navegador de quien toca y servirlo no cuesta nada; empezar por la lista de
 * precios daría a entender que la guitarra está de pago, y no lo está.
 */

const DENTRO: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 12,
  aiLeftMonth: 90,
};

function pintar(account: Account = ANONYMOUS) {
  return render(
    <AccountProvider account={account} accounts>
      <PlansScreen />
    </AccountProvider>,
  );
}

describe('Los planes', () => {
  it('lo primero que se lee es lo que es gratis', () => {
    pintar();

    const texto = document.body.textContent ?? '';
    const gratis = texto.indexOf('gratis y lo van a seguir siendo');
    const planes = texto.indexOf('Los tres planes de pago');

    expect(gratis).toBeGreaterThanOrEqual(0);
    expect(gratis).toBeLessThan(planes);
  });

  it('dice qué es lo que cuesta dinero, y por qué', () => {
    // La IA se paga por llamada y el temario del Profesional está escrito: son
    // las dos únicas cosas que no salen gratis, y decirlo evita que parezca que
    // se cobra por tocar.
    pintar();

    expect(screen.getByText(/Lo que cuesta dinero es la IA/)).toBeInTheDocument();
  });

  it('a quien no ha entrado le ofrece crear la cuenta', () => {
    pintar();

    expect(screen.getByText(/No has entrado/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Crear una cuenta/ })).toHaveAttribute(
      'href',
      '/registro',
    );
  });

  it('a quien ya está dentro le dice qué plan tiene', () => {
    pintar(DENTRO);

    expect(screen.getByText(/Ahora mismo tienes el plan/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tu cuenta/ })).toHaveAttribute('href', '/cuenta');
  });
});
