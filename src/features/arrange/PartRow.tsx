'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  BARS_QUE_AÑADE,
  MAX_BARS,
  drawnBars,
  isDoubtful,
  partLength,
  resolveDegree,
  type KeyMode,
  type Part,
  type PitchClass,
  type ScaleId,
} from '@core/music';
import { Chip } from '@ui/Chip';
import { TextField } from '@ui/TextField';

import { BlockButton, anchoDeBloque } from './BlockButton';
import { MelodyLane } from './MelodyLane';
import { Staff } from './Staff';

/**
 * Una parte del montaje: su nombre, sus bloques y el botón de oírla sola.
 *
 * Oír una parte suelta es lo que más se usa montando —se está peleando con el
 * estribillo, no con la canción entera— y por eso el botón está en la fila y no
 * escondido en un menú.
 *
 * El nombre se edita en el sitio: pulsarlo lo convierte en campo. Un botón de
 * «renombrar» al lado habría metido un tercer control de cuarenta y cuatro
 * píxeles en cada fila, y son doce filas como mucho.
 */
/** Cómo se enseña el punteo: en bloques, escrito, o nada. */
export type Punteo = 'bloques' | 'partitura' | 'oculto';

export interface PartRowProps {
  readonly part: Part;
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly beatsPerBar: number;
  readonly playing: boolean;
  readonly playingBlockId: string | null;
  readonly selectedBlockId: string | null;
  readonly draggingBlockId: string | null;
  /** Dónde caería el bloque que se está arrastrando, si cae en esta parte. */
  readonly dropIndex: number | null;
  readonly punteo: Punteo;
  /** Encendida mientras se arrastra una propuesta por encima de esta parte. */
  readonly dropPart: boolean;
  /** Entre qué dos compases caería lo que se arrastra, si cae en esta parte. */
  readonly dropAt: number | null;
  readonly scaleId: ScaleId;
  readonly onlyScale: boolean;
  readonly selectedNoteId: string | null;
  readonly onPlay: () => void;
  readonly onRename: (name: string) => void;
  readonly onRemove: () => void;
  readonly onSetBars: (bars: number) => void;
  readonly onBlockPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    blockId: string,
  ) => void;
  readonly onBlockClick: (blockId: string) => void;
  readonly onBlockKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, blockId: string) => void;
  readonly onAddNote: (partId: string, offset: number, start: number) => void;
  readonly onSelectNote: (noteId: string) => void;
  readonly onMoveNote: (noteId: string, start: number, offset: number) => void;
  readonly onResizeNote: (noteId: string, length: number) => void;
  readonly onRemoveBlock: (blockId: string) => void;
  readonly onResizeBlock: (blockId: string, beats: number) => void;
  readonly onGestureStart: () => void;
  readonly onGestureEnd: () => void;
}

