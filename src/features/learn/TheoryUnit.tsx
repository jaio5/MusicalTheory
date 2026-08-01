'use client';

import { useMemo, useState } from 'react';

import { lessonNotes, type TheoryUnit as TheoryUnitDef } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { Question } from './Question';

/**
 * Una unidad de teoría: lo que hay que saber y luego las preguntas, **de una en
 * una**.
 *
 * De una en una y no todas a la vez como al principio. Con la lista entera delante
 * se lee por encima y se contesta a bulto; con una sola pregunta y su porqué
 * inmediato hay que pararse. Es más lento a propósito.
 *
 * Lo que se falla se apunta por su **posición** en la lección, no por su texto: las
 * preguntas se generan en la tonalidad en la que estés, así que el texto cambia y
 * la posición no. Es lo que permite que el repaso vuelva a preguntar lo mismo en
 * otra tonalidad, que es la mitad del valor de repasarlo.
 */
export function TheoryUnit({
  unit,
  onDone,
  onMiss,
}: {
  readonly unit: TheoryUnitDef;
  readonly onDone: (flawless: boolean) => void;
  /** Se avisa de cada pregunta fallada, con su posición dentro de la lección. */
  readonly onMiss?: (index: number) => void;
}) {
  const activeKey = useSessionStore(selectActiveKey);
  const notes = useMemo(
    () => (activeKey === null ? null : lessonNotes(unit.lesson, activeKey.tonic, activeKey.mode)),
    [unit.lesson, activeKey],
  );

  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (activeKey === null || notes === null) {
    return (
      <p className="text-text-muted p-4 text-sm">
        Elige una tonalidad y te explico esto con tus acordes, no con los de un libro.
      </p>
    );
  }

  const exercise = notes.exercises[at];
  const last = at >= notes.exercises.length - 1;

  return (
    <div className="min-h-0 grow overflow-y-auto p-4">
      <ul className="flex max-w-prose flex-col gap-2">
        {notes.points.map((point) => (
          <li key={point} className="text-text text-base leading-relaxed">
            {point}
          </li>
        ))}
      </ul>

      {exercise !== undefined && (
        <div className="border-border mt-6 max-w-prose border-t pt-4">
          <h3 className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Compruébalo
          </h3>

          <Question
            exercise={exercise}
            position={at + 1}
            total={notes.exercises.length}
            lastLabel="Terminar la unidad"
            onAnswered={(correct) => {
              if (!correct) {
                setFailed(true);
                onMiss?.(at);
              }
            }}
            onNext={() => {
              if (last) {
                onDone(!failed);
                return;
              }
              setAt(at + 1);
            }}
          />
        </div>
      )}
    </div>
  );
}
