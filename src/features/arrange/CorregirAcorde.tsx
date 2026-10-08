'use client';

/**
 * «No lo oí claro. ¿Era esto?»: la cola de acordes que hay que preguntar.
 *
 * **Dice de cuál habla.** «Apunté Em» no bastaba con cuatro `Em` en la canción:
 * la tarjeta nombra la parte y el compás, y el lienzo recuadra ese acorde en las
 * dos vistas.
 *
 * Lo que decide es de qué acorde se pregunta y en qué orden, y eso vive en el
 * dominio (`bloquesEnDuda`). Aquí solo se pinta.
 */

import { resolveDegree, type Block, type DegreeSymbol, type KeyMode } from '@core/music';
import type { PitchClass } from '@core/music';

export interface CorregirAcordeProps {
  /** El acorde del que se pregunta, o nulo si no hay ninguno que preguntar. */
  readonly enDuda: Block | null;
  /** Cuántos quedan por resolver, contando este. */
  readonly cuantos: number;
  /** Dónde está, dicho como se busca: «Estrofa, compás 3». */
  readonly donde: string;
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  /** Cambiarlo por otro de los que el motor consideró. */
  readonly onCorregir: (blockId: string, degree: DegreeSymbol) => void;
  /** Darlo por bueno: deja de preguntar y pasa a valer como escrito. */
  readonly onConfirmar: (blockId: string) => void;
}

export function CorregirAcorde({
  enDuda,
  cuantos,
  donde,
  tonic,
  mode,
  onCorregir,
  onConfirmar,
}: CorregirAcordeProps) {
  if (enDuda === null) {
    return null;
  }

  return (
    <section
      aria-label="Corregir el acorde"
      className="border-brass-dim mb-4 rounded-md border border-dashed p-3"
    >
      <h3 className="rotulo">
        No lo oí claro. ¿Era esto?
        {cuantos > 1 && (
          // Cuántas quedan, para que se vea que esto se acaba. Sin el número,
          // arreglar uno y ver aparecer otro parece que no avanza.
          <span className="text-text-muted ml-2 text-xs font-normal">quedan {cuantos}</span>
        )}
      </h3>
      <p className="text-text-muted mt-1 text-xs">
        Apunté {resolveDegree(tonic, mode, enDuda.degree).symbol} en {donde}, el recuadrado, y
        estuve a punto de decir otra cosa.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1">
        {enDuda.alternatives.map((otro) => (
          <li key={otro}>
            <button
              type="button"
              onClick={() => onCorregir(enDuda.id, otro)}
              className="border-border text-text hover:border-brass-dim hover:bg-surface-raised min-h-tap inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium"
            >
              {resolveDegree(tonic, mode, otro).symbol}
              <span className="text-text-muted text-xs">{otro}</span>
            </button>
          </li>
        ))}
        <li>
          {/* Dar por bueno lo que se oyó también es corregir: deja de preguntar y
              el acorde pasa a valer como escrito. */}
          <button
            type="button"
            onClick={() => onConfirmar(enDuda.id)}
            className="border-border text-text-muted hover:border-brass-dim hover:text-text min-h-tap inline-flex items-center rounded-md border px-3 text-sm"
          >
            Estaba bien
          </button>
        </li>
      </ul>
    </section>
  );
}
