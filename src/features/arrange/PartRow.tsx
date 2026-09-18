'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  MAX_BARS,
  ROLES,
  drawnBars,
  isDoubtful,
  partLength,
  blockChord,
  resolveDegree,
  roleInfo,
  roleOf,
  type DegreeSymbol,
  type KeyMode,
  type Part,
  type PitchClass,
  type ScaleId,
  type SectionRole,
} from '@core/music';
import { Chip } from '@ui/Chip';
import { Field } from '@ui/Field';
import { TextField } from '@ui/TextField';

import { BlockButton, anchoDeBloque } from './BlockButton';
import { BloqueFantasma } from './BloqueFantasma';
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
/** Una sola lista vacía: devolver `[]` nueva en cada render repinta siempre. */
const SIN_PROPUESTA: readonly DegreeSymbol[] = [];

/** Cómo se enseña el punteo: en bloques, escrito, o nada. */
export type Punteo = 'bloques' | 'partitura' | 'oculto';

export interface PartRowProps {
  readonly part: Part;
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly beatsPerBar: number;
  /** Lo que mide un pulso, decidido por el lienzo al medir su ancho. */
  readonly porPulso: number;
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
  readonly onSetRole: (role: SectionRole) => void;
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
  readonly onMoveBlock: (partId: string, blockId: string, to: number) => void;
  readonly onGestureStart: () => void;
  readonly onGestureEnd: () => void;
  /** Lo que el copiloto propone para esta parte, y todavía no es de la canción. */
  readonly propuesta?: readonly DegreeSymbol[];
  /** Acepta los `cuantos` primeros propuestos. */
  readonly onAceptarPropuesta?: (cuantos: number) => void;
}

