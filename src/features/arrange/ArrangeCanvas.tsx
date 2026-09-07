'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  arrangementBeats,
  barsLabel,
  captureProgression,
  degreesFor,
  findBlock,
  lastDegreeOf,
  nextDegrees,
  resolveDegree,
  type DegreeSymbol,
} from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { selectCanUndo, useArrangementStore } from '@state/arrangement-store';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';

import { PX_POR_PULSO, ZONA_ESTIRAR_PX, anchoDeBloque } from './BlockButton';
import { PartRow } from './PartRow';
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

export function ArrangeCanvas() {
  const activeKey = useSessionStore(selectActiveKey);
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const captured = useSessionStore((state) => state.captured);
  const captureEndedAt = useSessionStore((state) => state.captureEndedAt);
  const capturing = useSessionStore((state) => state.capturing);

  const arrangement = useArrangementStore((state) => state.arrangement);
  const puedeDeshacer = useArrangementStore(selectCanUndo);
  const acciones = useArrangementStore((state) => state.actions);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);

  const tonic = activeKey?.tonic ?? null;
  const mode = activeKey?.mode ?? 'major';

  const player = useArrangementPlayer(arrangement, tonic, mode, bpm);

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

  const ponerAcorde = useCallback(
    (degree: DegreeSymbol) => {
      const partId = parteDestino?.id ?? acciones.addPart('Estrofa');
      const id = acciones.addBlock(partId, degree, beatsPerBar);
      setActivePartId(partId);
      setSelectedBlockId(id);
    },
    [acciones, beatsPerBar, parteDestino],
  );

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
    if (capture.steps.length === 0) {
      return;
    }
    setActivePartId(acciones.addRecorded(capture.steps, 'Lo que has tocado'));
  }, [acciones, beatsPerBar, bpm, captureEndedAt, captured, mode, tonic]);

  const pulsos = arrangementBeats(arrangement);
  const hayGrabado = !capturing && captured.length > 0 && captureEndedAt > 0;
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
          {hayGrabado && (
            <Chip onClick={traerGrabado} tone="quiet" className="px-3 text-xs">
              Traer lo grabado
            </Chip>
          )}
          {/* La parte nueva pasa a ser la de destino. Se crea una parte para
              meter cosas en ella, y sin esto los acordes que se pulsaban después
              seguían cayendo en la anterior. */}
          <Chip
            onClick={() => setActivePartId(acciones.addPart())}
            tone="quiet"
            className="px-3 text-xs"
          >
            Parte nueva
          </Chip>
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

      <div className="flex min-h-0 grow flex-col overflow-hidden lg:flex-row">
        <div ref={listaRef} className="min-h-0 grow overflow-y-auto">
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
                onPlay={() => player.toggle(part.id)}
                onRename={(name) => acciones.renamePart(part.id, name)}
                onRemove={() => acciones.removePart(part.id)}
                onBlockPointerDown={cogerBloque}
                onBlockClick={(blockId) => {
                  setSelectedBlockId(blockId);
                  setActivePartId(part.id);
                }}
                onBlockKeyDown={teclaEnBloque}
              />
            ))
          )}
        </div>

        {/* Lo que puede venir después. En pantalla ancha es una columna a la
            derecha, como en la otra cara de componer; apilado, va debajo y no
            arriba, porque lo que se mira todo el rato es la canción. */}
        <aside
          aria-label="Qué poner ahora"
          className="border-border shrink-0 overflow-y-auto border-t p-3 lg:w-72 lg:border-t-0 lg:border-l"
        >
          <h3 className="text-text-muted text-xs tracking-widest uppercase">
            {parteDestino === null ? 'Para empezar' : `Después de ${parteDestino.name}`}
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {sugerencias.map((sugerencia) => {
              const chord = resolveDegree(tonic, mode, sugerencia.degree);
              return (
                <li key={sugerencia.degree}>
                  <button
                    type="button"
                    onClick={() => ponerAcorde(sugerencia.degree)}
                    className="border-border hover:border-brass-dim hover:bg-surface-raised min-h-tap flex w-full items-baseline gap-3 rounded-md border px-3 py-2 text-left"
                  >
                    <span className="text-brass-bright font-mono text-base">{chord.symbol}</span>
                    <span className="text-text-muted font-mono text-xs">{sugerencia.degree}</span>
                    <span className="text-text-muted text-xs">{sugerencia.why}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      {/* El bloque que se arrastra, pegado al puntero. Va fuera de las filas y en
          `fixed` porque tiene que poder salir de la fila de la que se sacó: es
          justo el gesto de llevárselo al estribillo. */}
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
