import { useEffect, useRef, useState } from 'react';

import {
  DEFAULT_FRET_COUNT,
  fretboardPositions,
  INLAY_FRETS,
  STANDARD_TUNING,
} from '@core/instrument';
import {
  SCALES,
  scaleNotes,
  noteName,
  type Accidental,
  type PitchClass,
  type ScaleId,
} from '@core/music';

const NUT_X = 46;
/** Lo que mide un traste cuando el mástil se dibuja a su tamaño natural. */
const TRASTE_NATURAL = 54;
const STRING_GAP = 30;
/**
 * El aire de arriba y el de abajo, donde van los números de traste.
 *
 * **Eran 34 y 46, y se comían el 35 % del alto.** Lo que decide el tamaño de
 * las notas es el alto que le toca a las cuerdas, así que cada píxel de margen
 * es una nota más pequeña: recortados, las cuerdas pasan del 65 % del dibujo al
 * 74 % ([adr/0040](../../../docs/adr/0040-ni-cuadrado-ni-tira.md)).
 */
const TOP = 22;
const ABAJO = 26;
const HEIGHT = TOP + STRING_GAP * 5 + ABAJO;

/**
 * Lo más fino que se deja poner el mástil.
 *
 * Estirándolo sin tope llenaba el ancho entero y quedaba **una tira**: a 1314
 * por 606 salía de siete y pico a uno, con las notas diminutas. Cinco a uno es
 * bastante más ancho que su proporción natural y todavía se lee como un mástil.
 */
const MAS_FINO = 5;
const ANCHO_NATURAL = NUT_X + TRASTE_NATURAL * DEFAULT_FRET_COUNT + 18;

/**
 * Lo ancho que es el dibujo a su tamaño natural, respecto a lo alto.
 *
 * Es el mínimo: por debajo de esta proporción el mástil se queda como siempre y
 * se centra en su caja. Por encima **se estira a lo ancho**, que es lo que hace
 * que en una pantalla baja se vea un mástil de lado a lado en vez de un
 * cuadrado en medio.
 */
export const PROPORCION = ANCHO_NATURAL / HEIGHT;

export interface FretboardProps {
  readonly tonic: PitchClass;
  readonly scaleId: ScaleId;
  /** Cómo se escriben las notas en esta tonalidad. */
  readonly accidental?: Accidental;
  /** La nota que suena ahora, para encenderla en el mástil. */
  readonly soundingMidi: number | null;
  /**
   * Las notas del acorde que hay elegido, si hay alguno.
   *
   * Con esto el mástil deja de enseñar una escala plana: **las notas del acorde
   * se rellenan y las demás se quedan huecas**. Es el problema central de
   * improvisar —la escala entra toda, pero solo tres notas caen de pie sobre el
   * acorde que suena— y hasta ahora las quince se pintaban igual.
   *
   * Es la misma idea que usa Hookpad en su pentagrama: elegidos los acordes,
   * pinta de color las notas que encajan y deja las disonantes en blanco. Aquí
   * se dice con relleno y hueco, que es lo que este proyecto ya usa para
   * distinguir sin depender del color.
   */
  readonly chordNotes?: readonly PitchClass[] | undefined;
}

/**
 * Mástil de quince trastes con la escala marcada.
 *
 * Los trastes van igual de anchos, que no es lo que pasa en una guitarra real
 * —se estrechan hacia el puente— pero es lo que hace legible un diagrama.
 */
