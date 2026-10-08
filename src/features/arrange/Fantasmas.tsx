'use client';

import { anchoDeBloque } from './BlockButton';

/*
  Lo que va pegado al puntero mientras se arrastra.

  Va fuera de las filas y en `fixed` porque tiene que poder salir de la fila de
  la que se sacó: es justo el gesto de llevárselo al estribillo. Se coloca con
  `transform` desde el gesto, sin estado (`colocar`): aquí solo se dice qué lleva
  y cuánto mide. La caja de fuera va en la esquina y se traslada al puntero; el
  margen negativo de la de dentro la centra en él.
*/

/** El acorde de «Qué poner ahora» que se arrastra: apagado si no cae en ningún sitio. */
export function FantasmaDeSugerencia({
  nodo,
  symbol,
  cae,
}: {
  readonly nodo: (elemento: HTMLElement | null) => void;
  readonly symbol: string;
  readonly cae: boolean;
}) {
  return (
    <div
      aria-hidden
      ref={nodo}
      className="pointer-events-none fixed top-0 left-0 z-50 will-change-transform"
    >
      <div
        style={{ marginLeft: -30, marginTop: -22 }}
        className={`superficie-viva min-h-tap flex items-center justify-center rounded-md px-4 font-mono ${
          cae ? 'text-brass-bright' : 'text-text-muted opacity-70'
        }`}
      >
        {symbol}
      </div>
    </div>
  );
}

/**
 * El bloque que se arrastra, **con su ancho de verdad**: si el fantasma midiera
 * siempre lo mismo, arrastrar uno de dos compases mentiría sobre el hueco que va
 * a ocupar.
 */
export function FantasmaDeBloque({
  nodo,
  symbol,
  beats,
  porPulso,
}: {
  readonly nodo: (elemento: HTMLElement | null) => void;
  readonly symbol: string;
  readonly beats: number;
  readonly porPulso: number;
}) {
  const ancho = anchoDeBloque(beats, porPulso);
  return (
    <div
      aria-hidden
      ref={nodo}
      className="pointer-events-none fixed top-0 left-0 z-50 opacity-90 will-change-transform"
    >
      <div
        style={{ width: ancho, marginLeft: -ancho / 2, marginTop: -22 }}
        className="superficie-viva border-brass-bright text-text min-h-tap flex items-center justify-center rounded-md font-mono"
      >
        {symbol}
      </div>
    </div>
  );
}
