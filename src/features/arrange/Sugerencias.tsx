'use client';

import { useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  degreesFor,
  lastDegreeOf,
  nextDegrees,
  resolveDegree,
  type DegreeSymbol,
  type KeyMode,
  type Part,
  type PitchClass,
} from '@core/music';

/** Cuántos acordes se proponen. Más de seis dejan de mirarse. */
const CUANTAS_SUGERENCIAS = 6;

export interface SugerenciasProps {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  /** La parte a la que van los acordes que se pulsan; nula con la canción en blanco. */
  readonly parteDestino: Part | null;
  /** Con la canción en blanco, el primero lleva el acento. */
  readonly enBlanco: boolean;
  readonly onPoner: (degree: DegreeSymbol) => void;
  readonly onArrastrar: (event: ReactPointerEvent, degree: DegreeSymbol, symbol: string) => void;
  /** Si la pulsación que llega es la de vuelta de un arrastre, y la olvida. */
  readonly fueArrastre: () => boolean;
}

/**
 * Los acordes que pueden venir ahora, y por qué.
 *
 * Desde el último bloque de la parte de destino, con `nextDegrees`, que es el
 * mismo catálogo que usa la otra cara de la pantalla. Con el lienzo vacío no hay
 * «desde dónde», así que se ofrecen los grados de la tonalidad: es lo que hay
 * antes del primer acorde.
 */
export function Sugerencias({
  tonic,
  mode,
  parteDestino,
  enBlanco,
  onPoner,
  onArrastrar,
  fueArrastre,
}: SugerenciasProps) {
  const sugerencias = useMemo(() => {
    const desde = parteDestino === null ? null : lastDegreeOf(parteDestino);
    if (desde === null) {
      return degreesFor(mode)
        .slice(0, CUANTAS_SUGERENCIAS)
        .map((degree) => ({ degree, why: resolveDegree(tonic, mode, degree).role }));
    }
    return nextDegrees(mode, desde)
      .slice(0, CUANTAS_SUGERENCIAS)
      .map((move) => ({ degree: move.to, why: move.why }));
  }, [mode, parteDestino, tonic]);

  return (
    <>
      <h3 className="rotulo mt-4">
        {parteDestino === null ? 'Para empezar' : `Después de ${parteDestino.name}`}
      </h3>
      <p className="text-text-muted mt-1 text-xs">
        Pulsa uno, o arrástralo hasta la parte donde lo quieras.
      </p>
      <ul aria-label="Acordes que pueden seguir" className="mt-3 flex flex-col gap-2">
        {sugerencias.map((sugerencia, indice) => {
          const chord = resolveDegree(tonic, mode, sugerencia.degree);
          // **Con la canción en blanco, el primero lleva el acento.** El vacío
          // dice «pulsa un acorde de Para empezar» y la lista era seis cajas
          // iguales: ninguna decía «empieza por aquí».
          const primeroDeTodos = indice === 0 && enBlanco;
          return (
            <li key={sugerencia.degree}>
              <button
                type="button"
                onClick={() => {
                  // Tras un arrastre el navegador manda también el `click`. Sin
                  // esto, soltar un acorde en una parte metía dos: el que se
                  // soltó y el de la pulsación de vuelta.
                  if (!fueArrastre()) {
                    onPoner(sugerencia.degree);
                  }
                }}
                onPointerDown={(event) => onArrastrar(event, sugerencia.degree, chord.symbol)}
                // Con rótulo, porque los tres trozos van pegados: un lector de
                // pantalla leía «CICasa.» de corrido. Es el mismo formato que ya
                // usa la lista de «a dónde ir».
                aria-label={`${chord.symbol}, ${sugerencia.degree}. ${sugerencia.why}`}
                style={{ touchAction: 'none' }}
                className={`hover:border-brass-dim hover:bg-surface-raised min-h-tap flex w-full cursor-grab items-baseline gap-3 rounded-md border px-3 py-2 text-left ${
                  primeroDeTodos ? 'border-brass-dim bg-surface-raised' : 'border-border'
                }`}
              >
                <span className="text-brass-bright font-mono text-base">{chord.symbol}</span>
                <span className="text-text-muted font-mono text-xs">{sugerencia.degree}</span>
                <span className="text-text-muted text-xs">{sugerencia.why}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
