// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingPortalLink } from './BillingPortalLink';

const url = vi.hoisted(() => vi.fn());
vi.mock('@state/account', () => ({ billingPortalUrl: url }));

const assign = vi.fn();

beforeEach(() => {
  url.mockReset();
  assign.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign },
  });
});

describe('el enlace a la pasarela', () => {
  it('es un botón, porque la dirección no existe hasta que se pide', () => {
    render(<BillingPortalLink />);

    // Un `<a href>` puesto al pintar estaría caducado antes de que nadie lo
    // pulsara, y lo abriría cualquier rastreador que siguiera los enlaces.
    expect(screen.getByRole('button', { name: 'Tarjeta y facturas' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('no pide nada hasta que se pulsa', () => {
    render(<BillingPortalLink />);

    expect(url).not.toHaveBeenCalled();
  });

  it('sale hacia la pasarela cuando hay adónde ir', async () => {
    url.mockResolvedValue('https://billing.stripe.com/p/session_123');
    render(<BillingPortalLink />);

    await userEvent.click(screen.getByRole('button', { name: 'Tarjeta y facturas' }));

    expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/p/session_123');
  });

  it('sin facturas lo dice, en vez de mandar a una página vacía', async () => {
    url.mockResolvedValue(null);
    render(<BillingPortalLink />);

    await userEvent.click(screen.getByRole('button', { name: 'Tarjeta y facturas' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/no ha pagado nada/);
    expect(assign).not.toHaveBeenCalled();
  });
});
