import { IN_TUNE_CENTS, meterOffset, METER_RANGE_CENTS, type TuningStatus } from './tuning';

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
    // Más alta y más ancha que antes: es lo que se mira de reojo mientras se
    // gira la clavija, y competía en tamaño con dos desplegables. Un afinador se
    // lee a un metro.
    <div aria-hidden="true" className="relative h-28 w-full max-w-xl">
      <div className="border-border bg-surface absolute inset-x-0 top-7 h-14 rounded-md border" />

      {/*
        La franja del centro: **dónde hay que dejar la aguja**.

        Sin ella, la escala dice dónde estás pero no adónde vas: hay que leer los
        números, calcular si cinco cents es mucho o poco y decidir. Con la franja
        se afina mirando, que es lo que se hace de reojo con la mano en la
        clavija. Se enciende en verde en cuanto la aguja entra, y ese cambio de
        color es la respuesta antes que ninguna palabra.

        Mide lo que mide la tolerancia de verdad —`IN_TUNE_CENTS` sobre el rango
        de la escala—, no un ancho a ojo: si algún día se aprieta a tres cents, la
        franja se estrecha sola.
      */}
      <div
        className={`absolute top-7 h-14 transition-colors duration-150 ${
          status === 'afinada' ? 'bg-tube/40' : 'bg-brass-dim/20'
        }`}
        style={{
          left: `${50 - (IN_TUNE_CENTS / METER_RANGE_CENTS) * 50}%`,
          width: `${(IN_TUNE_CENTS / METER_RANGE_CENTS) * 100}%`,
        }}
      />

      {TICKS.map((tick) => (
        <div
          key={tick}
          className={`absolute top-7 h-14 ${tick === 0 ? 'bg-brass w-0.5' : 'bg-border w-px'}`}
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
          className={`absolute top-4 left-1/2 h-20 w-1.5 -translate-x-1/2 rounded-full ${needleColor}`}
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
