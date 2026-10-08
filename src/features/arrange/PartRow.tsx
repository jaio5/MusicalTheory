'use client';

import { memo, useCallback, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  MAX_BARS,
  ROLES,
  drawnBars,
  isDoubtful,
  partLength,
  blockChord,
  roleInfo,
  roleOf,
  type KeyMode,
  type Part,
  type PitchClass,
  type ScaleId,
  type SectionRole,
} from '@core/music';
import { Chip } from '@ui/Chip';
import { Field } from '@ui/Field';
import { TextField } from '@ui/TextField';
import { useTraerALaVista } from '@ui/use-traer-a-la-vista';

import { BlockButton, anchoDeBloque } from './BlockButton';
import { useBloqueQueSuena, type Cabezal } from './cabezal';
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
  /** Lo que mide un pulso, decidido por el lienzo al medir su ancho. */
  readonly porPulso: number;
  readonly playing: boolean;
  /**
   * Por dónde va la reproducción. **El cabezal y no el bloque que suena**: con
   * el identificador como prop, cada acorde que sonaba repintaba el lienzo para
   * pasárselo a la fila; con el cabezal, la fila se suscribe sola y solo se
   * repinta la que tiene el bloque (`cabezal.ts`).
   */
  readonly cabezal: Cabezal;
  readonly selectedBlockId: string | null;
  /** El acorde que «No lo oí claro» está preguntando, si es de esta parte. */
  readonly corrigiendoBlockId: string | null;
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
  /*
    **Todas las acciones reciben la parte, y ninguna la trae puesta.**

    Venían como flechas escritas en el lienzo —`() => player.toggle(part.id)`—,
    nuevas en cada pintado, y con ellas `memo` no servía de nada: cualquier
    cambio en una parte, o cada movimiento de un arrastre, repintaba todas las
    filas con sus pentagramas. Así el lienzo pasa las mismas funciones a todas
    las filas y cada fila las ata a su parte con `useCallback`.
  */
  readonly onPlay: (partId: string) => void;
  readonly onRename: (partId: string, name: string) => void;
  readonly onSetRole: (partId: string, role: SectionRole) => void;
  readonly onRemove: (partId: string) => void;
  readonly onSetBars: (partId: string, bars: number) => void;
  readonly onBlockPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    blockId: string,
  ) => void;
  readonly onBlockClick: (partId: string, blockId: string) => void;
  /**
   * Las teclas sobre un acorde, **las mismas en las dos vistas**: el bloque de
   * la tira y el cifrado de la partitura mandan aquí, y una sola función decide
   * qué hace cada tecla y adónde va el foco después.
   */
  readonly onBlockKeyDown: (event: React.KeyboardEvent<Element>, blockId: string) => void;
  readonly onAddNote: (partId: string, offset: number, start: number) => void;
  readonly onSelectNote: (noteId: string) => void;
  readonly onMoveNote: (noteId: string, start: number, offset: number) => void;
  readonly onResizeNote: (noteId: string, length: number) => void;
  readonly onResizeBlock: (blockId: string, beats: number) => void;
  readonly onMoveBlock: (partId: string, blockId: string, to: number) => void;
  readonly onGestureStart: () => void;
  readonly onGestureEnd: () => void;
}

/**
 * Con `memo`: lo que llega es la parte —que el almacén conserva por referencia
 * mientras no cambia nada de dentro— y funciones que no cambian, así que al
 * tocar una parte solo se repinta ésa.
 */
