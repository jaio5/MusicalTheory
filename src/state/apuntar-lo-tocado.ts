'use client';

import {
  captureMelody,
  captureProgression,
  DUDOSO,
  keyName,
  PAPEL_POR_DEFECTO,
  type Capture,
  type KeyMode,
  type MelodyCapture,
  type PapelDeLaToma,
  type PitchClass,
} from '@core/music';

import { useArrangementStore } from './arrangement-store';

/**
 * Lo que sale del papel que no se estaba tocando.
 *
 * Constantes y no una llamada al capturador con la lista vacía: eso recorrería
 * una grabación entera para devolver esto mismo, y además diría en el aviso que
 * «no he podido leer ni un acorde» cuando nadie ha pedido acordes.
 */
const CAPTURA_VACIA: Capture = { steps: [], unread: [], dropped: 0, skipped: 0, bars: 0 };
const PUNTEO_VACIO: MelodyCapture = { notes: [], outOfRange: 0, skipped: 0 };
import { useSessionStore } from './session-store';

/**
 * Lo que acabas de tocar, convertido en una parte de la canción.
 *
 * Vive en `state/` y no dentro del lienzo porque **lo usan dos entradas**: el
 * botón de traer lo grabado, que lleva tiempo ahí, y el espacio de trabajo de
 * tocar, que es la forma de componer que este proyecto tenía construida y
 * escondida ([adr/0034](../../docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)).
 * Escrito dos veces, uno de los dos se habría quedado sin la corrección del día
 * que hubiera que hacerle alguna.
 *
 * No abre el micro ni lo cierra: eso lo hace quien llama. Aquí solo se lee lo
 * que el motor apuntó entre `startCapture` y `stopCapture`.
 */

export interface LoApuntado {
  /** La parte nueva, o nulo si no se pudo leer nada. */
  readonly partId: string | null;
  /** Qué contar de lo que salió, o nulo si no hay nada que decir. */
  readonly aviso: string | null;
}

export function apuntarLoTocado({
  tonic,
  mode,
  bpm,
  beatsPerBar,
  papel = PAPEL_POR_DEFECTO,
  nombre = 'Lo que has tocado',
}: {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly bpm: number;
  readonly beatsPerBar: number;
  /**
   * Qué se estaba tocando. **Solo se apunta lo de ese papel.**
   *
   * Los dos motores corren a la vez sobre la misma entrada, así que una toma daba
   * acordes y notas siempre, y nadie decía nunca cuál era la buena: un punteo
   * salía escrito como acordes. No es que el croma falle —es que se le estaba
   * preguntando por algo que no era—.
   */
  readonly papel?: PapelDeLaToma;
  readonly nombre?: string;
}): LoApuntado {
  // **Solo grabar no escribe nada, y eso no es un fallo.** Sin este camino, la
  // toma pasaba por leer los dos motores, no encontraba nada que apuntar —porque
  // no se le ha pedido— y contestaba «no he podido leer ni un acorde», que es
  // culpar al micro de hacer justo lo que se le mandó.
  if (papel === 'solo-grabar') {
    return { partId: null, aviso: null };
  }

  const sesion = useSessionStore.getState();

  const capture =
    papel === 'ritmica'
      ? captureProgression(sesion.captured, {
          tonic,
          mode,
          bpm,
          endedAt: sesion.captureEndedAt,
          beatsPerBar,
        })
      : CAPTURA_VACIA;

  /**
   * El punteo se lee del historial de notas, que el motor de tono viene
   * llenando desde que se abre el micro. Se recorta al tramo apuntado: lo que
   * sonó antes de darle a apuntar no es parte de esta grabación.
   */
  const punteo =
    papel === 'punteo'
      ? captureMelody(sesion.noteHistory, {
          tonic,
          bpm,
          startedAt: sesion.captureStartedAt,
          endedAt: sesion.captureEndedAt,
        })
      : PUNTEO_VACIO;

  if (capture.steps.length === 0 && punteo.notes.length === 0) {
    // Y se dice en los términos del papel que se estaba tocando. «Ni un acorde ni
    // una nota» después de grabar un punteo suena a que se esperaban acordes, y
    // nadie los ha pedido.
    return {
      partId: null,
      aviso:
        papel === 'ritmica'
          ? 'No he podido leer ni un acorde de lo que has tocado.'
          : 'No he podido leer ni una nota de lo que has tocado.',
    };
  }

  const partId = useArrangementStore
    .getState()
    .actions.addRecorded(capture.steps, nombre, punteo.notes);

  return { partId, aviso: avisoDeLaCaptura(capture, punteo, keyName(tonic, mode)) };
}

/**
 * Qué contar de una grabación recién traída.
 *
 * **Lo que no se pudo leer importa más que lo que sí.** Un compás que se cayó es
 * un agujero en la canción que nadie va a notar mirando el lienzo, porque lo que
 * falta no se ve; y cuando lo que se cae son varios acordes con la misma pinta,
 * casi siempre significa lo mismo: la tonalidad que se detectó no es la que se
 * estaba tocando. Decirlo aquí ahorra volver a grabar sin saber por qué salió
 * mal.
 *
 * Lo dudoso se cuenta aparte y sin alarmar: esos sí están en el lienzo, marcados
 * y con su corrección a un toque.
 */
export function avisoDeLaCaptura(
  capture: Capture,
  punteo: MelodyCapture,
  tonalidad: string,
): string | null {
  const partes: string[] = [];

  if (punteo.notes.length > 0) {
    partes.push(
      punteo.notes.length === 1
        ? 'He apuntado 1 nota de punteo.'
        : `He apuntado ${punteo.notes.length} notas de punteo.`,
    );
  }

  if (capture.unread.length > 0) {
    const fuera = capture.unread.filter((tramo) => tramo.reason === 'fuera');
    const cifrados = [...new Set(fuera.map((tramo) => tramo.symbol))].filter(
      (symbol): symbol is string => symbol !== null,
    );

    if (cifrados.length > 0) {
      partes.push(
        `${fuera.length === 1 ? 'Un acorde no cabe' : `${fuera.length} acordes no caben`} en ` +
          `${tonalidad}: ${cifrados.join(', ')}. Si ${fuera.length === 1 ? 'lo tocaste' : 'los tocaste'} ` +
          'a propósito, prueba a cambiar la tonalidad y a traerlo otra vez.',
      );
    }

    const ilegibles = capture.unread.length - fuera.length;
    if (ilegibles > 0) {
      partes.push(
        ilegibles === 1
          ? 'Hubo un momento que no se parecía a ningún acorde y se ha quedado fuera.'
          : `Hubo ${ilegibles} momentos que no se parecían a ningún acorde y se han quedado fuera.`,
      );
    }
  }

  if (punteo.outOfRange > 0) {
    partes.push(
      `${punteo.outOfRange === 1 ? 'Una nota se salía' : `${punteo.outOfRange} notas se salían`} ` +
        'de lo que cabe en el pentagrama y no se ha escrito.',
    );
  }

  const dudosos = capture.steps.filter((step) => step.confidence < DUDOSO).length;
  if (dudosos > 0) {
    partes.push(
      `${dudosos === 1 ? 'Hay 1 acorde' : `Hay ${dudosos} acordes`} de los que no estoy seguro: ` +
        'salen marcados con «?» y se corrigen pulsándolos.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}
