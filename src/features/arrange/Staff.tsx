'use client';

import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  keySignature,
  offsetOfStep,
  resolveDegree,
  writeNote,
  type Block,
  type KeyMode,
  type LeadNote,
  type PitchClass,
} from '@core/music';

import { arrastrar } from './arrastrar';
import { PX_POR_PULSO } from './BlockButton';

/**
 * La partitura: el mismo punteo, escrito.
 *
 * No es otra cosa que el carril de bloques: son las mismas notas, el mismo píxel
 * por pulso y las mismas acciones. Lo que cambia es que aquí la altura se lee en
 * un pentagrama y la duración en una figura, que es como lo lee quien sabe.
 *
 * ## Lo que se dibuja y lo que no
 *
 * Se dibuja lo que el modelo tiene: cinco líneas, la armadura de la tonalidad,
 * barras de compás, los cifrados encima y una figura por nota, de la corchea a la
 * redonda con sus puntillos. **No hay ligaduras, ni tresillos, ni dos voces, ni
 * silencios escritos.** No es una renuncia de dibujo: es que el modelo no tiene
 * ninguna de esas cosas, y `melody.ts` limita las duraciones justo a las seis que
 * tienen figura para que nunca haya una nota que no se pueda escribir.
 *
 * Una nota que dura más de lo que le queda al compás se dibuja donde empieza y
 * cruza la barra. Con ligadura sería lo correcto; sin ella se lee igual de bien y
 * el modelo no sabría dónde partirla.
 *
 * ## Arrastrar por escalones, no por semitonos
 *
 * Subir una nota en la partitura la lleva a la línea de encima, y qué nota es esa
 * lo decide la armadura: en Sol mayor, subir del Mi da un Fa **sostenido**. Los
 * cromatismos no se escriben moviendo la nota, sino alterándola, y para eso están
 * las teclas de más y menos.
 */

/** Medio espacio del pentagrama: lo que sube una nota al pasar de línea a espacio. */
const PASO = 6;

/** Dónde cae la línea de abajo del pentagrama, contando desde arriba del dibujo. */
const BASE = 82;

/** Cuánto ocupa la clave y la armadura antes de que empiece el tiempo. */
const MARGEN = 52;

const ALTO = 130;

/** El `step` de la línea de abajo del pentagrama en clave de sol: el Mi de la 4.ª. */
const STEP_BASE = 2;

/** Los escalones en los que van las alteraciones de la armadura, por su letra. */
const ALTURA_ARMADURA: Readonly<Record<string, number>> = {
  F: 9,
  C: 6,
  G: 10,
  D: 7,
  A: 4,
  E: 8,
  B: 5,
};

function yDeStep(step: number): number {
  return BASE - (step - STEP_BASE) * PASO;
}

/** La figura con la que se escribe esa duración. */
function figura(length: number): {
  hueca: boolean;
  plica: boolean;
  corchete: boolean;
  punto: boolean;
} {
  return {
    hueca: length >= 2,
    plica: length < 4,
    corchete: length < 1,
    // Los puntillos son los dos valores de la lista que no son potencia de dos.
    punto: length === 1.5 || length === 3,
  };
}

export interface StaffProps {
  readonly notes: readonly LeadNote[];
  readonly blocks: readonly Block[];
  readonly beats: number;
  readonly beatsPerBar: number;
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly selectedNoteId: string | null;
  readonly selectedBlockId: string | null;
  readonly partName: string;
  readonly partId: string;
  /** Entre qué dos compases caería lo que se está arrastrando, si es aquí. */
  readonly dropAt: number | null;
  readonly onSelectBlock: (blockId: string) => void;
  readonly onRemoveBlock: (blockId: string) => void;
  readonly onResizeBlock: (blockId: string, beats: number) => void;
  /**
   * Escribe una nota a esa altura y en ese pulso.
   *
   * La altura llega ya en semitonos sobre la tónica, y no en escalones del
   * pentagrama: el escalón es cosa del dibujo, y traducirlo aquí es lo que
   * permite que las dos vistas del punteo hablen con el mismo modelo.
   */
  readonly onAdd: (offset: number, start: number) => void;
  readonly onSelect: (noteId: string) => void;
  readonly onMove: (noteId: string, start: number, offset: number) => void;
  readonly onGestureStart: () => void;
  readonly onGestureEnd: () => void;
}