export function PartRow({
  part,
  tonic,
  mode,
  beatsPerBar,
  porPulso,
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
  onSetRole,
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
  onMoveBlock,
  onGestureStart,
  onGestureEnd,
  propuesta = SIN_PROPUESTA,
  onAceptarPropuesta = () => {},
}: PartRowProps) {
  const [editando, setEditando] = useState(false);
  /**
   * Lo que hay tecleado en el campo de compases mientras se teclea, o nulo.
   *
   * Nulo quiere decir «lo que manda es la parte». Hace falta porque el valor
   * bueno se acota por abajo y por arriba, y acotar a cada tecla impide escribir
   * un número de dos cifras.
   */
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
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
          <Chip onClick={() => setEditando(true)} tone="quiet" className="text-xs">
            {part.name}
          </Chip>
        )}

        {/*
          Qué parte es, y no solo cómo se llama.

          Un nombre libre sirve para encontrarla en una lista y no sirve para lo
          que importa: **que la IA sepa qué le estás pidiendo.** Una estrofa que
          continúa y un estribillo que tiene que levantar no son la misma
          petición, y con «Parte 2» el modelo solo puede adivinar.

          Va aquí, pegado al nombre, porque es la misma pregunta: lo que acabas
          de tocar, qué es. Y se queda en «Una idea» mientras no lo decidas, que
          es la respuesta honesta la mayoría de las veces.
        */}
        <Field
          label={`Papel de ${part.name}`}
          compact
          ancho="auto"
          value={roleOf(part)}
          onChange={(event) => onSetRole(event.target.value as SectionRole)}
          // Solo el tamaño de letra. **Sin `min-h-0`**, que es lo que había: la
          // clase decía una cosa y el navegador hacía otra —el `min-h-tap` de
          // `ui/Field` ganaba por el orden del CSS, no por diseño—, y si algún
          // día ganara la mía, este selector bajaría de los 44 px que pide la
          // regla de esta interfaz. Que salga bien por casualidad no es que
          // salga bien.
          className="text-xs"
          title={roleInfo(roleOf(part)).what}
        >
          {ROLES.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Field>

        {/*
          Los compases, con el número **entre** los dos botones.
          
          «4 compases» al lado de un menos y un más decía lo mismo dos veces y en
          un teléfono partía la fila en dos líneas. Con el número en medio se lee
          igual de claro, ocupa un tercio y se entiende sin instrucciones qué
          hacen los botones de al lado.
        */}
        <span className="flex items-center gap-1">
          <Chip
            onClick={() => onSetBars(compases - 1)}
            tone="quiet"
            disabled={compases <= minimoBars}
            ariaLabel={`Acortar ${part.name}`}
            // Deshabilitado sin decir por qué se lee como estropeado. Y el
            // porqué es una regla, no un fallo: no se borran compases con cosas
            // dentro.
            title={
              compases <= minimoBars
                ? 'No se puede acortar más sin borrar lo que hay escrito'
                : 'Un compás menos'
            }
            className="px-3"
          >
            −
          </Chip>

          {/*
            El número **se escribe**, no solo se mira.

            Para llegar de cuatro a dieciséis había que pulsar seis veces, y de
            treinta y dos a cuatro otras catorce. Escribirlo es un gesto.

            Y lo que se teclea no se valida a cada tecla, se valida al salir:
            `onSetBars` acota por abajo a lo que hay escrito, así que borrar el
            campo para poner «10» lo dejaría en el mínimo al primer dígito y ya
            no habría forma de escribir el segundo. Con el texto a medias en
            local y la validación en el `blur`, se puede teclear.
          */}
          <input
            type="number"
            inputMode="numeric"
            min={minimoBars}
            max={MAX_BARS}
            value={escribiendo ?? compases}
            aria-label={`Compases de ${part.name}`}
            onChange={(event) => setEscribiendo(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
              onSetBars(Number(event.target.value));
              setEscribiendo(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
            className="border-border bg-surface text-text hover:border-brass-dim focus:border-brass-dim min-h-tap w-12 rounded-md border px-1 text-center font-mono text-xs tabular-nums"
          />

          <Chip
            onClick={() => onSetBars(compases + 1)}
            tone="quiet"
            disabled={compases >= MAX_BARS}
            ariaLabel={`Alargar ${part.name}`}
            title="Un compás más"
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
              style={{ minWidth: anchoDeBloque(beatsPerBar, porPulso) }}
            >
              Suelta aquí un acorde
            </li>
          )}

          {part.blocks.map((block, indice) => {
            const chord = blockChord(tonic, mode, block);
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
                  porPulso={porPulso}
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
          porPulso={porPulso}
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
          onMoveBlock={(blockId, to) => onMoveBlock(part.id, blockId, to)}
          onAdd={(offset, start) => onAddNote(part.id, offset, start)}
          onSelect={onSelectNote}
          onMove={onMoveNote}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      )}

      {/*
        Lo que propone el copiloto, al final de lo que llevas y sin ser tuyo
        todavía ([adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md)).

        **En su propia tira y no dentro de la de acordes**, y eso arregla dos
        cosas de una: en partitura no hay tira de bloques —los acordes se leen
        encima del pentagrama— así que dentro no se habrían visto en la vista por
        defecto; y separados se lee sin dudar dónde acaba tu canción y dónde
        empieza lo que alguien te ofrece.

        Aquí y no en un panel aparte porque leer cuatro acordes en una lista y
        buscarles sitio a mano es justo el trabajo que el copiloto debería
        ahorrarte.
      */}
      {propuesta.length > 0 && (
        <ul
          aria-label={`Lo propuesto para ${part.name}`}
          className="mt-2 flex items-stretch gap-1 overflow-x-auto pb-1"
        >
          {propuesta.map((degree, indice) => (
            <li key={`fantasma-${indice}`} className="flex">
              <BloqueFantasma
                symbol={resolveDegree(tonic, mode, degree).symbol}
                degree={degree}
                beats={beatsPerBar}
                porPulso={porPulso}
                orden={indice + 1}
                total={propuesta.length}
                onAceptar={() => onAceptarPropuesta(indice + 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
