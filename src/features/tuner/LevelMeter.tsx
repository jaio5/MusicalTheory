import { DEFAULT_PITCH_ENGINE_OPTIONS } from '@audio/pitch-engine';

export interface LevelMeterProps {
  /** Valor eficaz de la señal, de 0 a 1. */
  readonly rms: number;
}

/**
 * Escala del medidor. El nivel de una guitarra limpia vive entre 0,001 y 0,2,
 * así que en lineal no se vería nada: se pinta en decibelios, que es como se
 * mide el sonido en todas partes.
 */
const MIN_DB = -60;
const MAX_DB = 0;

export function levelToPercent(rms: number): number {
  if (rms <= 0) {
    return 0;
  }
  const db = 20 * Math.log10(rms);
  return Math.max(0, Math.min(100, ((db - MIN_DB) / (MAX_DB - MIN_DB)) * 100));
}

/**
 * Medidor de entrada con los dos umbrales marcados: el de enganche y el de
 * seguimiento. Sirve para ver de un vistazo si la señal llega corta, que es
 * justo lo que no se podía saber antes de esto.
 */
export function LevelMeter({ rms }: LevelMeterProps) {
  const percent = levelToPercent(rms);
  const attack = levelToPercent(DEFAULT_PITCH_ENGINE_OPTIONS.rmsThreshold);
  const release = levelToPercent(DEFAULT_PITCH_ENGINE_OPTIONS.releaseRmsThreshold);
  const enough = rms >= DEFAULT_PITCH_ENGINE_OPTIONS.rmsThreshold;

  return (
    <div className="w-full">
      <div className="text-text-muted flex items-baseline justify-between font-mono text-xs">
        <span>Nivel de entrada</span>
        <span>{rms <= 0 ? '—' : `${(20 * Math.log10(rms)).toFixed(0)} dB`}</span>
      </div>

      <div
        className="border-border bg-background relative mt-1 h-3 w-full overflow-hidden rounded-full border"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="Nivel de la señal que entra"
      >
        <div
          className={`h-full transition-[width] duration-100 ${
            enough ? 'bg-tube' : 'bg-brass-dim'
          }`}
          style={{ width: `${percent}%` }}
        />
        <span
          aria-hidden="true"
          title="Umbral para seguir una nota ya enganchada"
          className="bg-text-muted absolute inset-y-0 w-px"
          style={{ left: `${release}%` }}
        />
        <span
          aria-hidden="true"
          title="Umbral para enganchar una nota nueva"
          className="bg-brass-bright absolute inset-y-0 w-px"
          style={{ left: `${attack}%` }}
        />
      </div>

      <p className="text-text-muted mt-1 text-xs">
        {enough
          ? 'Llega señal de sobra para enganchar la nota.'
          : 'Llega poca señal: sube el volumen de la guitarra o la ganancia de entrada.'}
      </p>
    </div>
  );
}
