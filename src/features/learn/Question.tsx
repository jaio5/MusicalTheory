'use client';

import { useState } from 'react';

import type { Exercise } from '@core/music';
import { Button } from '@ui/Button';

/**
 * Una pregunta con sus opciones y su porqué.
 *
 * La usan las dos partes que preguntan cosas —la unidad de teoría y el repaso— y
 * por eso está aparte: dos copias del mismo bloque acabarían dando la
 * retroalimentación de forma distinta, y lo que hace que esto se aprenda es
 * justamente que el porqué salga siempre, y siempre igual.
 *
 * Fallar no bloquea, y esa decisión no ha cambiado con el repaso: se dice por qué
 * era la otra y se sigue. Lo que se pierde al fallar es la medalla de no fallar y
 * que la pregunta vuelva más adelante, no el avance, porque una unidad que hay que
 * repetir desde el principio se abandona.
 */
export function Question({
  exercise,
  position,
  total,
  lastLabel,
  onAnswered,
  onNext,
}: {
  readonly exercise: Exercise;
  /** Cuál es de cuántas, para poder decir «3 de 4». Empieza en 1. */
  readonly position: number;
  readonly total: number;
  /** Qué dice el botón en la última: «Terminar la unidad», «Terminar el repaso». */
  readonly lastLabel: string;
  /** Se avisa una vez, al contestar, diciendo si se acertó. */
  readonly onAnswered: (correct: boolean) => void;
  readonly onNext: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const correct = exercise.choices.find((choice) => choice.correct) ?? null;
  const answered = chosen !== null;
  const last = position >= total;

  // Al cambiar de pregunta hay que olvidar la respuesta anterior. Se ajusta
  // durante el render comparando con la de antes, que es lo que React recomienda
  // para esto: hacerlo en un efecto provoca un render en cascada.
  const [tracked, setTracked] = useState(exercise);
  if (tracked !== exercise) {
    setTracked(exercise);
    setChosen(null);
  }

  if (correct === null) {
    return null;
  }

  function answer(text: string): void {
    if (answered) {
      return;
    }
    setChosen(text);
    onAnswered(text === correct!.text);
  }

  return (
    <fieldset className="mt-3">
      <div className="flex items-baseline justify-between gap-4">
        <legend className="text-text text-base">{exercise.prompt}</legend>
        <span className="text-text-muted shrink-0 font-mono text-xs">
          {position} de {total}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {exercise.choices.map((choice) => {
          const picked = chosen === choice.text;
          return (
            <button
              key={choice.text}
              type="button"
              onClick={() => answer(choice.text)}
              aria-pressed={picked}
              disabled={answered}
              className={`border px-3 py-1.5 font-mono text-sm disabled:cursor-default ${
                answered && choice.correct
                  ? 'border-tube-bright text-tube-bright'
                  : picked
                    ? 'border-oxblood-bright text-oxblood-bright'
                    : 'border-border text-text-muted enabled:hover:text-text'
              }`}
            >
              {choice.text}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3">
          <p className="text-text-muted text-sm" aria-live="polite">
            {chosen === correct.text ? '' : `Era ${correct.text}. `}
            {exercise.why}
          </p>
          <div className="mt-3">
            <Button onClick={onNext}>{last ? lastLabel : 'Siguiente'}</Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
