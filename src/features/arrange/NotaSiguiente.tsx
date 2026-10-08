'use client';

import { useMemo } from 'react';

import {
  SCALES,
  chordAt,
  findNote,
  melodyEnd,
  nextNotes,
  type KeyMode,
  type Part,
  type PitchClass,
  type ScaleId,
} from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { Marca } from '@ui/Marca';

export interface NotaSiguienteProps {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly scaleId: ScaleId;
  readonly parteDestino: Part;
  readonly selectedNoteId: string | null;
  /** La nota se ha escrito: el lienzo la deja elegida. */
  readonly onEscrita: (noteId: string) => void;
}

/**
 * El refuerzo de la nota siguiente, siempre a la vista.
 *
 * Se calcula sobre el acorde que suena **en ese punto** y no sobre el de la
 * parte entera: es lo que hace que la propuesta cambie al avanzar por la canción
 * en vez de repetir siempre la misma lista. El sitio es el final del punteo, o
 * justo detrás de la nota elegida si hay una: la misma regla que siguen los
 * acordes, y así seleccionar y escribir significa «aquí» en las dos mitades.
 *
 * En una fila de píldoras y no en una lista como los acordes: son siete y con el
 * porqué de cada una debajo ocuparían la columna entera, dejando los acordes
 * fuera de pantalla. El porqué se enseña el de la primera —que es la más
 * segura— y el de cada una al pasar por encima.
 */
export function NotaSiguiente({
  tonic,
  mode,
  scaleId,
  parteDestino,
  selectedNoteId,
  onEscrita,
}: NotaSiguienteProps) {
  const arrangement = useArrangementStore((state) => state.arrangement);
  const addNote = useArrangementStore((state) => state.actions.addNote);

  const siguiente = useMemo(() => {
    const elegida = selectedNoteId === null ? null : findNote(arrangement, selectedNoteId);
    const en =
      elegida === null ? melodyEnd(parteDestino) : elegida.note.start + elegida.note.length;
    return {
      start: en,
      notes: nextNotes({
        tonic,
        mode,
        scaleId,
        chord: chordAt(parteDestino, en),
        from: elegida?.note.offset ?? parteDestino.notes.at(-1)?.offset ?? null,
      }),
    };
  }, [arrangement, mode, parteDestino, scaleId, selectedNoteId, tonic]);

  return (
    <section aria-label="Qué nota puede seguir" className="mt-5">
      {/* La escala va en el rótulo, y no es un adorno: con la pentatónica menor
          puesta sobre una tonalidad mayor salen un Mi bemol y un Si bemol
          encima de un Do mayor, que suena a blues y es correcto pero desconcierta
          si no se dice de dónde vienen. */}
      <h3 className="rotulo">Y de nota, sobre {SCALES[scaleId].name.toLowerCase()}</h3>
      <ul className="mt-2 flex flex-wrap gap-1">
        {siguiente.notes.map((nota) => (
          <li key={nota.offset}>
            <button
              type="button"
              onClick={() => onEscrita(addNote(parteDestino.id, nota.offset, siguiente.start, 1))}
              title={nota.why}
              aria-label={`${nota.name}: ${nota.why}`}
              className={`min-h-tap inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-medium ${
                nota.role === 'acorde'
                  ? 'border-brass-dim text-text hover:bg-surface-raised'
                  : 'border-border text-text-muted hover:border-brass-dim hover:text-text'
              }`}
            >
              {/* La misma marca que el panel de acordes: círculo lo que cae de
                  pie, anillo lo que entra pero pide seguir, rombo lo que se
                  sale. Con forma y no solo con color, que el verde contra el
                  rojo es la pareja que no distingue uno de cada doce hombres. */}
              <Marca
                tono={nota.role === 'acorde' ? 'entra' : nota.role === 'escala' ? 'color' : 'fuera'}
              />
              {nota.name}
            </button>
          </li>
        ))}
      </ul>
      {siguiente.notes[0] !== undefined && (
        <p className="text-text-muted mt-2 text-xs">{siguiente.notes[0].why}</p>
      )}
    </section>
  );
}
