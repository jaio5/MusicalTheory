// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { monthlyAiRequests, PAID_PLANS, priceLabel, type Account } from '@core/billing';
import { AccountProvider } from '@state/account';

import { Checkout } from './Checkout';

// El componente pide al servidor que vuelva a pintar tras activar el plan; en un
// test no hay router de Next, así que se sustituye por uno que no hace nada.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const PRO = PAID_PLANS.find((plan) => plan.id === 'pro')!;
const MEDIO = PAID_PLANS.find((plan) => plan.id === 'medio')!;

const ANONIMO: Account = {
  email: null,
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: null,
  aiLeftMonth: null,
};
const EN_BASICO: Account = {
  email: 'javier@example.com',
  plan: 'basico',
  aiModel: 'claude-opus-5',
  aiLeftToday: 40,
  aiLeftMonth: 40,
};

function pintar(plan = PRO, account: Account = EN_BASICO, accounts = true) {
  render(
    <AccountProvider account={account} accounts={accounts}>
      <Checkout plan={plan} />
    </AccountProvider>,
  );
}

describe('La ventana de pago', () => {
  it('dice qué plan es y cuánto cuesta', () => {
    pintar();

    expect(screen.getByText(`Plan ${PRO.name}`)).toBeInTheDocument();
    expect(screen.getByText(priceLabel(PRO.id))).toBeInTheDocument();
  });

  /**
   * Detrás del cambio de plan hay un cobrador que no cobra. Pintar campos de
   * tarjeta que no llevan a ninguna pasarela sería un decorado que se parece
   * demasiado a un cobro de verdad.
   */
  it('no pide una tarjeta ni finge cobrar', () => {
    pintar();

    expect(screen.queryByLabelText(/tarjeta/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/\d{4}/)).not.toBeInTheDocument();
    expect(screen.getByText(/todavía no se cobra nada/i)).toBeInTheDocument();
  });

  it('avisa antes del botón, no en letra pequeña debajo', () => {
    pintar();

    const aviso = screen.getByText(/todavía no se cobra nada/i);
    const boton = screen.getByRole('button', { name: /Activar el plan Pro/ });

    // `compareDocumentPosition` con FOLLOWING: el botón viene después del aviso.
    expect(aviso.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Lo que ya tenías no es lo que estás comprando.
  it('marca como nuevo solo lo que el plan de ahora no incluye', () => {
    pintar(PRO, EN_BASICO);

    const nuevos = screen.getAllByText('nuevo');
    expect(nuevos.length).toBeGreaterThan(0);

    const profesor = screen.getByText('Preguntar al profesor').closest('li')!;
    expect(profesor.textContent).not.toContain('nuevo');
  });

  it('enseña el salto de cupo cuando se sube de plan', () => {
    pintar(PRO, EN_BASICO);

    const ahora = monthlyAiRequests('basico', EN_BASICO.aiModel);
    expect(screen.getByText(new RegExp(`ahora tienes ${ahora}`))).toBeInTheDocument();
  });

  it('sin cuenta pide entrar antes de seguir, sin perder el plan elegido', () => {
    pintar(PRO, ANONIMO);

    expect(screen.getByRole('group', { name: 'Entrar o registrarse' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/sigues con el plan Pro/i)).toBeInTheDocument();
  });

  it('si ya lo tienes no ofrece pagarlo otra vez', () => {
    pintar(MEDIO, { ...EN_BASICO, plan: 'medio' });

    expect(screen.getByText(`Tienes el plan ${MEDIO.name}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al camino' })).toHaveAttribute('href', '/aprender');
  });

  it('al bajar de plan avisa de que hay que comprobar qué se pierde', () => {
    pintar(MEDIO, { ...EN_BASICO, plan: 'pro' });

    expect(screen.getByText(/Vienes del plan Pro/)).toBeInTheDocument();
    expect(screen.queryByText('nuevo')).not.toBeInTheDocument();
  });

  it('sin cuentas configuradas lo dice y no ofrece nada', () => {
    pintar(PRO, ANONIMO, false);

    expect(screen.getByText(/no tiene cuentas configuradas/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activar/ })).not.toBeInTheDocument();
  });

  it('enseña lo que incluye el plan, sacado del catálogo', () => {
    pintar(PRO, EN_BASICO);

    expect(screen.getByText('Un profesor que sabe por dónde vas')).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`${monthlyAiRequests('pro', EN_BASICO.aiModel)} peticiones a la IA al mes`),
      ),
    ).toBeInTheDocument();
  });
});
