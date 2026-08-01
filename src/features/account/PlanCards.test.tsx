// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { monthlyAiRequests, PAID_PLANS, PLANS, priceLabel, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { PlanCards } from './PlanCards';

function pintar(account: Account) {
  render(
    <AccountProvider account={account} accounts>
      <PlanCards />
    </AccountProvider>,
  );
}

const ANONIMO: Account = {
  email: null,
  name: null,
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: null,
  aiLeftMonth: null,
};
const EN_MEDIO: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 100,
  aiLeftMonth: 100,
};

/** La tarjeta de un plan, para no confundir su precio con su nombre. */
function tarjeta(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('article')!;
}

describe('Las tarjetas de los planes', () => {
  // El gratis no es una opción que se elija: es lo que tienes. Ponerlo aquí haría
  // que la decisión pareciera de cuatro cuando es de tres.
  it('enseña los tres de pago y no el gratis', () => {
    pintar(ANONIMO);

    expect(screen.getAllByRole('article')).toHaveLength(3);
    for (const plan of PAID_PLANS) {
      expect(screen.getByRole('heading', { name: plan.name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Gratis' })).not.toBeInTheDocument();
  });

  /**
   * El cupo que se enseña sale del modelo de coste, no de la tabla de planes: es el
   * mismo número que el servidor va a hacer cumplir, porque los dos salen de
   * dividir el presupuesto del plan entre el coste de una petición.
   */
  it('cada uno con su precio y el cupo que da con el modelo puesto', () => {
    pintar(ANONIMO);

    for (const plan of PAID_PLANS) {
      const card = within(tarjeta(plan.name));
      expect(card.getAllByText(priceLabel(plan.id)).length).toBeGreaterThan(0);
      expect(
        card.getByText(`${monthlyAiRequests(plan.id, ANONIMO.aiModel)} peticiones a la IA al mes`),
      ).toBeInTheDocument();
    }
  });

  it('un modelo más barato enseña un cupo más grande', () => {
    pintar({ ...ANONIMO, aiModel: 'claude-haiku-4-5' });

    const conHaiku = monthlyAiRequests('basico', 'claude-haiku-4-5');
    expect(
      within(tarjeta('Básico')).getByText(`${conHaiku} peticiones a la IA al mes`),
    ).toBeInTheDocument();
    expect(conHaiku).toBeGreaterThan(monthlyAiRequests('basico', 'claude-opus-5'));
  });

  /**
   * Lo que enseña cada tarjeta sale de la tabla de permisos, no de una lista
   * escrita a mano: una tabla de precios que miente es peor que no tenerla, y la
   * forma de que mienta es escribirla dos veces.
   */
  it('tacha lo que un plan no incluye', () => {
    pintar(ANONIMO);

    const enBasico = within(tarjeta('Básico')).getByText('Ideas de progresión de la IA');
    const enMedio = within(tarjeta('Medio')).getByText('Ideas de progresión de la IA');

    expect(enBasico.closest('li')).toHaveClass('line-through');
    expect(enMedio.closest('li')).not.toHaveClass('line-through');
  });

  it('cada tarjeta lleva a su ventana de pago, y no cobra desde aquí', () => {
    pintar(ANONIMO);

    for (const plan of PAID_PLANS) {
      expect(
        within(tarjeta(plan.name)).getByRole('link', { name: `Elegir ${plan.name}` }),
      ).toHaveAttribute('href', `/planes/${plan.id}`);
    }
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('marca el que ya tienes y no ofrece comprarlo otra vez', () => {
    pintar(EN_MEDIO);

    expect(within(tarjeta('Medio')).getByText('Es el que tienes')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Elegir Medio' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir Pro' })).toBeInTheDocument();
  });

  // Los planes se llamaron Estudiante y Conservatorio antes de ser tres.
  it('reconoce el nombre viejo del plan que tienes guardado', () => {
    pintar({
      email: 'javier@example.com',
      name: null,
      plan: 'estudiante' as Account['plan'],
      aiModel: 'claude-opus-5',
      aiLeftToday: 10,
      aiLeftMonth: 10,
    });

    expect(within(tarjeta('Básico')).getByText('Es el que tienes')).toBeInTheDocument();
  });

  it('no se inventa planes: son los del catálogo', () => {
    pintar(ANONIMO);

    expect(PAID_PLANS.length).toBe(PLANS.length - 1);
  });
});
