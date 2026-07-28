const STRINGS = 6;
const FRETS = 4;
const CELL = 15;
const LEFT = 16;
const TOP = 16;
const WIDTH = LEFT + CELL * (STRINGS - 1) + 16;
const HEIGHT = TOP + CELL * FRETS + 14;

export interface ChordDiagramProps {
  /** Traste por cuerda, de la sexta a la primera. `null` es muda. */
  readonly frets: readonly (number | null)[];
  /** Traste desde el que se dibuja. Cero es la cejuela. */
  readonly position: number;
  readonly label: string;
}

/**
 * El diagrama de un acorde, como en cualquier cancionero: las cuerdas en
 * vertical, la cejuela arriba y un punto por dedo.
 *
 * Va marcado como imagen con su descripción: quien no lo ve necesita la
 * digitación en texto, no seis líneas y unos círculos.
 */
export function ChordDiagram({ frets, position, label }: ChordDiagramProps) {
  // Si el acorde está más arriba del mástil se dibuja una ventana de cuatro
  // trastes y se numera, en vez de pintar doce trastes vacíos.
  const start = position <= 1 ? 1 : position;
  const text = frets.map((fret) => (fret === null ? 'x' : fret)).join('');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full max-w-[110px]"
      role="img"
      aria-label={`${label}: ${text}`}
    >
      {/* Cejuela gruesa solo si el acorde empieza en el primer traste. */}
      <line
        x1={LEFT}
        y1={TOP}
        x2={LEFT + CELL * (STRINGS - 1)}
        y2={TOP}
        className={start === 1 ? 'stroke-brass' : 'stroke-border'}
        strokeWidth={start === 1 ? 4 : 1.5}
      />

      {Array.from({ length: FRETS }, (_, index) => index + 1).map((fret) => (
        <line
          key={fret}
          x1={LEFT}
          y1={TOP + CELL * fret}
          x2={LEFT + CELL * (STRINGS - 1)}
          y2={TOP + CELL * fret}
          className="stroke-border"
          strokeWidth={1}
        />
      ))}

      {frets.map((fret, index) => {
        const x = LEFT + CELL * index;
        return (
          <g key={index}>
            <line
              x1={x}
              y1={TOP}
              x2={x}
              y2={TOP + CELL * FRETS}
              className="stroke-border"
              strokeWidth={1}
            />

            {fret === null && (
              <text
                x={x}
                y={TOP - 5}
                textAnchor="middle"
                className="fill-text-muted font-mono text-[9px]"
              >
                ×
              </text>
            )}

            {fret === 0 && (
              <circle
                cx={x}
                cy={TOP - 8}
                r={3}
                className="stroke-text-muted fill-none"
                strokeWidth={1.2}
              />
            )}

            {fret !== null && fret > 0 && (
              <circle
                cx={x}
                cy={TOP + CELL * (fret - start) + CELL / 2}
                r={5}
                className="fill-brass-bright"
              />
            )}
          </g>
        );
      })}

      {start > 1 && (
        <text x={4} y={TOP + CELL / 2 + 3} className="fill-text-muted font-mono text-[9px]">
          {start}
        </text>
      )}

      <text
        x={WIDTH / 2}
        y={HEIGHT - 2}
        textAnchor="middle"
        className="fill-text-muted font-mono text-[8px]"
      >
        {text}
      </text>
    </svg>
  );
}