export const PartRow = memo(function PartRow({
  part,
  tonic,
  mode,
  beatsPerBar,
  porPulso,
  playing,
  cabezal,
  selectedBlockId,
  corrigiendoBlockId,
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
  onResizeBlock,
  onMoveBlock,
  onGestureStart,
  onGestureEnd,
}: PartRowProps) {
  const [editando, setEditando] = useState(false);
  const playingBlockId = useBloqueQueSuena(cabezal, part);
  /**
   * Las tres tiras de la fila se desplazan de lado en un teléfono, y lo que
   * recibe el foco se trae entero: el navegador solo lo hace asomar.
   */
  const traerALaVista = useTraerALaVista();
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

  // Las tres que bajan al pentagrama y al carril del punteo, atadas a esta parte
  // y estables: esos dos van con `memo`, y una flecha nueva en cada pintado lo
  // anulaba.
  const partId = part.id;
  const anadirNota = useCallback(
    (offset: number, start: number) => onAddNote(partId, offset, start),
    [onAddNote, partId],
  );
  const elegirBloque = useCallback(
    (blockId: string) => onBlockClick(partId, blockId),
    [onBlockClick, partId],
  );
  const moverBloque = useCallback(
    (blockId: string, to: number) => onMoveBlock(partId, blockId, to),
    [onMoveBlock, partId],
  );

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
      {/* En el móvil esta fila no cabe: «Quitar» se salía cuarenta píxeles por el
          borde derecho y **no había manera de llegar a él**, porque quien
          recortaba era la pantalla y no una caja con desplazamiento —por eso la
          sonda de medidas tampoco lo veía—. Se desplaza a lo ancho, como la barra
          del lienzo, y el degradado dice que sigue. De `sm` para arriba cabe y no
          se toca nada. */}
      <div
        onFocus={traerALaVista}
        className="hay-mas-al-lado flex items-center gap-2 max-sm:overflow-x-auto sm:flex-wrap max-sm:[&>*]:shrink-0 sm:[&>*]:shrink-0"
      >
        {editando ? (
          <TextField
            label="Nombre de la parte"
            compact
            ancho="crece"
            defaultValue={part.name}
            autoFocus
            onBlur={(event) => {
              onRename(part.id, event.target.value);
              setEditando(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <Chip onClick={() => setEditando(true)} tone="quiet" tamano="compacto">
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

          **Con su rótulo a la vista.** Sin él, «Estrofa» al lado de «Una idea»
          se leía como una sola frase —una estrofa cuyo papel es una idea— y no
          como un nombre y un selector. El rótulo visible es «Sección» a secas y
          el nombre del selector sigue diciendo de qué parte, que es lo que oye
          un lector al llegar sin ver la fila; por eso el visible va oculto para
          él. Decía «Papel», que es la palabra del código: «Papel: Una idea» no
          lo dice nadie que toque, y una estrofa o un puente son secciones.

          **Sin bajarle la letra**: iba a 12 px, la del rótulo, en un mando que
          se elige con la guitarra puesta. Mide lo que mide `ui/Field`.
        */}
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="rotulo">
            Sección
          </span>
          <Field
            label={`Sección de ${part.name}`}
            compact
            ancho="auto"
            value={roleOf(part)}
            onChange={(event) => onSetRole(part.id, event.target.value as SectionRole)}
            title={roleInfo(roleOf(part)).what}
          >
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Field>
        </span>

        {/*
          Los compases, con el número **entre** los dos botones.
          
          «4 compases» al lado de un menos y un más decía lo mismo dos veces y en
          un teléfono partía la fila en dos líneas. Con el número en medio se lee
          igual de claro, ocupa un tercio y se entiende sin instrucciones qué
          hacen los botones de al lado.
        */}
        <span className="flex items-center gap-1">
          <Chip
            onClick={() => onSetBars(part.id, compases - 1)}
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
          {/* `ui/TextField` y no un `<input>` a mano: escrito aquí llevaba el
              borde de separar cajas, 1,5:1 sobre el fondo, y un campo vacío es
              solo su borde (WCAG 1.4.11 pide 3:1). `completo` porque el ancho lo
              pone el campo con `w-14`, y en esta fila `crece` le daría doce rem
              a dos cifras. */}
          <TextField
            type="number"
            inputMode="numeric"
            min={minimoBars}
            max={MAX_BARS}
            value={escribiendo ?? compases}
            label={`Compases de ${part.name}`}
            compact
            onChange={(event) => setEscribiendo(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
              onSetBars(part.id, Number(event.target.value));
              setEscribiendo(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur();
              }
            }}
            // **Sin las flechas del navegador.** En 56 px de campo se comían el
            // sitio de la cifra y «12» salía «1⁝»; subir y bajar ya lo hacen las
            // dos pastillas de al lado, con su alto de dedo.
            className="w-14 [appearance:textfield] px-1 text-center font-mono tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />

          <Chip
            onClick={() => onSetBars(part.id, compases + 1)}
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
            onClick={() => onPlay(part.id)}
            pressed={playing}
            tone="quiet"
            // Lo que dura y no cuántos acordes tiene: una parte de solo
            // punteo también suena, y con los acordes contados no se podía oír.
            disabled={partLength(part) === 0}
            ariaLabel={playing ? `Parar ${part.name}` : `Escuchar ${part.name}`}
            tamano="compacto"
          >
            {playing ? 'Parar' : 'Escuchar'}
          </Chip>
          <Chip
            onClick={() => onRemove(part.id)}
            tone="quiet"
            ariaLabel={`Quitar ${part.name}`}
            tamano="compacto"
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
          onFocus={traerALaVista}
          className="hay-mas-al-lado mt-2 flex items-stretch gap-1 overflow-x-auto pb-1"
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
                  blockId={block.id}
                  doubtful={isDoubtful(block)}
                  symbol={chord.symbol}
                  degree={block.degree}
                  beats={block.beats}
                  beatsPerBar={beatsPerBar}
                  porPulso={porPulso}
                  playing={playingBlockId === block.id}
                  selected={selectedBlockId === block.id}
                  corrigiendo={corrigiendoBlockId === block.id}
                  dragging={draggingBlockId === block.id}
                  onPointerDown={(event) => onBlockPointerDown(event, block.id)}
                  onClick={() => elegirBloque(block.id)}
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
          onAdd={anadirNota}
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
          corrigiendoBlockId={corrigiendoBlockId}
          partName={part.name}
          partId={part.id}
          dropAt={dropAt}
          onSelectBlock={elegirBloque}
          onBlockKeyDown={onBlockKeyDown}
          onResizeBlock={onResizeBlock}
          onMoveBlock={moverBloque}
          onAdd={anadirNota}
          onSelect={onSelectNote}
          onMove={onMoveNote}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      )}
    </section>
  );
});
