'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  GRID,
  MAX_BLOCK_BEATS,
  arrangementBeats,
  barsLabel,
  degreesFor,
  drawnBars,
  NOTE_LENGTHS,
  SCALES,
  chordAt,
  findBlock,
  findNote,
  bloquesEnDuda,
  isDoubtful,
  writeNote,
  melodyEnd,
  nextNotes,
  lastDegreeOf,
  nextDegrees,
  blockChord,
  ficheroMidi,
  nombreDeFichero,
  soundOf,
  resolveDegree,
  PAPELES_DE_TOMA,
  type DegreeSymbol,
  type EspecieDeBloque,
  type PapelDeLaToma,
} from '@core/music';
import { descargarBytes, TIPO_MIDI } from '@media/descargar';
import { apuntarLoTocado } from '@state/apuntar-lo-tocado';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { selectCanUndo, useArrangementStore } from '@state/arrangement-store';
import { useAtajosDeLaPropuesta } from '@state/atajos-de-la-propuesta';
import { usePropuestaStore } from '@state/propuesta';
import { Button } from '@ui/Button';
import { useMedida } from '@ui/use-medida';
import { Chip } from '@ui/Chip';
import { Segmentado } from '@ui/Segmentado';
import { EmpezarPorTonalidad } from '@ui/EmpezarPorTonalidad';
import { Field } from '@ui/Field';
import { useIsomorphicLayoutEffect } from '@ui/use-isomorphic-layout-effect';
import { IconoCanciones } from '@ui/icons';
import { Vacio } from '@ui/Vacio';

import { arrastrar, colocar } from './arrastrar';
import {
  TECLAS_DEL_BLOQUE_DICHAS,
  ZONA_ESTIRAR_PX,
  anchoDeBloque,
  pulsoQueCabe,
} from './BlockButton';
import { Marca } from '@ui/Marca';

import { ChordEntry } from './ChordEntry';
import { CorregirAcorde } from './CorregirAcorde';
import { Figura, nombreDeFigura } from './Figura';
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

/**
 * La raya entre dos grupos de la barra del lienzo.
 *
 * La barra son tres filas de cajas con el mismo borde —la vista, las figuras,
 * «Deshacer»— y, sin nada entre ellas, se leía como una sola lista de doce
 * botones. Una raya fina basta para que se lean como tres cosas, y no pide la
 * atención que pediría un rótulo por grupo.
 */
function Separador() {
  return <span aria-hidden="true" data-separador className="bg-border mx-1 w-px self-stretch" />;
}

/**
 * Una función que no cambia de identidad y siempre llama a la última versión.
 *
 * Existe por las filas: van con `memo`, y lo que se les pasa tiene que ser la
 * misma función de un pintado a otro. Los gestos del lienzo leen el montaje, el
 * pulso y el reproductor, que cambian a cada rato; con `useCallback` y sus
 * dependencias cambiarían también, y con ellos todas las filas se repintarían.
 * Se llaman solo desde un evento, así que leer la última versión es leer lo que
 * hay en pantalla.
 */
function useEstable<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}

/** El destino de una propuesta arrastrada: en qué parte y delante de qué compás. */
type Destino = { readonly partId: string; readonly at: number | null } | null;

function mismoDestino(a: Destino, b: Destino): boolean {
  return a?.partId === b?.partId && a?.at === b?.at;
}

/**
 * Con `memo` y sin props: la pantalla de componer se repinta con cada cambio del
 * banco —cada movimiento de un divisor, cada área que se pliega— y el lienzo se
 * entera de lo suyo por los almacenes, no por quien lo monta.
 */
