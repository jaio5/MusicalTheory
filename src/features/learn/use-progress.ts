'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { can } from '@core/billing';
import {
  completeUnit,
  DAILY_GOAL_XP,
  EMPTY_PROGRESS,
  findUnit,
  hitQuestion,
  isGoalMet,
  missQuestion,
  practiceReview,
  startAt,
  streakAfter,
  type BadgeId,
  type Progress,
} from '@core/music';
import { useAccount } from '@state/account';
import { clearProgress, loadProgress, saveProgress, today as todayOf } from '@state/learn-progress';
import { useIsomorphicLayoutEffect } from '@ui/use-isomorphic-layout-effect';

import { subirAvance } from './subir-avance';

/**
 * El avance: leído del equipo, guardado en cuanto cambia y sincronizado con la
 * cuenta si el plan lo incluye.
 *
 * Empieza vacío y se rellena en el primer efecto, no durante el render: en
 * servidor no hay `localStorage`, y leerlo mientras se renderiza daría un HTML
 * distinto al del cliente. El precio es un primer fotograma con todo a cero.
 *
 * **El navegador sigue siendo la copia de trabajo, también con cuenta.** Se
 * escribe siempre en `localStorage` primero y se sube después: así terminar una
 * unidad no espera a la red, y una unidad terminada en un túnel no se pierde. La
 * subida es una fusión en el servidor, así que da igual cuántas veces se repita ni
 * en qué orden lleguen dos aparatos.
 *
 * **Lo que se hace al componer no pasa por aquí**: lo lleva
 * `useGananciaAlComponer`, que no arrastra el temario a `/componer`.
 */

/**
 * Lo que cambió entre dos avances: lo que la pantalla de final celebra.
 *
 * **Las medallas nuevas y la meta recién cerrada se calculaban dos veces**, al
 * terminar una unidad y al cerrar un repaso, con las mismas cuatro líneas. Dos
 * copias de «qué ha cambiado» son dos sitios donde una celebración empiece a
 * contar otra cosa que la otra.
 */
function loQueCambio(
  current: Progress,
  next: Progress,
  hoy: string,
): Pick<Celebration, 'streak' | 'newBadges' | 'goalJustMet'> {
  return {
    streak: next.streak,
    newBadges: next.badges.filter((badge) => !current.badges.includes(badge)),
    /* v8 ignore next -- la meta no se cierra dos veces el mismo dia: al segundo, `next` ya estaba cerrada */
    goalJustMet: isGoalMet(next, hoy) && !isGoalMet(current, hoy),
  };
}

/** Lo que ha cambiado al terminar algo. Es lo que cuenta la pantalla de final. */
export interface Celebration {
  readonly unitId: string;
  readonly title: string;
  readonly xp: number;
  readonly streak: number;
  readonly newBadges: readonly BadgeId[];
  /** Si la meta del día se ha cerrado justo ahora. */
  readonly goalJustMet: boolean;
  readonly flawless: boolean;
}

/**
 * Las cuentas con las que ya se ha hecho la fusión de entrada en esta carga de
 * la página.
 *
 * **Es del módulo y no de cada gancho** porque hay cuatro pantallas que llaman a
 * `useProgress`, y con una marca por instancia cada una que se montaba subía el
 * avance otra vez: entrar al camino, abrir una unidad y volver eran tres `PUT`
 * con lo mismo. La fusión es idempotente, así que no rompía nada, pero la de
 * entrada solo hace falta una vez por cuenta. Se vacía al salir de la cuenta,
 * para que volver a entrar suba lo que se hiciera mientras tanto sin ella.
 */
const fusionados = new Set<string | null>();