export function PartRow({
  part,
  tonic,
  mode,
  beatsPerBar,
  playing,
  playingBlockId,
  selectedBlockId,
  draggingBlockId,
  dropIndex,
  punteo,
  dropPart,
  dropAt,
  scaleId,
  onlyScale,
  selectedNoteId,
  onPlay,
  onRename,
  onRemove,
  onSetBars,
  onBlockPointerDown,
  onBlockClick,
  onBlockKeyDown,
  onAddNote,
  onSelectNote,
  onMoveNote,
  onResizeNote,
  onRemoveBlock,
  onResizeBlock,
  onGestureStart,
  onGestureEnd,
}: PartRowProps) {
  const [editando, setEditando] = useState(false);
  const compases = drawnBars(part, beatsPerBar);
  // No se puede acortar por debajo de lo que hay dentro: un botón que borra
  // compases con acordes borra trabajo sin decirlo.
  const minimoBars = Math.max(1, Math.ceil(partLength(part) / Math.max(1, beatsPerBar)));

  return (
    <section
      aria-label={part.name}
      // Toda la fila recibe lo que se arrastre desde las propuestas, y no solo la
      // tira de bloques: en partitura no hay tira, y soltar «en la estrofa» tiene
      // que valer igual en las tres vistas.
      data-parte-destino={part.id}
      className={`border-border border-b px-3 py-2 last:border-b-0 ${
        dropPart ? 'bg-surface-raised' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {editando ? (
          <TextField
            label="Nombre de la parte"
            compact
            ancho="crece"
            defaultValue={part.name}
            autoFocus
            onBlur={(event) => {
              onRename(event.target.value);
              setEditando(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <Chip
            onClick={() => setEditando(true)}
            tone="quiet"
            className="text-xs tracking-widest uppercase"
          >
            {part.name}
          </Chip>
        )}

        {/*
          Los compases, con el número **entre** los dos botones.
          
          «4 compases» al lado de un menos y un más decía lo mismo dos veces y en
          un teléfono partía la fila en dos líneas. Con el número en medio se lee
          igual de claro, ocupa un tercio y se entiende sin instrucciones qué
          hacen los botones de al lado.
        */}
        <span
          className="flex items-center gap-1"
          role="group"
          aria-label={`Compases de ${part.name}`}
        >
          <Chip
            onClick={() => onSetBars(compases - BARS_QUE_AÑADE)}
            tone="quiet"
            disabled={compases <= minimoBars}
            ariaLabel={`Acortar ${part.name}`}
            // Deshabilitado sin decir por qué se lee como estropeado. Y el
            // porqué es una regla, no un fallo: no se borran compases con cosas
            // dentro.
            title={
              compases <= minimoBars
                ? 'No se puede acortar más sin borrar lo que hay escrito'
                : `Quitar ${BARS_QUE_AÑADE} compases`
            }
            className="px-3"
          >
            −
          </Chip>
          <span className="text-text-muted w-6 text-center font-mono text-xs tabular-nums">
            {compases}
          </span>
          <Chip
            onClick={() => onSetBars(compases + BARS_QUE_AÑADE)}
            tone="quiet"
            disabled={compases >= MAX_BARS}
            ariaLabel={`Alargar ${part.name}`}
            title={`Añadir ${BARS_QUE_AÑADE} compases`}
            className="px-3"
          >
            +
          </Chip>
        </span>

        <span className="ml-auto flex gap-1">
          <Chip
            onClick={onPlay}
            pressed={playing}
            tone="quiet"
            disabled={part.blocks.length === 0}
            ariaLabel={playing ? `Parar ${part.name}` : `Escuchar ${part.name}`}
            className="px-3 text-xs"
          >
            {playing ? 'Parar' : 'Escuchar'}
          </Chip>
          <Chip
            onClick={onRemove}
            tone="quiet"
            ariaLabel={`Quitar ${part.name}`}
            className="px-3 text-xs"
          >
            Quitar
          </Chip>
        </span>
      </div>

      {/*
        En partitura no hay tira de bloques.

        Los acordes se leen en su sitio de siempre —cifrados encima del
        pentagrama— y una tira de cajas repitiendo lo mismo justo encima sería
        decirlo dos veces y ocupar el doble. Quien lee una partitura ya sabe
        dónde mirar; a quien no, esta vista no le habla.
      */}
      {punteo !== 'partitura' && (
        <ul
          aria-label={`Acordes de ${part.name}`}
          data-parte-vacia={part.blocks.length === 0 ? part.id : undefined}
          className="mt-2 flex items-stretch gap-1 overflow-x-auto pb-1"
        >
          {part.blocks.length === 0 && (
            <li
              data-parte={part.id}
              data-indice={0}
              className="border-border text-text-muted min-h-tap flex items-center rounded-md border border-dashed px-4 text-xs"
              style={{ minWidth: anchoDeBloque(beatsPerBar) }}
            >
              Suelta aquí un acorde
            </li>
          )}

          {part.blocks.map((block, indice) => {
            const chord = resolveDegree(tonic, mode, block.degree);
            return (
              <li key={block.id} data-parte={part.id} data-indice={indice} className="flex">
                {/* El hueco donde caería lo que se arrastra. Se abre antes del
                  bloque, que es lo que hace que el sitio se vea antes de soltar
                  en vez de descubrirse después. */}
                {dropIndex === indice && (
                  <span aria-hidden className="bg-brass-bright mr-1 w-1 shrink-0 rounded-full" />
                )}
                <BlockButton
                  doubtful={isDoubtful(block)}
                  symbol={chord.symbol}
                  degree={block.degree}
                  beats={block.beats}
                  beatsPerBar={beatsPerBar}
                  playing={playingBlockId === block.id}
                  selected={selectedBlockId === block.id}
                  dragging={draggingBlockId === block.id}
                  onPointerDown={(event) => onBlockPointerDown(event, block.id)}
                  onClick={() => onBlockClick(block.id)}
                  onKeyDown={(event) => onBlockKeyDown(event, block.id)}
                />
              </li>
            );
          })}

          {dropIndex !== null && dropIndex >= part.blocks.length && part.blocks.length > 0 && (
            <li aria-hidden className="bg-brass-bright w-1 shrink-0 rounded-full" />
          )}
        </ul>
      )}

      {/* El punteo, debajo y con el mismo píxel por pulso: así una nota queda
          bajo el acorde sobre el que suena, sin tener que contar compases. */}
      {punteo === 'bloques' && (
        <MelodyLane
          notes={part.notes}
          beats={compases * beatsPerBar}
          beatsPerBar={beatsPerBar}
          tonic={tonic}
          scaleId={scaleId}
          onlyScale={onlyScale}
          selectedNoteId={selectedNoteId}
          partName={part.name}
          onAdd={(offset, start) => onAddNote(part.id, offset, start)}
          onSelect={onSelectNote}
          onMove={onMoveNote}
          onResize={onResizeNote}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      )}
      {punteo === 'partitura' && (
        <Staff
          notes={part.notes}
          blocks={part.blocks}
          bars={compases}
          beatsPerBar={beatsPerBar}
          tonic={tonic}
          mode={mode}
          selectedNoteId={selectedNoteId}
          selectedBlockId={selectedBlockId}
          partName={part.name}
          partId={part.id}
          dropAt={dropAt}
          onSelectBlock={onBlockClick}
          onRemoveBlock={onRemoveBlock}
          onResizeBlock={onResizeBlock}
          onAdd={(offset, start) => onAddNote(part.id, offset, start)}
          onSelect={onSelectNote}
          onMove={onMoveNote}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      )}
    </section>
  );
}