export function Staff({
  notes,
  blocks,
  beats,
  beatsPerBar,
  tonic,
  mode,
  selectedNoteId,
  selectedBlockId,
  partName,
  partId,
  dropAt,
  onSelectBlock,
  onRemoveBlock,
  onResizeBlock,
  onAdd,
  onSelect,
  onMove,
  onGestureStart,
  onGestureEnd,
}: StaffProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  /**
   * Si el último gesto fue un arrastre.
   *
   * El `click` se dispara igual después de soltar, y si se sueltan doce píxeles
   * más arriba llega al pentagrama en vez de a la nota: **escribía una nota
   * nueva justo donde se acababa de soltar la que se movía**. Se apunta que hubo
   * arrastre y el pentagrama deja pasar ese `click`.
   */
  const arrastradaRef = useRef(false);
  const armadura = keySignature(tonic, mode);
  const compases = Math.max(1, Math.ceil(Math.max(beats, beatsPerBar) / beatsPerBar));
  const ancho = MARGEN + compases * beatsPerBar * PX_POR_PULSO + 8;

  /** Qué escalón y qué pulso hay bajo un punto de la pantalla. */
  const sitioEn = useCallback(
    (clientX: number, clientY: number): { step: number; start: number } | null => {
      const caja = svgRef.current?.getBoundingClientRect();
      if (caja === undefined) {
        return null;
      }
      // El SVG se dibuja a su tamaño natural, así que un píxel de pantalla es un
      // píxel del dibujo. Si algún día se escala, aquí hay que dividir por la
      // razón entre `caja.width` y `ancho`.
      const x = clientX - caja.left;
      const y = clientY - caja.top;
      return {
        step: Math.round((BASE - y) / PASO) + STEP_BASE,
        start: Math.max(0, Math.round((x - MARGEN) / PX_POR_PULSO / 0.5) * 0.5),
      };
    },
    [],
  );

  /**
   * Estirar un acorde tirando del final de su línea.
   *
   * En esta vista no hay bloques que agarrar por el borde, y sin esto el único
   * sitio donde se puede cambiar lo que dura un acorde sería la otra vista. La
   * línea que va bajo el cifrado ya dice hasta dónde llega; tirar de su punta es
   * el gesto que le corresponde.
   */
  const estirarAcorde = useCallback(
    (event: ReactPointerEvent<SVGGElement>, blockId: string, beats: number) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      const inicioX = event.clientX;
      onGestureStart();
      arrastrar({
        mover: (x) => {
          arrastradaRef.current = true;
          onResizeBlock(blockId, beats + (x - inicioX) / PX_POR_PULSO);
        },
        soltar: onGestureEnd,
      });
    },
    [onGestureEnd, onGestureStart, onResizeBlock],
  );

  /**
   * Arrastrar una nota por el pentagrama.
   *
   * Se mueve por **escalones**, no por semitonos: subir una línea da la nota que
   * la armadura dice que va ahí. Para las alteradas están las teclas de más y
   * menos, que suman y restan un semitono sin cambiarla de sitio.
   */
  const cogerNota = useCallback(
    (event: ReactPointerEvent<SVGGElement>, note: LeadNote) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      onSelect(note.id);
      onGestureStart();

      // **La nota se mueve con el puntero, no salta a él.** Se guarda la
      // distancia entre donde se cogió y donde está, y se conserva durante todo
      // el gesto. Sin esto, cogerla por el final de la plica la mandaba de golpe
      // tres líneas más abajo antes de empezar a moverla.
      const agarre = sitioEn(event.clientX, event.clientY);
      const escrita = writeNote(note, tonic, mode);
      const dStep = agarre === null ? 0 : escrita.step - agarre.step;
      const dStart = agarre === null ? 0 : note.start - agarre.start;

      arrastrar({
        mover: (x, y) => {
          arrastradaRef.current = true;
          const sitio = sitioEn(x, y);
          if (sitio !== null) {
            onMove(note.id, sitio.start + dStart, offsetOfStep(sitio.step + dStep, tonic, mode));
          }
        },
        soltar: onGestureEnd,
      });
    },
    [mode, onGestureEnd, onGestureStart, onMove, onSelect, sitioEn, tonic],
  );

  return (
    <div className="mt-1 overflow-x-auto">
      <svg
        ref={svgRef}
        width={ancho}
        height={ALTO}
        viewBox={`0 0 ${ancho} ${ALTO}`}
        role="img"
        aria-label={`Partitura de ${partName}: ${notes.length} notas`}
        className="text-text block"
        onClick={(event) => {
          if (arrastradaRef.current) {
            arrastradaRef.current = false;
            return;
          }
          const sitio = sitioEn(event.clientX, event.clientY);
          if (sitio !== null) {
            onAdd(offsetOfStep(sitio.step, tonic, mode), sitio.start);
          }
        }}
      >
        {/* Las cinco líneas. */}
        {[0, 1, 2, 3, 4].map((linea) => (
          <line
            key={linea}
            x1={4}
            x2={ancho - 4}
            y1={BASE - linea * 2 * PASO}
            y2={BASE - linea * 2 * PASO}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1}
          />
        ))}

        {/*
          La clave de sol, dibujada.

          Se probó primero con el carácter de siempre —`U+1D11E`— y salía **un
          cuadro vacío**: los símbolos musicales de Unicode no están en las
          fuentes de sistema, y una partitura que empieza con un cuadro no es una
          partitura. Se dibuja, como ya se dibujan aquí los diagramas de acorde.

          No es tipografía musical y no lo pretende: es la espiral cerrada sobre
          la segunda línea —que es lo que la clave significa—, el tallo y el
          gancho de arriba. Con eso se lee «clave de sol» de un vistazo, que es
          para lo único que está.
        */}
        <g
          aria-hidden
          stroke="currentColor"
          strokeOpacity={0.8}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        >
          <path
            d={
              `M 22 ${BASE - 9 * PASO} ` +
              `C 13 ${BASE - 7 * PASO} 11 ${BASE - 4 * PASO} 16 ${BASE - 2 * PASO} ` +
              `C 21 ${BASE - PASO} 26 ${BASE - 2 * PASO} 25 ${BASE - 4 * PASO} ` +
              `C 24 ${BASE - 6 * PASO} 15 ${BASE - 6 * PASO} 12 ${BASE - 3 * PASO} ` +
              `C 9 ${BASE} 12 ${BASE + 2 * PASO} 18 ${BASE + 2 * PASO}`
            }
          />
          <line x1={22} y1={BASE - 9 * PASO} x2={19} y2={BASE + PASO} />
        </g>

        {/* La armadura, en el orden en que se escribe. */}
        {armadura.letters.map((letra, indice) => (
          <text
            key={letra}
            x={34 + indice * 7}
            y={yDeStep(ALTURA_ARMADURA[letra] ?? 6) + 4}
            fontSize={14}
            fill="currentColor"
            fillOpacity={0.75}
            aria-hidden
          >
            {armadura.accidental === 'sharp' ? '♯' : '♭'}
          </text>
        ))}

        {/* Las barras de compás, y el cifrado del acorde encima de cada bloque. */}
        {Array.from({ length: compases + 1 }, (_, i) => (
          <line
            key={i}
            x1={MARGEN + i * beatsPerBar * PX_POR_PULSO}
            x2={MARGEN + i * beatsPerBar * PX_POR_PULSO}
            y1={BASE - 8 * PASO}
            y2={BASE}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
        ))}

        {/*
          Los cifrados, que aquí **son** los acordes y no su etiqueta.

          En esta vista no hay tira de bloques, así que el cifrado es lo único que
          queda del acorde: se pulsa para elegirlo y se quita con `Supr`, igual
          que un bloque. Debajo lleva una línea que dice hasta dónde llega, que es
          lo que un cifrado suelto no dice y un bloque decía con su ancho.
        */}
        {
          blocks.reduce<{ x: number; nodos: React.ReactElement[]; i: number }>(
            (acumulado, block) => {
              const indice = acumulado.i;
              const chord = resolveDegree(tonic, mode, block.degree);
              const x = MARGEN + acumulado.x * PX_POR_PULSO;
              const elegido = selectedBlockId === block.id;

              acumulado.nodos.push(
                <g
                  key={block.id}
                  role="button"
                  tabIndex={0}
                  // El compás es zona de destino: al arrastrar un acorde por
                  // encima, el hueco que se abre es el de aquí.
                  data-parte={partId}
                  data-indice={acumulado.x === 0 ? 0 : indice}
                  aria-label={`${chord.symbol}, grado ${block.degree}, ${block.beats} pulsos`}
                  aria-pressed={elegido}
                  className={`focus-visible:outline-brass-bright cursor-pointer focus-visible:outline-2 ${
                    elegido ? 'text-brass-bright' : ''
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBlock(block.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Delete' || event.key === 'Backspace') {
                      event.preventDefault();
                      onRemoveBlock(block.id);
                    }
                  }}
                >
                  <text
                    x={x}
                    y={17}
                    fontSize={14}
                    fontFamily="ui-monospace, monospace"
                    fill="currentColor"
                    fillOpacity={elegido ? 1 : 0.85}
                  >
                    {chord.symbol}
                  </text>
                  <line
                    x1={x}
                    x2={x + block.beats * PX_POR_PULSO - 4}
                    y1={22}
                    y2={22}
                    stroke="currentColor"
                    strokeOpacity={elegido ? 0.9 : 0.3}
                    strokeWidth={elegido ? 2 : 1}
                  />
                  <rect
                    x={x - 2}
                    y={4}
                    width={Math.max(24, block.beats * PX_POR_PULSO - 14)}
                    height={22}
                    fill="transparent"
                  />
                  {/* La punta de la línea: de aquí se tira para estirar. */}
                  <rect
                    x={x + block.beats * PX_POR_PULSO - 16}
                    y={4}
                    width={16}
                    height={22}
                    fill="transparent"
                    className="cursor-ew-resize"
                    onPointerDown={(event) => estirarAcorde(event, block.id, block.beats)}
                  />
                </g>,
              );
              return {
                x: acumulado.x + block.beats,
                nodos: acumulado.nodos,
                i: acumulado.i + 1,
              };
            },
            { x: 0, nodos: [], i: 0 },
          ).nodos
        }

        {/* La marca de dónde caería el acorde que se arrastra. Va donde empieza
            el compás ante el que se soltaría, que es donde va a aparecer. */}
        {dropAt !== null && (
          <line
            aria-hidden
            x1={
              MARGEN +
              blocks.slice(0, dropAt).reduce((suma, b) => suma + b.beats, 0) * PX_POR_PULSO -
              3
            }
            x2={
              MARGEN +
              blocks.slice(0, dropAt).reduce((suma, b) => suma + b.beats, 0) * PX_POR_PULSO -
              3
            }
            y1={2}
            y2={BASE + 4}
            className="stroke-brass-bright"
            strokeWidth={2}
          />
        )}

        {notes.map((note) => {
          const escrita = writeNote(note, tonic, mode);
          const x = MARGEN + note.start * PX_POR_PULSO + 6;
          const y = yDeStep(escrita.step);
          const { hueca, plica, corchete, punto } = figura(note.length);
          const arriba = escrita.step < 6;
          const seleccionada = selectedNoteId === note.id;

          return (
            <g
              key={note.id}
              role="button"
              tabIndex={0}
              aria-label={`${escrita.letter}${escrita.accidental}${escrita.octave}, ${note.length} pulsos, en el pulso ${note.start}`}
              className="focus-visible:outline-brass-bright cursor-grab rounded focus-visible:outline-2"
              style={{ touchAction: 'none' }}
              onPointerDown={(event) => cogerNota(event, note)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(note.id);
              }}
            >
              {/* Las líneas adicionales, para lo que se sale del pentagrama. */}
              {escrita.step > 10 &&
                Array.from({ length: Math.floor((escrita.step - 10) / 2) }, (_, i) => (
                  <line
                    key={`a${i}`}
                    x1={x - 8}
                    x2={x + 8}
                    y1={yDeStep(12 + i * 2)}
                    y2={yDeStep(12 + i * 2)}
                    stroke="currentColor"
                    strokeOpacity={0.45}
                  />
                ))}
              {escrita.step < 2 &&
                Array.from({ length: Math.floor((2 - escrita.step) / 2) }, (_, i) => (
                  <line
                    key={`b${i}`}
                    x1={x - 8}
                    x2={x + 8}
                    y1={yDeStep(0 - i * 2)}
                    y2={yDeStep(0 - i * 2)}
                    stroke="currentColor"
                    strokeOpacity={0.45}
                  />
                ))}

              {escrita.accidental !== '' && (
                <text x={x - 18} y={y + 4} fontSize={13} fill="currentColor">
                  {escrita.accidental === '#' ? '♯' : '♭'}
                </text>
              )}

              {/* La cabeza va inclinada, como en cualquier partitura: es lo que
                  la distingue de un punto y lo que la hace caber entre dos
                  líneas que están a cinco píxeles. */}
              {seleccionada && (
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  className="fill-brass-dim"
                  fillOpacity={0.35}
                  aria-hidden
                />
              )}
              <ellipse
                cx={x}
                cy={y}
                rx={5.2}
                ry={3.8}
                transform={`rotate(-20 ${x} ${y})`}
                fill={hueca ? 'none' : 'currentColor'}
                stroke="currentColor"
                strokeWidth={hueca ? 1.6 : 1}
                className={seleccionada ? 'text-brass-bright' : ''}
              />
              {punto && <circle cx={x + 9} cy={y - 2} r={1.4} fill="currentColor" />}

              {plica && (
                <line
                  x1={arriba ? x + 5 : x - 5}
                  x2={arriba ? x + 5 : x - 5}
                  y1={y}
                  y2={arriba ? y - 26 : y + 26}
                  stroke="currentColor"
                  strokeWidth={1.2}
                />
              )}
              {corchete && (
                <path
                  d={
                    arriba ? `M ${x + 5} ${y - 26} q 8 4 7 12` : `M ${x - 5} ${y + 26} q 8 -4 7 -12`
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                />
              )}

              {/*
                La zona de agarre, en dos piezas: una sobre la cabeza y otra a lo
                largo de la plica.

                Invisible y mucho mayor que lo que se ve, porque una cabeza de
                cinco píxeles no se coge con el dedo. Y la plica cuenta: es la
                mitad de la altura de la nota, y quien va a cogerla apunta a la
                figura entera, no a la elipse de abajo.
              */}
              <rect
                x={x - 10}
                y={y - 9}
                width={Math.max(20, note.length * PX_POR_PULSO)}
                height={18}
                fill="transparent"
              />
              {plica && (
                <rect
                  x={arriba ? x : x - 10}
                  y={arriba ? y - 28 : y + 10}
                  width={10}
                  height={18}
                  fill="transparent"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
