// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DAILY_GOAL_XP, EMPTY_PROGRESS, UNIT_ORDER, completeUnit } from '@core/music';

import { UnitDone } from './UnitDone';
import type { Celebration } from './use-progress';

const HOY = '2026-07-29';

const BASE: Celebration = {
  unitId: 'e1-grados',
  title: 'Qué es un grado',
  xp: 20,
  streak: 1,
  newBadges: [],
  goalJustMet: false,
  flawless: false,
};

function pintar(celebration: Partial<Celebration> = {}, progress = EMPTY_PROGRESS) {
  const onNext = vi.fn();
  render(
    <UnitDone
      celebration={{ ...BASE, ...celebration }}
      progress={progress}
      day={HOY}
      onNext={onNext}
      nextLabel="Seguir"
    />,
  );
  return onNext;
}

describe('La pantalla de después', () => {
  it('dice qué unidad y cuánto se ha ganado', () => {
    pintar();

    expect(screen.getByText('Qué es un grado')).toBeInTheDocument();
    expect(screen.getByText('+20 XP')).toBeInTheDocument();
  });

  it('marca cuando se ha acertado todo a la primera', () => {
    pintar({ flawless: true });

    expect(screen.getByText('Sin un fallo')).toBeInTheDocument();
  });

  it('sin acertarlo todo no lo dice', () => {
    pintar();

    expect(screen.getByText('Unidad superada')).toBeInTheDocument();
    expect(screen.queryByText('Sin un fallo')).not.toBeInTheDocument();
  });

  it('enseña la racha en singular y en plural', () => {
    pintar({ streak: 1 });
    expect(screen.getByText('1 día')).toBeInTheDocument();
  });

  it('avisa cuando la meta se acaba de cerrar', () => {
    const progress = UNIT_ORDER.slice(0, 2).reduce(
      (current, id) => completeUnit(current, id, HOY),
      EMPTY_PROGRESS,
    );

    pintar({ goalJustMet: true }, progress);

    expect(screen.getByText(/Meta del día cerrada/)).toBeInTheDocument();
    expect(screen.getByText('cerrada')).toBeInTheDocument();
  });

  it('sin cerrarla enseña cuánto llevaba del día', () => {
    const progress = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, HOY);

    pintar({}, progress);

    expect(screen.getByText(`${progress.xpToday} de ${DAILY_GOAL_XP}`)).toBeInTheDocument();
  });

  it('enseña las medallas nuevas con lo que hay que hacer para tenerlas', () => {
    pintar({ newBadges: ['primer-paso'] });

    const lista = screen.getByRole('list', { name: 'Medallas nuevas' });
    expect(lista).toBeInTheDocument();
    expect(screen.getByText('Primer paso')).toBeInTheDocument();
    expect(screen.getByText('Termina tu primera unidad.')).toBeInTheDocument();
  });

  it('sin medallas nuevas no enseña la lista vacía', () => {
    pintar();

    expect(screen.queryByRole('list', { name: 'Medallas nuevas' })).not.toBeInTheDocument();
  });

  it('el botón de seguir avisa', () => {
    const onNext = pintar();

    screen.getByRole('button', { name: 'Seguir' }).click();

    expect(onNext).toHaveBeenCalled();
  });

  it('un repaso terminado se cuenta como repaso, no como unidad', () => {
    pintar({ unitId: 'repaso', title: 'Repaso', xp: 10 });

    expect(screen.getByText('Repaso terminado')).toBeInTheDocument();
  });
});
