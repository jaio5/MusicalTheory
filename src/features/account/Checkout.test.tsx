// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, PAID_PLANS, planOf, type Account } from '@core/billing';
import type * as Cuenta from '@state/account';
import { AccountProvider } from '@state/account';

import { Checkout } from './Checkout';

const refrescar = vi.fn();
const changePlan = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refrescar, push: () => {} }),
  usePathname: () => '/planes/pro',
}));

vi.mock('@state/account', async (original) => ({
  ...(await original<typeof Cuenta>()),
  changePlan: (...a: unknown[]) => changePlan(...a),
}));

/**
 * La ventana de pago.
 *
 * La decisión que sostiene esta pantalla es **decir la verdad sobre si se cobra**,
 * y decirla antes del botón y no debajo en letra pequeña. Que se cobre o no lo
 * pregunta el servidor al cobrador que haya puesto: si estuviera escrito fijo, el
 * día que se enchufe la pasarela seguiría diciendo que no se cobra mientras se
 * cobra, que es la peor de las dos mentiras posibles. Ese aviso es lo que más se
 * mira aquí.
 *
 * Y no hay campos de tarjeta: unos que no van a ninguna pasarela serían un
 * decorado que se parece demasiado a un cobro de verdad.
 */

const PRO = PAID_PLANS.find((p) => p.id === 'pro')!;
const BASICO = PAID_PLANS.find((p) => p.id === 'basico')!;

const CUENTA: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'gratis',
  aiModel: 'claude-opus-5',
  aiLeftToday: 3,
  aiLeftMonth: 20,
};

function pintar(props: { plan?: typeof PRO; charges?: boolean } = {}, account = CUENTA) {
  return render(
    <AccountProvider account={account} accounts>
      <Checkout plan={props.plan ?? PRO} charges={props.charges ?? false} />
    </AccountProvider>,
  );
}

beforeEach(() => {
  refrescar.mockReset();
  changePlan.mockReset();
  changePlan.mockResolvedValue({ kind: 'listo', plan: 'pro' });
});

describe('lo que vas a contratar', () => {
  it('se enseña el plan, su precio y lo que trae', () => {
    pintar();

    expect(screen.getByText(`Plan ${PRO.name}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Qué vas a contratar')).toBeInTheDocument();
  });

  it('lo que ya tenias no se marca como nuevo', () => {
    // Marcarlo sería inflar la lista con cosas por las que ya pagabas.
    pintar({ plan: PRO }, { ...CUENTA, plan: 'medio' });

    const nuevos = screen.queryAllByText('nuevo').length;
    const todos = screen.getAllByText('✓').length;

    expect(nuevos).toBeLessThan(todos);
  });

  it('al bajar de plan se avisa de que se puede perder algo', async () => {
    pintar({ plan: BASICO }, { ...CUENTA, plan: 'pro' });

    expect(screen.getByText(/Comprueba que no pierdes nada/)).toBeInTheDocument();
    expect(screen.queryByText('nuevo')).not.toBeInTheDocument();
  });
});

describe('decir la verdad sobre si se cobra', () => {
  it('sin pasarela puesta se dice que aqui no se cobra nada', () => {
    pintar({ charges: false });

    expect(screen.getByText(/todavía no se cobra nada/)).toBeInTheDocument();
  });

  it('con pasarela puesta se dice que se sale a pagar', () => {
    pintar({ charges: true });

    expect(screen.getByText(/Al confirmar se sale a pagar/)).toBeInTheDocument();
    expect(screen.getByText(/no pasan por aquí/)).toBeInTheDocument();
  });

  it('no hay campos de tarjeta en ninguno de los dos casos', () => {
    // Unos campos que no van a ninguna pasarela serían un decorado que se parece
    // demasiado a un cobro de verdad.
    for (const cobra of [true, false]) {
      const { unmount } = pintar({ charges: cobra });

      expect(screen.queryByLabelText(/tarjeta/i), String(cobra)).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('confirmar', () => {
  it('sin cuenta no se confirma: primero se entra, y sin salir de aqui', () => {
    render(
      <AccountProvider account={ANONYMOUS} accounts>
        <Checkout plan={PRO} />
      </AccountProvider>,
    );

    expect(screen.getByLabelText('Entrar para continuar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activar el plan/ })).not.toBeInTheDocument();
  });

  it('sin cuentas configuradas se dice, y lo que no es IA sigue funcionando', () => {
    render(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <Checkout plan={PRO} />
      </AccountProvider>,
    );

    expect(screen.getByText(/no tiene cuentas configuradas/)).toBeInTheDocument();
  });

  it('al activarlo se refresca el servidor, que es quien lee el plan', async () => {
    // Sin esto, el resto de la aplicación seguiría con el plan de antes.
    pintar();

    await userEvent.click(screen.getByRole('button', { name: /Activar el plan/ }));

    await waitFor(() => expect(refrescar).toHaveBeenCalled());
    expect(screen.getByText(/Plan activado/)).toBeInTheDocument();
  });

  it('el que ya tienes no se vuelve a contratar', () => {
    pintar({ plan: PRO }, { ...CUENTA, plan: 'pro' });

    expect(screen.getByText(/Ya lo tienes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activar/ })).not.toBeInTheDocument();
  });

  it('si no se puede, se dice y no se canta victoria', async () => {
    changePlan.mockResolvedValue({ kind: 'error', message: 'No hemos podido.' });
    pintar();

    await userEvent.click(screen.getByRole('button', { name: /Activar el plan/ }));

    expect(await screen.findByText('No hemos podido.')).toBeInTheDocument();
    expect(screen.queryByText(/Plan activado/)).not.toBeInTheDocument();
  });

  it('con pasarela, se sale a su dominio y no se navega por dentro', async () => {
    // `assign` y no `router.push`: es otra web, no una ruta de esta aplicación.
    const irA = vi.fn();
    vi.stubGlobal('location', { assign: irA });
    changePlan.mockResolvedValue({ kind: 'ir-a-pagar', url: 'https://pago' });
    pintar({ charges: true });

    await userEvent.click(screen.getByRole('button', { name: /Activar el plan/ }));

    await waitFor(() => expect(irA).toHaveBeenCalledWith('https://pago'));
    expect(refrescar).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('el plan que se pide', () => {
  it('es el de la pantalla, no uno del cuerpo', async () => {
    pintar({ plan: BASICO });

    await userEvent.click(screen.getByRole('button', { name: /Activar el plan/ }));

    await waitFor(() => expect(changePlan).toHaveBeenCalledWith(planOf('basico').id));
  });
});
