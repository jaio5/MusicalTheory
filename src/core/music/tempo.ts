/**
 * El tempo: pulsos por minuto y lo que se deduce de ellos.
 *
 * Está en core/ y no en el metrónomo porque es aritmética musical pura y se
 * prueba sin audio: cuánto dura un pulso, qué velocidades tienen sentido y qué
 * tempo llevas cuando lo marcas con el dedo.
 */

/** Por debajo no es un pulso, es esperar; por encima no se sigue con la mano. */
export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 100;

/** Compases que se pueden marcar. El primero de cada uno suena distinto. */
export const BEATS_PER_BAR: readonly number[] = [1, 2, 3, 4, 6];
export const DEFAULT_BEATS_PER_BAR = 4;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) {
    return DEFAULT_BPM;
  }
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function msPerBeat(bpm: number): number {
  return 60_000 / clampBpm(bpm);
}

/** Cuántos golpes hacen falta para fiarse de lo que se está marcando. */
const MIN_TAPS = 3;
/** Más de esto entre dos golpes y es que has empezado de nuevo. */
const MAX_GAP_MS = 2_500;

/**
 * El tempo que estás marcando con el dedo.
 *
 * Se queda con la racha final —desde el último silencio largo— y promedia sus
 * huecos. Con menos de tres golpes devuelve null: dos golpes dan un número,
 * pero no dan un tempo, y enseñarlo sería fingir precisión.
 */
export function bpmFromTaps(times: readonly number[]): number | null {
  const recent: number[] = [];
  for (let index = times.length - 1; index > 0; index -= 1) {
    const gap = times[index]! - times[index - 1]!;
    if (gap <= 0 || gap > MAX_GAP_MS) {
      break;
    }
    recent.unshift(gap);
  }

  if (recent.length < MIN_TAPS - 1) {
    return null;
  }

  const average = recent.reduce((total, gap) => total + gap, 0) / recent.length;
  return clampBpm(60_000 / average);
}
