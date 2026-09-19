'use client';

import { useMemo, useState } from 'react';

import {
  earExercises,
  dueReview,
  findUnit,
  lessonNotes,
  type Exercise,
  type KeyMode,
  type PitchClass,
  type Progress,
  type ReviewItem,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { CuatroTonalidades } from '@ui/EmpezarPorTonalidad';

import { createExercise, type ExerciseStep } from './exercise';
import { PlayNote } from './PlayNote';
import { Question } from './Question';
import { Tutor } from './Tutor';

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
 *
 * **Se repasan las dos cosas.** Una unidad de teoría trae su pregunta; una de
 * tocar trae la nota que se te atragantó, y esa se contesta con la guitarra. Van
 * mezcladas en la misma cola y en el mismo orden, porque son lo mismo: cosas de
 * un día que no se quedaron.
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
  // Lo que el muñeco dice por su cuenta. Nulo mientras no haya nada que decir.
  const [aviso, setAviso] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [fallos, setFallos] = useState(0);

  const preguntas = useMemo(
    () =>
      activeKey === null
        ? []
        : items.flatMap((item) => {
            const tarea = taskFor(item, activeKey.tonic, activeKey.mode);
            return tarea === null ? [] : [tarea];
          }),
    [items, activeKey],
  );

  if (activeKey === null) {
    // La barra de la tonalidad **flota sobre esta caja** y se abre sola cuando no
    // hay ninguna puesta, así que un aviso pegado arriba cae justo debajo de
    // ella. Y decía «está en la rueda de aquí arriba», debajo de la rueda que lo
    // tapaba: señalar no es ofrecer. Cuatro botones caben y resuelven el paso,
    // como en la unidad y en componer.
    //
    // Abajo con **margen automático**, no con `justify-end`: es la trampa de
    // flexbox que este repositorio ya tiene escrita en `docs/ESTILO.md`, y aquí
    // volvió a morder. Alineando la caja que recorta, lo que no cabe se sale por
    // el lado contrario y el desplazamiento no llega hasta ello: en una ventana
    // de 600 px de alto —un portátil bajo— el rótulo y los cuatro botones se
    // iban por arriba y **no había forma de empezar un repaso**. Lo cazó la
    // sonda del skill `arrancar`, cinco elementos inalcanzables. Con el margen,
    // cuando sobra sitio baja y cuando falta se queda arriba y se desplaza.
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mt-auto">
          <CuatroTonalidades>Elige una tonalidad para repasar:</CuatroTonalidades>
        </div>
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

  function contestar(correct: boolean): void {
    if (correct) {
      onHit(actual.item.unitId, actual.item.index);
      return;
    }
    setFallos((current) => current + 1);
    onMiss(actual.item.unitId, actual.item.index);
    setAviso(
      actual.kind === 'theory'
        ? 'Otra vez esa. Pregúntame y lo vemos con los acordes de hoy.'
        : 'Esa nota se resiste. Pregúntame dónde cae en el mástil.',
    );
  }

  function siguiente(): void {
    if (last) {
      // «Limpio» es haber acertado todas: lo fallado sigue pendiente para hoy,
      // así que la cola no se ha quedado vacía.
      onDone(fallos === 0);
      return;
    }
    setAt(at + 1);
  }

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
        {actual.kind === 'theory' ? (
          <Question
            exercise={actual.exercise}
            position={at + 1}
            total={preguntas.length}
            lastLabel="Terminar el repaso"
            onAnswered={contestar}
            onNext={siguiente}
          />
        ) : (
          <PlayNote
            step={actual.step}
            position={at + 1}
            total={preguntas.length}
            lastLabel="Terminar el repaso"
            onAnswered={contestar}
            onNext={siguiente}
          />
        )}
      </div>
      <Tutor unitId={actual.item.unitId} aviso={aviso} onAvisoVisto={() => setAviso(null)} />
    </div>
  );
}

/** Lo que hay que hacer para repasar un apunte de la cola. */
type ReviewTask =
  | { readonly kind: 'theory'; readonly item: ReviewItem; readonly exercise: Exercise }
  | { readonly kind: 'play'; readonly item: ReviewItem; readonly step: ExerciseStep };

/**
 * Lo que le toca a un apunte de la cola, en la tonalidad de ahora.
 *
 * De una unidad de teoría, su pregunta, regenerada con los acordes de hoy. De una
 * de tocar, la nota que se te atragantó, recolocada en la escala de hoy: el
 * apunte guarda el **paso** dentro del ejercicio, no la nota, así que en otra
 * tonalidad vuelve a preguntar por el mismo sitio de la escala con otra nota. Es
 * la misma idea que sostiene el repaso de teoría.
 *
 * Devuelve nulo cuando el sitio ya no existe: la unidad se retiró, cambió de tipo
 * o su lección tiene menos preguntas que antes. Nulo y no algo inventado, porque
 * preguntar otra cosa no es repasar lo que se falló.
 */
function taskFor(item: ReviewItem, tonic: PitchClass, mode: KeyMode): ReviewTask | null {
  const found = findUnit(item.unitId);
  if (found === null) {
    return null;
  }

  if (found.unit.kind === 'theory') {
    const exercise = lessonNotes(found.unit.lesson, tonic, mode).exercises[item.index];
    return exercise === undefined ? null : { kind: 'theory', item, exercise };
  }

  /**
   * Lo fallado de oído vuelve **como pregunta escrita**, no volviendo a sonar.
   *
   * Es a propósito y es la mitad del valor de repasarlo: si al oírlo dijiste que
   * era un IV y era un V, lo que hay que refrescar no es el sonido —eso se
   * entrena en la unidad— sino qué hace cada uno. El repaso pregunta lo otro.
   *
   * Y hay una razón práctica detrás: la cola de repaso apunta posiciones, no
   * ejercicios, y las posiciones de una unidad de oído y las de su lección no
   * son las mismas. Se reaprovecha el porqué, que es lo que se olvida.
   */
  if (found.unit.kind === 'ear') {
    const exercise = earExercises(found.unit.ear, tonic, mode)[item.index];
    return exercise === undefined ? null : { kind: 'theory', item, exercise };
  }

  const step = createExercise(tonic, found.unit.scaleId).steps[item.index];
  return step === undefined ? null : { kind: 'play', item, step };
}
