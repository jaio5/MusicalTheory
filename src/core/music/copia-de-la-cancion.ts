/**
 * La canción en un fichero que se puede volver a abrir.
 *
 * **Existe para que guardar no dependa de un plan.** La canción se guarda sola en
 * este navegador, y eso se pierde al borrar los datos del sitio o al cambiar de
 * aparato; la cuenta lo resuelve, pero cuesta dinero. El MIDI sale de aquí y se
 * abre en cualquier secuenciador, pero de vuelta solo trae notas: los grados, las
 * partes con nombre y de dónde salió cada acorde se pierden. Esta copia lo lleva
 * todo y se abre en la misma aplicación
 * ([adr/0118](../../../docs/adr/0118-la-cancion-vive-en-este-navegador-y-se-dice.md)).
 *
 * Va en `core/` porque escribir y leer un texto no necesita navegador; pedir la
 * descarga y leer el fichero viven en las capas de arriba.
 *
 * **Lo que se lee se trata como lo que se lee de fuera**: un fichero lo puede
 * haber editado cualquiera, así que pasa por `leerMontaje` —el mismo filtro que
 * lo guardado en el navegador— y lo que no cuadra se cae en vez de tumbar
 * componer.
 */

import { leerMontaje, type Arrangement } from './arrangement';
import type { KeyMode } from './keys';
import type { PitchClass } from './notes';
import { nombreDeFichero } from './midi';
import { BEATS_PER_BAR, clampBpm, DEFAULT_BEATS_PER_BAR, DEFAULT_BPM } from './tempo';

/** Lo que dice el fichero que es, para no abrir como canción un JSON cualquiera. */
export const FORMATO_DE_LA_COPIA = 'caos-ordenado/cancion';

/**
 * La versión de lo que se escribe. Hoy hay una; lo de una versión que no se
 * conoce no se abre, por lo mismo que el lienzo guardado
 * (`state/session-storage.ts`): leerlo con estas reglas podría dar por buenos
 * campos que significan otra cosa.
 */
export const VERSION_DE_LA_COPIA = 1;

/** Lo que hace falta para que la canción suene igual al abrirla. */
export interface CopiaDeLaCancion {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly arrangement: Arrangement;
}

/** El texto del fichero, legible a ojo por si alguien lo abre en un editor. */
export function escribirCopia(copia: CopiaDeLaCancion): string {
  return JSON.stringify(
    { formato: FORMATO_DE_LA_COPIA, version: VERSION_DE_LA_COPIA, ...copia },
    null,
    2,
  );
}

function esTonica(valor: unknown): valor is PitchClass {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= 11;
}

/**
 * La canción de un fichero, o nulo si no es una copia de las que escribe esto.
 *
 * El tempo y el compás no hacen que se rechace: un tempo fuera de rango se
 * acota y un compás que no existe vuelve al de siempre, que es lo que haría
 * quien lo tocara. Lo que sí la rechaza es no saber en qué tonalidad está o no
 * traer ninguna parte: sin eso no hay canción que abrir.
 */
export function leerCopia(texto: string): CopiaDeLaCancion | null {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    return null;
  }
  const registro = crudo as Record<string, unknown>;
  if (
    registro['formato'] !== FORMATO_DE_LA_COPIA ||
    registro['version'] !== VERSION_DE_LA_COPIA ||
    !esTonica(registro['tonic']) ||
    (registro['mode'] !== 'major' && registro['mode'] !== 'minor')
  ) {
    return null;
  }
  const arrangement = leerMontaje(registro['arrangement']);
  if (arrangement === null || arrangement.parts.length === 0) {
    return null;
  }
  const bpm = registro['bpm'];
  const beatsPerBar = registro['beatsPerBar'];
  return {
    tonic: registro['tonic'],
    mode: registro['mode'],
    bpm: typeof bpm === 'number' && Number.isFinite(bpm) ? clampBpm(bpm) : DEFAULT_BPM,
    beatsPerBar:
      typeof beatsPerBar === 'number' && BEATS_PER_BAR.includes(beatsPerBar)
        ? beatsPerBar
        : DEFAULT_BEATS_PER_BAR,
    arrangement,
  };
}

/**
 * El nombre del fichero: el de la primera parte, como el MIDI, y limpiado con
 * la misma regla para que ningún sistema lo rechace.
 */
export function nombreDeLaCopia(titulo: string): string {
  return nombreDeFichero(titulo, 'caos.json');
}
