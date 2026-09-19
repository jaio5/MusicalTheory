'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { WebAudioReferenceTone, type ReferenceTone } from '@audio/reference-tone';
import { accidentalForScale, midiToFrequency, SCALES, noteName, type ScaleId } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';
import { Button } from '@ui/Button';
import { Panel } from '@ui/Panel';

import {
  advanceExercise,
  stumbledSteps,
  createExercise,
  exerciseCompletion,
  INITIAL_PROGRESS,
  type ExerciseProgress,
} from './exercise';

export interface LearnPanelProps extends ListeningDeps {
  readonly createTone?: () => ReferenceTone;
  /**
   * La escala que pide la unidad del temario. Sin ella se practica la que esté
   * elegida en los ajustes, que es como funciona el panel suelto.
   */
  readonly scaleId?: ScaleId;
  /**
   * Se avisa una vez, cuando se termina la escala entera.
   *
   * `stumbled` son los pasos que costaron —los que se soltaron dos veces o más
   * antes de contar—, para que puedan volver en el repaso. Hasta ahora una
   * unidad de tocar no dejaba rastro de qué te había salido regular: o la
   * hacías o no la hacías.
   */
  readonly onDone?: (stumbled: readonly number[]) => void;
}

export function LearnPanel({ createTone, scaleId: asked, onDone, ...deps }: LearnPanelProps = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const chosen = useSessionStore((state) => state.scaleId);
  const scaleId = asked ?? chosen;

  /*
    El ejercicio se contesta con la guitarra, así que **lo enciende él**.

    Leía la nota del micro y no lo abría ni decía que hiciera falta: se pulsaba
    «Empezar», salía «Toca C» y no pasaba nada nunca, con el micro tachado en la
    cabecera y sin una palabra que lo relacionara. Quien llega aquí es alguien
    que acaba de terminar su primera unidad de teoría.

    El micro es uno y lo sujeta `state/use-listening`, que cuenta cuántos lo
    piden y lo suelta cuando no queda ninguno; aquí se pide como lo pide el
    afinador.
  */
  const escuchando = useSessionStore((state) => state.listening) === 'listening';
  const { start } = useListening(deps);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ExerciseProgress>(INITIAL_PROGRESS);

  const toneRef = useRef<ReferenceTone | null>(null);
  const factoryRef = useRef(createTone);
  useEffect(() => {
    factoryRef.current = createTone;
  });

  const exercise = useMemo(
    () => (activeKey === null ? null : createExercise(activeKey.tonic, scaleId)),
    [activeKey, scaleId],
  );

  // Al cambiar de escala o de tonalidad, el ejercicio anterior ya no vale. Se
  // ajusta durante el render comparando con el anterior, que es lo que React
  // recomienda para esto: hacerlo en un efecto provoca un render en cascada.
  const [trackedExercise, setTrackedExercise] = useState(exercise);
  if (trackedExercise !== exercise) {
    setTrackedExercise(exercise);
    setProgress(INITIAL_PROGRESS);
    setRunning(false);
  }

  useEffect(() => {
    if (!running || exercise === null) {
      return;
    }
    // Suscribirse al store y actualizar el estado desde su aviso es justo para
    // lo que están los efectos. Además, así este panel no se suscribe a la nota
    // que suena y no se repinta veinte veces por segundo: solo cuando
    // advanceExercise devuelve un progreso distinto.
    return useSessionStore.subscribe((state) => {
      setProgress((current) =>
        advanceExercise(current, exercise, state.hasSignal ? state.reading : null, state.readingAt),
      );
    });
  }, [running, exercise]);

  // Se avisa desde un efecto y no al detectar la nota: apuntar una unidad como
  // superada es escribir en el equipo, y eso no se hace dentro de un render.
  const notified = useRef(false);
  useEffect(() => {
    if (!progress.done) {
      notified.current = false;
      return;
    }
    if (notified.current) {
      return;
    }
    notified.current = true;
    onDone?.(stumbledSteps(progress));
  }, [progress, onDone]);

  useEffect(() => {
    return () => {
      void toneRef.current?.dispose();
      toneRef.current = null;
    };
  }, []);

  const step = exercise?.steps[progress.index] ?? null;
  const accidental = activeKey === null ? 'sharp' : accidentalForScale(activeKey.tonic, scaleId);

  async function playReference() {
    if (step === null) {
      return;
    }
    toneRef.current ??= factoryRef.current?.() ?? new WebAudioReferenceTone();
    await toneRef.current.play(midiToFrequency(step.midi));
  }

  if (activeKey === null || exercise === null) {
    return (
      <Panel id="aprender" title="Aprender">
        <p className="text-text-muted mt-4">
          Elige una tonalidad o toca unas notas sueltas, y aquí sale la escala para practicarla nota
          a nota.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      id="aprender"
      title="Aprender"
      actions={
        <>
          <Button variant="quiet" onClick={() => void playReference()}>
            Oír la nota
          </Button>
          <Button
            onClick={() => {
              setProgress(INITIAL_PROGRESS);
              setRunning((current) => !current);
              // Empezar un ejercicio que se contesta tocando **es** abrir el
              // micro. Si ya está abierto no se toca: lo puede estar por otra
              // pantalla, y pedirlo dos veces no cuesta nada pero tampoco vale.
              if (!escuchando) {
                void start();
              }
            }}
          >
            {running ? 'Empezar de nuevo' : 'Empezar'}
          </Button>
        </>
      }
    >
      <p className="text-text-muted mt-2 text-sm">
        {SCALES[scaleId].name} de {noteName(activeKey.tonic, accidental)}, subiendo y bajando. Cada
        nota cuenta cuando suena limpia y la sostienes un momento.
      </p>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Notas del ejercicio">
        {exercise.steps.map((item) => {
          const passed = item.index < progress.index;
          const current = running && item.index === progress.index;

          return (
            <li
              key={item.index}
              aria-current={current ? 'step' : undefined}
              className={`rounded-md border px-3 py-2 text-sm ${
                current
                  ? 'border-brass-bright text-brass-bright'
                  : passed
                    ? 'border-tube text-tube-bright'
                    : 'border-border text-text-muted'
              }`}
            >
              {noteName(item.pitchClass, accidental)}
              {item.descending && <span aria-hidden="true"> ↓</span>}
            </li>
          );
        })}
      </ol>

      <p className="mt-6" aria-live="polite">
        {!running ? (
          <span className="text-text-muted">Pulsa «Empezar» y toca la primera nota.</span>
        ) : !escuchando ? (
          // Y si el micro no llegó a abrirse —permiso denegado, o cerrado desde
          // la cabecera—, se dice y se ofrece dónde, en vez de dejar «Toca C»
          // esperando algo que nadie está oyendo.
          <span className="text-text-muted">
            Esto se contesta tocando, y el micrófono está cerrado.{' '}
            <button type="button" onClick={() => void start()} className="enlace cursor-pointer">
              Abrirlo
            </button>
            .
          </span>
        ) : progress.done ? (
          <span className="text-tube-bright">Escala completa. Otra vez, más rápido.</span>
        ) : (
          <span className="text-text">
            Toca {noteName(step?.pitchClass ?? activeKey.tonic, accidental)}
            {progress.heldSince !== null && <span className="text-tube-bright"> · sostenla</span>}
          </span>
        )}
      </p>

      <div
        className="border-border mt-4 h-2 w-full overflow-hidden rounded-full border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={exercise.steps.length}
        aria-valuenow={progress.index}
        aria-label="Avance del ejercicio"
      >
        <div
          className="bg-tube h-full transition-[width] duration-200"
          style={{ width: `${exerciseCompletion(progress, exercise) * 100}%` }}
        />
      </div>
    </Panel>
  );
}
