'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  barsLabel,
  partBeats,
  resolveDegree,
  type KeyMode,
  type Part,
  type PitchClass,
} from '@core/music';
import { Chip } from '@ui/Chip';
import { TextField } from '@ui/TextField';

import { BlockButton, anchoDeBloque } from './BlockButton';

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
  readonly onPlay: () => void;
  readonly onRename: (name: string) => void;
  readonly onRemove: () => void;
  readonly onBlockPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    blockId: string,
  ) => void;
  readonly onBlockClick: (blockId: string) => void;
  readonly onBlockKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, blockId: string) => void;
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
  onPlay,
  onRename,
  onRemove,
  onBlockPointerDown,
  onBlockClick,
  onBlockKeyDown,
}: PartRowProps) {
  const [editando, setEditando] = useState(false);

  return (
    <section aria-label={part.name} className="border-border border-b px-3 py-2 last:border-b-0">
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

        <span className="text-text-muted font-mono text-xs">
          {part.blocks.length === 0 ? 'vacía' : barsLabel(partBeats(part), beatsPerBar)}
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

      {/* La fila de bloques se desplaza sola en horizontal: doce compases no
          caben en un portátil, y partirlos en dos líneas rompería lo único que
          esta fila tiene que decir, que es el orden en el tiempo. */}
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
    </section>
  );
}
