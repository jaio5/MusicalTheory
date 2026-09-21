// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import { EMPTY_PROGRESS, findUnit, pitchClassFromName, UNIT_ORDER } from '@core/music';
import type * as Learn from '@features/learn';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

/**
 * Terminar una unidad de tocar.
 *
 * En un fichero aparte porque hace falta **sustituir** `LearnPanel`: el de
 * verdad da la escala por tocada cuando el micrófono oye las notas, y un
 * micrófono en jsdom no arranca. Lo que se prueba aquí no es el mástil —eso ya
 * tiene sus pruebas en `features/learn`— sino lo que esta pantalla hace con lo
 * que le cuenta: apuntar lo que costó y darla por terminada.
 */
vi.mock('@features/learn', async (original) => ({
  ...(await original<typeof Learn>()),
  LearnPanel: ({ onDone }: { readonly onDone?: (stumbled: readonly number[]) => void }) => (
    <>
      <button type="button" onClick={() => onDone?.([])}>
        Tocarla del tirón
      </button>
      <button type="button" onClick={() => onDone?.([2])}>
        Tocarla trompicada
      </button>
    </>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/aprender',
}));

const { UnitScreen } = await import('./UnitScreen');

const PRO: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

const SIN_PLAN: Account = { ...PRO, plan: 'gratis' };

const DE_TOCAR = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'play')!;

/** El avance guardado, tal y como queda en el equipo. */
function avance(): { readonly review?: readonly unknown[] } {
  return JSON.parse(localStorage.getItem('caos-ordenado:aprender') ?? '{}');
}

function pintar(account: Account) {
  localStorage.setItem(
    'caos-ordenado:aprender',
    JSON.stringify({
      ...EMPTY_PROGRESS,
      done: UNIT_ORDER.slice(0, UNIT_ORDER.indexOf(DE_TOCAR)),
    }),
  );
  useSessionStore.getState().actions.reset();
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  return render(
    <AccountProvider account={account} accounts>
      <UnitScreen unitId={DE_TOCAR} />
    </AccountProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('una unidad de tocar, terminada', () => {
  it('del tiron: se da por hecha y sin nada que repasar', async () => {
    pintar(PRO);

    await userEvent.click(screen.getByRole('button', { name: 'Tocarla del tirón' }));

    expect(screen.getByRole('link', { name: /Volver al camino/ })).toBeInTheDocument();
    expect(avance().review).toEqual([]);
  });

  /**
   * Y lo que costó vuelve, igual que una pregunta fallada: terminar la escala
   * sigue siendo terminarla —aquí no se suspende— pero el paso que se soltó dos
   * veces entra en la cola.
   */
  it('trompicada: se da por hecha igual, y lo que costo vuelve', async () => {
    pintar(PRO);

    await userEvent.click(screen.getByRole('button', { name: 'Tocarla trompicada' }));

    expect(screen.getByRole('link', { name: /Volver al camino/ })).toBeInTheDocument();
    expect(avance().review).not.toEqual([]);
  });

  // Sin plan no hay cola de repaso, así que lo que costó no se apunta.
  it('y sin plan, lo que costo no se apunta', async () => {
    pintar(SIN_PLAN);

    await userEvent.click(screen.getByRole('button', { name: 'Tocarla trompicada' }));

    expect(avance().review).toEqual([]);
  });
});
