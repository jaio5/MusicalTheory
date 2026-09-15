'use client';

import { HARMONIC_ROLES, roleOfDegreeSymbol, type HarmonicRole } from '@core/music';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Un bloque del lienzo: un acorde y lo que ocupa.
 *
 * ## El ancho dice la duración, hasta donde deja leerlo
 *
 * Un bloque de dos compases es el doble de ancho que uno de uno, que es lo único
 * que hace falta entender para montar una canción sin saber música. Pero por
 * debajo de cierto ancho el cifrado no cabe, así que hay un mínimo y los bloques
 * más cortos dejan de ser proporcionales.
 *
 * Es la misma renuncia que ya hizo el mástil con los trastes, que en una guitarra
 * de verdad se estrechan hacia el puente y aquí van todos iguales: **el diagrama
 * se lee mejor**, y un diagrama exacto que no se lee no vale para nada.
 *
 * ## Un solo control, no dos
 *
 * Arrastrar por el cuerpo mueve el bloque; arrastrar por la franja de la derecha
 * lo estira. Podrían ser dos elementos, y entonces la manija sería un control de
 * catorce píxeles en una aplicación donde nada de lo que se pulsa baja de
 * cuarenta y cuatro. Con uno solo, el bloque entero es zona de dedo y lo que
 * cambia es por dónde se coge.
 *
 * Con teclado no hay franjas: las flechas mueven, con `Shift` estiran, y `Supr`
 * lo quita. Es lo que hace que el lienzo se pueda usar sin ratón, que un
 * arrastre por sí solo nunca es accesible.
 */

/**
 * Cuántos píxeles ocupa un pulso **cuando no se ha medido la pantalla**.
 *
 * Es el valor de partida y el que usan los tests; el de verdad lo calcula el
 * lienzo al ancho que tenga, entre `PULSO_MINIMO` y `PULSO_MAXIMO`, y lo reparte
 * a todas las partes. **Una sola escala para todo el lienzo y no una por parte**,
 * porque lo que el ancho de una caja tiene que decir es su duración: con una
 * escala por fila, una parte de ocho compases mediría lo mismo que una de cuatro
 * y eso es justo lo que el carril de bloques existe para no hacer.
 */
export const PX_POR_PULSO = 24;

/**
 * Los dos topes de esa escala.
 *
 * Por debajo del mínimo un compás de cuatro pulsos no llega ni al ancho de un
 * cifrado; por encima del máximo, cuatro compases se estiran hasta que hay que
 * mover la cabeza para leerlos. Son los mismos dos topes que la partitura, que
 * lleva justificándose al ancho desde que existe.
 */
export const PULSO_MINIMO = 18;
export const PULSO_MAXIMO = 64;

/** Lo más estrecho que puede ser un bloque sin que el cifrado deje de leerse. */
export const ANCHO_MINIMO_PX = 68;

/** Por dónde hay que coger un bloque para estirarlo, en píxeles desde su borde. */
export const ZONA_ESTIRAR_PX = 16;

export function anchoDeBloque(beats: number, porPulso: number = PX_POR_PULSO): number {
  return Math.max(ANCHO_MINIMO_PX, beats * porPulso);
}

/**
 * La escala que cabe: lo que puede medir un pulso para que la parte más larga
 * quepa entera en el ancho disponible.
 *
 * Sin ancho medido todavía —el primer pintado— devuelve el de partida, que es lo
 * que hace que no haya un salto visible al montar.
 */
export function pulsoQueCabe(disponible: number, pulsosDeLaMasLarga: number): number {
  if (disponible <= 0 || pulsosDeLaMasLarga <= 0) {
    return PX_POR_PULSO;
  }
  return Math.min(PULSO_MAXIMO, Math.max(PULSO_MINIMO, disponible / pulsosDeLaMasLarga));
}

/**
 * El color de cada papel armónico.
 *
 * Los tres que ya usa la aplicación y ninguno nuevo: verde lo que reposa, latón
 * lo que sale de casa, rojo lo que tensa. Es el mismo código que el punto de
 * «entra, color, fuera» del panel de al lado, aplicado a otra cosa —allí es si
 * el acorde cabe en la tonalidad, aquí qué hace dentro de ella— y por eso el
 * bloque lleva **la letra al lado del color**: sin ella serían dos códigos de
 * color distintos en la misma pantalla, que no se leen, se adivinan.
 *
 * Son colores de relleno, no de escribir: `oxblood` y `tube` no llegan a 4,5:1
 * y aquí solo tiñen un filo de dos píxeles.
 */
