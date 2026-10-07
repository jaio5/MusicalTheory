'use client';

import { useSyncExternalStore } from 'react';

/**
 * Qué tramos del recorrido de la primera visita has visto, y por dónde ibas.
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
 * **Se guarda por tramos**: la bienvenida y uno por pantalla, que sale al llegar
 * a ella ([adr/0108](../../docs/adr/0108-el-recorrido-sale-por-pantallas.md)). Y
 * el paso dentro del tramo, para que recargar a mitad no lo empiece de cero.
 * Los nombres de los tramos son texto aquí y no el tipo de `features/tour`: el
 * estado no importa de un feature.
 */

export interface RecorridoEnCurso {
  readonly visto: false;
  /** Los tramos ya vistos, por su nombre. */
  readonly vistos: readonly string[];
  /** El paso por el que va dentro del tramo abierto, o nulo si por el primero. */
  readonly paso: string | null;
}

export type EstadoDelRecorrido = { readonly visto: true } | RecorridoEnCurso;

export const CLAVE_RECORRIDO = 'caos-ordenado:recorrido';

const VISTO: EstadoDelRecorrido = { visto: true };

/** Lo que hay sin nada guardado: la primera visita, sin empezar. */
export const SIN_EMPEZAR: RecorridoEnCurso = { visto: false, vistos: [], paso: null };

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' && valor.length <= 200 ? valor : null;
}

/**
 * Lo guardado, comprobado campo a campo.
 *
 * Lo que no se entienda cuenta como **visto**, no como pendiente: un recorrido
 * que sale en cada carga porque una versión vieja guardó otra cosa es peor que
 * uno que no sale. Quien lo quiera tiene el botón de volver a verlo.
 *
 * El de la versión de antes —un objeto con su `paso`, sin `vistos`— se lee como
 * sin empezar: era uno de veintiún pasos a medias, y el nuevo es otro recorrido.
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
    const vistos = Array.isArray(registro['vistos']) ? registro['vistos'] : [];
    return {
      visto: false,
      vistos: vistos.map(texto).filter((tramo) => tramo !== null),
      paso: texto(registro['paso']),
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

/** Apunta por dónde va. */
export function guardarPasoDelRecorrido(en: Omit<RecorridoEnCurso, 'visto'>): void {
  escribir(JSON.stringify(en));
}

/** Saltado: no se enseña nada más, en ninguna pantalla. */
export function marcarRecorridoVisto(): void {
  escribir('visto');
}

/**
 * Un tramo visto: terminado o cerrado. Con todos vistos, el recorrido entero.
 * `todos` son los nombres de los tramos, que los sabe quien los define.
 */
export function marcarTramoVisto(tramo: string, todos: readonly string[]): void {
  const actual = estadoDelRecorrido();
  /* v8 ignore next 3 -- solo se cierra un tramo que se está enseñando, y entonces no está visto */
  if (actual.visto) {
    return;
  }
  const vistos = actual.vistos.includes(tramo) ? actual.vistos : [...actual.vistos, tramo];
  if (todos.every((uno) => vistos.includes(uno))) {
    marcarRecorridoVisto();
    return;
  }
  guardarPasoDelRecorrido({ vistos, paso: null });
}

/** Lo vuelve a poner en marcha desde el principio. */
export function volverAVerElRecorrido(): void {
  escribir(JSON.stringify({ vistos: [], paso: null }));
}

export function useRecorrido(): EstadoDelRecorrido {
  return useSyncExternalStore(
    suscribirseAlRecorrido,
    estadoDelRecorrido,
    estadoDelRecorridoEnServidor,
  );
}
