// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DAILY_GOAL_XP,
  EMPTY_PROGRESS,
  UNIT_ORDER,
  completeUnit,
  missQuestion,
  type Progress,
} from '@core/music';

import { DailyGoal } from './DailyGoal';

const HOY = '2026-07-29';

function pintar(
  progress: Progress = EMPTY_PROGRESS,
  { day = HOY as string | null, repaso = true } = {},
) {
  const onReview = vi.fn();
  render(<DailyGoal progress={progress} day={day} onReview={repaso ? onReview : null} />);
  return onReview;
}

/** Termina unidades en orden, todas hoy. */
function tras(cuantas: number): Progress {
  return UNIT_ORDER.slice(0, cuantas).reduce(
    (progress, id) => completeUnit(progress, id, HOY),
    EMPTY_PROGRESS,
  );
}

describe('La meta del día', () => {
  it('empieza vacía y dice cuánto falta', () => {
    pintar();

    expect(
      screen.getByRole('img', { name: `0 de ${DAILY_GOAL_XP} XP de la meta de hoy` }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${DAILY_GOAL_XP} XP`)).toBeInTheDocument();
  });

  it('descuenta lo hecho hoy', () => {
    const progress = tras(1);

    pintar(progress);

    expect(
      screen.getByRole('img', {
        name: `${progress.xpToday} de ${DAILY_GOAL_XP} XP de la meta de hoy`,
      }),
    ).toBeInTheDocument();
  });

  it('al cerrarla lo dice y deja de pedir más', () => {
    pintar(tras(2));

    expect(screen.getByText(/Hecha/)).toBeInTheDocument();
    expect(screen.queryByText(/Te faltan/)).not.toBeInTheDocument();
  });

  // Lo de ayer no cuenta para la meta de hoy: si contase, quien estudió mucho
  // ayer abriría la aplicación con la meta cumplida sin tocar nada.
  it('lo de ayer no cuenta hoy', () => {
    const ayer = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-28');

    pintar(ayer);

    expect(
      screen.getByRole('img', { name: `0 de ${DAILY_GOAL_XP} XP de la meta de hoy` }),
    ).toBeInTheDocument();
  });
});

describe('La racha', () => {
  it('sin practicar no hay racha', () => {
    pintar();

    expect(screen.getByText('sin racha')).toBeInTheDocument();
  });

  it('en singular el primer día', () => {
    pintar(tras(1));

    expect(screen.getByText(/1 día de racha/)).toBeInTheDocument();
  });

  it('no enseña una racha que ya está rota', () => {
    const vieja = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-20');

    pintar(vieja);

    expect(screen.getByText('sin racha')).toBeInTheDocument();
  });
});

describe('El aviso de repaso', () => {
  it('no aparece si no hay nada pendiente', () => {
    pintar(tras(1));

    expect(screen.queryByRole('button', { name: /repasar/i })).not.toBeInTheDocument();
  });

  it('aparece con lo fallado y avisa al pulsarlo', () => {
    const progress = missQuestion(tras(1), UNIT_ORDER[0]!, 0, HOY);
    const onReview = pintar(progress);

    const boton = screen.getByRole('button', { name: /repasar/i });
    expect(boton).toBeInTheDocument();
    boton.click();

    expect(onReview).toHaveBeenCalled();
  });

  it('no aparece si el plan no incluye el repaso', () => {
    const progress = missQuestion(tras(1), UNIT_ORDER[0]!, 0, HOY);
    pintar(progress, { repaso: false });

    expect(screen.queryByRole('button', { name: /repasar/i })).not.toBeInTheDocument();
  });

  it('en singular cuando es una sola pregunta', () => {
    const progress = missQuestion(tras(1), UNIT_ORDER[0]!, 0, HOY);
    pintar(progress);

    expect(screen.getByText('Tienes una pregunta para repasar')).toBeInTheDocument();
  });
});
