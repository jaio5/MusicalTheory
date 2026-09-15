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
  parseProgress,
  practiceCompose,
  practiceReview,
  startAt,
  streakAfter,
  type BadgeId,
  type ComposeDeed,
  type Progress,
} from '@core/music';
import { useAccount } from '@state/account';
import { hechosDeComponer } from '@state/hechos-de-componer';
import { clearProgress, loadProgress, saveProgress, today as todayOf } from '@state/learn-progress';
import { useIsomorphicLayoutEffect } from '@ui/use-isomorphic-layout-effect';

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
 */

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
 * Lo que ha dado componer algo.
 *
 * Es hermano de `Celebration` y no lo mismo, a propósito: terminar una unidad
 * tiene un final y una pantalla, y componer no tiene final ninguno. Lo que se
 * puede enseñar sin estorbar es un aviso pequeño que aparece y se va, así que
 * esto lleva lo justo para escribirlo y nada de lo que pide una pantalla.
 *
 * `xp` puede venir a cero cuando el tope del día ya está lleno, y entonces no
 * hay nada que enseñar: se ha practicado igual y la racha lo recoge, pero un
 * «+0 XP» flotando en la pantalla solo sirve para recordarte un techo.
 */
export interface ComposeGain {
  readonly deed: ComposeDeed;
  readonly xp: number;
  readonly newBadges: readonly BadgeId[];
  readonly goalJustMet: boolean;
}

/** Lo que se le puede pedir al gancho. Hoy solo una cosa, y opcional. */
export interface ProgressOptions {
  /**
   * Si este gancho se apunta a los hechos de componer.
   *
   * Apagado por omisión **porque hay varias pantallas que llaman a `useProgress`
   * a la vez** —la cuenta, el camino, una unidad— y cada una tiene su copia del
   * avance. Con dos apuntados, guardar una canción sumaría dos veces y las dos
   * copias se pisarían al escribir. Lo enciende solo la pantalla donde se
   * compone.
   */
  readonly escuchaComponer?: boolean;
}

