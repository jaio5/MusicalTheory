import { fretboardPositions, STANDARD_TUNING } from '@core/instrument';
import {
  SCALES,
  noteName,
  scaleNotes,
  type Accidental,
  type PitchClass,
  type ScaleId,
} from '@core/music';

/** Cuántos trastes entran. Cinco es lo que ocupa una posición de la mano. */
const TRASTES = 5;
const CELDA = 13;
const IZQUIERDA = 7;
const ARRIBA = 6;
const ANCHO = IZQUIERDA + CELDA * TRASTES + IZQUIERDA;
const ALTO = ARRIBA + CELDA * 5 + ARRIBA;

export interface EscalaMiniProps {
  readonly tonic: PitchClass;
  readonly scaleId: ScaleId;
  readonly accidental?: Accidental;
}

/**
 * La escala en un trozo de mástil del tamaño de un sello.
 *
 * Para cuando hay que **enseñar una escala sin llevarte a ella**: la propone la
 * IA en una idea, y hasta ahora eso era una línea de texto —«Pentatónica menor
 * de La»— que no dice nada a quien todavía no se sabe las escalas de memoria.
 * Un dibujo de la forma sí: se reconoce la caja del rock sin leer su nombre.
 *
 * Es el mismo trato que `ChordDiagram` le da a un acorde, y por lo mismo. La
 * diferencia es la orientación: un acorde se dibuja de pie porque es una
 * digitación, y una escala se dibuja tumbada porque lo que cuenta es **por
 * dónde va**, que es a lo largo del mástil.
 *
 * **Cinco trastes desde la cejuela, y no los quince.** No es el mástil de
 * verdad: es un recorte reconocible. Los quince en este tamaño son una nube de
 * puntos de dos píxeles donde no se distingue una escala de otra.
 *
 * La tónica va rellena y el resto hueca, que es como este proyecto distingue sin
 * depender del color. Y va marcado como imagen con su nombre escrito: quien no
 * lo ve necesita «pentatónica menor de La», no treinta círculos.
 */
export function EscalaMini({ tonic, scaleId, accidental = 'sharp' }: EscalaMiniProps) {
  const notas = scaleNotes(tonic, scaleId);
  const cuerda = new Map(STANDARD_TUNING.map((string, indice) => [string.number, indice]));
  const puntos = fretboardPositions(TRASTES).filter((posicion) =>
    notas.includes(posicion.pitchClass),
  );

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="h-auto w-full max-w-[110px] min-w-[92px] shrink-0"
      role="img"
      aria-label={`${SCALES[scaleId].name} de ${noteName(tonic, accidental)}, en los cinco primeros trastes`}
    >
      {/* El trozo de mástil, como en el diagrama de acordes: sin él esto son
          unas rayas sueltas encima del fondo de la página. */}
      <rect
        x={IZQUIERDA}
        y={ARRIBA}
        width={CELDA * TRASTES}
        height={CELDA * 5}
        rx={2}
        className="fill-surface-raised"
      />

      {/* La cejuela, gruesa: es lo que dice que esto empieza en el principio del
          mástil y no en un sitio cualquiera. */}
      <line
        x1={IZQUIERDA}
        y1={ARRIBA}
        x2={IZQUIERDA}
        y2={ARRIBA + CELDA * 5}
        className="stroke-brass"
        strokeWidth={2.5}
      />

      {Array.from({ length: TRASTES }, (_, indice) => indice + 1).map((traste) => (
        <line
          key={traste}
          x1={IZQUIERDA + CELDA * traste}
          y1={ARRIBA}
          x2={IZQUIERDA + CELDA * traste}
          y2={ARRIBA + CELDA * 5}
          className="stroke-border"
          strokeWidth={0.75}
        />
      ))}

      {STANDARD_TUNING.map((_, indice) => (
        <line
          key={indice}
          x1={IZQUIERDA}
          y1={ARRIBA + CELDA * indice}
          x2={IZQUIERDA + CELDA * TRASTES}
          y2={ARRIBA + CELDA * indice}
          className="stroke-border"
          strokeWidth={0.5}
        />
      ))}

      {puntos.map((posicion) => {
        const fila = cuerda.get(posicion.string.number);
        if (fila === undefined) {
          return null;
        }
        const esTonica = posicion.pitchClass === tonic;
        // Al aire se dibuja sobre la cejuela, no dentro del primer traste: es
        // donde está la nota, y donde la busca quien lee un diagrama.
        const x = posicion.fret === 0 ? IZQUIERDA : IZQUIERDA + CELDA * posicion.fret - CELDA / 2;
        return (
          <circle
            key={`${posicion.string.number}-${posicion.fret}`}
            cx={x}
            cy={ARRIBA + CELDA * fila}
            r={esTonica ? 3.4 : 2.4}
            className={esTonica ? 'fill-brass-bright' : 'fill-text-muted'}
            opacity={esTonica ? 1 : 0.75}
          />
        );
      })}
    </svg>
  );
}
