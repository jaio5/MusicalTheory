'use client';

import { useCallback, useEffect, useState } from 'react';

import { can } from '@core/billing';
import type { Badge, ComposeDeed } from '@core/music';
import { useAccount } from '@state/account';
import { hechosDeComponer } from '@state/hechos-de-componer';
import { today as todayOf } from '@state/hoy';

/**
 * Lo que ha dado componer algo.
 *
 * Es hermano de `Celebration` y no lo mismo, a propósito: terminar una unidad
 * tiene un final y una pantalla, y componer no tiene final ninguno. Lo que se
 * puede enseñar sin estorbar es un aviso pequeño que aparece y se va, así que
 * esto lleva lo justo para escribirlo y nada de lo que pide una pantalla.
 *
 * `xp` puede venir a cero cuando el tope del día ya está lleno pero ha salido
 * una medalla: lo que se enseña entonces es la medalla.
 */
export interface ComposeGain {
  readonly deed: ComposeDeed;
  readonly xp: number;
  /**
   * Las medallas ya resueltas, con su nombre, y no sus identificadores: quien
   * traduce un identificador a medalla es `badgesOf`, que vive junto al temario,
   * y el aviso que las pinta va en `/componer` desde el principio. Resolverlas
   * aquí lo dejaba entrar por la puerta de atrás.
   */
  readonly newBadges: readonly Badge[];
  readonly goalJustMet: boolean;
}

/**
 * Lo que ha dado componer, para el aviso de la esquina. Es lo único del avance
 * que `/componer` necesita.
 *
 * **Salió de `useProgress` por lo que pesaba.** Aquel gancho sabe terminar
 * unidades, mover el punto de partida y validar lo guardado contra el temario,
 * así que montarlo en componer traía los títulos de todas las unidades para no
 * enseñar ninguna. Esto se apunta a los hechos y, cuando llega uno, pide la
 * suma a `sumar-al-componer.ts` con un `import()`: el temario viaja la primera
 * vez que se guarda algo, no cada vez que se abre la pantalla.
 *
 * **Uno solo por pantalla**, igual que antes lo era `escuchaComponer`: dos
 * apuntados sumarían el mismo hecho dos veces. Solo lo monta `ComposeScreen`.
 */
export function useGananciaAlComponer() {
  const { signedIn, account } = useAccount();
  const sincroniza = signedIn && can(account.plan, 'sincronizar');
  const [composeGain, setComposeGain] = useState<ComposeGain | null>(null);

  useEffect(
    () =>
      hechosDeComponer.suscribir((deed) => {
        // El día se lee al pasar, no al montar: una pantalla abierta desde
        // ayer tiene que sumar a la meta de hoy.
        const hoy = todayOf();
        void import('./sumar-al-componer').then(({ sumarAlComponer }) => {
          const ganancia = sumarAlComponer(deed, hoy, sincroniza);
          if (ganancia !== null) {
            setComposeGain(ganancia);
          }
        });
      }),
    [sincroniza],
  );

  return {
    composeGain,
    dismissComposeGain: useCallback(() => setComposeGain(null), []),
  };
}
