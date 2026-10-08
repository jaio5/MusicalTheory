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

import { useClaqueta, volumenQueSuena } from './claqueta';
import { contarAtras } from './cuenta-atras';
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
 * **Y antes de empezar se cuentan dos compases**, con la misma cuenta que
 * Tocando (`cuenta-atras.ts`) y la misma regla: el compás uno cae **un pulso
 * después del último clic de cuenta**, que es el primer clic de la canción. Sin
 * cuenta, el primer clic ya era el compás uno: el acorde se encendía a la vez
 * que había que tocarlo, y el primer compás salía fallado casi siempre, que es
 * puntuar el reflejo y no la canción.
 *
 * **Mientras dura, la toma es suya** (`claqueta.ts`): el metrónomo de la barra
 * se aparta —dos metrónomos a la vez son dos pulsos que no coinciden— y lo que
 * mira si hay una toma sonando se entera, igual que con Tocando.
 *
 * Quien decide qué es acertar, tarde o fallar es `core/music/ensayo.ts`, que se
 * prueba sin micrófono ni reloj. Aquí solo se junta lo que el motor oye con el
 * pulso que marca el compás.
 */

type FaseDelEnsayo = 'quieto' | 'preparando' | 'ensayando' | 'terminado';

export interface EnsayoEnMarcha {
  readonly fase: FaseDelEnsayo;
  /** Por qué paso del guion va, o nulo si no ha empezado. */
  readonly paso: number | null;
  readonly guion: readonly PasoDeEnsayo[];
  /** Lo que salió en cada paso ya cerrado. */
  readonly resultados: readonly Acierto[];
  /** El recuento, cuando se termina o se para. */
  readonly resultado: ResultadoDelEnsayo | null;
  /**
   * Golpes que quedan de la cuenta atrás, o nulo si no está contando.
   *
   * Mientras cuenta, la fase sigue siendo `preparando`: todavía no se puntúa
   * nada, y el botón de empezar sigue apagado.
   */
  readonly cuenta: number | null;
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
  const [cuenta, setCuenta] = useState<number | null>(null);

  const metronomoRef = useRef<Metronome | null>(null);
  /** Cómo cortar la cuenta atrás si se para en mitad. Nulo si no está contando. */
  const cortarCuentaRef = useRef<(() => void) | null>(null);
  const fabricas = useRef(deps);
  /**
   * La fase y la escucha, para la limpieza: el efecto que limpia se escribe una
   * vez y tiene que leer las de ahora, no las del primer render.
   */
  const faseRef = useRef<FaseDelEnsayo>('quieto');
  const escuchaRef = useRef(escucha);
  useEffect(() => {
    fabricas.current = deps;
    faseRef.current = fase;
    escuchaRef.current = escucha;
  });
  /**
   * Si la pantalla sigue ahí. Se mira **después de cada espera** de `empezar`:
   * el marco ya no se desmonta al navegar, así que el arranque sobrevive a la
   * pantalla, y sin mirarlo el ensayo se ponía en marcha sin nadie delante
   * —la toma marcada, la cuenta y el clic sonando encima de otra pantalla—.
   */
  const montadoRef = useRef(false);

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
    useClaqueta.getState().acciones.marcarToma(false);
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
    /* v8 ignore next 3 -- el metronomo se para al acabar el guion, asi que el paso siempre existe */
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
    /* v8 ignore next 3 -- sin tonalidad la pantalla enseña que falta elegirla, sin boton de empezar */
    if (tonic === null) {
      return;
    }
    const nuevo = guionDeEnsayo(arrangement, beatsPerBar);
    /* v8 ignore next 3 -- sin acordes que tocar la pantalla enseña el estado vacio, sin boton de empezar */
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
    // Se fue mientras el navegador pedía el permiso: la limpieza ya paró la
    // escucha, y aquí no queda nada que arrancar.
    if (!montadoRef.current) {
      return;
    }
    if (useSessionStore.getState().listening !== 'listening') {
      setFase('quieto');
      return;
    }

    const metronomo = fabricas.current.createMetronome?.() ?? new WebAudioMetronome();
    metronomoRef.current = metronomo;
    useClaqueta.getState().acciones.marcarToma(true);

    // **El mismo metrónomo cuenta y lleva la canción**, sin pararse entre una
    // cosa y otra: los clics de después de la cuenta son los pulsos del ensayo,
    // y el primero de ellos es el compás uno. Con dos metrónomos, o parando y
    // volviendo a arrancar, el compás uno caería donde le diera al segundo
    // arranque y no un pulso después del último clic de cuenta.
    const cuentaAtras = contarAtras({
      metronomo,
      bpm,
      beatsPerBar,
      volumen: volumenQueSuena(useClaqueta.getState()),
      alQuedar: setCuenta,
      alClic: () => enCadaPulso(),
    });
    cortarCuentaRef.current = cuentaAtras.cortar;

    const compasUno = await cuentaAtras.terminada;
    cortarCuentaRef.current = null;
    // Cortada por irse de la pantalla: la limpieza ya soltó el metrónomo, la
    // toma y la escucha, y no hay estado que poner a nadie.
    if (!montadoRef.current) {
      return;
    }
    setCuenta(null);

    // Cortada: se paró o se fue de la pantalla en mitad de la cuenta. No se
    // empezó nada, así que no hay nada que puntuar: se vuelve a como estaba.
    if (compasUno === null) {
      metronomo.stop();
      useClaqueta.getState().acciones.marcarToma(false);
      void escucha.stop();
      setFase('quieto');
      return;
    }

    // Si el guion ya se ha tocado entero, ya está cerrado y no hay nada que
    // encender. Con el reloj de verdad no pasa —entre el último clic de cuenta y
    // el final hay compases enteros—, pero los clics llegan por su cuenta y la
    // espera de arriba no los frena: sin esto, un ensayo acabado volvería a
    // ponerse en marcha.
    if (marcha.current.indice >= marcha.current.guion.length) {
      return;
    }
    // Un pulso antes del compás uno: el acorde que toca se enciende con el
    // último clic de cuenta, que es justo cuando hace falta verlo.
    setPaso(0);
    setFase('ensayando');
  }, [arrangement, beatsPerBar, bpm, enCadaPulso, escucha, tonic]);

  const parar = useCallback(() => {
    // Parar en mitad de la cuenta la corta y no puntúa: no ha empezado nada.
    if (cortarCuentaRef.current !== null) {
      cortarCuentaRef.current();
      return;
    }
    setFase('terminado');
    cerrar();
  }, [cerrar]);

  // Irse de la pantalla no puede dejar el clic sonando, ni el micrófono abierto,
  // ni la toma marcada: con ella marcada el metrónomo de la barra se quedaría
  // apartado para siempre.
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      cortarCuentaRef.current?.();
      void metronomoRef.current?.dispose();
      metronomoRef.current = null;
      useClaqueta.getState().acciones.marcarToma(false);
      // **Y la escucha que abrió el ensayo.** El micro lo sujeta la barra, que no
      // se va al navegar, así que sin esto se quedaban abiertos el micro y el
      // croma. Quieto o terminado no se toca —terminar ya la cerró—: ese micro,
      // si lo hay, es de la barra. Igual que `use-tocar-y-apuntar.ts`.
      if (faseRef.current === 'preparando' || faseRef.current === 'ensayando') {
        void escuchaRef.current.stop();
      }
    };
  }, []);

  return { fase, paso, guion, resultados, resultado, cuenta, empezar, parar };
}
