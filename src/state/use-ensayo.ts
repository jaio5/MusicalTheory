'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Metronome } from '@audio/metronome';
import { WebAudioMetronome } from '@audio/metronome';
import {
  comoSalio,
  ensayoTerminado,
  blockChord,
  guionDeEnsayo,
  puntuar,
  suenaComo,
  writtenBlock,
  type Acierto,
  type Arrangement,
  type KeyMode,
  type PasoDeEnsayo,
  type PitchClass,
  type ResultadoDelEnsayo,
} from '@core/music';

import { apuntarHecho } from './hechos-de-componer';
import { useListening, type ListeningDeps } from './use-listening';
import { useSessionStore } from './session-store';

/**
 * Ensayar la canción contra el metrónomo, y que te diga cómo ha ido.
 *
 * **El compás lo lleva el reloj de audio, no un `setInterval`.** Es la decisión
 * que ya estaba tomada para el metrónomo y aquí importa el doble: un temporizador
 * de JavaScript se retrasa cuando la pestaña se ocupa, y un compás que llega
 * tarde convierte un acierto en un fallo. `onBeat` llega programado por el mismo
 * reloj que hace sonar el clic.
 *
 * **Lo que suena es el clic y nada más.** Tocar la canción por los altavoces
 * mientras el croma escucha sería oírse a sí misma: el motor apuntaría los
 * acordes de la aplicación, no los tuyos, y saldría un diez perfecto sin haber
 * tocado una cuerda.
 *
 * **Se puntúa sin castigar.** Aquí se cuenta lo que pasó; no hay vidas, ni
 * volver al principio, ni nada que se pierda. Es la misma regla que ya tiene
 * aprender: fallar ilumina el compás y se sigue.
 *
 * Quien decide qué es acertar, tarde o fallar es `core/music/ensayo.ts`, que se
 * prueba sin micrófono ni reloj. Aquí solo se junta lo que el motor oye con el
 * pulso que marca el compás.
 */

export type FaseDelEnsayo = 'quieto' | 'preparando' | 'ensayando' | 'terminado';

export interface EnsayoEnMarcha {
  readonly fase: FaseDelEnsayo;
  /** Por qué paso del guion va, o nulo si no ha empezado. */
  readonly paso: number | null;
  readonly guion: readonly PasoDeEnsayo[];
  /** Lo que salió en cada paso ya cerrado. */
  readonly resultados: readonly Acierto[];
  /** El recuento, cuando se termina o se para. */
  readonly resultado: ResultadoDelEnsayo | null;
  readonly empezar: () => Promise<void>;
  readonly parar: () => void;
}

export interface EnsayoDeps extends ListeningDeps {
  readonly createMetronome?: () => Metronome;
}

