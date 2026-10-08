'use client';

import { useMemo, useState } from 'react';

import { lessonNotes, type TheoryUnit as TheoryUnitDef } from '@core/music';
import { selectTonalidadParaAprender, useSessionStore } from '@state/session-store';

import { Question } from './Question';
import { usePreguntaEnCurso } from './sitio-en-la-unidad';
import { HUECO_DEL_TUTOR, Tutor } from './Tutor';
import { UnidadPorMomentos } from './UnidadPorMomentos';

/**
 * Una unidad de teoría: de qué va, lo que hay que saber y luego las preguntas,
 * **cada cosa en su momento** (`UnidadPorMomentos`).
 *
 * Las preguntas van **de una en una** y no todas a la vez como al principio. Con
 * la lista entera delante se lee por encima y se contesta a bulto; con una sola
 * pregunta y su porqué inmediato hay que pararse. Es más lento a propósito. Y
 * tampoco van debajo de la teoría: con la explicación a la vista se contesta
 * copiando, no sabiendo.
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
  yaHecha = false,
}: {
  readonly unit: TheoryUnitDef;
  readonly onDone: (flawless: boolean) => void;
  /** Se avisa de cada pregunta fallada, con su posición dentro de la lección. */
  readonly onMiss?: (index: number) => void;
  /** Si ya se superó: la presentación ofrece ir directo a las preguntas. */
  readonly yaHecha?: boolean;
}) {
  // Sin tonalidad elegida, la de partida: la unidad no espera a que se elija.
  const tonalidad = useSessionStore(selectTonalidadParaAprender);
  const notes = useMemo(
    () => lessonNotes(unit.lesson, tonalidad.tonic, tonalidad.mode),
    [unit.lesson, tonalidad],
  );

  // Retomada de donde se dejó si se recarga a mitad (`sitio-en-la-unidad.ts`).
  const { at, failed, fallar, siguiente } = usePreguntaEnCurso(unit.id, notes.exercises.length);
  // Lo que el muñeco dice por su cuenta. Nulo mientras no haya nada que decir,
  // que es casi siempre.
  const [aviso, setAviso] = useState<string | null>(null);

  const exercise = notes.exercises[at];
  const last = at >= notes.exercises.length - 1;

  return (
    <div className={`min-h-0 grow overflow-y-auto p-4 ${HUECO_DEL_TUTOR}`}>
      <UnidadPorMomentos
        unit={unit}
        yaHecha={yaHecha}
        teoria={
          <ul className="flex max-w-prose flex-col gap-2">
            {notes.points.map((point) => (
              <li key={point} className="text-text text-base leading-relaxed">
                {point}
              </li>
            ))}
          </ul>
        }
        prueba={
          exercise !== undefined && (
            <div className="max-w-prose">
              <Question
                exercise={exercise}
                position={at + 1}
                total={notes.exercises.length}
                lastLabel="Terminar la unidad"
                onAnswered={(correct) => {
                  if (!correct) {
                    fallar();
                    onMiss?.(at);
                    setAviso(
                      'Esa no era. Si quieres te lo explico, y con los acordes que tienes puestos.',
                    );
                  }
                }}
                onNext={() => {
                  if (last) {
                    onDone(!failed);
                    return;
                  }
                  siguiente();
                }}
              />
            </div>
          )
        }
      />
      <Tutor unitId={unit.id} aviso={aviso} onAvisoVisto={() => setAviso(null)} />
    </div>
  );
}
