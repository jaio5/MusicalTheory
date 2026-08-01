// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_PROGRESS,
  lessonNotes,
  missQuestion,
  pitchClassFromName,
  type NoteName,
  type Progress,
} from '@core/music';
import { useSessionStore } from '@state/session-store';

import { ReviewSession } from './ReviewSession';

const HOY = '2026-07-29';
const C = pitchClassFromName('C');

function fijarTonalidad(tonic: NoteName = 'C') {
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName(tonic), mode: 'major' });
}

function pintar(progress: Progress) {
  const onHit = vi.fn();
  const onMiss = vi.fn();
  const onDone = vi.fn();
  const onLeave = vi.fn();
  render(
    <ReviewSession
      progress={progress}
      day={HOY}
      onHit={onHit}
      onMiss={onMiss}
      onDone={onDone}
      onLeave={onLeave}
    />,
  );
  return { onHit, onMiss, onDone, onLeave };
}

/** La primera pregunta de «Qué es un grado», fallada hoy. */
function conUnFallo(index = 0): Progress {
  return missQuestion(EMPTY_PROGRESS, 'e1-grados', index, HOY);
}

describe('El repaso', () => {
  beforeEach(() => {
    fijarTonalidad('C');
  });

  it('sin nada pendiente lo dice y no pregunta', () => {
    const { onDone } = pintar(EMPTY_PROGRESS);

    expect(screen.getByText('No hay nada que repasar.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  /**
   * Lo que se guardó al fallar fue la posición de la pregunta, no su texto. Esto
   * comprueba que desde la posición se vuelve a la pregunta de verdad.
   */
  it('vuelve a preguntar lo que se falló, generado otra vez', () => {
    const esperada = lessonNotes('degrees', C, 'major').exercises[0]!;
    pintar(conUnFallo(0));

    expect(screen.getByText(esperada.prompt)).toBeInTheDocument();
    expect(screen.getByText('1 de 1')).toBeInTheDocument();
  });

  it('pregunta lo mismo en otra tonalidad, con otros acordes', () => {
    fijarTonalidad('G');
    const enSol = lessonNotes('degrees', pitchClassFromName('G'), 'major').exercises[0]!;

    pintar(conUnFallo(0));

    expect(screen.getByText(enSol.prompt)).toBeInTheDocument();
  });

  it('acertar avisa con la unidad y la posición', async () => {
    const exercise = lessonNotes('degrees', C, 'major').exercises[1]!;
    const buena = exercise.choices.find((choice) => choice.correct)!;
    const { onHit, onMiss } = pintar(conUnFallo(1));

    await userEvent.click(screen.getByRole('button', { name: buena.text }));

    expect(onHit).toHaveBeenCalledWith('e1-grados', 1);
    expect(onMiss).not.toHaveBeenCalled();
  });

  it('fallar en el repaso lo vuelve a apuntar', async () => {
    const exercise = lessonNotes('degrees', C, 'major').exercises[0]!;
    const mala = exercise.choices.find((choice) => !choice.correct)!;
    const { onHit, onMiss } = pintar(conUnFallo(0));

    await userEvent.click(screen.getByRole('button', { name: mala.text }));

    expect(onMiss).toHaveBeenCalledWith('e1-grados', 0);
    expect(onHit).not.toHaveBeenCalled();
  });

  it('explica el porqué también cuando se acierta', async () => {
    const exercise = lessonNotes('degrees', C, 'major').exercises[0]!;
    const buena = exercise.choices.find((choice) => choice.correct)!;
    pintar(conUnFallo(0));

    await userEvent.click(screen.getByRole('button', { name: buena.text }));

    expect(screen.getByText(exercise.why)).toBeInTheDocument();
  });

  it('al terminar sin fallos dice que quedó limpio', async () => {
    const exercise = lessonNotes('degrees', C, 'major').exercises[0]!;
    const buena = exercise.choices.find((choice) => choice.correct)!;
    const { onDone } = pintar(conUnFallo(0));

    await userEvent.click(screen.getByRole('button', { name: buena.text }));
    await userEvent.click(screen.getByRole('button', { name: 'Terminar el repaso' }));

    expect(onDone).toHaveBeenCalledWith(true);
  });

  // Lo fallado sigue pendiente para hoy, así que la cola no se ha quedado vacía.
  it('al terminar con un fallo dice que no quedó limpio', async () => {
    const exercise = lessonNotes('degrees', C, 'major').exercises[0]!;
    const mala = exercise.choices.find((choice) => !choice.correct)!;
    const { onDone } = pintar(conUnFallo(0));

    await userEvent.click(screen.getByRole('button', { name: mala.text }));
    await userEvent.click(screen.getByRole('button', { name: 'Terminar el repaso' }));

    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('se puede dejar a medias', async () => {
    const { onLeave, onDone } = pintar(conUnFallo(0));

    await userEvent.click(screen.getByRole('button', { name: 'Dejarlo' }));

    expect(onLeave).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('pasa de una pregunta a la siguiente contando bien', async () => {
    let progress = conUnFallo(0);
    progress = missQuestion(progress, 'e1-grados', 1, HOY);
    const primera = lessonNotes('degrees', C, 'major').exercises[0]!;
    const buena = primera.choices.find((choice) => choice.correct)!;

    pintar(progress);
    expect(screen.getByText('1 de 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: buena.text }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('2 de 2')).toBeInTheDocument();
  });
});

describe('Sin tonalidad', () => {
  beforeEach(() => {
    // Ni fijada ni detectada, que es lo que ve quien entra sin haber tocado nada:
    // sin tonalidad no hay acordes con los que preguntar.
    useSessionStore.setState({ pinnedKey: null, keyCandidates: [] });
  });

  it('lo explica en vez de enseñar una pregunta vacía', () => {
    pintar(conUnFallo(0));

    expect(screen.getByText(/Elige una tonalidad para repasar/)).toBeInTheDocument();
  });
});
