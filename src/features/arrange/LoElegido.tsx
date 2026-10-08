'use client';

import { enPulsos } from '@core/cifras';
import { useMemo } from 'react';

import {
  MAX_BLOCK_BEATS,
  barsLabel,
  blockChord,
  findBlock,
  findNote,
  writeNote,
  type DegreeSymbol,
  type EspecieDeBloque,
  type KeyMode,
  type PitchClass,
} from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { Chip } from '@ui/Chip';
import { Disclosure } from '@ui/Disclosure';
import { Field } from '@ui/Field';
import { Mando, Mandos, ValorDelMando } from '@ui/Mandos';

import { TECLAS_DEL_BLOQUE_DICHAS } from './BlockButton';
import { ChordEntry } from './ChordEntry';

/**
 * Lo elegido —un acorde o una nota—, con lo que se puede hacer con ello.
 *
 * Borrar se podía **solo con el teclado** —`Supr` sobre lo enfocado— y en un
 * teléfono no hay teclado que valga: lo que se ponía no se podía quitar. Y mover
 * y estirar sin arrastrar es lo que pide WCAG 2.5.7: quien no puede arrastrar
 * —un dedo que tiembla, un puntero de cabeza— y además no tiene teclado se
 * quedaba sin mover nada.
 *
 * Se entera de lo elegido por el almacén y no por el lienzo: así el lienzo no
 * tiene que calcular aquí lo que solo enseña este panel.
 */
export interface LoElegidoProps {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly beatsPerBar: number;
  /** La nota elegida, que vive en el lienzo y no en el almacén. */
  readonly selectedNoteId: string | null;
  /** Lo elegido se ha quitado: el lienzo suelta la elección. */
  readonly onSoltar: () => void;
  /** El acorde se ha ido a otra parte, que pasa a ser la de destino. */
  readonly onLlevado: (partId: string) => void;
}