export function Fretboard({
  tonic,
  scaleId,
  soundingMidi,
  chordNotes,
  accidental = 'sharp',
}: FretboardProps) {
  /**
   * El hueco, medido, para saber cuánto se puede estirar.
   *
   * Un `ResizeObserver` y no un porcentaje de CSS, por lo mismo que en el
   * pentagrama: hace falta **el número** para repartir los trastes. Estirando
   * el SVG con `preserveAspectRatio="none"` se estirarían también las notas, y
   * un mástil de notas ovaladas no es un mástil.
   */
  const cajaRef = useRef<HTMLDivElement | null>(null);
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const el = cajaRef.current;
    /* v8 ignore next -- la caja está montada; lo que falta en jsdom es el observador, y eso sí se prueba */
    if (el === null || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(([entrada]) => {
      setCaja({
        ancho: entrada?.contentRect.width ?? 0,
        alto: entrada?.contentRect.height ?? 0,
      });
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  /**
   * El ancho del dibujo en sus propias unidades.
   *
   * **Se estira hasta llenar el hueco, entre dos topes.** Sin estirarse, en una
   * ventana baja se quedaba en un cuadrado centrado con dos franjas muertas a
   * los lados. Estirándose sin freno quedaba lo contrario: una tira de siete a
   * uno con las notas diminutas. Los dos se vieron, y por eso hay dos topes.
   *
   * Encogerlo por debajo de su tamaño natural no vale: los trastes se juntarían
   * hasta que las notas no cupieran dentro.
   */
  const ancho =
    caja.alto > 0
      ? Math.min(Math.max(ANCHO_NATURAL, (HEIGHT * caja.ancho) / caja.alto), HEIGHT * MAS_FINO)
      : ANCHO_NATURAL;
  const traste = (ancho - NUT_X - 18) / DEFAULT_FRET_COUNT;

  const notes = scaleNotes(tonic, scaleId);
  const delAcorde = new Set(chordNotes ?? []);
  const hayAcorde = delAcorde.size > 0;
  const positions = fretboardPositions().filter((position) => notes.includes(position.pitchClass));
  const stringIndex = new Map(STANDARD_TUNING.map((string, index) => [string.number, index]));

  // El alto sale de la proporción del dibujo, así que no sobra ni falta sitio a
  // los lados; el tope es lo que impide que en un área ancha y baja el dibujo
  // pida más alto del que hay.
  return (
    // La caja que se mide. El SVG llena lo que haya y el dibujo se reparte
    // dentro con el ancho de traste que salga.
    <div ref={cajaRef} className="h-full w-full">
      <svg
        viewBox={`0 0 ${ancho} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        // **Llena su caja**, y quien le da a la caja la proporción buena es
        // `PROPORCION` —la usa el hueco que lo envuelve—.
        //
        // Antes ponía `h-auto max-h-full`: el alto salía del dibujo y el tope lo
        // encogía. Con el mástil en un área más ancha que alta eso lo dejaba
        // pintado a menos de la mitad del ancho, centrado entre dos franjas
        // muertas de casi cuatrocientos píxeles, y es lo que hacía que se viera
        // pequeño teniendo sitio de sobra. El `preserveAspectRatio` sigue
        // puesto: si el hueco se queda corto de alto, encoge y se ve entero, que
        // es la promesa de siempre.
        className="h-full w-full"
        role="img"
        aria-label={
          hayAcorde
            ? `Mástil de ${DEFAULT_FRET_COUNT} trastes con la escala ${SCALES[
                scaleId
              ].name.toLowerCase()} de ${noteName(tonic, accidental)}, con las notas del acorde elegido rellenas.`
            : `Mástil de ${DEFAULT_FRET_COUNT} trastes con la escala ${SCALES[
                scaleId
              ].name.toLowerCase()} de ${noteName(tonic, accidental)} marcada.`
        }
      >
        {INLAY_FRETS.map((fret) => (
          <rect
            key={fret}
            x={NUT_X + traste * (fret - 1)}
            y={TOP - 12}
            width={traste}
            height={STRING_GAP * 5 + 24}
            className="fill-surface-raised"
            opacity={fret === 12 ? 0.9 : 0.5}
          />
        ))}

        {/* Cejuela: más gruesa que los trastes, como en la guitarra. */}
        <line
          x1={NUT_X}
          y1={TOP - 10}
          x2={NUT_X}
          y2={TOP + STRING_GAP * 5 + 10}
          className="stroke-brass"
          strokeWidth={5}
        />

        {Array.from({ length: DEFAULT_FRET_COUNT }, (_, index) => index + 1).map((fret) => (
          <line
            key={fret}
            x1={NUT_X + traste * fret}
            y1={TOP - 10}
            x2={NUT_X + traste * fret}
            y2={TOP + STRING_GAP * 5 + 10}
            className="stroke-border"
            strokeWidth={2}
          />
        ))}

        {STANDARD_TUNING.map((string, index) => (
          <g key={string.number}>
            <line
              x1={NUT_X}
              y1={TOP + STRING_GAP * index}
              x2={ancho - 18}
              y2={TOP + STRING_GAP * index}
              className="stroke-border"
              strokeWidth={index > 3 ? 2 : 1}
            />
            <text
              x={NUT_X - 14}
              y={TOP + STRING_GAP * index}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-text-muted font-mono text-[11px]"
            >
              {string.number}
            </text>
          </g>
        ))}

        {positions.map((position) => {
          /* v8 ignore next -- las posiciones salen de la misma afinacion con la que se hizo el mapa */
          const index = stringIndex.get(position.string.number) ?? 0;
          const x = position.fret === 0 ? NUT_X - 30 : NUT_X + traste * (position.fret - 0.5);
          const y = TOP + STRING_GAP * index;
          const isTonic = position.pitchClass === tonic;
          const sounding = soundingMidi !== null && position.midi === soundingMidi;
          // Con acorde elegido manda el acorde, no la tonalidad: la tónica de la
          // canción es una nota más si no está en el acorde que suena ahora.
          const cae = hayAcorde ? delAcorde.has(position.pitchClass) : isTonic;

          return (
            <g key={`${position.string.number}-${position.fret}`}>
              {sounding && (
                <circle
                  cx={x}
                  cy={y}
                  r={13}
                  className="stroke-tube-bright fill-none"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={9}
                className={cae ? 'fill-brass-bright' : 'fill-surface-raised stroke-brass-dim'}
                strokeWidth={cae ? 0 : 1.5}
              />
              {/* La fundamental del acorde lleva además un aro: de las tres que
                caen de pie, es la que dice cuál es el acorde. */}
              {hayAcorde && position.pitchClass === chordNotes?.[0] && (
                <circle
                  cx={x}
                  cy={y}
                  r={12}
                  className="stroke-brass-bright fill-none"
                  strokeWidth={1.5}
                />
              )}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className={`font-mono text-[9px] ${cae ? 'fill-background' : 'fill-text-muted'}`}
              >
                {noteName(position.pitchClass, accidental)}
              </text>
            </g>
          );
        })}

        {INLAY_FRETS.map((fret) => (
          <text
            key={fret}
            x={NUT_X + traste * (fret - 0.5)}
            y={TOP + STRING_GAP * 5 + ABAJO - 8}
            textAnchor="middle"
            className="fill-text-muted font-mono text-[11px]"
          >
            {fret}
          </text>
        ))}
      </svg>
    </div>
  );
}
