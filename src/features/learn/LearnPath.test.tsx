// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PlanId } from '@core/billing';
import {
  COURSES,
  EMPTY_PROGRESS,
  UNIT_ORDER,
  completeUnit,
  missQuestion,
  startAt,
  type Progress,
} from '@core/music';

import { LearnPath } from './LearnPath';

const HOY = '2026-07-29';

const ELEMENTAL = COURSES.filter((course) => course.grade === 'elemental').flatMap((course) =>
  course.units.map((unit) => unit.id),
);

function pintar(progress = EMPTY_PROGRESS, plan: PlanId = 'basico', day: string | null = HOY) {
  const onPick = vi.fn();
  render(<LearnPath progress={progress} plan={plan} day={day} active={null} onPick={onPick} />);
  return onPick;
}

/** Termina unidades en orden, que es la única forma de que se abran. */
function tras(ids: readonly string[]): Progress {
  return ids.reduce((progress, id) => completeUnit(progress, id, HOY), EMPTY_PROGRESS);
}

describe('El camino del temario', () => {
  it('enseña los dos grados', () => {
    pintar();

    expect(screen.getByRole('region', { name: 'Grado Elemental' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Grado Profesional' })).toBeInTheDocument();
  });

  it('los diez cursos están en pantalla', () => {
    pintar();

    for (const course of COURSES) {
      expect(screen.getByText(course.title)).toBeInTheDocument();
    }
  });

  it('la primera unidad se puede pulsar y las demás no', () => {
    pintar();

    expect(screen.getByRole('button', { name: /^qué es un grado$/i })).toBeEnabled();

    const bloqueadas = screen.getAllByRole('button', { name: /bloqueada$/i });
    expect(bloqueadas).toHaveLength(UNIT_ORDER.length - 1);
    for (const boton of bloqueadas) {
      expect(boton).toBeDisabled();
    }
  });

  it('avisa de que se ha pulsado una unidad y dice cuál', () => {
    const onPick = pintar();

    screen.getByRole('button', { name: /^qué es un grado$/i }).click();

    expect(onPick).toHaveBeenCalledWith(UNIT_ORDER[0]);
  });

  it('una unidad superada se marca y sigue pulsable, para repasarla', () => {
    pintar(tras([UNIT_ORDER[0]!]));

    expect(screen.getByRole('button', { name: /superada$/i })).toBeEnabled();
  });

  /**
   * Una unidad hecha con preguntas esperando en la cola se marca **agrietada**:
   * sigue estando hecha, pero hay algo que volver a mirar. Sin la marca, la
   * cola de repaso es una lista que nadie relaciona con el camino.
   */
  it('una unidad hecha con algo pendiente sale agrietada', () => {
    const hecha = tras([UNIT_ORDER[0]!]);
    const agrietada = missQuestion(hecha, UNIT_ORDER[0]!, 0, HOY);

    const { container } = render(
      <LearnPath progress={agrietada} plan="basico" day={HOY} active={null} onPick={vi.fn()} />,
    );

    expect(container.querySelectorAll('.border-oxblood-bright').length).toBeGreaterThan(0);
  });

  // Y la que se está haciendo se enciende, para no perderla de vista al volver.
  it('la unidad activa se enciende', () => {
    const { container } = render(
      <LearnPath
        progress={EMPTY_PROGRESS}
        plan="basico"
        day={HOY}
        active={UNIT_ORDER[0]!}
        onPick={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('.halo-latón').length).toBe(1);
  });

  it('la siguiente lleva su cartel de «aquí»', () => {
    pintar(tras([UNIT_ORDER[0]!]));

    expect(screen.getByText(/aquí/)).toBeInTheDocument();
  });
});

/**
 * Los dos candados no se abren igual: uno estudiando y otro pagando. Con el mismo
 * icono, quien va por el cuarto curso del Elemental cree que le falta estudiar
 * cuando lo que le falta es un plan.
 */
describe('Los dos candados', () => {
  it('en gratis, el Profesional se bloquea por plan y no por temario', () => {
    pintar(tras(ELEMENTAL), 'gratis');

    expect(screen.getByRole('button', { name: /reposo, salida y tensión.*plan/i })).toBeDisabled();
  });

  it('con plan, esa misma unidad está abierta', () => {
    pintar(tras(ELEMENTAL), 'basico');

    expect(screen.getByRole('button', { name: /^reposo, salida y tensión$/i })).toBeEnabled();
  });

  it('lo hecho con plan sigue viéndose hecho al volver a gratis, pero cerrado', () => {
    const pagando = tras([...ELEMENTAL, 'p1-funciones']);
    pintar(pagando, 'gratis');

    const nodo = screen.getByRole('button', { name: /reposo, salida y tensión.*plan/i });
    expect(nodo).toBeDisabled();
  });
});

describe('Las unidades agrietadas', () => {
  it('una unidad hecha con preguntas pendientes se marca para repasar', () => {
    const progress = missQuestion(tras([UNIT_ORDER[0]!]), UNIT_ORDER[0]!, 0, HOY);
    pintar(progress);

    expect(screen.getByRole('button', { name: /para repasar$/i })).toBeInTheDocument();
  });

  it('sin día todavía leído no se marca ninguna: no se sabe qué toca hoy', () => {
    const progress = missQuestion(tras([UNIT_ORDER[0]!]), UNIT_ORDER[0]!, 0, HOY);
    pintar(progress, 'basico', null);

    expect(screen.queryByRole('button', { name: /para repasar$/i })).not.toBeInTheDocument();
  });
});

/**
 * Elegir por dónde empezar abre ese curso sin haber hecho nada antes. Es el cambio
 * que hace que quien ya sabe teoría no tenga once unidades de peaje.
 */
describe('El punto de partida', () => {
  it('abre el curso elegido y deja abierto lo anterior', () => {
    pintar(startAt(EMPTY_PROGRESS, 'profesional-1'), 'basico');

    expect(screen.getByRole('button', { name: /^reposo, salida y tensión$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^qué es un grado$/i })).toBeEnabled();
  });

  it('lo que va después del punto de partida sigue cerrado', () => {
    pintar(startAt(EMPTY_PROGRESS, 'profesional-1'), 'basico');

    expect(screen.getByRole('button', { name: /la mayor, otra vez.*bloqueada$/i })).toBeDisabled();
  });

  it('sin elegir nada, solo está abierta la primera', () => {
    pintar(EMPTY_PROGRESS, 'basico');

    expect(screen.getAllByRole('button', { name: /bloqueada$/i })).toHaveLength(
      UNIT_ORDER.length - 1,
    );
  });
});
