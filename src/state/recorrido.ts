'use client';

import { useSyncExternalStore } from 'react';

import type { EspacioDeTrabajo } from './workspace';

/**
 * Si ya has visto el recorrido de la primera visita, y por dónde ibas si no.
 *
 * Vive en su propia clave y no dentro de `workspace.ts` por lo mismo que el sitio
 * del profesor: es una sola cosa, se lee antes de pintar el recorrido y no tiene
 * nada que ver con la tonalidad ni con el reparto del banco. Meterla allí haría
 * que cada paso del recorrido reescribiera las preferencias enteras.
 *
 * En `localStorage`, como el resto de preferencias: **por navegador y por
 * persona**, sin cuenta. Quien entra desde otro aparato lo vuelve a ver una vez,
 * que es lo honrado: no sabemos si en ese aparato ya se lo enseñaron.
 *
 * **Se guarda el paso, no solo si se ha visto.** Recargar a mitad —o cerrar la
 * pestaña— no te devuelve al principio ni te lo quita: sigues donde lo dejaste.
 * Y se guarda lo que el recorrido ha tocado para enseñarse, porque eso tiene
 * que deshacerse al acabar aunque haya habido una recarga en medio.
 */

/** Lo que el recorrido cambia para poder enseñar componer, y deshace al acabar. */
export interface LoQuePuso {
  /** Si puso Do mayor porque no había tonalidad. */
  readonly tonalidad: boolean;
  /** En qué espacio de componer estabas antes de que lo cambiara, si lo cambió. */
  readonly espacio: EspacioDeTrabajo | null;
}

export interface RecorridoEnCurso {
  readonly visto: false;
  /** El paso por el que va, por su nombre: el número cambia con el ancho. */
  readonly paso: string | null;
  /** Dónde estabas al empezar, para devolverte allí al acabar. */
  readonly origen: string | null;
  readonly puso: LoQuePuso;
}

export type EstadoDelRecorrido = { readonly visto: true } | RecorridoEnCurso;

export const CLAVE_RECORRIDO = 'caos-ordenado:recorrido';

const VISTO: EstadoDelRecorrido = { visto: true };

/** Lo que hay sin nada guardado: la primera visita, sin empezar. */
export const SIN_EMPEZAR: RecorridoEnCurso = {
  visto: false,
  paso: null,
  origen: null,
  puso: { tonalidad: false, espacio: null },
};

function esEspacio(valor: unknown): valor is EspacioDeTrabajo {
  return valor === 'tocando' || valor === 'escribir' || valor === 'ensayar';
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' && valor.length <= 200 ? valor : null;
}

/**
 * Lo guardado, comprobado campo a campo.
 *
 * Lo que no se entienda cuenta como **visto**, no como pendiente: un recorrido
 * que sale en cada carga porque una versión vieja guardó otra cosa es peor que
 * uno que no sale. Quien lo quiera tiene el botón de volver a verlo.
 */
export function leerRecorrido(crudo: string | null): EstadoDelRecorrido {
  if (crudo === null) {
    return SIN_EMPEZAR;
  }
  if (crudo === 'visto') {
    return VISTO;
  }
  try {
    const valor: unknown = JSON.parse(crudo);
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      return VISTO;
    }
    const registro = valor as Record<string, unknown>;
    const puso = registro['puso'];
    const lo = typeof puso === 'object' && puso !== null ? (puso as Record<string, unknown>) : {};
    return {
      visto: false,
      paso: texto(registro['paso']),
      origen: texto(registro['origen']),
      puso: {
        tonalidad: lo['tonalidad'] === true,
        espacio: esEspacio(lo['espacio']) ? lo['espacio'] : null,
      },
    };
  } catch {
    return VISTO;
  }
}

let crudoLeido: string | null | undefined;
let actual: EstadoDelRecorrido = SIN_EMPEZAR;
/** Lo último escrito, para cuando el navegador no deja guardar. */
let enMemoria: string | null = null;
const oyentes = new Set<() => void>();

function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_RECORRIDO);
  } catch {
    // Sin almacenamiento —modo privado estricto— no se puede recordar que ya
    // se vio, y enseñarlo en cada carga sería castigar a quien protege su
    // intimidad. Se da por visto, salvo que se haya pedido verlo en esta carga.
    return enMemoria ?? 'visto';
  }
}

/**
 * El estado, **el mismo objeto mientras no cambie lo guardado**:
 * `useSyncExternalStore` compara por identidad, y un objeto nuevo en cada
 * lectura sería un bucle de repintados.
 */
export function estadoDelRecorrido(): EstadoDelRecorrido {
  const crudo = leerGuardado();
  if (crudo !== crudoLeido) {
    crudoLeido = crudo;
    actual = leerRecorrido(crudo);
  }
  return actual;
}

/** En el servidor no hay navegador que recuerde nada, y el recorrido no se pinta. */
export function estadoDelRecorridoEnServidor(): EstadoDelRecorrido {
  return VISTO;
}

export function suscribirseAlRecorrido(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function escribir(valor: string): void {
  enMemoria = valor;
  try {
    localStorage.setItem(CLAVE_RECORRIDO, valor);
  } catch {
    // Sin permiso para guardar se sigue igual; solo que no se recuerda.
  }
  for (const oyente of oyentes) {
    oyente();
  }
}

/** Apunta por dónde va, y lo que ha tocado para enseñarse. */
export function guardarPasoDelRecorrido(en: Omit<RecorridoEnCurso, 'visto'>): void {
  escribir(JSON.stringify(en));
}

/** Terminado, saltado o cerrado: las tres cuentan como visto. */
export function marcarRecorridoVisto(): void {
  escribir('visto');
}

/** Lo vuelve a poner en marcha desde el principio. */
export function volverAVerElRecorrido(): void {
  escribir(JSON.stringify(SIN_EMPEZAR));
}

export function useRecorrido(): EstadoDelRecorrido {
  return useSyncExternalStore(
    suscribirseAlRecorrido,
    estadoDelRecorrido,
    estadoDelRecorridoEnServidor,
  );
}