const FILO: Readonly<Record<HarmonicRole, string>> = {
  tonic: 'bg-tube',
  subdominant: 'bg-brass',
  dominant: 'bg-oxblood',
  approach: 'bg-border',
};

export interface BlockButtonProps {
  readonly symbol: string;
  readonly degree: string;
  readonly beats: number;
  /**
   * Si el motor eligió este acorde por poco.
   *
   * Se marca con el filo punteado y un interrogante, y no con un color nuevo:
   * los tres colores de aquí ya están diciendo qué papel tiene el acorde, y un
   * cuarto encima haría que ninguno de los dos se leyera.
   */
  readonly doubtful?: boolean;
  /** Para decir cuántos compases ocupa: en 3/4 no son los mismos que en 4/4. */
  readonly beatsPerBar: number;
  /**
   * Lo que mide un pulso, que lo decide el lienzo midiendo su ancho.
   *
   * Llega desde arriba y no se importa aquí para que todas las partes usen el
   * mismo número: es lo único que hace que el ancho de una caja signifique su
   * duración también **entre** partes, y no solo dentro de una.
   */
  readonly porPulso?: number;
  /** Encendido mientras suena, para que se vea por dónde va. */
  readonly playing?: boolean;
  readonly selected?: boolean;
  /** Se está arrastrando: se queda en su sitio, apagado, como hueco de origen. */
  readonly dragging?: boolean;
  readonly onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  readonly onClick?: () => void;
  readonly onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export function BlockButton({
  symbol,
  degree,
  beats,
  beatsPerBar,
  porPulso = PX_POR_PULSO,
  doubtful = false,
  playing = false,
  selected = false,
  dragging = false,
  onPointerDown,
  onClick,
  onKeyDown,
}: BlockButtonProps) {
  const role = roleOfDegreeSymbol(degree);
  const info = HARMONIC_ROLES[role];
  const compases = beats / Math.max(1, beatsPerBar);

  return (
    <button
      type="button"
      // `min-h-tap` y no una altura fija: es lo que se pulsa, y aquí no hay
      // excepciones ni para lo que se arrastra.
      className={`superficie-alta min-h-tap relative flex flex-col justify-center overflow-hidden rounded-md px-3 py-2 text-left transition-[border-color,opacity,transform] duration-150 ${
        dragging
          ? 'opacity-30'
          : playing
            ? 'border-brass-bright ring-brass-bright ring-1'
            : selected
              ? 'border-brass-dim'
              : 'hover:border-brass-dim'
      }`}
      style={{ width: anchoDeBloque(beats, porPulso), touchAction: 'none' }}
      aria-label={`${symbol}, grado ${degree}, ${info.name.toLowerCase()}, ${beats} pulsos${
        doubtful ? ', dudoso' : ''
      }`}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {/* El filo de color va pegado al borde de abajo y mide dos píxeles: dice
          el papel del acorde sin teñir el bloque, que a treinta bloques seguidos
          sería una bandera y no una canción. */}
      {/* El filo del papel armónico. Punteado cuando el acorde está en duda: es
          la misma franja diciendo dos cosas, y no dos franjas peleándose. */}
      {doubtful ? (
        <span
          aria-hidden
          className={`absolute inset-x-0 bottom-0 h-0.5 ${FILO[role]}`}
          style={{
            maskImage: 'repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 6px)',
            WebkitMaskImage: 'repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 6px)',
          }}
        />
      ) : (
        <span aria-hidden className={`absolute inset-x-0 bottom-0 h-0.5 ${FILO[role]}`} />
      )}

      <span className={`font-mono text-lg ${playing ? 'text-brass-bright' : 'text-text'}`}>
        {symbol}
        {doubtful && (
          <span className="text-text-muted ml-1 text-sm" title="No lo oí claro: puedes corregirlo">
            ?
          </span>
        )}
      </span>
      <span className="text-text-muted flex items-baseline gap-1.5 font-mono text-xs">
        <span>{degree}</span>
        <span aria-hidden title={info.what}>
          {info.short}
        </span>
        {/* Los compases solo cuando no es uno: escribir «1» en todos los bloques
            es ruido en la única fila que se mira mientras se toca. */}
        {compases !== 1 && (
          <span className="ml-auto tabular-nums" aria-hidden>
            {String(Math.round(compases * 100) / 100).replace('.', ',')}
          </span>
        )}
      </span>

      {/* La franja de estirar. Solo cambia el cursor: quien la usa la encuentra
          por el cursor, y quien no, no se entera de que está. */}
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 w-4 cursor-ew-resize"
        style={{ width: ZONA_ESTIRAR_PX }}
      />
    </button>
  );
}
