'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  GRID,
  DUDOSO,
  arrangementBeats,
  barsLabel,
  captureMelody,
  captureProgression,
  degreesFor,
  SCALES,
  chordAt,
  findBlock,
  findNote,
  isDoubtful,
  melodyEnd,
  nextNotes,
  lastDegreeOf,
  nextDegrees,
  keyName,
  resolveDegree,
  type Capture,
  type DegreeSymbol,
  type MelodyCapture,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { selectCanUndo, useArrangementStore } from '@state/arrangement-store';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';

import { arrastrar } from './arrastrar';
import { PX_POR_PULSO, ZONA_ESTIRAR_PX, anchoDeBloque } from './BlockButton';
import { ChordEntry } from './ChordEntry';
import { PartRow, type Punteo } from './PartRow';
import { useArrangementPlayer } from './use-arrangement-player';
import { useBlockDrag, type Medida } from './use-block-drag';

/**
 * El lienzo: la canción como bloques que se arrastran, se estiran y suenan.
 *
 * Es la segunda cara de componer. La primera —la de siempre— responde a «qué
 * acorde tengo delante»: la rueda, sus formas, a dónde ir. Esta responde a «cómo
 * va mi canción», y esa pregunta es horizontal y en el tiempo. Meterla entre las
 * tres columnas de la otra habría dado seis franjas peleando por el mismo alto,
 * que es de lo que ya se quejaba `ComposeScreen` con cinco.
 *
 * ## Qué hace falta saber de música para usarlo
 *
 * Nada. Los bloques traen el cifrado y el grado, el filo de color dice si el
 * acorde reposa, sale o tensa, y la fila de la derecha propone los que suelen
 * venir después **con su porqué en una línea**, que es el vocabulario que la
 * aplicación ya usa en el panel de al lado. Poner un acorde es pulsar el que te
 * gusta de esa lista.
 *
 * ## Lo que no está aquí
 *
 * Ni tonalidad ni tempo: los pone la pantalla, y son los mismos que en la otra
 * cara. Cambiar de tonalidad en la rueda cambia todos los bloques a la vez sin
 * tocar el montaje, porque lo que hay guardado son grados.
 */

/**
 * Qué contar de una grabación recién traída.
 *
 * **Lo que no se pudo leer importa más que lo que sí.** Un compás que se cayó es
 * un agujero en la canción que nadie va a notar mirando el lienzo, porque lo que
 * falta no se ve; y cuando lo que se cae son varios acordes con la misma pinta,
 * casi siempre significa lo mismo: la tonalidad que se detectó no es la que se
 * estaba tocando. Decirlo aquí ahorra volver a grabar sin saber por qué salió
 * mal.
 *
 * Lo dudoso se cuenta aparte y sin alarmar: esos sí están en el lienzo, marcados
 * y con su corrección a un toque.
 */
