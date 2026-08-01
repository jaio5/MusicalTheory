// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { planOf } from '@core/billing';

import { PlanLock } from './PlanLock';
import { PlansLink, seArreglaConPlan } from './PlansLink';

/**
 * Lo que se prueba aquí es una sola cosa: que decir «te hace falta un plan» y no
 * poder ir a verlos es un callejón. El enlace llevaba a `/cuenta`, que dice quién
 * eres y no qué cuesta cada plan.
 */
describe('El enlace a los planes', () => {
  it('lleva a la pantalla de los tres planes', () => {
    render(<PlansLink />);
    expect(screen.getByRole('link', { name: /ver los tres planes/i })).toHaveAttribute(
      'href',
      '/planes',
    );
  });
});

describe('El candado', () => {
  it('dice qué plan hace falta y lleva a verlo', () => {
    render(<PlanLock needed={planOf('medio')} what="Las ideas de la IA" signedIn />);

    expect(screen.getByRole('note')).toHaveTextContent(
      /las ideas de la ia entra en el plan medio/i,
    );
    expect(screen.getByRole('link', { name: /ver los tres planes/i })).toHaveAttribute(
      'href',
      '/planes',
    );
  });

  // Sin cuenta también se va a los planes: entrar se hace en la ventana del plan,
  // sin salir a otra pantalla y sin perder por dónde ibas.
  it('sin cuenta lleva al mismo sitio, y avisa de que el plan va con una', () => {
    render(<PlanLock needed={null} what="El repaso" signedIn={false} />);

    expect(screen.getByRole('link', { name: /ver los tres planes/i })).toHaveAttribute(
      'href',
      '/planes',
    );
    expect(screen.getByText(/el plan va con una cuenta/i)).toBeInTheDocument();
  });
});

describe('Cuándo el enlace arregla algo', () => {
  it('siempre que falte plan', () => {
    expect(seArreglaConPlan('plan_required', 'gratis')).toBe(true);
    expect(seArreglaConPlan('plan_required', 'medio')).toBe(true);
  });

  it('con el cupo gastado, solo si queda plan por encima', () => {
    expect(seArreglaConPlan('quota_exhausted', 'basico')).toBe(true);
    expect(seArreglaConPlan('quota_exhausted', 'pro')).toBe(false);
  });

  // Lo que no arregla ningún plan no se ofrece: un enlace que no lleva a la
  // solución hace perder el viaje justo cuando algo ya ha fallado.
  it('nunca con un fallo que no es de plan', () => {
    expect(seArreglaConPlan('model_unavailable', 'gratis')).toBe(false);
    expect(seArreglaConPlan('invalid_request', 'gratis')).toBe(false);
    expect(seArreglaConPlan(null, 'gratis')).toBe(false);
  });
});
