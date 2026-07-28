import { meterOffset, METER_RANGE_CENTS, type TuningStatus } from './tuning';

export interface TuningMeterProps {
  readonly cents: number;
  readonly status: TuningStatus;
}

const TICKS = [-1, -0.5, 0, 0.5, 1];

/**
 * La aguja del afinador. Es decorativa: el dato lo llevan los números y el
 * texto de al lado, así que va oculta para el lector de pantalla.
 *
 * El movimiento es una transición CSS sobre transform, y la regla global de
 * prefers-reduced-motion la anula sin que este componente tenga que saberlo.
 */
export function TuningMeter({ cents, status }: TuningMeterProps) {
  const offset = meterOffset(cents);
  const needleColor = status === 'afinada' ? 'bg-tube-bright' : 'bg-brass-bright';

  return (
    <div aria-hidden="true" className="relative h-20 w-full max-w-md">
      <div className="border-border bg-surface absolute inset-x-0 top-6 h-8 rounded-md border" />

      {TICKS.map((tick) => (
        <div
          key={tick}
          className={`absolute top-6 h-8 w-px ${tick === 0 ? 'bg-brass' : 'bg-border'}`}
          style={{ left: `${50 + tick * 50}%` }}
        />
      ))}

      {/* El contenedor ocupa todo el ancho, así que desplazarlo un tanto por
          ciento mueve la aguja esa misma fracción de la escala. */}
      <div
        className="absolute inset-0 duration-100 ease-out"
        style={{ transform: `translateX(${offset * 50}%)`, transitionProperty: 'transform' }}
      >
        <div
          className={`absolute top-3 left-1/2 h-14 w-1 -translate-x-1/2 rounded-full ${needleColor}`}
        />
      </div>

      <div className="text-text-muted absolute inset-x-0 top-0 flex justify-between font-mono text-xs">
        <span>-{METER_RANGE_CENTS}</span>
        <span>0</span>
        <span>+{METER_RANGE_CENTS}</span>
      </div>
    </div>
  );
}
