import type { ReactNode } from 'react';

/**
 * Un anillo que dice cuánto llevas hecho.
 *
 * SVG a mano y no una librería de gráficos: es un círculo con el trazo cortado.
 * El truco es `strokeDasharray` con la circunferencia entera y `strokeDashoffset`
 * con lo que falta.
 *
 * Estaba escrito dentro de la meta diaria y ahora lo usan dos sitios —la meta y
 * cada curso del camino—, así que sube a `ui/`: dos copias de un anillo acaban
 * girando en sentidos distintos.
 *
 * Empieza arriba y no a la derecha, que es donde empieza un círculo en SVG: un
 * cuarto de vuelta de giro. Y crece con una transición de 400 ms, lo justo para
 * que se vea que ha subido al terminar una unidad.
 */
export function ProgressRing({
  part,
  label,
  size = 64,
  ancho = 5,
  children,
}: {
  /** De 0 a 1. Lo que se salga se recorta. */
  readonly part: number;
  /** Qué es esto, para quien no ve la pantalla. */
  readonly label: string;
  readonly size?: number;
  readonly ancho?: number;
  /** Lo que va dentro del anillo: un número, una marca. */
  readonly children?: ReactNode;
}) {
  const hecho = Math.max(0, Math.min(1, part));
  const centro = size / 2;
  const radio = centro - ancho / 2 - 1;
  const vuelta = 2 * Math.PI * radio;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <g transform={`rotate(-90 ${centro} ${centro})`}>
          <circle
            cx={centro}
            cy={centro}
            r={radio}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth={ancho}
          />
          <circle
            cx={centro}
            cy={centro}
            r={radio}
            fill="none"
            stroke="currentColor"
            className={hecho >= 1 ? 'text-tube-bright' : 'text-brass-bright'}
            strokeWidth={ancho}
            strokeLinecap="round"
            strokeDasharray={vuelta}
            strokeDashoffset={vuelta * (1 - hecho)}
            style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
          />
        </g>
      </svg>
      {children !== undefined && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-mono text-sm"
        >
          {children}
        </span>
      )}
    </div>
  );
}
