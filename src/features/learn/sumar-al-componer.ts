import { badgesOf, isGoalMet, practiceCompose, type ComposeDeed } from '@core/music';
import { loadProgress, saveProgress } from '@state/learn-progress';

import { subirAvance } from './subir-avance';
import type { ComposeGain } from './use-ganancia-al-componer';

/**
 * Apunta en el avance que se ha compuesto algo, y dice qué ha dado.
 *
 * **Se carga cuando llega el primer hecho, no con la pantalla.** Leer el avance
 * guardado pasa por `parseProgress`, que valida contra el temario entero —los
 * nombres de todas las unidades—, y `/componer` no enseña ni una. Con esto en el
 * gancho, cada visita a componer se descargaba el temario por si acaso se
 * guardaba una canción (`use-ganancia-al-componer.ts`).
 *
 * **Lee del equipo cada vez**, y no de una copia en memoria: componer no pinta
 * el avance, así que no hay nada que tener al día, y leer justo antes de sumar
 * es lo que evita pisar lo que otra pestaña haya guardado mientras tanto.
 *
 * Devuelve nulo cuando no hay nada que enseñar: con el tope del día lleno el
 * hecho cuenta para la racha, que ya queda guardada, y un «+0 XP» solo sería un
 * techo recordándose a sí mismo.
 */
export function sumarAlComponer(
  deed: ComposeDeed,
  hoy: string,
  sincroniza: boolean,
): ComposeGain | null {
  const current = loadProgress();
  const next = practiceCompose(current, hoy, deed);
  saveProgress(next);
  if (sincroniza) {
    void subirAvance(next);
  }

  const xp = next.xpToday - (current.lastDay === hoy ? current.xpToday : 0);
  const newBadges = next.badges.filter((badge) => !current.badges.includes(badge));
  if (xp <= 0 && newBadges.length === 0) {
    return null;
  }
  return {
    deed,
    xp,
    newBadges: badgesOf(newBadges),
    goalJustMet: isGoalMet(next, hoy) && !isGoalMet(current, hoy),
  };
}
