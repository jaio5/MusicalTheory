'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  EAR_KINDS,
  earExercises,
  scheduleProgression,
  sonidoDe,
  type EarUnit as EarUnitDef,
} from '@core/music';
import { WebAudioProgressionPlayer, type ProgressionPlayer } from '@audio/progression-player';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

import { Question } from './Question';
import { SinTonalidad } from './SinTonalidad';
import { HUECO_DEL_TUTOR, Tutor } from './Tutor';

/**
 * Una unidad de oído: suena algo y hay que decir qué era.
 *
 * Es la tercera manera de preguntar, y la que le faltaba al camino. `theory` se
 * contesta leyendo y `play` con la guitarra; las dos dan por hecho que ya sabes
 * cómo suena lo que estás estudiando.
 *
 * ## Se escucha las veces que haga falta
 *
 * El botón no se gasta ni antes ni después de contestar. Un entrenamiento
 * auditivo que solo deja oír una vez mide la memoria, no el oído, y aquí lo que
 * se está aprendiendo es a reconocer: hay que poder repetirlo, y sobre todo hay
 * que poder **volver a oírlo con la respuesta delante**, que es donde se aprende
 * de verdad.
 *
 * ## La referencia suena y se dice
 *
 * Un acorde suelto no tiene grado: lo tiene dentro de una tonalidad. Cuando la
 * pregunta es «qué grado ha sonado», la tónica suena antes y se enseña escrita,
 * porque no es parte de la pregunta: es el suelo desde el que se mide.
 */
export function EarUnit({
  unit,
  onDone,
  onMiss,
}: {
  readonly unit: EarUnitDef;
  readonly onDone: (flawless: boolean) => void;
  /** Se avisa de cada pregunta fallada, con su posición dentro de la unidad. */
  readonly onMiss?: (index: number) => void;
}) {
  const activeKey = useSessionStore(selectActiveKey);
  const bpm = useSessionStore((state) => state.bpm);

  const ejercicios = useMemo(
    () => (activeKey === null ? [] : earExercises(unit.ear, activeKey.tonic, activeKey.mode)),
    [activeKey, unit.ear],
  );

  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(false);
  /** Si esta pregunta ya se ha oído alguna vez, para saber qué decir en el botón. */
  const [oido, setOido] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const playerRef = useRef<ProgressionPlayer | null>(null);
  useEffect(() => {
    return () => {
      void playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const ejercicio = ejercicios[at];

  /**
   * Hace sonar un ejercicio por su posición, y no «el de ahora».
   *
   * Por el índice porque al pasar de pregunta hay que oír la siguiente, y en ese
   * momento el estado todavía dice la anterior. Pasarlo por parámetro es lo que
   * permite encadenar «siguiente» con «y suena» en el mismo gesto.
   */
  const escuchar = useCallback(
    (indice: number) => {
      const cual = ejercicios[indice];
      /* v8 ignore next 3 -- sin tonalidad la unidad enseña la rueda, y el indice va dentro de la lista */
      if (activeKey === null || cual === undefined) {
        return;
      }
      playerRef.current ??= new WebAudioProgressionPlayer();

      // `sonidoDe` y no `resolveDegree`: un paso puede llevar séptima, y con el
      // grado a secas la unidad de cuatríadas sonaba dos veces la misma tríada.
      const pasos = cual.degrees.map((step) => {
        const { root, notes } = sonidoDe(step, activeKey.tonic, activeKey.mode);
        return { root, notes, beats: cual.beats };
      });

      // Sin estado de «sonando». El reproductor avisa cuando acaba, pero si el
      // navegador no deja abrir el audio ese aviso no llega nunca y el botón se
      // queda diciendo «Sonando…» para siempre. Aquí lo único que hace falta es
      // poder volver a pulsarlo, y eso no necesita saber si suena.
      void playerRef.current.play(scheduleProgression(pasos, bpm));
    },
    [activeKey, bpm, ejercicios],
  );

  if (activeKey === null) {
    return <SinTonalidad para="Lo que vas a oír son sus acordes: elige una para empezar." />;
  }

  /* v8 ignore next 3 -- las seis clases de oido del catalogo traen sus preguntas */
  if (ejercicio === undefined) {
    return <p className="text-text-muted p-4 text-sm">Esta unidad no tiene nada que oír.</p>;
  }

  const last = at >= ejercicios.length - 1;
  const referencia = ejercicio.degrees
    .slice(0, ejercicio.reference)
    .map((step) => sonidoDe(step, activeKey.tonic, activeKey.mode).symbol);

  return (
    <div className={`min-h-0 grow overflow-y-auto p-4 ${HUECO_DEL_TUTOR}`}>
      <p className="text-text max-w-prose text-base leading-relaxed">{EAR_KINDS[unit.ear].lead}</p>

      <div className="border-border mt-6 max-w-prose border-t pt-4">
        <div className="flex flex-wrap items-center gap-3">
          {/*
            No suena solo al entrar, y el botón no se gasta.

            Sonar sin que nadie lo pida es meter ruido en una pantalla en la que
            se acaba de entrar. Y poder repetirlo **con la respuesta delante** es
            donde se aprende de verdad: un entrenamiento que deja oír una sola vez
            mide la memoria, no el oído.
          */}
          <Button
            onClick={() => {
              setOido(true);
              escuchar(at);
            }}
            className="px-5 py-2"
          >
            {oido ? 'Escuchar otra vez' : 'Escuchar'}
          </Button>
          {referencia.length > 0 && (
            <p className="text-text-muted text-sm">
              Primero suena{' '}
              <span className="text-brass-bright font-mono">{referencia.join(' y ')}</span>, que es
              la referencia. La pregunta es lo que viene después.
            </p>
          )}
        </div>

        <div className="mt-4">
          <Question
            exercise={ejercicio}
            position={at + 1}
            total={ejercicios.length}
            lastLabel="Terminar la unidad"
            onAnswered={(correct) => {
              if (!correct) {
                setFailed(true);
                onMiss?.(at);
                setAviso('Vuelve a darle a escuchar con la respuesta delante: es donde se pilla.');
              }
            }}
            onNext={() => {
              if (last) {
                onDone(!failed);
                return;
              }
              // La siguiente suena en el mismo gesto: aquí sí, porque quien pulsa
              // «siguiente» en una unidad de oído está pidiendo justo eso.
              setAt(at + 1);
              setOido(true);
              escuchar(at + 1);
            }}
          />
        </div>
      </div>

      <Tutor unitId={unit.id} aviso={aviso} onAvisoVisto={() => setAviso(null)} />
    </div>
  );
}
