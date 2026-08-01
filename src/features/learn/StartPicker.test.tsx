// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PlanId } from '@core/billing';
import { COURSES, EMPTY_PROGRESS, startAt, type Progress } from '@core/music';

import { StartPicker } from './StartPicker';

function pintar(progress: Progress = EMPTY_PROGRESS, plan: PlanId = 'basico') {
  const onChange = vi.fn();
  render(<StartPicker progress={progress} plan={plan} onChange={onChange} />);
  return onChange;
}

const desplegable = (): HTMLSelectElement =>
  screen.getByRole('combobox', { name: 'Empiezo por' }) as HTMLSelectElement;

describe('Elegir por dónde empezar', () => {
  it('ofrece los diez cursos y el principio', () => {
    pintar();

    // Diez cursos más la opción de empezar por el principio.
    expect(screen.getAllByRole('option')).toHaveLength(COURSES.length + 1);
    expect(screen.getByRole('option', { name: /El principio/ })).toBeInTheDocument();
  });

  it('empieza por el principio cuando no se ha elegido nada', () => {
    pintar();

    expect(desplegable().value).toBe('');
  });

  it('enseña el curso elegido', () => {
    pintar(startAt(EMPTY_PROGRESS, 'profesional-2'));

    expect(desplegable().value).toBe('profesional-2');
  });

  it('avisa del curso elegido y deja volver al principio', async () => {
    const onChange = pintar(startAt(EMPTY_PROGRESS, 'profesional-2'));

    await userEvent.selectOptions(desplegable(), '');

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('avisa con el identificador del curso al elegirlo', async () => {
    const onChange = pintar();

    await userEvent.selectOptions(desplegable(), 'elemental-3');

    expect(onChange).toHaveBeenCalledWith('elemental-3');
  });

  /**
   * Ofrecer un curso que el plan no incluye sería vender un punto de partida que
   * se cierra en la cara al elegirlo.
   */
  it('con el plan gratis, los cursos del Profesional no se pueden elegir', () => {
    pintar(EMPTY_PROGRESS, 'gratis');

    const profesional = COURSES.filter((course) => course.grade === 'profesional');
    for (const course of profesional) {
      expect(screen.getByRole('option', { name: new RegExp(course.title) })).toBeDisabled();
    }
    for (const course of COURSES.filter((c) => c.grade === 'elemental')) {
      expect(screen.getByRole('option', { name: new RegExp(course.title) })).toBeEnabled();
    }
  });

  it('con plan se pueden elegir todos', () => {
    pintar(EMPTY_PROGRESS, 'pro');

    for (const course of COURSES) {
      expect(screen.getByRole('option', { name: new RegExp(course.title) })).toBeEnabled();
    }
  });

  // Regalar el avance de once unidades por elegir un desplegable convertiría el
  // marcador en una mentira, y hay que decirlo donde se elige.
  it('explica que saltar no da por hechas las unidades anteriores', () => {
    pintar();

    expect(screen.getByText(/no da por hechas las unidades anteriores/i)).toBeInTheDocument();
  });
});
