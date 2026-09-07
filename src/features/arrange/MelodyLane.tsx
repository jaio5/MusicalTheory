'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  GRID,
  clampOffset,
  isInScaleOffset,
  accidentalForScale,
  normalizePitchClass,
  noteName,
  type LeadNote,
  type PitchClass,
  type ScaleId,
} from '@core/music';

import { arrastrar } from './arrastrar';
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

/** Alto de cada fila. Doce filas de esto caben en un portátil sin desplazar. */
export const ALTO_FILA = 22;

/** Hasta dónde llegan las alturas: de una cuarta abajo a una novena arriba. */
export const OFFSET_GRAVE = -5;
export const OFFSET_AGUDO = 16;

export interface MelodyLaneProps {
  readonly notes: readonly LeadNote[];
  readonly beats: number;
  readonly beatsPerBar: number;
  readonly tonic: PitchClass;
  readonly scaleId: ScaleId;
  /** Solo las notas de la escala, que es como no hay forma de desafinar. */
  readonly onlyScale: boolean;
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

export function MelodyLane({
  notes,
  beats,
  beatsPerBar,
  tonic,
  scaleId,
  onlyScale,
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

  const anchoTotal = Math.max(beats, beatsPerBar) * PX_POR_PULSO;

  /**
   * Cuántas notas no tienen fila donde dibujarse.
   *
   * Con «solo la escala» puesta, una nota alterada en la partitura no cabe en
   * ninguna fila. Se queda donde está —quitarla sería borrar trabajo por haber
   * cambiado de vista— pero **hay que decirlo**: escribir seis notas y ver una
   * parece que se han perdido cinco.
   */
  const escondidas = notes.filter((note) => !filas.includes(clampOffset(note.offset))).length;

  /** Qué casilla hay bajo un punto de la pantalla. */
  const casillaEn = useCallback(
    (clientX: number, clientY: number): { offset: number; start: number } | null => {
      const caja = rejillaRef.current?.getBoundingClientRect();
      if (caja === undefined) {
        return null;
      }
      const fila = Math.floor((clientY - caja.top) / ALTO_FILA);
      const offset = filas[Math.min(Math.max(0, fila), filas.length - 1)];
      if (offset === undefined) {
        return null;
      }
      const pulsos = (clientX - caja.left) / PX_POR_PULSO;
      return { offset, start: Math.max(0, Math.floor(pulsos / GRID) * GRID) };
    },
    [filas],
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
      const estirando = event.clientX > caja.right - 8;
      onSelect(note.id);
      onGestureStart();

      if (estirando) {
        const inicioX = event.clientX;
        arrastrar({
          mover: (x) => {
            arrastradaRef.current = true;
            onResize(note.id, note.length + (x - inicioX) / PX_POR_PULSO);
          },
          soltar: onGestureEnd,
        });
        return;
      }

      // La nota se mueve con el puntero y no salta a él: cogiendo una de cuatro
      // pulsos por el medio, sin esto el principio se iba a donde estaba el dedo.
      const agarre = casillaEn(event.clientX, event.clientY);
      const dStart = agarre === null ? 0 : note.start - agarre.start;

      arrastrar({
        mover: (x, y) => {
          arrastradaRef.current = true;
          const casilla = casillaEn(x, y);
          if (casilla !== null) {
            onMove(note.id, casilla.start + dStart, casilla.offset);
          }
        },
        soltar: onGestureEnd,
      });
    },
    [casillaEn, onGestureEnd, onGestureStart, onMove, onResize, onSelect],
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
                onClick={(event) => {
                  if (arrastradaRef.current) {
                    arrastradaRef.current = false;
                    return;
                  }
                  const casilla = casillaEn(event.clientX, event.clientY);
                  if (casilla !== null) {
                    onAdd(casilla.offset, casilla.start);
                  }
                }}
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
          {Array.from({ length: Math.ceil(anchoTotal / (beatsPerBar * PX_POR_PULSO)) }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="bg-border absolute top-0 bottom-0 w-px"
              style={{ left: i * beatsPerBar * PX_POR_PULSO }}
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
            return (
              <button
                key={note.id}
                type="button"
                onPointerDown={(event) => cogerNota(event, note)}
                onClick={() => onSelect(note.id)}
                aria-label={`${nombre}, ${note.length} pulsos, en el pulso ${note.start}`}
                aria-pressed={selectedNoteId === note.id}
                className={`bg-brass absolute rounded-sm ${
                  selectedNoteId === note.id ? 'ring-brass-bright ring-2' : ''
                }`}
                style={{
                  left: note.start * PX_POR_PULSO,
                  top: fila * ALTO_FILA + 3,
                  width: Math.max(8, note.length * PX_POR_PULSO - 2),
                  height: ALTO_FILA - 6,
                  touchAction: 'none',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
