'use client';

import { memo, useCallback, useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
  GRID,
  clampOffset,
  isDoubtfulNote,
  isInScaleOffset,
  accidentalForScale,
  normalizePitchClass,
  noteName,
  type LeadNote,
  type PitchClass,
  type ScaleId,
} from '@core/music';

import { useArrastre } from './arrastrar';
import { PX_POR_PULSO } from './BlockButton';

/**
 * El punteo como bloques, para quien no lee partituras.
 *
 * Una rejilla: el tiempo hacia la derecha con el mismo píxel por pulso que los
 * acordes de arriba —así una nota queda debajo del acorde sobre el que suena, sin
 * tener que contar— y las alturas hacia arriba, una fila por nota.
 *
 * **La casilla de «solo la escala» es la que separa a quien sabe de quien no.**
 * Encendida, las filas son las notas de la escala que hay puesta y no hay manera
 * de escribir una que desafine: la interfaz no ofrece las de fuera. Apagada,
 * aparecen las doce y se puede escribir el cromatismo, que es medio idioma del
 * blues. Es la misma idea que la partitura, con otra piel.
 */

/**
 * Alto de cada fila, y **es el mínimo de la norma para lo que se pulsa**.
 *
 * Estaba en 22: las filas se tocan unas con otras, así que no hay hueco que
 * cuente como margen y cada una tenía que medir 24 por sí sola. Las notas miden
 * lo mismo, porque su zona de agarre es la fila entera aunque se pinten más
 * finas ([adr/0062](../../../docs/adr/0062-la-rejilla-del-punteo-llega-a-veinticuatro.md)).
 * Con la escala puesta siguen cabiendo en un portátil sin desplazar.
 */
export const ALTO_FILA = 24;

/** Lo que se come el pintado de una nota por arriba y por abajo de su fila. */
const AIRE_NOTA = 3;

/** Lo mínimo que mide de ancho la zona de agarre de una nota: lo que pide la norma. */
const AGARRE_MINIMO = 24;

/** Lo que mide pintada una nota: su duración, menos un respiro con la siguiente. */
function anchoPintado(note: LeadNote, porPulso: number): number {
  return Math.max(8, note.length * porPulso - 2);
}

/** La caja de una rejilla que no está montada. No pasa; TypeScript no lo sabe. */
const SIN_REJILLA = { top: 0, left: 0 } as DOMRect;

/** Hasta dónde llegan las alturas: de una cuarta abajo a una novena arriba. */
const OFFSET_GRAVE = -5;
const OFFSET_AGUDO = 16;

export interface MelodyLaneProps {
  readonly notes: readonly LeadNote[];
  readonly beats: number;
  readonly beatsPerBar: number;
  readonly tonic: PitchClass;
  readonly scaleId: ScaleId;
  /** Solo las notas de la escala, que es como no hay forma de desafinar. */
  readonly onlyScale: boolean;
  /**
   * Lo que mide un pulso. El mismo número que usan los acordes de arriba, o una
   * nota dejaría de caer debajo del acorde sobre el que suena.
   */
  readonly porPulso?: number;
  readonly selectedNoteId: string | null;
  readonly partName: string;
  readonly onAdd: (offset: number, start: number) => void;
  readonly onSelect: (noteId: string) => void;
  readonly onMove: (noteId: string, start: number, offset: number) => void;
  readonly onResize: (noteId: string, length: number) => void;
  /** Un arrastre entero es un paso atrás, no uno por píxel. */
  readonly onGestureStart: () => void;
  readonly onGestureEnd: () => void;
}

