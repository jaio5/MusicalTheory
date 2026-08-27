// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { EMPTY_PROGRESS, pitchClassFromName, UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { ReviewScreen } from './ReviewScreen';

const empujar = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: empujar }),
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
  empujar.mockReset();
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

describe('la cola de lo que fallaste', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  });

  it('vacia se dice, y se explica como se llena', () => {
    // Lo que falles vuelve el mismo día y otra vez al siguiente. Sin decirlo,
    // una pantalla vacía parece una avería.
    pintar(CON_PLAN);

    expect(screen.getByText('No hay nada que repasar.')).toBeInTheDocument();
    expect(screen.getByText(/vuelve el mismo día/)).toBeInTheDocument();
  });

  it('con algo pendiente se pregunta, y al terminar se celebra', async () => {
    // La celebración vive aquí, como en una unidad: el repaso es una sesión con
    // principio y final.
    const hoy = new Date();
    const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
      hoy.getDate(),
    ).padStart(2, '0')}`;
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({
        ...EMPTY_PROGRESS,
        review: [{ unitId: UNIT_ORDER[0]!, index: 0, dueOn: dia, streak: 0 }],
      }),
    );

    pintar(CON_PLAN);

    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const seguir = screen.queryByRole('button', { name: /Siguiente|Terminar el repaso/ });
      if (seguir !== null) {
        await userEvent.click(seguir);
        continue;
      }
      const pregunta = screen.queryAllByRole('group').find((grupo) => grupo.tagName === 'FIELDSET');
      const opciones = pregunta === undefined ? [] : within(pregunta).queryAllByRole('button');
      if (opciones.length === 0) {
        break;
      }
      await userEvent.click(opciones[0]!);
    }

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Volver al camino' })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Volver al camino' }));

    expect(empujar).toHaveBeenCalledWith('/aprender');
  });

  it('se puede salir sin terminar, sin perder lo contestado', async () => {
    pintar(CON_PLAN);

    await userEvent.click(screen.getByRole('button', { name: 'Volver al camino' }));

    expect(empujar).toHaveBeenCalledWith('/aprender');
  });
});
