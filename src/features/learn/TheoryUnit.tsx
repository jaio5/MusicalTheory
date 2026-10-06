'use client';

import { useMemo, useState } from 'react';

import { lessonNotes, type TheoryUnit as TheoryUnitDef } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { Question } from './Question';
import { SinTonalidad } from './SinTonalidad';
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
  const activeKey = useSessionStore(selectActiveKey);
  const notes = useMemo(
    () => (activeKey === null ? null : lessonNotes(unit.lesson, activeKey.tonic, activeKey.mode)),
    [unit.lesson, activeKey],
  );

  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(false);
  // Lo que el muñeco dice por su cuenta. Nulo mientras no haya nada que decir,
  // que es casi siempre.
  const [aviso, setAviso] = useState<string | null>(null);

  const exercise = notes?.exercises[at];
  const last = notes === null || at >= notes.exercises.length - 1;

  return (
    <div className={`min-h-0 grow overflow-y-auto p-4 ${HUECO_DEL_TUTOR}`}>
      <UnidadPorMomentos
        unit={unit}
        yaHecha={yaHecha}
        teoria={
          notes === null ? (
            <SinTonalidad para="La explicación se escribe con sus acordes: elige una para empezar." />
          ) : (
            <ul className="flex max-w-prose flex-col gap-2">
              {notes.points.map((point) => (
                <li key={point} className="text-text text-base leading-relaxed">
                  {point}
                </li>
              ))}
            </ul>
          )
        }
        prueba={
          notes === null ? (
            <SinTonalidad para="Las preguntas se escriben con sus acordes: elige una para empezar." />
          ) : (
            exercise !== undefined && (
              <div className="max-w-prose">
                <Question
                  exercise={exercise}
                  position={at + 1}
                  total={notes.exercises.length}
                  lastLabel="Terminar la unidad"
                  onAnswered={(correct) => {
                    if (!correct) {
                      setFailed(true);
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
                    setAt(at + 1);
                  }}
                />
              </div>
            )
          )
        }
      />
      <Tutor unitId={unit.id} aviso={aviso} onAvisoVisto={() => setAviso(null)} />
    </div>
  );
}
