'use client';

import { useMemo, useState } from 'react';

import {
  dueReview,
  findUnit,
  lessonNotes,
  type Exercise,
  type Progress,
  type ReviewItem,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

import { Question } from './Question';

/**
 * El repaso: lo que fallaste, otra vez.
 *
 * Las preguntas no estaban guardadas. Lo que se guardó al fallarlas fue su sitio
 * —la unidad y la posición dentro de su lección— y aquí se vuelven a generar en la
 * tonalidad en la que estés ahora. Así el repaso pregunta lo mismo con otros
 * acordes, que es lo que distingue haber entendido el V grado de haberse aprendido
 * que la respuesta era Sol.
 *
 * El precio de esta decisión: si una unidad desaparece del temario, sus preguntas
 * pendientes desaparecen con ella. Es correcto —no hay nada que preguntar— y por
 * eso `parseProgress` las tira al leer.
 */
export function ReviewSession({
  progress,
  day,
  onHit,
  onMiss,
  onDone,
  onLeave,
}: {
  readonly progress: Progress;
  readonly day: string;
  readonly onHit: (unitId: string, index: number) => void;
  readonly onMiss: (unitId: string, index: number) => void;
  /** Se avisa al terminar, diciendo si no quedaba nada más pendiente para hoy. */
  readonly onDone: (cleared: boolean) => void;
  readonly onLeave: () => void;
}) {
  const activeKey = useSessionStore(selectActiveKey);

  // La cola se congela al abrir el repaso, a propósito. Si se recalculase a cada
  // acierto, las preguntas irían desapareciendo de debajo y la sesión no tendría
  // ni final ni cuenta: se contestaría una, la lista se acortaría y no habría
  // forma de saber cuántas quedan.
  const [items] = useState<readonly ReviewItem[]>(() => dueReview(progress.review, day));
  const [at, setAt] = useState(0);
  const [fallos, setFallos] = useState(0);

  const preguntas = useMemo(
    () =>
      activeKey === null
        ? []
        : items.flatMap((item) => {
            const exercise = exerciseFor(item, activeKey.tonic, activeKey.mode);
            return exercise === null ? [] : [{ item, exercise }];
          }),
    [items, activeKey],
  );

  if (activeKey === null) {
    return (
      <div className="p-4">
        <p className="text-text-muted max-w-prose text-sm">
          Elige una tonalidad para repasar: las preguntas se vuelven a generar con sus acordes, y
          sin tonalidad no hay acordes con los que preguntar.
        </p>
      </div>
    );
  }

  if (preguntas.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-text text-lg">No hay nada que repasar.</h2>
        <p className="text-text-muted mt-2 max-w-prose text-sm">
          Lo que falles se apunta aquí y vuelve el mismo día, y otra vez al día siguiente. Cuando lo
          aciertas dos veces seguidas, sale de la cola.
        </p>
        <div className="mt-4">
          <Button variant="quiet" onClick={onLeave}>
            Volver al camino
          </Button>
        </div>
      </div>
    );
  }

  const actual = preguntas[Math.min(at, preguntas.length - 1)]!;
  const last = at >= preguntas.length - 1;

  return (
    <div className="min-h-0 grow overflow-y-auto p-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-text text-lg">Repaso</h2>
          <p className="text-text-muted text-xs">
            {findUnit(actual.item.unitId)?.unit.title ?? 'Una unidad de antes'}
          </p>
        </div>
        <Button variant="quiet" onClick={onLeave}>
          Dejarlo
        </Button>
      </div>

      <div className="border-border mt-4 max-w-prose border-t pt-4">
        <Question
          exercise={actual.exercise}
          position={at + 1}
          total={preguntas.length}
          lastLabel="Terminar el repaso"
          onAnswered={(correct) => {
            if (correct) {
              onHit(actual.item.unitId, actual.item.index);
            } else {
              setFallos((current) => current + 1);
              onMiss(actual.item.unitId, actual.item.index);
            }
          }}
          onNext={() => {
            if (last) {
              // «Limpio» es haber acertado todas: lo fallado sigue pendiente para
              // hoy, así que la cola no se ha quedado vacía.
              onDone(fallos === 0);
              return;
            }
            setAt(at + 1);
          }}
        />
      </div>
    </div>
  );
}

/**
 * La pregunta que le toca a un apunte de la cola, en la tonalidad de ahora.
 *
 * Devuelve nulo cuando el sitio ya no existe: la unidad se retiró, dejó de ser de
 * teoría o su lección tiene menos preguntas que antes. Nulo y no una pregunta
 * inventada, porque preguntar otra cosa no es repasar lo que se falló.
 */
function exerciseFor(
  item: ReviewItem,
  tonic: Parameters<typeof lessonNotes>[1],
  mode: Parameters<typeof lessonNotes>[2],
): Exercise | null {
  const found = findUnit(item.unitId);
  if (found === null || found.unit.kind !== 'theory') {
    return null;
  }
  return lessonNotes(found.unit.lesson, tonic, mode).exercises[item.index] ?? null;
}