export const MelodyLane = memo(function MelodyLane({
  notes,
  beats,
  beatsPerBar,
  tonic,
  scaleId,
  onlyScale,
  porPulso = PX_POR_PULSO,
  selectedNoteId,
  partName,
  onAdd,
  onSelect,
  onMove,
  onResize,
  onGestureStart,
  onGestureEnd,
}: MelodyLaneProps) {
  const rejillaRef = useRef<HTMLDivElement | null>(null);
  /**
   * Si el último gesto fue un arrastre.
   *
   * Igual que en la partitura: al soltar una nota sobre otra fila, el `click`
   * llega a la casilla de debajo y escribía una nota nueva encima de la que se
   * acababa de mover.
   */
  const arrastradaRef = useRef(false);
  const empezarArrastre = useArrastre();
  /**
   * La escala manda sobre la tonalidad al escribir estos nombres.
   *
   * `accidentalForScale` existe justo para esto, y `scales.ts` lo explica con el
   * caso que se ve aquí: la pentatónica menor de Do sale de Mi bemol mayor, así
   * que es C Eb F G Bb y no C D# F G A#, que suena igual y no lo escribe nadie.
   * Con la alteración de la tonalidad —que es de sostenidos— las filas salían con
   * los nombres que nadie usa.
   */
  const accidental = accidentalForScale(tonic, scaleId);

  /**
   * Las filas, de aguda a grave.
   *
   * De arriba abajo porque es como está el mundo: lo agudo arriba, igual que en
   * un pentagrama. Con la escala puesta se quitan las de fuera y la rejilla
   * encoge a la mitad, que es lo que la hace caber sin desplazar.
   */
  const filas = useMemo(() => {
    const todas: number[] = [];
    for (let offset = OFFSET_AGUDO; offset >= OFFSET_GRAVE; offset -= 1) {
      if (!onlyScale || isInScaleOffset(offset, tonic, scaleId)) {
        todas.push(offset);
      }
    }
    return todas;
  }, [onlyScale, scaleId, tonic]);

  const anchoTotal = Math.max(beats, beatsPerBar) * porPulso;

  /**
   * Cuántas notas no tienen fila donde dibujarse.
   *
   * Con «solo la escala» puesta, una nota alterada en la partitura no cabe en
   * ninguna fila. Se queda donde está —quitarla sería borrar trabajo por haber
   * cambiado de vista— pero **hay que decirlo**: escribir seis notas y ver una
   * parece que se han perdido cinco.
   */
  const escondidas = notes.filter((note) => !filas.includes(clampOffset(note.offset))).length;

  /**
   * Qué casilla hay bajo un punto de la pantalla. **Siempre hay una.**
   *
   * La fila se recorta contra los extremos, así que un punto por encima de la
   * rejilla cae en la de arriba y uno por debajo en la de abajo, que es lo que
   * hace que arrastrar fuera y volver no pierda la nota.
   *
   * Los dos valores de repuesto son para lo que TypeScript no puede saber —que
   * la rejilla está montada siempre que se pueda pulsar en ella, y que la lista
   * de filas de una escala nunca está vacía—, no para un caso real. Devolver
   * nulo por ellos obligaba a comprobarlo en los tres sitios que llaman aquí, y
   * esas tres comprobaciones tampoco podían darse.
   */
  const casillaEn = useCallback(
    (clientX: number, clientY: number): { offset: number; start: number } => {
      /* v8 ignore next -- la rejilla está montada: sin ella no hay dónde pulsar. */
      const caja = rejillaRef.current?.getBoundingClientRect() ?? SIN_REJILLA;
      const fila = Math.floor((clientY - caja.top) / ALTO_FILA);
      /* v8 ignore next -- una escala sin notas no existe. */
      const offset = filas[Math.min(Math.max(0, fila), filas.length - 1)] ?? 0;
      const pulsos = (clientX - caja.left) / porPulso;
      return { offset, start: Math.max(0, Math.floor(pulsos / GRID) * GRID) };
    },
    [filas, porPulso],
  );

  /**
   * Coger una nota: por el cuerpo se mueve, por el borde derecho se estira.
   *
   * Es la misma regla que los bloques de acorde, y por el mismo motivo: una
   * manija aparte sería un control de ocho píxeles, y aquí ya se está por debajo
   * de lo que esta aplicación exige para lo que se pulsa.
   */
  const cogerNota = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, note: LeadNote) => {
      if (event.button !== 0) {
        return;
      }
      const caja = event.currentTarget.getBoundingClientRect();
      // El borde que cuenta es el de lo pintado, no el de la zona de agarre: en
      // una nota corta la zona sobresale, y estirar desde el aire no se entiende.
      const estirando = event.clientX > caja.left + anchoPintado(note, porPulso) - 8;
      onSelect(note.id);
      onGestureStart();

      if (estirando) {
        const inicioX = event.clientX;
        empezarArrastre({
          mover: (x) => {
            arrastradaRef.current = true;
            onResize(note.id, note.length + (x - inicioX) / porPulso);
          },
          soltar: onGestureEnd,
        });
        return;
      }

      // La nota se mueve con el puntero y no salta a él: cogiendo una de cuatro
      // pulsos por el medio, sin esto el principio se iba a donde estaba el dedo.
      const agarre = casillaEn(event.clientX, event.clientY);
      const dStart = note.start - agarre.start;

      empezarArrastre({
        mover: (x, y) => {
          arrastradaRef.current = true;
          const casilla = casillaEn(x, y);
          onMove(note.id, casilla.start + dStart, casilla.offset);
        },
        soltar: onGestureEnd,
      });
    },
    [
      casillaEn,
      empezarArrastre,
      onGestureEnd,
      onGestureStart,
      onMove,
      onResize,
      onSelect,
      porPulso,
    ],
  );

  /**
   * Dónde escribe una fila que se activa con el teclado.
   *
   * Con `Intro` o `Espacio` el `click` llega sin puntero —`detail` a cero y las
   * coordenadas a cero—, y leerlas escribía **siempre la fila de arriba en el
   * pulso cero**, pulsara uno la fila que pulsara. La altura la sabe la propia
   * fila; el pulso es **justo después de la última nota**, que es donde sigue
   * quien escribe un punteo de corrido. Sin pasarse del final de la rejilla: una
   * nota fuera de ella no se vería, y parecería que la tecla no ha hecho nada.
   */
  const pulsoLibre = useCallback((): number => {
    const fin = notes.reduce((hasta, note) => Math.max(hasta, note.start + note.length), 0);
    const ultimo = Math.max(beats, beatsPerBar) - GRID;
    return Math.min(Math.ceil(fin / GRID) * GRID, ultimo);
  }, [beats, beatsPerBar, notes]);

  const escribirEnFila = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, offset: number) => {
      if (arrastradaRef.current) {
        arrastradaRef.current = false;
        return;
      }
      if (event.detail === 0) {
        onAdd(offset, pulsoLibre());
        return;
      }
      const casilla = casillaEn(event.clientX, event.clientY);
      onAdd(casilla.offset, casilla.start);
    },
    [casillaEn, onAdd, pulsoLibre],
  );

  return (
    <div className="mt-1">
      {escondidas > 0 && (
        <p className="text-text-muted mb-1 text-xs">
          {escondidas === 1
            ? 'Hay 1 nota que no es de la escala y no cabe en esta rejilla.'
            : `Hay ${escondidas} notas que no son de la escala y no caben en esta rejilla.`}{' '}
          Siguen ahí: se ven quitando «Solo la escala», o en la partitura.
        </p>
      )}
      <div
        ref={rejillaRef}
        // `relative` para anclar las notas, que van en absoluto sobre la rejilla:
        // una nota puede empezar a mitad de pulso y durar tres, y eso no lo
        // coloca una tabla.
        // `max-w-full` y no ancho completo: una parte de cuatro compases dejaba
        // media pantalla de rejilla vacía a la derecha, y una rejilla vacía
        // parece que se puede escribir en ella.
        className="border-border relative max-w-full overflow-x-auto rounded-md border"
        style={{ height: filas.length * ALTO_FILA, width: anchoTotal }}
      >
        <div style={{ width: anchoTotal, height: filas.length * ALTO_FILA }}>
          {filas.map((offset, fila) => {
            const enEscala = isInScaleOffset(offset, tonic, scaleId);
            const nombre = noteName(normalizePitchClass(tonic + offset), accidental);
            return (
              <button
                key={offset}
                type="button"
                // Pulsar una casilla vacía escribe la nota ahí. Es lo más corto
                // que hay entre querer una nota y tenerla, y con la escala puesta
                // no hay ninguna casilla que suene mal.
                onClick={(event) => escribirEnFila(event, offset)}
                aria-label={`Escribir ${nombre} en ${partName}`}
                className={`absolute inset-x-0 block ${
                  offset === 0
                    ? 'bg-surface-raised'
                    : enEscala
                      ? 'bg-surface'
                      : 'bg-background opacity-60'
                }`}
                style={{ top: fila * ALTO_FILA, height: ALTO_FILA }}
              >
                <span
                  className={`absolute left-1 font-mono text-[10px] leading-none ${
                    offset === 0 ? 'text-brass-bright' : 'text-text-muted'
                  }`}
                  style={{ top: (ALTO_FILA - 10) / 2 }}
                >
                  {enEscala ? nombre : ''}
                </span>
              </button>
            );
          })}

          {/* Las divisiones de compás, por encima de las filas y por debajo de
              las notas: son referencia, no contenido. */}
          {Array.from({ length: Math.ceil(anchoTotal / (beatsPerBar * porPulso)) }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="bg-border absolute top-0 bottom-0 w-px"
              style={{ left: i * beatsPerBar * porPulso }}
            />
          ))}

          {notes.map((note) => {
            const fila = filas.indexOf(clampOffset(note.offset));
            if (fila === -1) {
              // Con «solo la escala» puesta, una nota alterada en la partitura no
              // tiene fila. No se dibuja aquí y sigue existiendo: quitarla sería
              // borrar trabajo por haber cambiado de vista.
              return null;
            }
            const nombre = noteName(normalizePitchClass(tonic + note.offset), accidental);
            const pintado = anchoPintado(note, porPulso);
            return (
              <button
                key={note.id}
                type="button"
                onPointerDown={(event) => cogerNota(event, note)}
                onClick={() => onSelect(note.id)}
                aria-label={`${nombre}, ${note.length} pulsos, en el pulso ${note.start}${
                  isDoubtfulNote(note) ? ', dudosa' : ''
                }`}
                aria-pressed={selectedNoteId === note.id}
                // El botón es la zona de agarre y no el dibujo: la fila entera de
                // alto y al menos 24 de ancho, invisible. Pintada, la nota mide
                // dieciocho —con tres de aire arriba y abajo para que dos filas
                // seguidas no se lean como una barra— y una semicorchea, ocho de
                // ancho: cogerla así era apuntar a un palillo.
                className="absolute rounded-sm"
                style={{
                  left: note.start * porPulso,
                  top: fila * ALTO_FILA,
                  width: Math.max(AGARRE_MINIMO, pintado),
                  height: ALTO_FILA,
                  touchAction: 'none',
                }}
              >
                {/* La dudosa va translúcida: en una rejilla de cajitas no cabe un
                    interrogante, y lo que hay que ver es cuál mirar. */}
                <span
                  aria-hidden
                  className={`bg-brass absolute left-0 rounded-sm ${
                    isDoubtfulNote(note) ? 'opacity-50' : ''
                  } ${selectedNoteId === note.id ? 'ring-brass-bright ring-2' : ''}`}
                  style={{ top: AIRE_NOTA, width: pintado, height: ALTO_FILA - 2 * AIRE_NOTA }}
                />
                {/* La franja de estirar, que aquí faltaba: los bloques de acorde
                    la tienen desde el principio y las notas no, así que estirar
                    una nota era un gesto que no se anunciaba. Solo cambia el
                    cursor —el `pointerdown` lo sigue recogiendo la nota entera—,
                    y no se dibuja en las notas que no dan de sí: en una corchea a
                    la escala mínima, seis píxeles serían la nota entera. */}
                {note.length * porPulso >= 20 && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-1.5 cursor-ew-resize"
                    style={{ left: pintado - 6 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
