// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { lessonNotes, pitchClassFromName, type TheoryUnit as TheoryUnitDef } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { TheoryUnit } from './TheoryUnit';

const GRADOS: TheoryUnitDef = {
  id: 'e1-grados',
  title: 'Qué es un grado',
  kind: 'theory',
  lesson: 'degrees',
  xp: 20,
};

beforeEach(() => {
  useSessionStore.getState().actions.reset();
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
});

describe('los encabezados de una unidad de teoría', () => {
  /**
   * Encima está el título de la unidad, que es el `h1`. «Compruébalo» era un `h3`
   * y quien navega por encabezados saltaba un nivel buscando el apartado que
   * faltaba.
   */
  it('«Compruébalo» cuelga directamente del título: es un h2', () => {
    render(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <TheoryUnit unit={GRADOS} onDone={() => {}} />
      </AccountProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Compruébalo' })).toHaveProperty('tagName', 'H2');
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});

describe('fallar una pregunta', () => {
  const C = pitchClassFromName('C');
  const mala = () =>
    lessonNotes('degrees', C, 'major').exercises[0]!.choices.find((c) => !c.correct)!;

  function pintar(onMiss?: (index: number) => void) {
    render(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <TheoryUnit unit={GRADOS} onDone={() => {}} {...(onMiss ? { onMiss } : {})} />
      </AccountProvider>,
    );
  }

  it('avisa de cuál se ha fallado, por su posición', async () => {
    const onMiss = vi.fn();
    pintar(onMiss);

    await userEvent.click(screen.getByRole('button', { name: mala().text }));

    expect(onMiss).toHaveBeenCalledWith(0);
  });

  it('sin nadie a quien avisar, la corrección sale igual', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: mala().text }));

    expect(screen.getByText(/^Era /)).toBeInTheDocument();
  });
});