function avisoDeLaCaptura(
  capture: Capture,
  punteo: MelodyCapture,
  tonalidad: string,
): string | null {
  const partes: string[] = [];

  if (punteo.notes.length > 0) {
    partes.push(
      punteo.notes.length === 1
        ? 'He apuntado 1 nota de punteo.'
        : `He apuntado ${punteo.notes.length} notas de punteo.`,
    );
  }

  if (capture.unread.length > 0) {
    const fuera = capture.unread.filter((tramo) => tramo.reason === 'fuera');
    const cifrados = [...new Set(fuera.map((tramo) => tramo.symbol))].filter(
      (symbol): symbol is string => symbol !== null,
    );

    if (cifrados.length > 0) {
      partes.push(
        `${fuera.length === 1 ? 'Un acorde no cabe' : `${fuera.length} acordes no caben`} en ` +
          `${tonalidad}: ${cifrados.join(', ')}. Si ${fuera.length === 1 ? 'lo tocaste' : 'los tocaste'} ` +
          'a propósito, prueba a cambiar la tonalidad y a traerlo otra vez.',
      );
    }

    const ilegibles = capture.unread.length - fuera.length;
    if (ilegibles > 0) {
      partes.push(
        ilegibles === 1
          ? 'Hubo un momento que no se parecía a ningún acorde y se ha quedado fuera.'
          : `Hubo ${ilegibles} momentos que no se parecían a ningún acorde y se han quedado fuera.`,
      );
    }
  }

  if (punteo.outOfRange > 0) {
    partes.push(
      `${punteo.outOfRange === 1 ? 'Una nota se salía' : `${punteo.outOfRange} notas se salían`} ` +
        'de lo que cabe en el pentagrama y no se ha escrito.',
    );
  }

  const dudosos = capture.steps.filter((step) => step.confidence < DUDOSO).length;
  if (dudosos > 0) {
    partes.push(
      `${dudosos === 1 ? 'Hay 1 acorde' : `Hay ${dudosos} acordes`} de los que no estoy seguro: ` +
        'salen marcados con «?» y se corrigen pulsándolos.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}

/** Cuántos acordes se proponen. Más de seis dejan de mirarse. */
const CUANTAS_SUGERENCIAS = 6;

/**
 * Cuánto hay que moverse para que una pulsación sea un arrastre.
 *
 * El mismo cuatro que usan los bloques, y por lo mismo: un dedo nunca pulsa
 * completamente quieto, y sin umbral la mitad de las pulsaciones acaban siendo
 * arrastres de dos píxeles.
 */
const UMBRAL_ARRASTRE = 4;

/**
 * Las tres maneras de llevar el punteo.
 *
 * `bloques` y `partitura` son **la misma melodía** con dos pieles: las mismas
 * notas, el mismo píxel por pulso y las mismas acciones. Lo que cambia es quién
 * las lee. `oculto` deja la pantalla como estaba, que es lo que quiere quien solo
 * está buscando acordes.
 */
const PUNTEOS: ReadonlyArray<{ id: Punteo; name: string }> = [
  { id: 'partitura', name: 'Partitura' },
  { id: 'bloques', name: 'Bloques' },
  { id: 'oculto', name: 'Solo acordes' },
];

export function ArrangeCanvas() {
  const activeKey = useSessionStore(selectActiveKey);
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const captured = useSessionStore((state) => state.captured);
  const noteHistory = useSessionStore((state) => state.noteHistory);
  const captureStartedAt = useSessionStore((state) => state.captureStartedAt);
  const scaleId = useSessionStore((state) => state.scaleId);
  const captureEndedAt = useSessionStore((state) => state.captureEndedAt);
  const capturing = useSessionStore((state) => state.capturing);
  const listening = useSessionStore((state) => state.listening);

  const arrangement = useArrangementStore((state) => state.arrangement);
  const puedeDeshacer = useArrangementStore(selectCanUndo);
  const acciones = useArrangementStore((state) => state.actions);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  /**
   * La partitura es lo primero que se ve.
   *
   * Es donde se escribe: los acordes van encima, las notas dentro y las dos
   * cosas se arrastran. Empezar por una tira de bloques y esconder la partitura
   * detrás de un conmutador la convertía en un extra, y no lo es —es la manera
   * de escribir una canción que existe desde hace cuatro siglos—. Quien no la
   * lea tiene los bloques a un toque.
   */
  const [punteo, setPunteo] = useState<Punteo>('partitura');
  /** Lo que hay que contar de la última grabación traída. */
  const [aviso, setAviso] = useState<string | null>(null);
  /** Qué propuesta se está arrastrando y sobre qué parte va, mientras dura. */
  const [soltando, setSoltando] = useState<{
    degree: DegreeSymbol;
    symbol: string;
    destino: { partId: string; at: number | null } | null;
    x: number;
    y: number;
  } | null>(null);
  // Encendida se dibujan solo las notas de la escala, y no hay manera de escribir
  // una que desafine. Es el mismo eje que separa los bloques de la partitura.
  const [onlyScale, setOnlyScale] = useState(true);
  const listaRef = useRef<HTMLDivElement | null>(null);
  /** Sobre qué parte se está soltando, y si el gesto llegó a ser un arrastre. */
  const destinoRef = useRef<{ partId: string; at: number | null } | null>(null);
  const arrastradaRef = useRef(false);

  const tonic = activeKey?.tonic ?? null;
  const mode = activeKey?.mode ?? 'major';

  const player = useArrangementPlayer(arrangement, tonic, mode, bpm);

  /**
   * Escribir una nota, seleccionarla y dejarla lista para alterarla.
   *
   * Dura un pulso por omisión: es la negra, la figura con la que se escribe casi
   * todo, y estirarla es un gesto más corto que elegir la duración antes.
   */
  const escribirNota = useCallback(
    (partId: string, offset: number, start: number) => {
      setSelectedNoteId(acciones.addNote(partId, offset, start, 1));
      setActivePartId(partId);
    },
    [acciones],
  );

  /**
   * El punteo con el teclado.
   *
   * Más y menos alteran la nota elegida medio tono, que es como se escribe un
   * cromatismo sin moverla de línea; las flechas la mueven en el tiempo y `Supr`
   * la quita. Sin esto, la partitura solo se podría usar con ratón.
   */
  const teclaEnPunteo = useCallback(
    (event: React.KeyboardEvent) => {
      if (selectedNoteId === null) {
        return;
      }
      const sitio = findNote(arrangement, selectedNoteId);
      if (sitio === null) {
        return;
      }
      const { note } = sitio;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        acciones.removeNote(selectedNoteId);
        setSelectedNoteId(null);
      } else if (event.key === '+' || event.key === '-') {
        event.preventDefault();
        acciones.moveNote(selectedNoteId, note.start, note.offset + (event.key === '+' ? 1 : -1));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const paso = event.key === 'ArrowLeft' ? -GRID : GRID;
        if (event.shiftKey) {
          acciones.resizeNote(selectedNoteId, note.length + paso * 2);
        } else {
          acciones.moveNote(selectedNoteId, note.start + paso, note.offset);
        }
      }
    },
    [acciones, arrangement, selectedNoteId],
  );

  /**
   * La parte a la que van los acordes que se pulsan.
   *
   * La última tocada, y si no la última que haya. Sin esto habría que elegir
   * parte antes de cada acorde, y montando se encadenan cinco seguidos.
   */
  const parteDestino =
    arrangement.parts.find((part) => part.id === activePartId) ?? arrangement.parts.at(-1) ?? null;

  /**
   * Las cajas de todos los bloques, para resolver el arrastre.
   *
   * Se leen del DOM por sus `data-`, y no de un registro de refs, porque son las
   * posiciones de verdad —con el desplazamiento horizontal de cada fila ya
   * aplicado— y eso un ref no lo sabe.
   */
  const medir = useCallback((): Medida[] => {
    const raiz = listaRef.current;
    if (raiz === null) {
      return [];
    }
    return [...raiz.querySelectorAll<HTMLElement>('[data-parte]')].map((elemento) => {
      const caja = elemento.getBoundingClientRect();
      return {
        partId: elemento.dataset['parte'] ?? '',
        index: Number(elemento.dataset['indice'] ?? 0),
        left: caja.left,
        right: caja.right,
        top: caja.top,
        bottom: caja.bottom,
      };
    });
  }, []);

  const soltar = useCallback(
    (blockId: string, partId: string, index: number) => {
      acciones.moveBlock(blockId, partId, index);
      setActivePartId(partId);
    },
    [acciones],
  );

  const { drag, start } = useBlockDrag(medir, soltar);

  /**
   * Empieza a mover o a estirar, según por dónde se coja el bloque.
   *
   * La franja de estirar son los últimos píxeles del bloque. Se decide aquí y no
   * en dos elementos distintos porque una manija propia sería un control de
   * catorce píxeles en una interfaz donde nada de lo que se pulsa baja de
   * cuarenta y cuatro.
   */
  const cogerBloque = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, blockId: string) => {
      const caja = event.currentTarget.getBoundingClientRect();
      const estirando = event.clientX > caja.right - ZONA_ESTIRAR_PX;

      if (!estirando) {
        start(event, blockId);
        return;
      }
      if (event.button !== 0) {
        return;
      }

      const inicioX = event.clientX;
      const pulsosIniciales = findBlock(arrangement, blockId)?.block.beats ?? 4;

      const mover = (e: PointerEvent) => {
        e.preventDefault();
        acciones.resizeBlock(blockId, pulsosIniciales + (e.clientX - inicioX) / PX_POR_PULSO);
      };
      const fin = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', fin);
        window.removeEventListener('pointercancel', fin);
      };
      window.addEventListener('pointermove', mover, { passive: false });
      window.addEventListener('pointerup', fin);
      window.addEventListener('pointercancel', fin);
    },
    [acciones, arrangement, start],
  );

  /**
   * El lienzo con el teclado, que es lo que un arrastre nunca da.
   *
   * Las flechas mueven el bloque de sitio, con `Shift` lo estiran y `Supr` lo
   * quita. Sin esto, montar una canción exigiría ratón.
   */
  const teclaEnBloque = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, blockId: string) => {
      const sitio = findBlock(arrangement, blockId);
      if (sitio === null) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        acciones.removeBlock(blockId);
        setSelectedBlockId(null);
        return;
      }

      const paso = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      if (paso === 0) {
        return;
      }
      event.preventDefault();

      if (event.shiftKey) {
        acciones.resizeBlock(blockId, sitio.block.beats + paso);
      } else {
        acciones.moveBlock(blockId, sitio.part.id, sitio.index + paso);
      }
    },
    [acciones, arrangement],
  );

  /**
   * Los acordes que se proponen, y por qué.
   *
   * Desde el último bloque de la parte de destino, con `nextDegrees`, que es el
   * mismo catálogo que usa la otra cara de la pantalla. Con el lienzo vacío no
   * hay «desde dónde», así que se ofrecen los grados de la tonalidad: es lo que
   * hay antes del primer acorde.
   */
  const sugerencias = useMemo(() => {
    if (tonic === null) {
      return [];
    }
    const desde = parteDestino === null ? null : lastDegreeOf(parteDestino);

    if (desde === null) {
      return degreesFor(mode)
        .slice(0, CUANTAS_SUGERENCIAS)
        .map((degree) => ({ degree, why: resolveDegree(tonic, mode, degree).role }));
    }
    return nextDegrees(mode, desde)
      .slice(0, CUANTAS_SUGERENCIAS)
      .map((move) => ({ degree: move.to, why: move.why }));
  }, [mode, parteDestino, tonic]);

  /**
   * Arrastrar una propuesta hasta una parte.
   *
   * Es la otra manera de poner un acorde, y la que hace falta con más de una
   * parte delante: pulsar lo mete en la de destino, que puede no ser la que se
   * está mirando. Arrastrando se dice dónde va, y se ve antes de soltar.
   *
   * Dos cosas que costaron una pasada por el navegador:
   *
   * - **El destino se guarda en un ref además de en el estado.** Leerlo dentro
   *   del actualizador de `setSoltando` para soltarlo allí mismo es cambiar un
   *   componente mientras se está pintando otro, y React lo dice por consola.
   * - **Un arrastre no es además una pulsación.** El navegador dispara el `click`
   *   después del `pointerup` aunque el puntero haya recorrido media pantalla, y
   *   sin acordarse de que hubo arrastre se metían dos acordes: el que se soltó y
   *   el de la pulsación.
   *
   * La parte de debajo se busca con `elementFromPoint` y no midiéndolas al
   * empezar, como sí hace el arrastre de bloques: aquí lo que hay debajo no se
   * mueve mientras dura el gesto, así que no hace falta la foto.
   */
  const arrastrarPropuesta = useCallback(
    (event: ReactPointerEvent, degree: DegreeSymbol, symbol: string) => {
      if (event.button !== 0) {
        return;
      }
      const inicioX = event.clientX;
      const inicioY = event.clientY;
      destinoRef.current = null;
      arrastradaRef.current = false;

      /**
       * Dónde caería el acorde: en qué parte y **entre qué dos compases**.
       *
       * Antes solo miraba la parte y lo metía al final, que es lo que se puede
       * hacer con una fila de bloques a la que se apunta de lejos. Sobre una
       * partitura no vale: se suelta encima de un compás porque se quiere
       * **ahí**, y aparecer cuatro compases más allá se lee como que el gesto no
       * ha funcionado.
       */
      const huecoBajo = (x: number, y: number): { partId: string; at: number | null } | null => {
        const elemento = document.elementFromPoint(x, y);
        const parte = elemento?.closest<HTMLElement>('[data-parte-destino]');
        if (parte === null || parte === undefined) {
          return null;
        }
        const partId = parte.dataset['parteDestino'] ?? '';
        const hueco = elemento?.closest<HTMLElement>('[data-indice]');
        const indice = hueco?.dataset['indice'];

        if (indice === undefined || hueco?.dataset['parte'] !== partId) {
          // Sobre la parte pero no sobre un compás: al final, que es donde se
          // sigue una canción cuando no se apunta a ningún sitio concreto.
          return { partId, at: null };
        }
        // Pasada la mitad, el acorde va detrás. Es la misma regla que sigue el
        // arrastre de bloques, para que los dos gestos se sientan igual.
        const caja = hueco.getBoundingClientRect();
        return { partId, at: Number(indice) + (x > (caja.left + caja.right) / 2 ? 1 : 0) };
      };

      arrastrar({
        mover: (x, y) => {
          if (!arrastradaRef.current) {
            if (Math.hypot(x - inicioX, y - inicioY) < UMBRAL_ARRASTRE) {
              return;
            }
            arrastradaRef.current = true;
          }
          destinoRef.current = huecoBajo(x, y);
          setSoltando({ degree, symbol, destino: destinoRef.current, x, y });
        },
        soltar: () => {
          const destino = destinoRef.current;
          setSoltando(null);
          if (arrastradaRef.current && destino !== null) {
            setSelectedBlockId(acciones.addBlock(destino.partId, degree, beatsPerBar, destino.at));
            setActivePartId(destino.partId);
          }
        },
      });
    },
    [acciones, beatsPerBar],
  );

  /**
   * Mete un acorde: detrás del que esté elegido, o al final si no hay ninguno.
   *
   * Con una partitura delante, elegir un compás y escribir un acorde solo puede
   * significar «aquí». Meterlo al final obligaría a escribirlo y arrastrarlo
   * después, que son dos gestos para una cosa.
   *
   * Escribiendo seguido, cada acorde queda elegido y el siguiente entra detrás:
   * se encadena sin tener que apuntar a nada.
   */
  /**
   * Qué nota puede seguir, y dónde caería.
   *
   * Se calcula sobre el acorde que suena **en ese punto** y no sobre el de la
   * parte entera: es lo que hace que la propuesta cambie al avanzar por la
   * canción en vez de repetir siempre la misma lista.
   *
   * El sitio es el final del punteo, o justo detrás de la nota elegida si hay
   * una: es la misma regla que siguen los acordes, y así seleccionar y escribir
   * significa «aquí» en las dos mitades.
   */
  const notaSiguiente = useMemo(() => {
    if (tonic === null || parteDestino === null) {
      return null;
    }
    const elegida = selectedNoteId === null ? null : findNote(arrangement, selectedNoteId);
    const en =
      elegida === null ? melodyEnd(parteDestino) : elegida.note.start + elegida.note.length;

    return {
      start: en,
      from: elegida?.note.offset ?? parteDestino.notes.at(-1)?.offset ?? null,
      notes: nextNotes({
        tonic,
        mode,
        scaleId,
        chord: chordAt(parteDestino, en),
        from: elegida?.note.offset ?? parteDestino.notes.at(-1)?.offset ?? null,
      }),
    };
  }, [arrangement, mode, parteDestino, scaleId, selectedNoteId, tonic]);

  const ponerNota = useCallback(
    (offset: number) => {
      if (parteDestino === null || notaSiguiente === null) {
        return;
      }
      setSelectedNoteId(acciones.addNote(parteDestino.id, offset, notaSiguiente.start, 1));
    },
    [acciones, notaSiguiente, parteDestino],
  );

  const ponerAcorde = useCallback(
    (degree: DegreeSymbol) => {
      const elegido = selectedBlockId === null ? null : findBlock(arrangement, selectedBlockId);
      const partId = elegido?.part.id ?? parteDestino?.id ?? acciones.addPart('Estrofa');
      const at = elegido === null ? null : elegido.index + 1;

      setSelectedBlockId(acciones.addBlock(partId, degree, beatsPerBar, at));
      setActivePartId(partId);
    },
    [acciones, arrangement, beatsPerBar, parteDestino, selectedBlockId],
  );

  /**
   * Empieza o para de apuntar lo que suena.
   *
   * **Vive aquí y no solo en Salidas, que es donde estaba.** Apuntar acordes no
   * cuesta IA ni gasta cupo: lo hace el motor de croma en el propio equipo. El
   * muro de plan es para pedirle salidas a un modelo, no para escribir en tu
   * canción lo que acabas de tocar, y tenerlo solo allí dejaba «Traer lo
   * grabado» sin nada que traer para quien no paga.
   */
  const apuntar = useCallback(() => {
    const acciones = useSessionStore.getState().actions;
    // **`performance.now` y no `Date.now`.** Es el reloj con el que se apuntan
    // los acordes que llegan del motor y las notas del historial, y mezclarlos
    // deja los instantes a mil millones de distancia: el punteo se quedaba
    // entero fuera del tramo grabado y no aparecía ni una nota.
    if (capturing) {
      acciones.stopCapture(performance.now());
    } else {
      setAviso(null);
      acciones.startCapture(performance.now());
    }
  }, [capturing]);

  /**
   * Trae al lienzo lo que se acaba de tocar, con las duraciones que se midieron.
   *
   * Es el puente que faltaba: el motor de croma ya decía qué acorde sonaba y
   * cuánto, `captureProgression` ya lo convertía en compases, y hasta ahora eso
   * solo servía para pedirle salidas a la IA. Aquí cae como una parte más, que se
   * puede mover, estirar y quitar como cualquier otra.
   */
  const traerGrabado = useCallback(() => {
    if (tonic === null) {
      return;
    }
    const capture = captureProgression(captured, {
      tonic,
      mode,
      bpm,
      endedAt: captureEndedAt,
      beatsPerBar,
    });
    /**
     * El punteo se lee del historial de notas, que el motor de tono viene
     * llenando desde que se abre el micro. Se recorta al tramo apuntado: lo que
     * sonó antes de darle a apuntar no es parte de esta grabación.
     */
    const punteo = captureMelody(noteHistory, {
      tonic,
      bpm,
      startedAt: captureStartedAt,
      endedAt: captureEndedAt,
    });

    if (capture.steps.length === 0 && punteo.notes.length === 0) {
      setAviso('No he podido leer ni un acorde ni una nota de lo que has tocado.');
      return;
    }

    setActivePartId(acciones.addRecorded(capture.steps, 'Lo que has tocado', punteo.notes));
    setAviso(avisoDeLaCaptura(capture, punteo, keyName(tonic, mode)));
  }, [
    acciones,
    beatsPerBar,
    bpm,
    captureEndedAt,
    captureStartedAt,
    captured,
    mode,
    noteHistory,
    tonic,
  ]);

  /**
   * El bloque elegido, si es uno del que hay que preguntar.
   *
   * Solo cuando está elegido: marcar los dudosos en el lienzo ya avisa de que
   * hay algo que mirar, y abrir la corrección de todos a la vez llenaría la
   * columna de preguntas sobre compases que a lo mejor ni importan.
   */
  const elegido = selectedBlockId === null ? null : findBlock(arrangement, selectedBlockId);
  const enDuda =
    elegido !== null && isDoubtful(elegido.block) && elegido.block.alternatives.length > 0
      ? elegido.block
      : null;

  const pulsos = arrangementBeats(arrangement);
  /**
   * Si hay algo que traer: acordes **o** punteo.
   *
   * Miraba solo los acordes, y eso dejaba fuera el caso de puntear sin rasguear
   * —que es la mitad de lo que se hace con una guitarra—: se apuntaban las notas
   * y el botón no aparecía, así que no había manera de sacarlas.
   */
  const hayGrabado =
    !capturing &&
    captureEndedAt > 0 &&
    (captured.length > 0 ||
      noteHistory.some((nota) => nota.at >= captureStartedAt && nota.at <= captureEndedAt));
  const arrastrado = drag === null ? null : findBlock(arrangement, drag.blockId);

  if (tonic === null) {
    return (
      <p className="text-text-muted p-6 text-center text-sm">
        Elige una tonalidad y monta la canción con bloques: los arrastras, los estiras y los oyes.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button
          onClick={() => player.toggle(null)}
          disabled={pulsos === 0}
          className="px-4 py-1.5 text-sm"
        >
          {player.playing && player.playingPartId === null ? 'Parar' : 'Escuchar la canción'}
        </Button>

        <span className="text-text-muted font-mono text-xs">
          {pulsos === 0 ? 'sin nada todavía' : barsLabel(pulsos, beatsPerBar)}
        </span>

        <span className="ml-auto flex flex-wrap gap-1">
          <span className="flex gap-1" role="group" aria-label="Cómo llevar el punteo">
            {PUNTEOS.map((candidato) => (
              <Chip
                key={candidato.id}
                onClick={() => setPunteo(candidato.id)}
                pressed={punteo === candidato.id}
                tone="quiet"
                className="px-3 text-xs"
              >
                {candidato.name}
              </Chip>
            ))}
          </span>

          {/* Apuntar solo tiene sentido con el micro abierto: sin él no llega
              un acorde y el botón sería una promesa que no se cumple. */}
          {listening === 'listening' && (
            <Chip
              onClick={apuntar}
              pressed={capturing}
              tone="quiet"
              className="px-3 text-xs"
              title="Apunta los acordes que vayas tocando"
            >
              {capturing ? 'Parar de apuntar' : 'Apuntar lo que toco'}
            </Chip>
          )}
          {hayGrabado && (
            <Chip onClick={traerGrabado} tone="quiet" className="px-3 text-xs">
              Traer lo grabado
            </Chip>
          )}
          {/* La parte nueva pasa a ser la de destino. Se crea una parte para
              meter cosas en ella, y sin esto los acordes que se pulsaban después
              seguían cayendo en la anterior. */}
          <Chip
            onClick={() => {
              setActivePartId(acciones.addPart());
              // Y se suelta lo que hubiera elegido: si no, el acorde siguiente
              // caería detrás de un bloque de la parte anterior, que es de donde
              // se acaba de salir.
              setSelectedBlockId(null);
            }}
            tone="quiet"
            className="px-3 text-xs"
          >
            + Parte
          </Chip>
          {punteo === 'bloques' && (
            <Chip
              onClick={() => setOnlyScale(!onlyScale)}
              pressed={onlyScale}
              tone="quiet"
              className="px-3 text-xs"
              title="Solo las notas de la escala que tienes puesta"
            >
              Solo la escala
            </Chip>
          )}

          <Chip
            onClick={() => acciones.undo()}
            tone="quiet"
            disabled={!puedeDeshacer}
            className="px-3 text-xs"
          >
            Deshacer
          </Chip>
        </span>
      </div>

      {aviso !== null && (
        <p className="border-border text-text-muted flex items-start gap-3 border-b px-3 py-2 text-xs">
          <span className="min-w-0 grow">{aviso}</span>
          <Chip onClick={() => setAviso(null)} tone="quiet" className="shrink-0 px-3 text-xs">
            Vale
          </Chip>
        </p>
      )}

      {/*
        En pantalla estrecha se desplaza la caja entera; en ancha, cada columna.

        Apilado, la columna de propuestas es larga y no se deja encoger, así que
        se comía el alto y **la partitura no llegaba a dibujarse**: quedaba la
        barra de botones y debajo la lista de acordes, sin canción en medio. Con
        el desplazamiento en esta caja, cada cosa ocupa lo suyo y se baja.
      */}
      <div className="flex min-h-0 grow flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Las teclas del punteo se escuchan en la caja entera y no en cada nota:
            en el pentagrama la nota es un `<g>` de SVG, y un grupo de SVG no
            recibe el foco igual en todos los navegadores. */}
        <div
          ref={listaRef}
          className="min-h-0 shrink-0 grow lg:shrink lg:overflow-y-auto"
          onKeyDown={teclaEnPunteo}
          role="presentation"
        >
          {arrangement.parts.length === 0 ? (
            <p className="text-text-muted p-6 text-center text-sm">
              Pulsa un acorde de la derecha y empieza la primera parte.
            </p>
          ) : (
            arrangement.parts.map((part) => (
              <PartRow
                key={part.id}
                part={part}
                tonic={tonic}
                mode={mode}
                beatsPerBar={beatsPerBar}
                playing={player.playing && player.playingPartId === part.id}
                playingBlockId={player.currentBlockId}
                selectedBlockId={selectedBlockId}
                draggingBlockId={drag?.blockId ?? null}
                dropIndex={drag?.target?.partId === part.id ? drag.target.index : null}
                punteo={punteo}
                dropPart={soltando?.destino?.partId === part.id}
                dropAt={soltando?.destino?.partId === part.id ? soltando.destino.at : null}
                scaleId={scaleId}
                onlyScale={onlyScale}
                selectedNoteId={selectedNoteId}
                onPlay={() => player.toggle(part.id)}
                onRename={(name) => acciones.renamePart(part.id, name)}
                onRemove={() => acciones.removePart(part.id)}
                onSetBars={(bars) => acciones.setBars(part.id, bars, beatsPerBar)}
                onBlockPointerDown={cogerBloque}
                onBlockClick={(blockId) => {
                  setSelectedBlockId(blockId);
                  setActivePartId(part.id);
                }}
                onBlockKeyDown={teclaEnBloque}
                onRemoveBlock={(blockId) => {
                  acciones.removeBlock(blockId);
                  setSelectedBlockId(null);
                }}
                onResizeBlock={acciones.resizeBlock}
                onAddNote={escribirNota}
                onSelectNote={setSelectedNoteId}
                onMoveNote={acciones.moveNote}
                onResizeNote={acciones.resizeNote}
                onGestureStart={acciones.beginGesture}
                onGestureEnd={acciones.endGesture}
              />
            ))
          )}
        </div>

        {/* Lo que puede venir después. En pantalla ancha es una columna a la
            derecha, como en la otra cara de componer; apilado, va debajo y no
            arriba, porque lo que se mira todo el rato es la canción. */}
        <aside
          aria-label="Qué poner ahora"
          className="border-border shrink-0 border-t p-3 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          {/*
            Corregir va lo primero, y solo cuando hay algo que corregir.

            Si hay un acorde elegido del que el motor dudó, lo que hace falta
            ahora no es poner otro: es arreglar ese. Aparece encima de todo y
            desaparece en cuanto se resuelve.
          */}
          {enDuda !== null && (
            <section
              aria-label="Corregir el acorde"
              className="border-brass-dim mb-4 rounded-md border border-dashed p-3"
            >
              <h3 className="text-text-muted text-xs tracking-widest uppercase">
                No lo oí claro. ¿Era esto?
              </h3>
              <p className="text-text-muted mt-1 text-xs">
                Apunté {resolveDegree(tonic, mode, enDuda.degree).symbol} y estuve a punto de decir
                otra cosa.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {enDuda.alternatives.map((otro) => (
                  <li key={otro}>
                    <button
                      type="button"
                      onClick={() => acciones.fixBlock(enDuda.id, otro)}
                      className="border-border text-text hover:border-brass-dim hover:bg-surface-raised min-h-tap inline-flex items-center gap-2 rounded-md border px-3 font-mono text-sm"
                    >
                      {resolveDegree(tonic, mode, otro).symbol}
                      <span className="text-text-muted text-xs">{otro}</span>
                    </button>
                  </li>
                ))}
                <li>
                  {/* Dar por bueno lo que se oyó también es corregir: deja de
                      preguntar y el acorde pasa a valer como escrito. */}
                  <button
                    type="button"
                    onClick={() => acciones.confirmBlock(enDuda.id)}
                    className="border-border text-text-muted hover:border-brass-dim hover:text-text min-h-tap inline-flex items-center rounded-md border px-3 text-sm"
                  >
                    Estaba bien
                  </button>
                </li>
              </ul>
            </section>
          )}

          {/* Escribir va antes que elegir: quien sabe cómo se llama el acorde no
              tiene por qué buscarlo en una lista, y quien no lo sabe pasa de
              largo hasta las propuestas de abajo. */}
          <ChordEntry tonic={tonic} mode={mode} onPick={ponerAcorde} />

          <h3 className="text-text-muted mt-4 text-xs tracking-widest uppercase">
            {parteDestino === null ? 'Para empezar' : `Después de ${parteDestino.name}`}
          </h3>
          <p className="text-text-muted mt-1 text-xs">
            Pulsa uno, o arrástralo hasta la parte donde lo quieras.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {sugerencias.map((sugerencia) => {
              const chord = resolveDegree(tonic, mode, sugerencia.degree);
              return (
                <li key={sugerencia.degree}>
                  <button
                    type="button"
                    onClick={() => {
                      // Tras un arrastre el navegador manda también el `click`.
                      // Sin esto, soltar un acorde en una parte metía dos: el que
                      // se soltó y el de la pulsación de vuelta.
                      if (arrastradaRef.current) {
                        arrastradaRef.current = false;
                        return;
                      }
                      ponerAcorde(sugerencia.degree);
                    }}
                    onPointerDown={(event) =>
                      arrastrarPropuesta(event, sugerencia.degree, chord.symbol)
                    }
                    style={{ touchAction: 'none' }}
                    className="border-border hover:border-brass-dim hover:bg-surface-raised min-h-tap flex w-full cursor-grab items-baseline gap-3 rounded-md border px-3 py-2 text-left"
                  >
                    <span className="text-brass-bright font-mono text-base">{chord.symbol}</span>
                    <span className="text-text-muted font-mono text-xs">{sugerencia.degree}</span>
                    <span className="text-text-muted text-xs">{sugerencia.why}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/*
            El refuerzo de la nota siguiente, siempre a la vista.

            En una fila de píldoras y no en una lista como los acordes: son siete
            y con el porqué de cada una debajo ocuparían la columna entera,
            dejando los acordes fuera de pantalla. El porqué se enseña el de la
            primera —que es la más segura— y el de cada una al pasar por encima.
          */}
          {notaSiguiente !== null && (
            <section aria-label="Qué nota puede seguir" className="mt-5">
              {/* La escala va en el rótulo, y no es un adorno: con la
                  pentatónica menor puesta sobre una tonalidad mayor salen un Mi
                  bemol y un Si bemol encima de un Do mayor, que suena a blues y
                  es correcto pero desconcierta si no se dice de dónde vienen. */}
              <h3 className="text-text-muted text-xs tracking-widest uppercase">
                Y de nota, sobre {SCALES[scaleId].name.toLowerCase()}
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1">
                {notaSiguiente.notes.map((nota) => (
                  <li key={nota.offset}>
                    <button
                      type="button"
                      onClick={() => ponerNota(nota.offset)}
                      title={nota.why}
                      aria-label={`${nota.name}: ${nota.why}`}
                      className={`min-h-tap inline-flex items-center gap-1.5 rounded-md border px-3 font-mono text-sm ${
                        nota.role === 'acorde'
                          ? 'border-brass-dim text-text hover:bg-surface-raised'
                          : 'border-border text-text-muted hover:border-brass-dim hover:text-text'
                      }`}
                    >
                      {/* El mismo código de tres colores que los bloques: verde
                          lo que cae de pie, latón lo que entra, rojo lo que roza
                          y sigue. Con la letra al lado, que un color solo no se
                          lee. */}
                      <span
                        aria-hidden
                        className={`inline-block size-1.5 rounded-full ${
                          nota.role === 'acorde'
                            ? 'bg-tube'
                            : nota.role === 'escala'
                              ? 'bg-brass'
                              : 'bg-oxblood'
                        }`}
                      />
                      {nota.name}
                    </button>
                  </li>
                ))}
              </ul>
              {notaSiguiente.notes[0] !== undefined && (
                <p className="text-text-muted mt-2 text-xs">{notaSiguiente.notes[0].why}</p>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* El bloque que se arrastra, pegado al puntero. Va fuera de las filas y en
          `fixed` porque tiene que poder salir de la fila de la que se sacó: es
          justo el gesto de llevárselo al estribillo. */}
      {soltando !== null && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50"
          style={{ left: soltando.x - 30, top: soltando.y - 22 }}
        >
          <div
            className={`superficie-viva min-h-tap flex items-center justify-center rounded-md px-4 font-mono ${
              soltando.destino === null ? 'text-text-muted opacity-70' : 'text-brass-bright'
            }`}
          >
            {soltando.symbol}
          </div>
        </div>
      )}

      {arrastrado !== null && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 opacity-90"
          // Centrado en el puntero, y con el ancho de verdad del bloque: si el
          // fantasma midiera siempre lo mismo, arrastrar uno de dos compases
          // mentiría sobre el hueco que va a ocupar.
          style={{
            left: (drag?.x ?? 0) - anchoDeBloque(arrastrado.block.beats) / 2,
            top: (drag?.y ?? 0) - 22,
            width: anchoDeBloque(arrastrado.block.beats),
          }}
        >
          <div className="superficie-viva border-brass-bright text-text min-h-tap flex items-center justify-center rounded-md font-mono">
            {resolveDegree(tonic, mode, arrastrado.block.degree).symbol}
          </div>
        </div>
      )}
    </div>
  );
}