export const ArrangeCanvas = memo(function ArrangeCanvas() {
  const activeKey = useSessionStore(selectActiveKey);
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const scaleId = useSessionStore((state) => state.scaleId);
  /**
   * Si hay algo que traer: acordes **o** punteo.
   *
   * Miraba solo los acordes, y eso dejaba fuera el caso de puntear sin rasguear
   * —que es la mitad de lo que se hace con una guitarra—: se apuntaban las notas
   * y el botón no aparecía, así que no había manera de sacarlas.
   *
   * **Y se pide el sí o el no, no las listas.** El lienzo se suscribía a lo
   * capturado y al historial de notas enteros para sacar este booleano, y el
   * historial crece con cada nota que oye el motor: con el micro abierto, el
   * lienzo entero se repintaba veinte veces por segundo sin que cambiara nada de
   * lo que enseña.
   */
  const hayGrabado = useSessionStore(
    (state) =>
      !state.capturing &&
      state.captureEndedAt > 0 &&
      (state.captured.length > 0 ||
        state.noteHistory.some(
          (nota) => nota.at >= state.captureStartedAt && nota.at <= state.captureEndedAt,
        )),
  );
  const capturing = useSessionStore((state) => state.capturing);
  const listening = useSessionStore((state) => state.listening);

  const arrangement = useArrangementStore((state) => state.arrangement);
  const propuesta = usePropuestaStore((state) => state.propuesta);
  useAtajosDeLaPropuesta();
  const accionesDeLaPropuesta = usePropuestaStore((state) => state.acciones);
  const puedeDeshacer = useArrangementStore(selectCanUndo);
  const acciones = useArrangementStore((state) => state.actions);

  /**
   * Lo elegido, que es **uno y solo uno**: un acorde o una nota, nunca los dos.
   *
   * Eran dos estados sueltos y podían estar los dos puestos a la vez, así que
   * «quitar lo elegido» no tenía respuesta. Elegir una cosa suelta la otra.
   */
  /**
   * El bloque elegido vive en el store y la nota no.
   *
   * No es una asimetría gratuita: al bloque elegido lo miran **desde fuera** la
   * columna del acorde —que enseña cómo se toca— y las propuestas, que salen
   * desde él. La nota elegida no sale de aquí.
   */
  const selectedBlockId = useArrangementStore((state) => state.selectedBlockId);
  const setSelectedBlockIdCrudo = useArrangementStore((state) => state.actions.elegirBloque);
  const [selectedNoteId, setSelectedNoteIdCrudo] = useState<string | null>(null);

  const setSelectedBlockId = useCallback(
    (id: string | null) => {
      setSelectedBlockIdCrudo(id);
      if (id !== null) {
        setSelectedNoteIdCrudo(null);
      }
    },
    [setSelectedBlockIdCrudo],
  );

  const setSelectedNoteId = useCallback(
    (id: string | null) => {
      setSelectedNoteIdCrudo(id);
      if (id !== null) {
        setSelectedBlockIdCrudo(null);
      }
    },
    [setSelectedBlockIdCrudo],
  );
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

  /**
   * La frase que se lee sola, con las teclas dentro.
   *
   * Los atajos se nombran aquí porque un fantasma solo se entiende sabiendo cómo
   * se acepta y cómo se tira; en pantalla eso lo dicen los dos botones de la
   * barra, y quien la oye no los ha alcanzado todavía.
   */
  const anuncio =
    propuesta === null
      ? ''
      : `${propuesta.titulo}: ${propuesta.degrees.length} acordes propuestos para ${
          /* v8 ignore start -- se propone sobre una parte que existe, que es de donde sale la propuesta */
          arrangement.parts.find((part) => part.id === propuesta.partId)?.name ?? 'la canción'
          /* v8 ignore stop */
        }. Tab los acepta, Mayúsculas y Tab acepta uno, Escape los descarta.`;
  /**
   * Qué propuesta se está arrastrando y sobre qué parte va, mientras dura.
   *
   * **Sin la posición del puntero**, por lo mismo que el arrastre de bloques: el
   * fantasma se mueve escribiéndole el `transform` (`colocar`), y el estado solo
   * cambia cuando cambia dónde caería.
   */
  const [soltando, setSoltando] = useState<{
    degree: DegreeSymbol;
    symbol: string;
    destino: Destino;
  } | null>(null);
  const punteroRef = useRef({ x: 0, y: 0 });
  const fantasmaDePropuestaRef = useRef<HTMLElement | null>(null);
  const fantasmaDePropuesta = useCallback((nodo: HTMLElement | null) => {
    fantasmaDePropuestaRef.current = nodo;
    colocar(nodo, punteroRef.current.x, punteroRef.current.y);
  }, []);
  /**
   * Cómo dejar de escuchar el gesto que esté en curso —estirar un bloque o
   * arrastrar una propuesta—.
   *
   * Los dos se enganchan al `window`, y si el lienzo se desmonta a mitad —se
   * cambia de espacio con el teclado, que es un atajo sin modificador— los
   * oyentes se quedaban colgados: el siguiente movimiento del ratón estiraba un
   * bloque de un lienzo que ya no estaba.
   */
  const cancelarGestoRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelarGestoRef.current?.(), []);
  // Encendida se dibujan solo las notas de la escala, y no hay manera de escribir
  // una que desafine. Es el mismo eje que separa los bloques de la partitura.
  const [onlyScale, setOnlyScale] = useState(true);
  const listaRef = useRef<HTMLDivElement | null>(null);

  /**
   * El ancho del lienzo, medido, y la escala que sale de él.
   *
   * Los bloques y el punteo medían un pulso en veinticuatro píxeles fijos, así
   * que una parte de cuatro compases ocupaba 384 de los mil y pico que hay en un
   * portátil y el resto era hueco. Ahora se mide y se reparte.
   *
   * **Una escala para todo el lienzo, sacada de la parte más larga**, y no una
   * por fila: si cada parte se justificara a su ancho, una de ocho compases
   * mediría lo mismo que una de cuatro y el carril de bloques dejaría de decir
   * con su tamaño lo que dura cada cosa, que es para lo que está.
   */
  const { ref: anchoRef, medida } = useMedida<HTMLDivElement>();
  const disponible = medida.ancho;

  const pulsosDeLaMasLarga = arrangement.parts.reduce(
    (largo, part) => Math.max(largo, drawnBars(part, beatsPerBar) * beatsPerBar),
    beatsPerBar,
  );
  // El respiro es el de la propia fila: sin descontarlo, la parte más larga sale
  // justa y aparece una barra de desplazamiento que no hacía falta.
  const porPulso = pulsoQueCabe(disponible - 32, pulsosDeLaMasLarga);
  /** Sobre qué parte se está soltando, y si el gesto llegó a ser un arrastre. */
  const destinoRef = useRef<Destino>(null);
  const arrastradaRef = useRef(false);
  /** Si el fantasma de la propuesta ya está puesto: el primer destino se pinta siempre. */
  const soltandoRef = useRef(false);

  const tonic = activeKey?.tonic ?? null;
  const mode = activeKey?.mode ?? 'major';

  const player = useArrangementPlayer(arrangement, tonic, mode, bpm);

  /**
   * Escribir una nota, seleccionarla y dejarla lista para alterarla.
   *
   * Dura un pulso por omisión: es la negra, la figura con la que se escribe casi
   * todo, y estirarla es un gesto más corto que elegir la duración antes.
   */
  /**
   * Con qué figura se escribe la nota siguiente.
   *
   * Antes toda nota nacía negra y para hacer una blanca había que estirarla —con
   * el ratón por su borde, o con `Shift` y las flechas, que no está escrito en
   * ninguna parte—. Elegir antes de escribir es como se monta un punteo: se
   * decide la duración y se pone, no se pone y se arregla.
   *
   * La misma elección sirve para cambiar la nota que esté seleccionada, que es lo
   * que uno espera al pulsar una figura teniendo una nota elegida.
   */
  const [figura, setFigura] = useState<number>(1);

  const escribirNota = useCallback(
    (partId: string, offset: number, start: number) => {
      setSelectedNoteId(acciones.addNote(partId, offset, start, figura));
      setActivePartId(partId);
    },
    [acciones, figura, setSelectedNoteId],
  );

  const elegirFigura = useCallback(
    (length: number) => {
      setFigura(length);
      if (selectedNoteId !== null) {
        acciones.resizeNote(selectedNoteId, length);
      }
    },
    [acciones, selectedNoteId],
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
    [acciones, arrangement, selectedNoteId, setSelectedNoteId],
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
    /* v8 ignore next 3 -- solo corre durante un arrastre sobre la lista, que está puesta porque se arrastra dentro de ella */
    if (raiz === null) {
      return [];
    }
    return [...raiz.querySelectorAll<HTMLElement>('[data-parte]')].map((elemento) => {
      const caja = elemento.getBoundingClientRect();
      return {
        /* v8 ignore start -- los dos `data-` los escribe este mismo componente en cada fila */
        partId: elemento.dataset['parte'] ?? '',
        index: Number(elemento.dataset['indice'] ?? 0),
        /* v8 ignore stop */
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

  const { drag, start, fantasma } = useBlockDrag(medir, soltar);

  /**
   * Empieza a mover o a estirar, según por dónde se coja el bloque.
   *
   * La franja de estirar son los últimos píxeles del bloque. Se decide aquí y no
   * en dos elementos distintos porque una manija propia sería un control de
   * catorce píxeles en una interfaz donde nada de lo que se pulsa baja de
   * cuarenta y cuatro.
   */
  const cogerBloque = useEstable((event: ReactPointerEvent<HTMLButtonElement>, blockId: string) => {
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
    /* v8 ignore next -- el bloque que se coge esta pintado, y lo esta porque esta en el montaje */
    const pulsosIniciales = findBlock(arrangement, blockId)?.block.beats ?? 4;
    // **Un estirón es un solo paso de deshacer.** Sin abrir el gesto, cada
    // movimiento del puntero apilaba su deshacer, y volver atrás un estirón
    // pedía pulsar «Deshacer» tantas veces como píxeles se había movido.
    acciones.beginGesture();

    cancelarGestoRef.current = arrastrar({
      mover: (x) => acciones.resizeBlock(blockId, pulsosIniciales + (x - inicioX) / porPulso),
      soltar: () => {
        cancelarGestoRef.current = null;
        acciones.endGesture();
      },
    });
  });

  /**
   * El lienzo con el teclado, que es lo que un arrastre nunca da.
   *
   * Las flechas mueven el bloque de sitio, con `Shift` lo estiran y `Supr` lo
   * quita. Sin esto, montar una canción exigiría ratón.
   */
  const teclaEnBloque = useEstable(
    (event: React.KeyboardEvent<HTMLButtonElement>, blockId: string) => {
      const sitio = findBlock(arrangement, blockId);
      /* v8 ignore next 3 -- el boton y el montaje salen del mismo pintado: el bloque que manda la tecla esta en el */
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
      soltandoRef.current = false;

      /**
       * Dónde caería el acorde: en qué parte y **entre qué dos compases**.
       *
       * Antes solo miraba la parte y lo metía al final, que es lo que se puede
       * hacer con una fila de bloques a la que se apunta de lejos. Sobre una
       * partitura no vale: se suelta encima de un compás porque se quiere
       * **ahí**, y aparecer cuatro compases más allá se lee como que el gesto no
       * ha funcionado.
       */
      const huecoBajo = (x: number, y: number): Destino => {
        const elemento = document.elementFromPoint(x, y);
        const parte = elemento?.closest<HTMLElement>('[data-parte-destino]');
        if (parte === null || parte === undefined) {
          return null;
        }
        /* v8 ignore next -- el `data-parte-destino` lo escribe la propia fila que se acaba de encontrar */
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

      cancelarGestoRef.current = arrastrar({
        mover: (x, y) => {
          punteroRef.current = { x, y };
          colocar(fantasmaDePropuestaRef.current, x, y);
          if (!arrastradaRef.current) {
            if (Math.hypot(x - inicioX, y - inicioY) < UMBRAL_ARRASTRE) {
              return;
            }
            arrastradaRef.current = true;
          }
          const destino = huecoBajo(x, y);
          if (soltandoRef.current && mismoDestino(destinoRef.current, destino)) {
            // El mismo sitio que en el movimiento de antes: el fantasma ya se
            // ha movido y no hay nada más que pintar.
            return;
          }
          soltandoRef.current = true;
          destinoRef.current = destino;
          setSoltando({ degree, symbol, destino });
        },
        soltar: () => {
          cancelarGestoRef.current = null;
          const destino = destinoRef.current;
          setSoltando(null);
          if (arrastradaRef.current && destino !== null) {
            setSelectedBlockId(acciones.addBlock(destino.partId, degree, beatsPerBar, destino.at));
            setActivePartId(destino.partId);
          }
        },
      });
    },
    [acciones, beatsPerBar, setSelectedBlockId],
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
      /* v8 ignore next 3 -- el boton se pinta con `notaSiguiente`, y esa cuenta ya exige parte de destino */
      if (parteDestino === null || notaSiguiente === null) {
        return;
      }
      setSelectedNoteId(acciones.addNote(parteDestino.id, offset, notaSiguiente.start, 1));
    },
    [acciones, notaSiguiente, parteDestino, setSelectedNoteId],
  );

  /**
   * Lo que hay elegido ahora mismo, para poder enseñarlo y quitarlo.
   *
   * Borrar se podía **solo con el teclado** —`Supr` sobre el bloque o la nota
   * enfocada— y en un teléfono no hay teclado que valga: lo que se ponía no se
   * podía quitar. Es medio editor.
   */
  const elegido = useMemo(() => {
    if (selectedBlockId !== null) {
      const sitio = findBlock(arrangement, selectedBlockId);
      if (sitio !== null && tonic !== null) {
        // Con `blockChord`: el panel enseñaba «Am» teniendo un «Am7» elegido,
        // porque resolvía solo el grado y la séptima se quedaba por el camino.
        const chord = blockChord(tonic, mode, sitio.block);
        return {
          que: 'acorde' as const,
          id: selectedBlockId,
          nombre: chord.symbol,
          detalle: `${sitio.block.degree} · ${barsLabel(sitio.block.beats, beatsPerBar)}`,
          partId: sitio.part.id,
          index: sitio.index,
          ultimo: sitio.part.blocks.length - 1,
          beats: sitio.block.beats,
        };
      }
    }
    if (selectedNoteId !== null) {
      const sitio = findNote(arrangement, selectedNoteId);
      if (sitio !== null && tonic !== null) {
        const escrita = writeNote(sitio.note, tonic, mode);
        return {
          que: 'nota' as const,
          id: selectedNoteId,
          nombre: `${escrita.letter}${escrita.accidental}${escrita.octave}`,
          detalle: `${sitio.note.length === 1 ? '1 pulso' : `${sitio.note.length} pulsos`}`,
        };
      }
    }
    return null;
  }, [arrangement, beatsPerBar, mode, selectedBlockId, selectedNoteId, tonic]);

  const quitarElegido = useCallback(() => {
    /* v8 ignore next 3 -- el boton de quitar vive dentro de `elegido !== null` */
    if (elegido === null) {
      return;
    }
    if (elegido.que === 'acorde') {
      acciones.removeBlock(elegido.id);
      setSelectedBlockId(null);
    } else {
      acciones.removeNote(elegido.id);
      setSelectedNoteId(null);
    }
  }, [acciones, elegido, setSelectedBlockId, setSelectedNoteId]);

  /**
   * Mover y estirar lo elegido **sin arrastrar** (WCAG 2.5.7).
   *
   * Se podía de dos maneras: arrastrando, o con las flechas sobre el bloque
   * enfocado. Quien no puede arrastrar —un dedo que tiembla, un puntero de
   * cabeza— y además no tiene teclado, que es un teléfono, se quedaba sin mover
   * nada. Son las mismas cuatro cosas que hacen las flechas, en botones, y la
   * quinta que las flechas no hacen: llevárselo a otra parte.
   */
  const moverElegido = useCallback(
    (paso: -1 | 1) => {
      /* v8 ignore next 3 -- los botones de mover viven dentro de `elegido.que === 'acorde'` */
      if (elegido?.que !== 'acorde') {
        return;
      }
      acciones.moveBlock(elegido.id, elegido.partId, elegido.index + paso);
    },
    [acciones, elegido],
  );

  const estirarElegido = useCallback(
    (paso: -1 | 1) => {
      /* v8 ignore next 3 -- los botones de estirar viven dentro de `elegido.que === 'acorde'` */
      if (elegido?.que !== 'acorde') {
        return;
      }
      acciones.resizeBlock(elegido.id, elegido.beats + paso);
    },
    [acciones, elegido],
  );

  const llevarElegido = useCallback(
    (partId: string) => {
      /* v8 ignore next 3 -- el selector de parte vive dentro de `elegido.que === 'acorde'` */
      if (elegido?.que !== 'acorde') {
        return;
      }
      // Al final de la otra parte: es donde sigue una canción cuando no se
      // apunta a ningún compás, la misma regla que al soltar una propuesta. El
      // dominio acota el sitio a lo que mida la parte de destino.
      acciones.moveBlock(elegido.id, partId, Number.POSITIVE_INFINITY);
      setActivePartId(partId);
    },
    [acciones, elegido],
  );

  /**
   * Devuelve la canción a la pantalla después de poner un acorde.
   *
   * En ancho no hace nada, porque el lienzo y el carril de acordes son dos
   * columnas con su propio desplazamiento. En estrecho **son la misma columna**,
   * así que al pulsar un acorde del carril el navegador lo trae a la vista y se
   * lleva la canción por encima del borde: se medía en −117 píxeles después del
   * primer acorde, o sea que en un teléfono ponías tu primer acorde y no lo veías.
   *
   * Se espera un fotograma porque el bloque nuevo todavía no está pintado cuando
   * esto se llama, y se mira antes de mover: si ya se ve, no se toca la vista de
   * nadie.
   *
   * **Y «se ve» no es `top >= 0`.** Eso fue lo que se midió y no bastaba: en el
   * móvil, encima de la canción flotan la barra de tonalidad y las tiras de área
   * —flotan a propósito, `ui/Disclosure`—, así que la parte podía estar en el
   * píxel 116, dentro de la pantalla, y **debajo de las barras**. Medido con
   * capturas: escribías cuatro acordes y lo que veías era «Añadir otra parte» y
   * las sugerencias, con la canción escondida detrás del cromo.
   *
   * Así que se pregunta quién hay en su borde de arriba. Si no es ella, la tapa
   * algo, y `scroll-margin-top` es lo que le dice al navegador cuánto hueco dejar
   * por encima al traerla: se saca del alto de lo que tapa, no de un número
   * escrito a mano que caducaría al mover una barra.
   */
  const traerLaCancionALaVista = useCallback(() => {
    requestAnimationFrame(() => {
      const caja = listaRef.current;
      /* v8 ignore next 3 -- se llama al poner un acorde, y para eso el lienzo esta pintado */
      if (caja === null) {
        return;
      }
      const { top, left, width } = caja.getBoundingClientRect();
      const enSuBorde = document.elementFromPoint(left + width / 2, top + 2);
      const tapa = enSuBorde !== null && !caja.contains(enSuBorde) ? enSuBorde : null;

      if (top >= 0 && tapa === null) {
        return;
      }
      caja.style.scrollMarginTop =
        tapa === null ? '' : `${Math.ceil(tapa.getBoundingClientRect().bottom)}px`;
      caja.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, []);

  const ponerAcorde = useCallback(
    (degree: DegreeSymbol, especie?: EspecieDeBloque) => {
      const donde = selectedBlockId === null ? null : findBlock(arrangement, selectedBlockId);
      const partId = donde?.part.id ?? parteDestino?.id ?? acciones.addPart('Estrofa');
      const at = donde === null ? null : donde.index + 1;

      setSelectedBlockId(acciones.addBlock(partId, degree, beatsPerBar, at, especie));
      setActivePartId(partId);
      traerLaCancionALaVista();
    },
    [
      acciones,
      arrangement,
      beatsPerBar,
      parteDestino,
      selectedBlockId,
      setSelectedBlockId,
      traerLaCancionALaVista,
    ],
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
  const traerGrabado = useCallback(
    (papel: PapelDeLaToma) => {
      /* v8 ignore next 3 -- sin tonalidad el lienzo entero no se pinta, y con el ni este boton */
      if (tonic === null) {
        return;
      }
      // La conversión vive en `state/apuntar-lo-tocado.ts` porque la comparten dos
      // entradas: este botón y el espacio de trabajo de tocar. Escrita dos veces,
      // una de las dos se quedaría sin la corrección del día que haga falta.
      //
      // **Y el papel se dice aquí también.** Los dos motores corren a la vez sobre
      // la misma entrada, así que traer «lo grabado» sin decir qué era escribía
      // acordes encima de un punteo. Dos botones y no uno: lo que se elige no es
      // un ajuste, es qué se tocó.
      const { partId, aviso } = apuntarLoTocado({ tonic, mode, bpm, beatsPerBar, papel });
      if (partId !== null) {
        setActivePartId(partId);
      }
      setAviso(aviso);
    },
    [beatsPerBar, bpm, mode, tonic],
  );

  /**
   * De qué acorde se pregunta: el elegido si es dudoso, y si no, **el primero que
   * lo sea.**
   *
   * Aquí solo se preguntaba del elegido, con esta razón: abrir la corrección de
   * todos a la vez llenaría la columna de preguntas sobre compases que a lo mejor
   * ni importan. La razón es buena y sigue en pie, **pero preguntar solo del
   * elegido significa que hay que ir a buscarlos**: quien no supiera que los
   * dudosos están marcados no los arreglaba nunca.
   *
   * Así que ni todos ni ninguno: **uno, y cuántos quedan.** Se arregla o se da por
   * bueno, y aparece el siguiente. Que la transcripción pregunte lo que no tiene
   * claro en vez de esperar a que lo encuentres es lo que pidió quien la usa, y es
   * el primer paso para que la toma no tenga que declarar lo que es
   * ([adr/0048](../../../docs/adr/0048-una-toma-dice-lo-que-es.md)).
   *
   * El elegido manda sobre la cola: si estás mirando un acorde concreto, la
   * pregunta es de ése.
   */
  const bloqueElegido = selectedBlockId === null ? null : findBlock(arrangement, selectedBlockId);
  const cola = bloquesEnDuda(arrangement);
  const enDuda =
    bloqueElegido !== null &&
    isDoubtful(bloqueElegido.block) &&
    bloqueElegido.block.alternatives.length > 0
      ? bloqueElegido.block
      : (cola[0] ?? null);

  const pulsos = arrangementBeats(arrangement);

  /**
   * La canción, en un fichero MIDI.
   *
   * Sale de `soundOf`, que es lo mismo que suena al darle a escuchar: si algún
   * día lo que se oye y lo que se descarga dejan de coincidir, será porque
   * alguien metió un segundo camino, no porque haya dos cuentas distintas.
   */
  function descargarMidi(): void {
    const primera = arrangement.parts[0];
    /* v8 ignore next 3 -- el botón está apagado sin tonalidad y sin nada escrito */
    if (activeKey === null || primera === undefined) {
      return;
    }
    const sonido = soundOf(arrangement, activeKey.tonic, activeKey.mode);
    // El nombre de la primera parte. Siempre hay uno: el almacén pone «Parte 1»
    // a la que se crea sin él, así que aquí no hace falta comprobarlo. Y si
    // alguna vez llegara vacío, `nombreDeFichero` ya devuelve «cancion.mid».
    const titulo = primera.name;
    descargarBytes(
      ficheroMidi(sonido.events, { nombre: titulo, bpm, beatsPerBar }),
      nombreDeFichero(titulo),
      TIPO_MIDI,
    );
  }
  const arrastrado = drag === null ? null : findBlock(arrangement, drag.blockId);

  /**
   * Una parte nueva, y **pasa a ser la de destino**.
   *
   * Se crea una parte para meter cosas en ella; sin esto, los acordes que se
   * pulsaban después seguían cayendo en la anterior. Y se suelta lo que hubiera
   * elegido, o el acorde siguiente caería detrás de un bloque de la parte de la
   * que se acaba de salir.
   *
   * Está sacada aparte porque la piden dos sitios: el botón de la barra y el
   * hueco del final de la canción.
   */
  function anadirParte(): void {
    setActivePartId(acciones.addPart());
    setSelectedBlockId(null);
  }

  /*
    Lo que reciben las filas, **las mismas funciones en cada pintado**.

    Las filas van con `memo`, y antes les llegaban flechas escritas aquí mismo
    —`() => player.toggle(part.id)`—, nuevas cada vez: cualquier cambio en una
    parte, o cada movimiento de un arrastre, repintaba todas las filas con sus
    pentagramas. Ahora cada una recibe la parte como argumento y la fila la ata
    a la suya.
  */
  const tocarParte = useEstable((partId: string) => player.toggle(partId));
  const renombrarParte = useCallback(
    (partId: string, name: string) => acciones.renamePart(partId, name),
    [acciones],
  );
  const ponerPapel = useCallback(
    (partId: string, role: Parameters<typeof acciones.setPartRole>[1]) =>
      acciones.setPartRole(partId, role),
    [acciones],
  );
  const quitarParte = useCallback((partId: string) => acciones.removePart(partId), [acciones]);
  const ponerCompases = useCallback(
    (partId: string, bars: number) => acciones.setBars(partId, bars, beatsPerBar),
    [acciones, beatsPerBar],
  );
  const elegirBloqueDeLaParte = useCallback(
    (partId: string, blockId: string) => {
      setSelectedBlockId(blockId);
      setActivePartId(partId);
    },
    [setSelectedBlockId],
  );
  const quitarBloque = useCallback(
    (blockId: string) => {
      acciones.removeBlock(blockId);
      setSelectedBlockId(null);
    },
    [acciones, setSelectedBlockId],
  );
  // La acción del estado recibe `(bloque, parte, sitio)` y la fila manda
  // `(parte, bloque, sitio)`. Los tres son del mismo tipo, así que cambiarlos de
  // orden compila y no mueve nada.
  const moverBloqueDeLaParte = useCallback(
    (partId: string, blockId: string, to: number) => acciones.moveBlock(blockId, partId, to),
    [acciones],
  );

  /*
    Lo elegido, lo que suena y lo que se arrastra, **solo a la fila donde está**.

    Pasar el mismo identificador a todas las filas hacía que elegir un acorde, o
    cada paso de la reproducción, las repintara todas: cambiaba una prop en
    cada una aunque en la mayoría no dijera nada. Para una fila que no lo tiene,
    «nada elegido» es exactamente lo mismo.
  */
  const parteDelBloque = (blockId: string | null): string | null =>
    blockId === null ? null : (findBlock(arrangement, blockId)?.part.id ?? null);
  const parteElegida = parteDelBloque(selectedBlockId);
  const parteQueSuena = parteDelBloque(player.currentBlockId);
  const parteDeLaNota =
    selectedNoteId === null ? null : (findNote(arrangement, selectedNoteId)?.part.id ?? null);

  /** Si la canción tiene algo, para no ofrecer mandos que no tienen sobre qué. */
  const hayAlgo = arrangement.parts.length > 0;

  if (tonic === null) {
    return (
      // Se centra con `my-auto` **en el hijo**, que es como lo hace el afinador y
      // lo que pide `docs/ESTILO.md`: con `justify-center` en la caja que se
      // desplaza, lo que no cabe se sale por los dos lados y no hay forma de
      // bajar hasta ello. Con el margen automático se centra cuando sobra sitio y
      // se desplaza cuando falta.
      <div className="flex min-h-0 grow flex-col overflow-y-auto p-3">
        <div className="my-auto">
          <EmpezarPorTonalidad />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      {/*
        Lo que acaba de aparecer, dicho en voz alta.

        Un fantasma en pantalla **cambia lo que hace `Tab`**: deja de mover el
        foco y acepta lo propuesto. Aparecía sin decir nada, así que quien no ve
        la pantalla pulsaba `Tab` para recorrerla y se encontraba cuatro acordes
        metidos en su canción sin haberlos pedido.

        La región va montada siempre y vacía, y solo cambia el texto de dentro:
        una que nace con el texto ya puesto no se lee en todos los lectores.

        El aviso de lo grabado se lee en su propio sitio, unas líneas más abajo:
        metido aquí también se decía dos veces.
      */}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      {/*
        En pantalla ancha se envuelve; en estrecha **se desplaza a lo largo**.

        Envolviéndose siempre, esta barra crecía hacia abajo, y el hueco del
        lienzo en un teléfono son doscientos y pico píxeles: con las figuras
        dentro, la barra medía 235 en una caja de 203 y la última fila se metía
        debajo del cajón de herramientas —«Deshacer» dejaba de poder pulsarse—.
        Al no envolverse mide una fila y siempre cabe, y lo que no entra se
        alcanza arrastrando, que es lo que hace cualquier barra de herramientas
        en un móvil. `shrink-0` para que la fila no ceda su altura.
      */}
      <div className="border-border hay-mas-al-lado flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-2 sm:flex-wrap sm:overflow-x-visible [&>*]:shrink-0 sm:[&>*]:shrink">
        <Button
          onClick={() => player.toggle(null)}
          disabled={pulsos === 0}
          className="px-4 py-1.5 text-sm"
        >
          {player.playing && player.playingPartId === null ? 'Parar' : 'Escuchar la canción'}
        </Button>

        {/* **Lo que saca la canción de aquí.** Sin esto, lo único descargable
          era el audio de lo que tocaste: el montaje vivía dentro y no salía, y
          se compone para llevárselo a un secuenciador o mandárselo a alguien.
          Va al lado de «escuchar» porque las dos hacen lo mismo con la canción
          entera, una para oírla y otra para llevársela. */}
        <Button
          variant="quiet"
          onClick={descargarMidi}
          disabled={pulsos === 0}
          title="Guardar la canción como fichero MIDI"
          className="px-3 py-1.5 text-sm"
        >
          MIDI
        </Button>

        {/* La monoespaciada solo cuando es un dato que se compara —«4 compases»—;
            «sin nada todavía» es una frase, y va en la sans (adr/0024). */}
        <span className={`text-text-muted text-xs ${pulsos === 0 ? '' : 'font-mono'}`}>
          {pulsos === 0 ? 'sin nada todavía' : barsLabel(pulsos, beatsPerBar)}
        </span>

        {/* Sin envolver en estrecho, por lo mismo que la barra que lo contiene:
              envolviéndose aquí dentro, el grupo crecía hacia abajo y se llevaba
              por delante lo que la barra acababa de arreglar.

              **A la izquierda, no con `ml-auto`.** Empujado a la derecha, en
              cuanto la barra se partía en dos filas esta segunda salía pegada al
              otro borde, y su primer botón saltaba de x=269 a x=135 según hubiera
              canción o no: la misma barra en dos sitios. */}
        <span className="flex gap-1 sm:flex-wrap">
          {/* Cómo se lleva el punteo se elige también antes de escribir, porque
              decide dónde se escribe. Las figuras y «Deshacer», en cambio, no
              se enseñan hasta que hay canción: sin partes no hay nota que medir
              ni nada que deshacer, y eran ocho mandos más compitiendo con el
              estado vacío de debajo, que es lo único que tiene algo que decir. */}
          {/* Un segmentado y no tres pastillas sueltas: son tres maneras de ver
              lo mismo y se excluyen, y sueltas tenían la misma pinta que las
              acciones de al lado —«+ Parte», «Deshacer»—. */}
          <Segmentado
            etiqueta="Cómo llevar el punteo"
            opciones={PUNTEOS.map((candidato) => ({ valor: candidato.id, texto: candidato.name }))}
            valor={punteo}
            onCambiar={setPunteo}
          />
          <Separador />

          {/* Apuntar solo tiene sentido con el micro abierto: sin él no llega
              un acorde y el botón sería una promesa que no se cumple. */}
          {listening === 'listening' && (
            <Chip
              onClick={apuntar}
              pressed={capturing}
              tone="quiet"
              tamano="compacto"
              title="Apunta los acordes que vayas tocando"
            >
              {capturing ? 'Parar de apuntar' : 'Apuntar lo que toco'}
            </Chip>
          )}
          {hayGrabado &&
            (Object.keys(PAPELES_DE_TOMA) as PapelDeLaToma[]).map((papel) => (
              <Chip
                key={papel}
                onClick={() => traerGrabado(papel)}
                tone="quiet"
                tamano="compacto"
                title={PAPELES_DE_TOMA[papel].what}
              >
                Traer {PAPELES_DE_TOMA[papel].name.toLowerCase()}
              </Chip>
            ))}
          <Chip onClick={anadirParte} tone="quiet" tamano="compacto">
            + Parte
          </Chip>

          {/* Lo propuesto se acepta o se descarta **desde aquí también**, y no
            solo con las teclas: un atajo que es la única manera de hacer algo no
            es un atajo, es un requisito. Y dice de dónde salió, que es lo que
            permite saber si fiarse
            ([adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md)). */}
          {propuesta !== null && (
            <span
              role="group"
              aria-label="Lo que propone el copiloto"
              className="border-brass-dim flex items-center gap-2 rounded-md border border-dashed px-2 py-1"
            >
              <span className="text-text-muted text-xs">{propuesta.titulo}</span>
              <Chip
                onClick={accionesDeLaPropuesta.aceptarTodo}
                tone="quiet"
                atajo="Tab"
                tamano="compacto"
              >
                Aceptar {propuesta.degrees.length}
              </Chip>
              <Chip
                onClick={accionesDeLaPropuesta.descartar}
                tone="quiet"
                atajo="Esc"
                tamano="compacto"
              >
                Descartar
              </Chip>
            </span>
          )}
          {punteo === 'bloques' && (
            <Chip
              onClick={() => setOnlyScale(!onlyScale)}
              pressed={onlyScale}
              tone="quiet"
              tamano="compacto"
              title="Solo las notas de la escala que tienes puesta"
            >
              Solo la escala
            </Chip>
          )}

          {/* Las figuras que el modelo sabe escribir, que son siete. Se ven en las dos
              pieles del punteo porque en las dos se escriben notas. */}
          {punteo !== 'oculto' && hayAlgo && <Separador />}
          {punteo !== 'oculto' && hayAlgo && (
            <span
              role="group"
              aria-label="Duración de la nota"
              // Dos píxeles entre figuras eran pocos para una fila de botones
              // seguidos: el de al lado está a un dedo de distancia. Son siete
              // desde que existe la semicorchea.
              className="border-border flex items-center gap-1 rounded-md border px-1"
            >
              {NOTE_LENGTHS.map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => elegirFigura(length)}
                  aria-pressed={figura === length}
                  aria-label={nombreDeFigura(length)}
                  title={nombreDeFigura(length)}
                  // **Cuarenta y cuatro de ancho, no treinta.** Medían 30 por 44:
                  // altas de sobra y estrechas, que en una fila de siete pegadas
                  // es justo la forma de pulsar la de al lado. Lo canta la sonda
                  // de componer, que mide el rectángulo y no la clase.
                  className={`focus-visible:outline-brass-bright min-h-tap min-w-tap cursor-pointer rounded-sm px-1 focus-visible:outline-2 ${
                    figura === length ? 'text-brass-bright' : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Figura length={length} />
                </button>
              ))}
            </span>
          )}

          {/* Con canción, o con algo que deshacer aunque ya no quede nada: borrar
              la última parte deja la canción vacía, y es justo cuando más falta
              hace volver atrás. */}
          {(hayAlgo || puedeDeshacer) && <Separador />}
          {(hayAlgo || puedeDeshacer) && (
            <Chip
              onClick={() => acciones.undo()}
              tone="quiet"
              disabled={!puedeDeshacer}
              tamano="compacto"
            >
              Deshacer
            </Chip>
          )}
        </span>
      </div>

      {/*
        La caja de fuera va siempre, aunque no haya nada que contar.

        Es lo que hace que el aviso se lea: un lector anuncia lo que **entra** en
        una región que ya estaba, y no siempre una región que nace con el texto
        dentro. Vacía no ocupa —el relieve y el relleno los lleva el párrafo de
        dentro—, así que no se nota cuando no hay aviso.
      */}
      <div aria-live="polite">
        {aviso !== null && (
          <p className="border-border text-text-muted flex items-start gap-3 border-b px-3 py-2 text-xs">
            <span className="min-w-0 grow">{aviso}</span>
            <Chip
              onClick={() => setAviso(null)}
              tone="quiet"
              tamano="compacto"
              className="shrink-0"
            >
              Vale
            </Chip>
          </p>
        )}
      </div>

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
          ref={(nodo) => {
            listaRef.current = nodo;
            anchoRef.current = nodo;
          }}
          className="min-h-0 shrink-0 grow lg:shrink lg:overflow-y-auto"
          onKeyDown={teclaEnPunteo}
          role="presentation"
        >
          {arrangement.parts.length === 0 ? (
            <Vacio icono={<IconoCanciones />} titulo="La canción está en blanco">
              Pulsa un acorde de la lista y con él se crea la primera parte. Después se arrastra
              para moverlo, se estira por los bordes para que dure más y se pulsa Escuchar para
              oírla entera.
            </Vacio>
          ) : (
            arrangement.parts.map((part) => (
              <PartRow
                key={part.id}
                part={part}
                tonic={tonic}
                mode={mode}
                beatsPerBar={beatsPerBar}
                porPulso={porPulso}
                playing={player.playing && player.playingPartId === part.id}
                playingBlockId={parteQueSuena === part.id ? player.currentBlockId : null}
                selectedBlockId={parteElegida === part.id ? selectedBlockId : null}
                draggingBlockId={arrastrado?.part.id === part.id ? arrastrado.block.id : null}
                dropIndex={drag?.target?.partId === part.id ? drag.target.index : null}
                punteo={punteo}
                dropPart={soltando?.destino?.partId === part.id}
                dropAt={soltando?.destino?.partId === part.id ? soltando.destino.at : null}
                scaleId={scaleId}
                onlyScale={onlyScale}
                selectedNoteId={parteDeLaNota === part.id ? selectedNoteId : null}
                onPlay={tocarParte}
                onRename={renombrarParte}
                onSetRole={ponerPapel}
                onRemove={quitarParte}
                onSetBars={ponerCompases}
                onBlockPointerDown={cogerBloque}
                onBlockClick={elegirBloqueDeLaParte}
                onBlockKeyDown={teclaEnBloque}
                onRemoveBlock={quitarBloque}
                onResizeBlock={acciones.resizeBlock}
                onMoveBlock={moverBloqueDeLaParte}
                onAddNote={escribirNota}
                onSelectNote={setSelectedNoteId}
                onMoveNote={acciones.moveNote}
                onResizeNote={acciones.resizeNote}
                propuesta={propuesta?.partId === part.id ? propuesta.degrees : undefined}
                onAceptarPropuesta={accionesDeLaPropuesta.aceptar}
                onGestureStart={acciones.beginGesture}
                onGestureEnd={acciones.endGesture}
              />
            ))
          )}

          {/*
            El hueco del final, que dice que la canción sigue.

            Con una sola parte quedaban quinientos píxeles de negro debajo del
            pentagrama, y ese vacío no decía nada: ni que una canción se hace de
            partes ni que se pueden añadir. El botón para hacerlo existía, pero
            arriba en la barra, entre otros seis, escrito «+ Parte».
            
            Va **al final de la lista y no antes**, porque es donde continúa la
            canción, y en trazo discontinuo porque es un sitio por llenar y no
            una parte más.
          */}
          {arrangement.parts.length > 0 && (
            <div className="p-3">
              <button
                type="button"
                onClick={anadirParte}
                className="border-border text-text-muted hover:border-brass-dim hover:text-brass-bright hover:bg-surface min-h-tap flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm transition-colors"
              >
                <span aria-hidden="true" className="text-base">
                  +
                </span>
                Añadir otra parte
              </button>
            </div>
          )}
        </div>

        {/* Lo que puede venir después. En pantalla ancha es una columna a la
            derecha, como en la otra cara de componer; apilado, va debajo y no
            arriba, porque lo que se mira todo el rato es la canción. */}
        {/* Una región y no un `aside`: un `aside` es un punto de referencia de
            primer nivel, y éste vive dentro del área del arreglo, que ya es una
            región con nombre. axe lo marcaba como complementario anidado. */}
        <section
          aria-label="Qué poner ahora"
          className="border-border shrink-0 border-t p-3 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          {/*
            Lo elegido, con su botón de quitar.

            Borrar se podía solo con `Supr` sobre el elemento enfocado, y en un
            teléfono no hay teclado: lo que se ponía no se podía quitar. Va
            arriba del todo porque, cuando hay algo elegido, lo que se quiere
            hacer es con eso.
          */}
          {elegido !== null && (
            <section
              aria-label="Lo elegido"
              className="border-border mb-4 flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="min-w-0">
                  <span className="text-brass-bright block font-mono text-base">
                    {elegido.nombre}
                  </span>
                  <span className="text-text-muted block font-mono text-xs">{elegido.detalle}</span>
                </span>
                <Chip
                  onClick={quitarElegido}
                  tone="quiet"
                  tamano="compacto"
                  className="ml-auto"
                  ariaLabel={`Quitar ${elegido.nombre}`}
                >
                  Quitar
                </Chip>
              </div>

              {elegido.que === 'acorde' && (
                <>
                  {/* **Dos pares, en rejilla de dos por dos.** En una fila que se
                      envuelve salían tres y uno —«Antes», «Después», «− pulso» y
                      «+ pulso» solo en la de abajo—, que parte el par que va
                      junto y junta lo que no. Arriba se mueve, abajo se estira. */}
                  <div className="grid grid-cols-2 gap-1" role="group" aria-label="Mover y estirar">
                    <Chip
                      onClick={() => moverElegido(-1)}
                      tone="quiet"
                      disabled={elegido.index === 0}
                      ariaLabel={`Mover ${elegido.nombre} antes`}
                      tamano="compacto"
                      className="w-full"
                    >
                      Antes
                    </Chip>
                    <Chip
                      onClick={() => moverElegido(1)}
                      tone="quiet"
                      disabled={elegido.index === elegido.ultimo}
                      ariaLabel={`Mover ${elegido.nombre} después`}
                      tamano="compacto"
                      className="w-full"
                    >
                      Después
                    </Chip>
                    <Chip
                      onClick={() => estirarElegido(-1)}
                      tone="quiet"
                      disabled={elegido.beats <= 1}
                      ariaLabel={`Un pulso menos a ${elegido.nombre}`}
                      tamano="compacto"
                      className="w-full"
                    >
                      − pulso
                    </Chip>
                    <Chip
                      onClick={() => estirarElegido(1)}
                      tone="quiet"
                      disabled={elegido.beats >= MAX_BLOCK_BEATS}
                      ariaLabel={`Un pulso más a ${elegido.nombre}`}
                      tamano="compacto"
                      className="w-full"
                    >
                      + pulso
                    </Chip>
                  </div>
                  {/* A otra parte, solo si hay otra: con una sola no hay adónde. */}
                  {arrangement.parts.length > 1 && (
                    <Field
                      label="Mover a la parte"
                      compact
                      ancho="completo"
                      value=""
                      onChange={(event) => llevarElegido(event.target.value)}
                      className="text-xs"
                    >
                      <option value="" disabled>
                        Mover a la parte…
                      </option>
                      {arrangement.parts
                        .filter((part) => part.id !== elegido.partId)
                        .map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name}
                          </option>
                        ))}
                    </Field>
                  )}
                  <p className="text-text-muted text-xs">
                    Con el teclado: {TECLAS_DEL_BLOQUE_DICHAS}.
                  </p>
                </>
              )}
            </section>
          )}

          {/*
            Corregir va lo primero, y solo cuando hay algo que corregir.

            Vive en su propio fichero: `ArrangeCanvas` son mil cuatrocientas líneas
            en una función, y esta pieza depende de cinco cosas y hace una sola.
          */}
          <CorregirAcorde
            enDuda={enDuda}
            cuantos={cola.length}
            tonic={tonic}
            mode={mode}
            onCorregir={acciones.fixBlock}
            onConfirmar={acciones.confirmBlock}
          />

          {/* Escribir va antes que elegir: quien sabe cómo se llama el acorde no
              tiene por qué buscarlo en una lista, y quien no lo sabe pasa de
              largo hasta las propuestas de abajo. */}
          <ChordEntry tonic={tonic} mode={mode} onPick={ponerAcorde} />

          <h3 className="rotulo mt-4">
            {parteDestino === null ? 'Para empezar' : `Después de ${parteDestino.name}`}
          </h3>
          <p className="text-text-muted mt-1 text-xs">
            Pulsa uno, o arrástralo hasta la parte donde lo quieras.
          </p>
          <ul aria-label="Acordes que pueden seguir" className="mt-3 flex flex-col gap-2">
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
                    // Con rótulo, porque los tres trozos van pegados: un lector
                    // de pantalla leía «CICasa.» de corrido. Es el mismo formato
                    // que ya usa la lista de «a dónde ir».
                    aria-label={`${chord.symbol}, ${sugerencia.degree}. ${sugerencia.why}`}
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
              <h3 className="rotulo">Y de nota, sobre {SCALES[scaleId].name.toLowerCase()}</h3>
              <ul className="mt-2 flex flex-wrap gap-1">
                {notaSiguiente.notes.map((nota) => (
                  <li key={nota.offset}>
                    <button
                      type="button"
                      onClick={() => ponerNota(nota.offset)}
                      title={nota.why}
                      aria-label={`${nota.name}: ${nota.why}`}
                      className={`min-h-tap inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-medium ${
                        nota.role === 'acorde'
                          ? 'border-brass-dim text-text hover:bg-surface-raised'
                          : 'border-border text-text-muted hover:border-brass-dim hover:text-text'
                      }`}
                    >
                      {/* La misma marca que el panel de acordes: círculo lo que
                          cae de pie, anillo lo que entra pero pide seguir, rombo
                          lo que se sale. Con forma y no solo con color, que el
                          verde contra el rojo es la pareja que no distingue uno
                          de cada doce hombres. */}
                      <Marca
                        tono={
                          nota.role === 'acorde'
                            ? 'entra'
                            : nota.role === 'escala'
                              ? 'color'
                              : 'fuera'
                        }
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
        </section>
      </div>

      {/* El bloque que se arrastra, pegado al puntero. Va fuera de las filas y en
          `fixed` porque tiene que poder salir de la fila de la que se sacó: es
          justo el gesto de llevárselo al estribillo. */}
      {/* Los dos fantasmas se colocan con `transform` desde el gesto, sin
          estado (`colocar`): aquí solo se dice qué llevan y cuánto miden. La
          caja de fuera va en la esquina y se traslada al puntero; el margen
          negativo de la de dentro la centra en él. */}
      {soltando !== null && (
        <div
          aria-hidden
          ref={fantasmaDePropuesta}
          className="pointer-events-none fixed top-0 left-0 z-50 will-change-transform"
        >
          <div
            style={{ marginLeft: -30, marginTop: -22 }}
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
          ref={fantasma}
          className="pointer-events-none fixed top-0 left-0 z-50 opacity-90 will-change-transform"
        >
          {/* Centrado en el puntero, y con el ancho de verdad del bloque: si el
              fantasma midiera siempre lo mismo, arrastrar uno de dos compases
              mentiría sobre el hueco que va a ocupar. */}
          <div
            style={{
              width: anchoDeBloque(arrastrado.block.beats, porPulso),
              marginLeft: -anchoDeBloque(arrastrado.block.beats, porPulso) / 2,
              marginTop: -22,
            }}
            className="superficie-viva border-brass-bright text-text min-h-tap flex items-center justify-center rounded-md font-mono"
          >
            {resolveDegree(tonic, mode, arrastrado.block.degree).symbol}
          </div>
        </div>
      )}
    </div>
  );
});