export function useEnsayo(
  arrangement: Arrangement,
  tonic: PitchClass | null,
  mode: KeyMode,
  deps: EnsayoDeps = {},
): EnsayoEnMarcha {
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  // Con acordes encendidos: sin el croma no hay nada que comparar.
  const escucha = useListening({ ...deps, chords: true });

  const [fase, setFase] = useState<FaseDelEnsayo>('quieto');
  const [paso, setPaso] = useState<number | null>(null);
  const [guion, setGuion] = useState<readonly PasoDeEnsayo[]>([]);
  const [resultados, setResultados] = useState<readonly Acierto[]>([]);
  const [resultado, setResultado] = useState<ResultadoDelEnsayo | null>(null);

  const metronomoRef = useRef<Metronome | null>(null);
  const fabricas = useRef(deps);
  useEffect(() => {
    fabricas.current = deps;
  });

  /**
   * Lo que va pasando dentro de un compás, fuera de React.
   *
   * En una referencia y no en estado: `onBeat` llega desde el reloj de audio,
   * varias veces por compás, y pasar por un render en cada pulso sería pedirle a
   * React que siga el tempo. Al estado solo sube lo que se ve.
   */
  const marcha = useRef({
    guion: [] as readonly PasoDeEnsayo[],
    indice: 0,
    /** Pulsos consumidos del paso actual. */
    pulsosDelPaso: 0,
    /** En qué pulso del paso sonó lo que tocaba, si sonó. */
    acertadoEn: null as number | null,
    resultados: [] as Acierto[],
  });

  const cerrar = useCallback(() => {
    metronomoRef.current?.stop();
    void escucha.stop();
    const { guion: guardado, resultados: hechos } = marcha.current;
    const puntuacion = puntuar(guardado, hechos);
    setResultado(puntuacion);
    setResultados([...hechos]);
    setPaso(null);

    // Ensayar suma a la meta del día igual que escribir, que es lo que ya decidió
    // [adr/0028](../../docs/adr/0028-componer-tambien-cuenta.md): tocarse lo que
    // compusiste es practicar. **Solo si llega al final**, porque parar a los dos
    // compases no es haberla tocado; y `puntuar` no basta para saberlo, que un
    // ensayo a medias también devuelve números.
    if (ensayoTerminado(guardado, hechos)) {
      const limpio = puntuacion.total > 0 && puntuacion.acertados === puntuacion.total;
      apuntarHecho(limpio ? 'ensayo-limpio' : 'ensayo');
    }
  }, [escucha]);

  /**
   * Un pulso: mira si ya se oyó lo que tocaba y cierra el paso cuando se acaba.
   *
   * Se comprueba **en cada pulso y no al final**, porque el croma dice lo que
   * suena *ahora*: mirando solo al cerrar el compás, un acorde bien tocado al
   * principio y soltado antes de tiempo contaría como fallo.
   */
  const enCadaPulso = useCallback(() => {
    const estado = marcha.current;
    const actual = estado.guion[estado.indice];
    if (actual === undefined || tonic === null) {
      return;
    }

    if (estado.acertadoEn === null) {
      const oido = useSessionStore.getState().heardChord;
      // Con `blockChord` y no con `resolveDegree`: un paso con especie —un `C5`,
      // un `Fmaj7`— suena distinto de su tríada, y comparándolo contra ella un
      // riff bien tocado contaría como fallo
      // ([adr/0035](../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
      const esperado = blockChord(tonic, mode, {
        ...writtenBlock(actual.blockId, actual.degree, actual.beats, actual.especie),
      });
      if (suenaComo(esperado, oido)) {
        estado.acertadoEn = estado.pulsosDelPaso;
      }
    }

    estado.pulsosDelPaso += 1;
    if (estado.pulsosDelPaso < actual.beats) {
      return;
    }

    estado.resultados.push(comoSalio(actual.beats, estado.acertadoEn));
    estado.indice += 1;
    estado.pulsosDelPaso = 0;
    estado.acertadoEn = null;

    if (estado.indice >= estado.guion.length) {
      setFase('terminado');
      cerrar();
      return;
    }
    setPaso(estado.indice);
    setResultados([...estado.resultados]);
  }, [cerrar, mode, tonic]);

  const empezar = useCallback(async () => {
    if (tonic === null) {
      return;
    }
    const nuevo = guionDeEnsayo(arrangement, beatsPerBar);
    if (nuevo.length === 0) {
      return;
    }

    setFase('preparando');
    setResultado(null);
    setResultados([]);
    marcha.current = {
      guion: nuevo,
      indice: 0,
      pulsosDelPaso: 0,
      acertadoEn: null,
      resultados: [],
    };
    setGuion(nuevo);

    // Primero el micro: sin él no hay nada que comparar, así que no se empieza.
    await escucha.start();
    if (useSessionStore.getState().listening !== 'listening') {
      setFase('quieto');
      return;
    }

    const metronomo = fabricas.current.createMetronome?.() ?? new WebAudioMetronome();
    metronomoRef.current = metronomo;
    await metronomo.start({ bpm, beatsPerBar, onBeat: enCadaPulso });

    setPaso(0);
    setFase('ensayando');
  }, [arrangement, beatsPerBar, bpm, enCadaPulso, escucha, tonic]);

  const parar = useCallback(() => {
    setFase('terminado');
    cerrar();
  }, [cerrar]);

  // Irse de la pantalla no puede dejar el clic sonando ni el micrófono abierto.
  useEffect(() => {
    return () => {
      void metronomoRef.current?.dispose();
      metronomoRef.current = null;
    };
  }, []);

  return { fase, paso, guion, resultados, resultado, empezar, parar };
}