export function LoElegido({
  tonic,
  mode,
  beatsPerBar,
  selectedNoteId,
  onSoltar,
  onLlevado,
}: LoElegidoProps) {
  const arrangement = useArrangementStore((state) => state.arrangement);
  const selectedBlockId = useArrangementStore((state) => state.selectedBlockId);
  const acciones = useArrangementStore((state) => state.actions);

  const acorde = useMemo(
    () => (selectedBlockId === null ? null : findBlock(arrangement, selectedBlockId)),
    [arrangement, selectedBlockId],
  );
  const nota = useMemo(
    () => (selectedNoteId === null ? null : findNote(arrangement, selectedNoteId)),
    [arrangement, selectedNoteId],
  );

  if (acorde !== null) {
    const { block, part, index } = acorde;
    // Con `blockChord`: el panel enseñaba «Am» teniendo un «Am7» elegido,
    // porque resolvía solo el grado y la séptima se quedaba por el camino.
    const nombre = blockChord(tonic, mode, block).symbol;

    /**
     * Cambiarlo por otro, **en su sitio y con lo que dura**.
     *
     * Escribir un acorde con uno elegido lo mete detrás, que es lo que permite
     * encadenar cuatro tecleando seguido; para cambiar uno había que quitarlo y
     * escribir el nuevo, que entraba detrás del vecino. Quitar y poner van en un
     * solo gesto, así que «Deshacer» devuelve el de antes de una vez. Se quita
     * primero: en una parte llena, poner primero no cabría y quitar después
     * borraría el acorde sin poner el otro
     * ([adr/0119](../../../docs/adr/0119-la-partitura-llena-su-hueco-y-el-lienzo-se-parte.md)).
     */
    const cambiar = (degree: DegreeSymbol, especie?: EspecieDeBloque) => {
      acciones.beginGesture();
      acciones.removeBlock(block.id);
      const nuevo = acciones.addBlock(part.id, degree, block.beats, index, especie);
      acciones.endGesture();
      acciones.elegirBloque(nuevo);
    };

    return (
      // Con la clave del bloque: al cambiarlo, el «Cambiar por…» vuelve cerrado.
      <section
        key={block.id}
        aria-label="Lo elegido"
        className="superficie mb-4 flex flex-col gap-3 p-3"
      >
        <Cabecera
          nombre={nombre}
          detalle={`${block.degree} · ${barsLabel(block.beats, beatsPerBar)}`}
          onQuitar={() => {
            acciones.removeBlock(block.id);
            onSoltar();
          }}
        />

        {/* **Dos mandos con borde, y no cuatro palabras sueltas.** Eran `Chip`
            silenciosos en una rejilla de dos por dos: sin contorno, con cien
            píxeles de hueco entre ellos, se leían como texto. Arriba se mueve
            y abajo se estira, con lo que dura entre el menos y el más. */}
        <Mandos etiqueta="Mover" className="w-full">
          <Mando
            primero
            onClick={() => acciones.moveBlock(block.id, part.id, index - 1)}
            disabled={index === 0}
            ariaLabel={`Mover ${nombre} antes`}
          >
            Antes
          </Mando>
          <Mando
            onClick={() => acciones.moveBlock(block.id, part.id, index + 1)}
            disabled={index === part.blocks.length - 1}
            ariaLabel={`Mover ${nombre} después`}
          >
            Después
          </Mando>
        </Mandos>
        <Mandos etiqueta="Lo que dura" className="w-full">
          <Mando
            primero
            onClick={() => acciones.resizeBlock(block.id, block.beats - 1)}
            disabled={block.beats <= 1}
            ariaLabel={`Un pulso menos a ${nombre}`}
          >
            −
          </Mando>
          <ValorDelMando>{enPulsos(block.beats)}</ValorDelMando>
          <Mando
            onClick={() => acciones.resizeBlock(block.id, block.beats + 1)}
            disabled={block.beats >= MAX_BLOCK_BEATS}
            ariaLabel={`Un pulso más a ${nombre}`}
          >
            +
          </Mando>
        </Mandos>

        <Disclosure summary="Cambiar por…">
          <div className="pt-2">
            <ChordEntry
              tonic={tonic}
              mode={mode}
              onPick={cambiar}
              etiqueta={`Cambiar ${nombre} por`}
            />
          </div>
        </Disclosure>

        {/* A otra parte, solo si hay otra: con una sola no hay adónde. */}
        {arrangement.parts.length > 1 && (
          <Field
            label="Mover a la parte"
            compact
            ancho="completo"
            value=""
            onChange={(event) => {
              // Al final de la otra parte: es donde sigue una canción cuando no
              // se apunta a ningún compás. El dominio acota el sitio.
              acciones.moveBlock(block.id, event.target.value, Number.POSITIVE_INFINITY);
              onLlevado(event.target.value);
            }}
          >
            <option value="" disabled>
              Mover a la parte…
            </option>
            {arrangement.parts
              .filter((otra) => otra.id !== part.id)
              .map((otra) => (
                <option key={otra.id} value={otra.id}>
                  {otra.name}
                </option>
              ))}
          </Field>
        )}

        {/* Las teclas, **solo con un puntero fino**: en un teléfono no hay
            flechas ni `Supr`, y la frase eran tres renglones de instrucciones
            que no se pueden seguir. */}
        <p className="text-text-muted hidden text-xs pointer-fine:block">
          Con el teclado: {TECLAS_DEL_BLOQUE_DICHAS}.
        </p>
      </section>
    );
  }

  if (nota !== null) {
    const escrita = writeNote(nota.note, tonic, mode);
    const nombre = `${escrita.letter}${escrita.accidental}${escrita.octave}`;
    return (
      <section aria-label="Lo elegido" className="superficie mb-4 flex flex-col gap-3 p-3">
        <Cabecera
          nombre={nombre}
          detalle={enPulsos(nota.note.length)}
          onQuitar={() => {
            acciones.removeNote(nota.note.id);
            onSoltar();
          }}
        />
      </section>
    );
  }

  return null;
}

/** El nombre de lo elegido, grande, y su botón de quitar. */
function Cabecera({
  nombre,
  detalle,
  onQuitar,
}: {
  readonly nombre: string;
  readonly detalle: string;
  readonly onQuitar: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 grow">
        {/* El nombre en la letra de los títulos, como el cifrado de la
            partitura: es lo que se busca con la mirada al volver al panel. */}
        <span className="font-display text-brass-bright block text-2xl leading-tight">
          {nombre}
        </span>
        <span className="text-text-muted block font-mono text-xs">{detalle}</span>
      </span>
      <Chip onClick={onQuitar} tamano="compacto" ariaLabel={`Quitar ${nombre}`}>
        Quitar
      </Chip>
    </div>
  );
}
