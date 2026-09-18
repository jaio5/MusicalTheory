// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_PROGRESS,
  lessonNotes,
  midiToFrequency,
  missQuestion,
  pitchClassFromName,
  type NoteName,
  type Progress,
} from '@core/music';
import { useSessionStore } from '@state/session-store';

import { HOLD_MS } from './exercise';
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
    expect(screen.getByText('Pregunta 1 de 1')).toBeInTheDocument();
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
    expect(screen.getByText('Pregunta 1 de 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: buena.text }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Pregunta 2 de 2')).toBeInTheDocument();
  });
});

describe('Sin tonalidad', () => {
  beforeEach(() => {
    // Ni fijada ni detectada, que es lo que ve quien entra sin haber tocado nada:
    // sin tonalidad no hay acordes con los que preguntar.
    useSessionStore.setState({ pinnedKey: null, keyCandidates: [] });
  });

  /**
   * Y **ofrece cuáles**, no señala la rueda. Esa barra flota sobre esta caja y
   * se abre ella sola sin tonalidad, así que el aviso decía «está en la rueda de
   * aquí arriba» debajo de la rueda que lo tapaba: es el mismo fallo que ya se
   * arregló en la unidad y en componer.
   */
  it('ofrece cuatro tonalidades en vez de senalar la rueda', () => {
    pintar(conUnFallo(0));

    expect(screen.getByText(/Elige una tonalidad para repasar/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Tonalidades para empezar' })).getByRole('button', {
        name: 'C mayor',
      }),
    ).toBeInTheDocument();
  });
});

describe('el repaso de una unidad de tocar', () => {
  beforeEach(() => {
    fijarTonalidad('C');
  });

  /** La tercera nota de la escala mayor, que se atragantó hoy. */
  function conNotaAtragantada(index = 2): Progress {
    return missQuestion(EMPTY_PROGRESS, 'e1-escala', index, HOY);
  }

  it('no se contesta con botones: se contesta tocando', () => {
    pintar(conNotaAtragantada());

    expect(screen.getByText(/tócala/i)).toBeInTheDocument();
    // Es lo que distingue saber dónde está una nota de haberlo leído.
    expect(screen.getByRole('button', { name: 'No me sale' })).toBeInTheDocument();
  });

  it('dice qué nota y si era subiendo o bajando', () => {
    // La misma nota subiendo y bajando son dos sitios del mástil, y la que se
    // atraganta suele ser una de las dos.
    pintar(conNotaAtragantada(2));

    expect(screen.getByText(/Subiendo/)).toBeInTheDocument();
  });

  it('sostener la nota afinada cuenta como acertada', async () => {
    const { onHit } = pintar(conNotaAtragantada());
    const { actions } = useSessionStore.getState();

    // La tercera nota de Do mayor subiendo es Mi. Se sostiene el tiempo que
    // pide el ejercicio, con el mismo criterio: afinada y sin soltarla.
    const mi = midiToFrequency(52);
    actions.setPitch(mi, 1, 0);
    actions.setPitch(mi, 1, HOLD_MS + 10);

    expect(await screen.findByText('Ahí está.')).toBeInTheDocument();
    expect(onHit).toHaveBeenCalledWith('e1-escala', 2);
  });

  it('rozarla y soltarla no cuenta', () => {
    const { onHit } = pintar(conNotaAtragantada());
    const { actions } = useSessionStore.getState();

    const mi = midiToFrequency(52);
    actions.setPitch(mi, 1, 0);
    actions.setPitch(null, 0, 100);
    actions.setPitch(mi, 1, 200);

    expect(onHit).not.toHaveBeenCalled();
  });

  it('«no me sale» la deja pendiente y explica dónde buscarla', async () => {
    const { onMiss } = pintar(conNotaAtragantada());

    await userEvent.click(screen.getByRole('button', { name: 'No me sale' }));

    expect(onMiss).toHaveBeenCalledWith('e1-escala', 2);
    expect(screen.getByText(/vuelve mañana/i)).toBeInTheDocument();
  });

  it('una nota que ya no existe en la escala no se pregunta', () => {
    // El apunte guarda el paso, no la nota: si la escala se acorta, el paso
    // desaparece. Preguntar otra cosa no sería repasar lo que costó.
    pintar(missQuestion(EMPTY_PROGRESS, 'e1-escala', 999, HOY));

    expect(screen.getByText('No hay nada que repasar.')).toBeInTheDocument();
  });

  it('teoría y tocar se mezclan en la misma cola', () => {
    let progress = missQuestion(EMPTY_PROGRESS, 'e1-grados', 0, HOY);
    progress = missQuestion(progress, 'e1-escala', 2, HOY);
    pintar(progress);

    expect(screen.getByText(/1 de 2/)).toBeInTheDocument();
  });
});
