'use client';

import { anchoDeBloque } from './BlockButton';

/**
 * Un acorde que el copiloto propone y **todavía no es de la canción**.
 *
 * Punteado y sin el filo de color, que es lo que decide
 * [adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md): el
 * filo dice si un acorde reposa, sale o tensa, y eso es información sobre **tu**
 * canción. Ponérselo a algo que no has aceptado sería decir que ya cuenta.
 *
 * Es un botón y no un adorno: pulsarlo acepta hasta aquí. Así aceptar los dos
 * primeros de cuatro es un gesto, y no hay que aprenderse ningún atajo para
 * hacerlo.
 */
export function BloqueFantasma({
  symbol,
  degree,
  beats,
  porPulso,
  orden,
  total,
  onAceptar,
}: {
  readonly symbol: string;
  readonly degree: string;
  readonly beats: number;
  readonly porPulso: number;
  /** Cuál de la lista es, contando desde uno. */
  readonly orden: number;
  readonly total: number;
  readonly onAceptar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAceptar}
      aria-label={`Aceptar ${symbol}, grado ${degree}${
        orden > 1 ? ` y los ${orden - 1} de antes` : ''
      }. Propuesto, ${orden} de ${total}.`}
      // El punteado es el borde, no un adorno encima: un bloque de verdad tiene
      // el borde entero y éste no, que es la diferencia que hay que ver de lejos.
      className="border-brass-dim text-text-muted hover:border-brass-bright hover:text-text min-h-tap relative flex cursor-pointer flex-col justify-center overflow-hidden rounded-md border border-dashed bg-transparent px-3 py-2 text-left opacity-70 transition-[border-color,color,opacity] duration-150 hover:opacity-100"
      style={{ width: anchoDeBloque(beats, porPulso) }}
    >
      <span aria-hidden="true" className="text-brass-bright/70 font-mono text-sm">
        {symbol}
      </span>
      <span aria-hidden="true" className="text-text-muted font-mono text-[10px]">
        {degree}
      </span>
    </button>
  );
}
