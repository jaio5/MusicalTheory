'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';

/**
 * Por dónde iba uno dentro de una unidad: el momento, la pregunta y si ya falló.
 *
 * Recargar a mitad de una unidad la montaba de cero —la presentación y la
 * pregunta 1—, y quien iba por la séptima de diez tenía que volver a contestar
 * seis que ya sabía. Ahora se retoma donde se dejó.
 *
 * **Solo números.** Ni el texto de la pregunta ni lo contestado: las preguntas
 * se generan en la tonalidad en la que se esté, así que se guarda la
 * **posición**, igual que la cola de repaso (adr/0096). Cambiar de tonalidad y
 * recargar sigue en la misma pregunta, escrita con los acordes de la nueva.
 *
 * **En `sessionStorage` y no en el avance**: no es algo ganado ni tiene que
 * viajar a la cuenta, es por dónde iba uno hace un rato en esta pestaña. Se
 * olvida al terminar la unidad, y con la pestaña.
 */
export interface SitioEnLaUnidad {
  /** El momento, por su posición: 0 la presentación, 1 la teoría, 2 la prueba. */
  readonly momento: number;
  /** La pregunta en la que se estaba, desde 0. */
  readonly pregunta: number;
  /** Si ya se ha fallado alguna: decide si la unidad sale sin fallos. */
  readonly fallada: boolean;
}

const CLAVE = (unitId: string) => `caos-ordenado:sitio:${unitId}`;

const VACIO: SitioEnLaUnidad = { momento: 0, pregunta: 0, fallada: false };

/** Un entero en un rango, o el de partida: lo guardado puede venir de otra versión. */
function entero(valor: unknown, maximo: number): number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= maximo
    ? valor
    : 0;
}

/** Lee lo guardado. Algo que no se entiende vale lo mismo que nada. */
export function leerSitio(crudo: string | null): SitioEnLaUnidad | null {
  if (crudo === null) {
    return null;
  }
  try {
    const leido: unknown = JSON.parse(crudo);
    if (typeof leido !== 'object' || leido === null) {
      return null;
    }
    const { momento, pregunta, fallada } = leido as Record<string, unknown>;
    return {
      momento: entero(momento, 2),
      // Un tope holgado y no el de la lección: el que manda lo pone quien la pinta.
      pregunta: entero(pregunta, 99),
      fallada: fallada === 1,
    };
  } catch {
    return null;
  }
}

function crudoDe(unitId: string): string | null {
  try {
    return sessionStorage.getItem(CLAVE(unitId));
  } catch {
    // Sin almacenamiento —navegación privada estricta— se empieza por el principio.
    return null;
  }
}

/** Apunta un cambio sobre lo que ya hubiera. */
export function apuntarSitio(unitId: string, cambio: Partial<SitioEnLaUnidad>): void {
  const sitio = { ...(leerSitio(crudoDe(unitId)) ?? VACIO), ...cambio };
  try {
    sessionStorage.setItem(
      CLAVE(unitId),
      JSON.stringify({ ...sitio, fallada: sitio.fallada ? 1 : 0 }),
    );
  } catch {
    // Igual que al leer: no recordarlo solo quita el retomar de la próxima vez.
  }
}

/** Terminada la unidad, la próxima vez se empieza de nuevo. */
export function olvidarSitio(unitId: string): void {
  try {
    sessionStorage.removeItem(CLAVE(unitId));
  } catch {
    // Nada que olvidar si no se pudo guardar.
  }
}

/** Nadie más escribe esto mientras la unidad está montada: no hay a quién avisar. */
const sinAvisos = () => () => {};

/**
 * Lo guardado de una unidad, leído **después de hidratar**.
 *
 * Con `useSyncExternalStore`, que en el servidor contesta «nada»: leerlo en el
 * render daría un HTML distinto del de la primera pintura. Quien lo usa lo
 * aplica una vez, al llegar, y a partir de ahí manda su propio estado.
 */
export function useSitioGuardado(unitId: string): SitioEnLaUnidad | null {
  const crudo = useSyncExternalStore(
    sinAvisos,
    () => crudoDe(unitId),
    () => null,
  );
  return useMemo(() => leerSitio(crudo), [crudo]);
}

/**
 * La pregunta en la que se está y si ya se falló alguna, **retomadas** de lo
 * guardado y apuntadas a cada paso. Lo comparten las dos unidades que preguntan
 * —teoría y oído— para que retomen igual.
 *
 * Lo guardado se aplica una sola vez, al llegar. «Al llegar» es hasta que se
 * hace algo: lo que se apunta al contestar también cambia lo guardado, y sin la
 * marca se volvería a aplicar encima de lo que ya se lleva.
 */
export function usePreguntaEnCurso(unitId: string, total: number) {
  const guardado = useSitioGuardado(unitId);
  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [retomada, setRetomada] = useState(false);
  if (!retomada && guardado !== null) {
    setRetomada(true);
    // Otra tonalidad puede tener menos preguntas que la del día que se guardó.
    setAt(guardado.pregunta < total ? guardado.pregunta : 0);
    setFailed(guardado.fallada);
  }

  return {
    at,
    failed,
    fallar(): void {
      setRetomada(true);
      setFailed(true);
      apuntarSitio(unitId, { fallada: true });
    },
    siguiente(): void {
      setRetomada(true);
      setAt(at + 1);
      apuntarSitio(unitId, { pregunta: at + 1 });
    },
  };
}