export function useProgress() {
  const { signedIn, account } = useAccount();
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  // El día se lee aquí y no en el render por lo mismo: en servidor podría ser
  // otro, y la racha parpadearía al hidratar.
  const [day, setDay] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const sincroniza = signedIn && can(account.plan, 'sincronizar');

  /**
   * El avance de ahora, para calcular el siguiente **fuera** de `setProgress`.
   *
   * Un actualizador de estado tiene que ser puro: en `StrictMode` React lo
   * ejecuta dos veces para destapar justo esto, y aquí dentro se subía al
   * servidor, se guardaba y se celebraba. Eran dos `PUT` por unidad terminada.
   * La referencia se cambia a la vez que el estado, así que dos llamadas
   * seguidas en el mismo tick encadenan bien sin esperar al render.
   */
  const actual = useRef<Progress>(EMPTY_PROGRESS);
  const cambiar = useCallback((next: Progress) => {
    actual.current = next;
    setProgress(next);
  }, []);

  useIsomorphicLayoutEffect(() => {
    cambiar(loadProgress());
    setDay(todayOf());
    setLoaded(true);
  }, [cambiar]);

  /**
   * Guarda en el equipo y, si hay con qué, sube.
   *
   * Lo que vuelve del servidor es la fusión, y es la que se queda: si en otro
   * aparato se hicieron dos unidades más, aparecen aquí sin recargar.
   */
  const push = useCallback(
    (next: Progress) => {
      saveProgress(next);
      if (!sincroniza) {
        return;
      }
      void subirAvance(next).then((merged) => {
        if (merged !== null) {
          cambiar(merged);
        }
      });
    },
    [sincroniza, cambiar],
  );

  // La primera fusión, al entrar con cuenta. Sube lo que haya en este navegador y
  // se queda con lo que devuelva: es lo que hace que estudiar sin cuenta y
  // registrarse después no pierda nada.
  const cuenta = account.email;
  useEffect(() => {
    if (!signedIn) {
      fusionados.clear();
      return;
    }
    if (!loaded || !sincroniza || fusionados.has(cuenta)) {
      return;
    }
    fusionados.add(cuenta);
    push(loadProgress());
  }, [loaded, signedIn, sincroniza, cuenta, push]);

  const complete = useCallback(
    (unitId: string, flawless: boolean) => {
      const hoy = todayOf();
      const current = actual.current;
      const next = completeUnit(current, unitId, hoy, { flawless });
      if (next === current) {
        // Ya estaba hecha: se repasa cuantas veces se quiera, pero no vuelve a
        // sumar ni se celebra otra vez.
        return;
      }
      cambiar(next);
      setCelebration({
        unitId,
        /* v8 ignore next -- solo se completa una unidad que existe: se llega a ella desde el temario */
        title: findUnit(unitId)?.unit.title ?? '',
        xp: next.xp - current.xp,
        ...loQueCambio(current, next, hoy),
        flawless,
      });
      push(next);
    },
    [cambiar, push],
  );

  /** Apunta un fallo para que la pregunta vuelva en el repaso. */
  const miss = useCallback(
    (unitId: string, index: number) => {
      // No sube: un fallo no cambia el avance y subir por cada pregunta fallada
      // sería una petición por pulsación. Viaja con la siguiente unidad terminada.
      const next = missQuestion(actual.current, unitId, index, todayOf());
      cambiar(next);
      saveProgress(next);
    },
    [cambiar],
  );

  /** Apunta un acierto en repaso. */
  const hit = useCallback(
    (unitId: string, index: number) => {
      const next = hitQuestion(actual.current, unitId, index, todayOf());
      cambiar(next);
      saveProgress(next);
    },
    [cambiar],
  );

  /** Cierra una sesión de repaso: suma a la meta del día y mantiene la racha. */
  const finishReview = useCallback(
    (cleared: boolean) => {
      const hoy = todayOf();
      const current = actual.current;
      const next = practiceReview(current, hoy, { cleared });
      cambiar(next);
      setCelebration({
        unitId: 'repaso',
        title: 'Repaso',
        // Lo ganado ayer no se resta: `xpToday` es del último día con actividad, y
        // se repasa el primer día después de fallar, cuando ese día es otro.
        xp: next.xpToday - (current.lastDay === hoy ? current.xpToday : 0),
        ...loQueCambio(current, next, hoy),
        flawless: cleared,
      });
      push(next);
    },
    [cambiar, push],
  );

  /** Mueve el punto de partida. No borra nada ni da nada por hecho. */
  const chooseStart = useCallback(
    (courseId: string | null) => {
      const current = actual.current;
      // El instante de ahora, que es lo que hace que la fusión respete lo
      // último que has dicho en vez de quedarse con lo que más camino abría.
      const next = startAt(current, courseId, new Date().toISOString());
      if (next === current) {
        return;
      }
      cambiar(next);
      push(next);
    },
    [cambiar, push],
  );

  const reset = useCallback(() => {
    clearProgress();
    cambiar(EMPTY_PROGRESS);
    setCelebration(null);
  }, [cambiar]);

  return {
    progress,
    loaded,
    day,
    /** La racha que tendría si practicase ahora mismo. La usa la celebración. */
    streakIfPracticed: day === null ? 1 : streakAfter(progress, day),
    goal: DAILY_GOAL_XP,
    celebration,
    dismissCelebration: useCallback(() => setCelebration(null), []),
    complete,
    miss,
    hit,
    finishReview,
    chooseStart,
    reset,
    syncing: sincroniza,
  };
}
