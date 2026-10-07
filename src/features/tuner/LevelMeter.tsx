import { DEFAULT_PITCH_ENGINE_OPTIONS } from '@audio/pitch-engine';
import { useEffect, useRef, useState } from 'react';

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

/**
 * Cada cuánto se reescriben el número y el valor que lee el lector de pantalla.
 *
 * El nivel llega veinte veces por segundo. La barra puede seguirlo, porque se
 * mueve con `transform` y eso no recoloca nada; el texto no: cambiarlo es
 * volver a medir la línea, y a veinte por segundo se iban entre 17 y 39 ms de
 * cada segundo en recolocar la pantalla. Además, un número que cambia veinte
 * veces no se lee, y un `aria-valuenow` que cambia veinte veces es ruido. A
 * cuatro por segundo se lee y sigue pareciendo vivo.
 */
export const REFRESCO_DEL_NUMERO_MS = 250;

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
 *
 * **No escribe ninguna frase.** Llevaba la suya —«llega poca señal» o «llega señal
 * de sobra»— y se turnaba con el aviso de debajo de la nota, que dice otra cosa de
 * la misma señal: dos avisos a la vez, y el suyo cambiaba cada ~700 ms al rondar
 * el umbral. El único aviso de nivel lo decide `Tuner`, con histéresis
 * ([adr/0061](../../../docs/adr/0061-el-afinador-no-se-mueve-mientras-escucha.md)).
 */
export function LevelMeter({ rms }: LevelMeterProps) {
  const percent = levelToPercent(rms);
  const attack = levelToPercent(DEFAULT_PITCH_ENGINE_OPTIONS.rmsThreshold);
  const release = levelToPercent(DEFAULT_PITCH_ENGINE_OPTIONS.releaseRmsThreshold);
  const enough = rms >= DEFAULT_PITCH_ENGINE_OPTIONS.rmsThreshold;

  /*
    El nivel que se escribe, que va por detrás del que se pinta.

    Se queda con **el último** que llegó en cada tramo y no con el primero: si no,
    al callar la guitarra el número se quedaría en el penúltimo nivel. Cada
    lectura nueva cancela la espera y vuelve a ponerla contando desde el último
    refresco, no desde ahora, así que un chorro continuo no la aplaza nunca.
  */
  const [escrito, setEscrito] = useState(rms);
  const ultimoRefrescoRef = useRef(0);
  useEffect(() => {
    if (rms === escrito) {
      return;
    }
    const espera = Math.max(
      0,
      ultimoRefrescoRef.current + REFRESCO_DEL_NUMERO_MS - performance.now(),
    );
    const temporizador = setTimeout(() => {
      ultimoRefrescoRef.current = performance.now();
      setEscrito(rms);
    }, espera);
    return () => clearTimeout(temporizador);
  }, [rms, escrito]);

  return (
    <div className="w-full">
      {/* El rótulo en la sans y el número en monoespaciada: el rótulo es
          interfaz y los decibelios son un dato que salta de golpe entre −45 y
          −12, así que sin ancho fijo la línea baila. */}
      <div className="text-text-muted flex items-baseline justify-between text-xs">
        <span>Nivel de entrada</span>
        <span className="font-mono tabular-nums">
          {escrito <= 0 ? '—' : `${(20 * Math.log10(escrito)).toFixed(0)} dB`}
        </span>
      </div>

      <div
        className="border-border bg-background relative mt-1 h-3 w-full overflow-hidden rounded-full border"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(levelToPercent(escrito))}
        aria-label="Nivel de la señal que entra"
      >
        {/* **Se escala, no se ensancha.** Con `width` cada lectura recolocaba la
            página entera; `scaleX` lo resuelve el compositor sin tocar el
            reparto, y la transición se queda igual de suave. */}
        <div
          className={`h-full w-full origin-left transition-transform duration-100 ${enough ? 'bg-tube' : 'bg-brass'}`}
          style={{ transform: `scaleX(${percent / 100})` }}
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
    </div>
  );
}