export function useProgress({ escuchaComponer = false }: ProgressOptions = {}) {
  const { signedIn, account } = useAccount();
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  // El día se lee aquí y no en el render por lo mismo: en servidor podría ser
  // otro, y la racha parpadearía al hidratar.
  const [day, setDay] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [composeGain, setComposeGain] = useState<ComposeGain | null>(null);

  const sincroniza = signedIn && can(account.plan, 'sincronizar');

  useIsomorphicLayoutEffect(() => {
    setProgress(loadProgress());
    setDay(todayOf());
    setLoaded(true);
  }, []);

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
      void fetch('/api/progreso', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: next }),
      })
        .then(async (response) => {
          if (!response.ok) {
            return;
          }
          const body = (await response.json()) as { progress?: unknown };
          const merged = parseProgress(body.progress);
          saveProgress(merged);
          setProgress(merged);
        })
        .catch(() => {
          // Sin red se queda lo de este navegador, que es lo que hay guardado.
          // La próxima subida lo arrastra: la fusión no depende de que esta haya
          // llegado.
        });
    },
    [sincroniza],
  );

  // La primera fusión, al entrar con cuenta. Sube lo que haya en este navegador y
  // se queda con lo que devuelva: es lo que hace que estudiar sin cuenta y
  // registrarse después no pierda nada.
  const fusionado = useRef(false);
  useEffect(() => {
    if (!loaded || !sincroniza || fusionado.current) {
      return;
    }
    fusionado.current = true;
    push(loadProgress());
  }, [loaded, sincroniza, push]);

  // Al salir de la cuenta se permite volver a fusionar cuando se entre otra vez.
  useEffect(() => {
    if (!sincroniza) {
      fusionado.current = false;
    }
  }, [sincroniza]);

  const complete = useCallback(
    (unitId: string, flawless: boolean) => {
      const hoy = todayOf();
      setProgress((current) => {
        const next = completeUnit(current, unitId, hoy, { flawless });
        if (next === current) {
          // Ya estaba hecha: se repasa cuantas veces se quiera, pero no vuelve a
          // sumar ni se celebra otra vez.
          return current;
        }

        setCelebration({
          unitId,
          title: findUnit(unitId)?.unit.title ?? '',
          xp: next.xp - current.xp,
          streak: next.streak,
          newBadges: next.badges.filter((badge) => !current.badges.includes(badge)),
          goalJustMet: isGoalMet(next, hoy) && !isGoalMet(current, hoy),
          flawless,
        });

        push(next);
        return next;
      });
    },
    [push],
  );

  /** Apunta un fallo para que la pregunta vuelva en el repaso. */
  const miss = useCallback((unitId: string, index: number) => {
    // No sube: un fallo no cambia el avance y subir por cada pregunta fallada
    // sería una petición por pulsación. Viaja con la siguiente unidad terminada.
    setProgress((current) => {
      const next = missQuestion(current, unitId, index, todayOf());
      saveProgress(next);
      return next;
    });
  }, []);

  /** Apunta un acierto en repaso. */
  const hit = useCallback((unitId: string, index: number) => {
    setProgress((current) => {
      const next = hitQuestion(current, unitId, index, todayOf());
      saveProgress(next);
      return next;
    });
  }, []);

  /** Cierra una sesión de repaso: suma a la meta del día y mantiene la racha. */
  const finishReview = useCallback(
    (cleared: boolean) => {
      const hoy = todayOf();
      setProgress((current) => {
        const next = practiceReview(current, hoy, { cleared });
        setCelebration({
          unitId: 'repaso',
          title: 'Repaso',
          xp: next.xpToday - (current.lastDay === hoy ? current.xpToday : 0),
          streak: next.streak,
          newBadges: next.badges.filter((badge) => !current.badges.includes(badge)),
          goalJustMet: isGoalMet(next, hoy) && !isGoalMet(current, hoy),
          flawless: cleared,
        });
        push(next);
        return next;
      });
    },
    [push],
  );

  /**
   * Apunta que se ha compuesto algo: suma a la meta del día y mantiene la racha.
   *
   * Sube igual que una unidad terminada, y no como un fallo apuntado: componer
   * sí cambia el avance —la racha, la meta, las medallas— y dejarlo solo en este
   * navegador lo perdería al abrir la aplicación en otro sitio. Son cuatro
   * subidas como mucho al día, que es lo que pone el tope.
   */
  const compose = useCallback(
    (deed: ComposeDeed) => {
      const hoy = todayOf();
      setProgress((current) => {
        const next = practiceCompose(current, hoy, deed);
        const ganado = next.xpToday - (current.lastDay === hoy ? current.xpToday : 0);

        // Con el tope lleno no se enseña nada: el hecho cuenta para la racha,
        // que ya está guardada, y un aviso de cero puntos solo sería un techo
        // recordándose a sí mismo.
        const nuevas = next.badges.filter((badge) => !current.badges.includes(badge));
        if (ganado > 0 || nuevas.length > 0) {
          setComposeGain({
            deed,
            xp: ganado,
            newBadges: nuevas,
            goalJustMet: isGoalMet(next, hoy) && !isGoalMet(current, hoy),
          });
        }

        push(next);
        return next;
      });
    },
    [push],
  );

  // Solo cuando se pide, y solo después de haber leído lo guardado: apuntarse
  // antes dejaría que un hecho muy temprano sumara sobre el avance vacío y luego
  // lo pisara la lectura del `localStorage`.
  useEffect(() => {
    if (!escuchaComponer || !loaded) {
      return;
    }
    return hechosDeComponer.suscribir(compose);
  }, [escuchaComponer, loaded, compose]);

  /** Mueve el punto de partida. No borra nada ni da nada por hecho. */
  const chooseStart = useCallback(
    (courseId: string | null) => {
      setProgress((current) => {
        const next = startAt(current, courseId);
        if (next !== current) {
          push(next);
        }
        return next;
      });
    },
    [push],
  );

  const reset = useCallback(() => {
    clearProgress();
    setProgress(EMPTY_PROGRESS);
    setCelebration(null);
    setComposeGain(null);
  }, []);

  return {
    progress,
    loaded,
    day,
    /** La racha que tendría si practicase ahora mismo. La usa la celebración. */
    streakIfPracticed: day === null ? 1 : streakAfter(progress, day),
    goal: DAILY_GOAL_XP,
    celebration,
    dismissCelebration: useCallback(() => setCelebration(null), []),
    composeGain,
    dismissComposeGain: useCallback(() => setComposeGain(null), []),
    compose,
    complete,
    miss,
    hit,
    finishReview,
    chooseStart,
    reset,
    syncing: sincroniza,
  };
}
