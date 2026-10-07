import { parseProgress, type Progress } from '@core/music';
import { saveProgress } from '@state/learn-progress';

/**
 * Sube el avance y guarda en el equipo la fusión que devuelva el servidor.
 *
 * Vive fuera de `useProgress` porque lo usan dos sitios que no pueden
 * compartir gancho: el avance entero, en las pantallas de aprender, y la suma
 * de componer, que se carga aparte para no llevarse el temario a `/componer`
 * (`sumar-al-componer.ts`).
 *
 * Devuelve la fusión, o nulo si no llegó: sin red o con un error del servidor
 * se queda lo de este navegador, que es lo que ya hay guardado. La próxima
 * subida lo arrastra, porque la fusión no depende de que esta haya llegado.
 */
export async function subirAvance(next: Progress): Promise<Progress | null> {
  try {
    const response = await fetch('/api/progreso', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: next }),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { progress?: unknown };
    const merged = parseProgress(body.progress);
    saveProgress(merged);
    return merged;
  } catch {
    return null;
  }
}
