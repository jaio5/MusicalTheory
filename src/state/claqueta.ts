'use client';

/**
 * El clic de la toma: cuánto suena, si suena, y si hay una toma sonando.
 *
 * Desde que la claqueta sigue durante la toma
 * ([adr/0053](../../docs/adr/0053-la-claqueta-cuenta-y-se-calla.md) la callaba)
 * hace falta poder bajarla y quitarla: con auriculares sobra la mitad del
 * volumen, y hay quien prefiere tocar sin pulso aunque la rejilla lo pierda.
 * **Quitarla no para el pulso**: el metrónomo sigue contando en silencio, y la
 * transcripción sigue sabiendo dónde cae cada compás.
 *
 * Vive en `state/` porque lo leen dos piezas que no se conocen: la toma, que
 * pone el clic, y el metrónomo de la barra, que **se aparta mientras hay toma**
 * —dos metrónomos a la vez son dos pulsos que no coinciden— y no deja cambiar el
 * tempo a mitad, que dejaría la rejilla de lo grabado en un tempo y lo tocado en
 * otro.
 *
 * El volumen y el silencio se recuerdan en el navegador: es una preferencia de
 * quien toca, como el tema. Si el navegador no deja guardar, se olvida y ya.
 */

import { create } from 'zustand';

export const CLAVE_CLAQUETA = 'caos-ordenado:claqueta';

/** El de partida: fuerte, pero no al máximo, que con el micro al lado molesta. */
export const VOLUMEN_DE_PARTIDA = 0.8;

export interface EstadoDeLaClaqueta {
  /** De 0 a 1. */
  readonly volumen: number;
  /** Si se ha quitado. No toca el volumen, para volver a él al ponerlo. */
  readonly callada: boolean;
  /** Si hay una toma con su clic sonando: el metrónomo de la barra se aparta. */
  readonly enLaToma: boolean;
  readonly acciones: {
    readonly ponerVolumen: (volumen: number) => void;
    readonly callar: (callada: boolean) => void;
    readonly marcarToma: (enLaToma: boolean) => void;
  };
}

/** Lo que llega al metrónomo: cero si está callada. */
export function volumenQueSuena(estado: Pick<EstadoDeLaClaqueta, 'volumen' | 'callada'>): number {
  return estado.callada ? 0 : estado.volumen;
}

function acotar(volumen: number): number {
  return Number.isFinite(volumen) ? Math.min(1, Math.max(0, volumen)) : VOLUMEN_DE_PARTIDA;
}

function leerGuardado(): Pick<EstadoDeLaClaqueta, 'volumen' | 'callada'> {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CLAQUETA) ?? 'null') as {
      volumen?: unknown;
      callada?: unknown;
    } | null;
    return {
      volumen:
        typeof guardado?.volumen === 'number' ? acotar(guardado.volumen) : VOLUMEN_DE_PARTIDA,
      callada: guardado?.callada === true,
    };
  } catch {
    // Sin `localStorage` —el servidor, una ventana privada estricta— o con algo
    // ilegible dentro: lo de partida.
    return { volumen: VOLUMEN_DE_PARTIDA, callada: false };
  }
}

function guardar(estado: Pick<EstadoDeLaClaqueta, 'volumen' | 'callada'>): void {
  try {
    localStorage.setItem(
      CLAVE_CLAQUETA,
      JSON.stringify({ volumen: estado.volumen, callada: estado.callada }),
    );
  } catch {
    // No se puede guardar: se queda para esta visita.
  }
}

export const useClaqueta = create<EstadoDeLaClaqueta>()((set, get) => ({
  ...leerGuardado(),
  enLaToma: false,
  acciones: {
    ponerVolumen: (volumen) => {
      // Mover el volumen es querer oírlo: si estaba quitada, vuelve.
      set({ volumen: acotar(volumen), callada: false });
      guardar(get());
    },
    callar: (callada) => {
      set({ callada });
      guardar(get());
    },
    marcarToma: (enLaToma) => set({ enLaToma }),
  },
}));
