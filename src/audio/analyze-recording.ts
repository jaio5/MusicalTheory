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

import { acordesDeGrabacion, type AnalisisOptions } from './offline-chords';
import type { Recording } from './recorder';

interface RespuestaDelWorker {
  readonly ok: boolean;
  readonly acordes: CapturedChord[];
}

/**
 * Cuánto se espera al worker antes de rendirse y calcularlo aquí.
 *
 * Generoso: dos minutos de grabación en un móvil lento pueden ser diez segundos.
 * Esto no es un tope de calidad, es la red por si el worker no contesta nunca.
 */
const ESPERA_MAXIMA_MS = 30_000;

export async function analizarGrabacion(
  grabacion: Recording,
  options: Omit<AnalisisOptions, 'sampleRate'> = {},
): Promise<CapturedChord[]> {
  const opciones: AnalisisOptions = { ...options, sampleRate: grabacion.sampleRate };

  const enWorker = await intentarEnWorker(grabacion.samples, opciones);
  if (enWorker !== null) {
    return enWorker;
  }
  return acordesDeGrabacion(grabacion.samples, opciones);
}

async function intentarEnWorker(
  samples: Float32Array<ArrayBuffer>,
  options: AnalisisOptions,
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
      const reloj = setTimeout(() => resolver(null), ESPERA_MAXIMA_MS);

      worker.addEventListener('message', (evento: MessageEvent<RespuestaDelWorker>) => {
        clearTimeout(reloj);
        resolver(evento.data.ok ? evento.data.acordes : null);
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
