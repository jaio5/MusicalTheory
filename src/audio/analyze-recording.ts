/**
 * Analizar una grabación, en un worker si se puede y aquí mismo si no.
 *
 * El respaldo no es pereza: es lo que hace que esto no dependa de que el
 * empaquetador sepa construir el worker. Si algo falla al crearlo —o si esto
 * corre en un test, donde no hay `Worker`—, se calcula en el hilo y ya está.
 * Tarda lo mismo; lo único que se pierde es que la pantalla no se congele.
 *
 * Y por eso las muestras se copian en vez de cederse: un buffer transferido deja
 * el original vacío, y el respaldo analizaría silencio.
 */

import type { CapturedChord } from '@core/music';

import { chordsOfRecording, type AnalysisOptions } from './offline-chords';
import type { Recording } from './recorder';

interface WorkerAnswer {
  readonly ok: boolean;
  readonly chords: CapturedChord[];
}

/**
 * Cuánto se espera al worker antes de rendirse y calcularlo aquí.
 *
 * Generoso: dos minutos de grabación en un móvil lento pueden ser diez segundos.
 * Esto no es un tope de calidad, es la red por si el worker no contesta nunca.
 */
const MAX_WAIT_MS = 30_000;

export async function analyzeRecording(
  recording: Recording,
  options: Omit<AnalysisOptions, 'sampleRate'> = {},
): Promise<CapturedChord[]> {
  const settings: AnalysisOptions = { ...options, sampleRate: recording.sampleRate };

  const inWorker = await tryInWorker(recording.samples, settings);
  if (inWorker !== null) {
    return inWorker;
  }
  return chordsOfRecording(recording.samples, settings);
}

async function tryInWorker(
  samples: Float32Array<ArrayBuffer>,
  options: AnalysisOptions,
): Promise<CapturedChord[] | null> {
  if (typeof Worker === 'undefined') {
    return null;
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('./analizador.worker.ts', import.meta.url));
  } catch {
    return null;
  }

  try {
    return await new Promise<CapturedChord[] | null>((resolver) => {
      const reloj = setTimeout(() => resolver(null), MAX_WAIT_MS);

      worker.addEventListener('message', (evento: MessageEvent<WorkerAnswer>) => {
        clearTimeout(reloj);
        resolver(evento.data.ok ? evento.data.chords : null);
      });
      worker.addEventListener('error', () => {
        clearTimeout(reloj);
        resolver(null);
      });

      // **Se copia, no se cede.** Ceder el buffer ahorraría copiar 34 MB —unos
      // veinte milisegundos— pero deja el array de aquí vacío, y entonces el
      // respaldo de abajo analizaría silencio si el worker fallara después de
      // arrancar. Veinte milisegundos no valen ese fallo.
      worker.postMessage({ samples, options });
    });
  } finally {
    worker.terminate();
  }
}
