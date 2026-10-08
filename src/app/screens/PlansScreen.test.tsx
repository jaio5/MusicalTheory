// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ANONYMOUS, MESES_GRATIS_AL_AÑO, PAID_PLANS, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { PlansScreen } from './PlansScreen';

/**
 * La pantalla de planes.
 *
 * Lo que se prueba es el orden de lectura, que es la decisión de esta pantalla:
 * **lo primero que se lee es que lo que no cuesta dinero es gratis**, en una
 * línea, y **lo primero que se ve son los planes** (adr/0122). Empezar por la
 * lista de precios daría a entender que la guitarra está de pago; empezar por
 * cuatro párrafos dejaba los planes bajo el pliegue.
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
  it('lo primero que se lee es lo que es gratis, en la línea de la cabecera', () => {
    pintar();

    const texto = document.body.textContent ?? '';
    const gratis = texto.indexOf('es gratis y lo va a seguir siendo');
    const planes = texto.indexOf('Los planes de pago');

    expect(gratis).toBeGreaterThanOrEqual(0);
    expect(gratis).toBeLessThan(planes);
  });

  it('y lo primero que se ve son las tarjetas: la explicación larga va después', () => {
    pintar();

    const texto = document.body.textContent ?? '';
    const tarjetas = texto.indexOf(PAID_PLANS[0]!.name);

    expect(tarjetas).toBeGreaterThanOrEqual(0);
    expect(tarjetas).toBeLessThan(texto.indexOf('gratis y lo van a seguir siendo'));
    expect(tarjetas).toBeLessThan(texto.indexOf('Sin plan tienes'));
  });

  it('el pago anual se dice también en la prosa, con sus meses gratis', () => {
    pintar();

    expect(screen.getByText(/Lo que cuesta dinero es la IA/)).toHaveTextContent(
      `el año sale con ${MESES_GRATIS_AL_AÑO} meses gratis`,
    );
  });

  it('dice qué es lo que cuesta dinero, y por qué', () => {
    // La IA se paga por llamada y el temario del Profesional está escrito: son
    // las dos únicas cosas que no salen gratis, y decirlo evita que parezca que
    // se cobra por tocar.
    pintar();

    expect(screen.getByText(/Lo que cuesta dinero es la IA/)).toBeInTheDocument();
  });

  /**
   * **Y no se contradice con las tarjetas.** Decía «sin plan tienes todo menos la
   * IA y el Grado Profesional», y el repaso y guardar las canciones van con el
   * Básico. Lo que no entra sale ahora de la tabla de permisos.
   */
  it('sin pagar no entran ni el repaso ni guardar canciones, y lo dice', () => {
    pintar();

    const sinPagar = screen.getByText(/Sin plan tienes/);
    expect(sinPagar).toHaveTextContent(/el repaso de lo que fallaste/);
    expect(sinPagar).toHaveTextContent(/guardar tus canciones en la cuenta/);
    expect(document.body).not.toHaveTextContent(/menos la IA y el Grado Profesional/);
    expect(screen.getByText(/Desde el plan Básico se suman/)).toHaveTextContent(
      /el repaso de lo que fallaste/,
    );
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
