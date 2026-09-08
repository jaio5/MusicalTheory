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
 * Se dibuja a un tamaño al que se lee de un vistazo desde la distancia a la que
 * se está con la guitarra puesta, que es más lejos de la pantalla de lo normal.
 *
 * Va marcado como imagen con su descripción: quien no lo ve necesita la
 * digitación en texto, no seis líneas y unos círculos.
 *
 * **Debajo de la rejilla hay un trozo de mástil**, y no es adorno: sin él, seis
 * de estos seguidos son una tabla de contabilidad sobre el fondo de la página.
 * Con el fondo un punto más claro y las esquinas redondeadas, cada uno se lee
 * como una pieza —lo que es— y la fila entera se recorre de un vistazo.
 */
export function ChordDiagram({ frets, position, label }: ChordDiagramProps) {
  // Si el acorde está más arriba del mástil se dibuja una ventana de cuatro
  // trastes y se numera, en vez de pintar doce trastes vacíos.
  const start = position <= 1 ? 1 : position;
  const text = frets.map((fret) => (fret === null ? 'x' : fret)).join('');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full max-w-[152px] min-w-[132px]"
      role="img"
      aria-label={`${label}: ${text}`}
    >
      {/* El trozo de mástil sobre el que se dibuja todo. Sobresale medio hueco a
          los lados para que las cuerdas de fuera no queden en el canto. */}
      <rect
        x={LEFT - CELL / 2}
        y={TOP}
        width={CELL * (STRINGS - 1) + CELL}
        height={CELL * FRETS}
        rx={3}
        className="fill-surface-raised"
      />

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
              // El dedo, con su aro del color del mástil: sobre una línea de
              // traste, un círculo liso se funde con ella y parece un nudo.
              <circle
                cx={x}
                cy={TOP + CELL * (fret - start) + CELL / 2}
                r={5}
                className="fill-brass-bright stroke-surface-raised"
                strokeWidth={1.5}
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
