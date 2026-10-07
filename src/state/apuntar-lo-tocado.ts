'use client';

import {
  captureMelody,
  captureProgression,
  DUDOSO,
  keyName,
  MAX_LEAD_NOTES,
  MAX_PART_BLOCKS,
  MAX_PARTS,
  PAPEL_POR_DEFECTO,
  RETARDO_DEL_TONO_MS,
  transcribirPunteo,
  type Capture,
  type CapturedStep,
  type FotogramaDeTono,
  type KeyMode,
  type LeadNote,
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
  /** La parte nueva —la primera, si salieron varias—, o nulo si no se pudo leer nada. */
  readonly partId: string | null;
  /** Qué contar de lo que salió, o nulo si no hay nada que decir. */
  readonly aviso: string | null;
}

/**
 * Lo que la toma oyó de primera mano, cuando se toca desde «Tocando».
 *
 * Con esto se transcribe **la toma entera** y contra su rejilla: cada análisis
 * del motor de tono y el compás uno de la cuenta. Sin esto —el botón del lienzo,
 * que no cuenta— se lee lo de siempre: el historial de la sesión y los acordes
 * medidos de uno a otro.
 */
export interface LecturaParaApuntar {
  readonly fotogramas: readonly FotogramaDeTono[];
  readonly empiezaEn: number;
  readonly acabaEn: number;
}

/**
 * Por debajo de este nivel, la guitarra ya no suena. Es lo que mide hasta dónde
 * llega el último acorde: el que se pulse parar un segundo después no lo alarga.
 */
const SIGUE_SONANDO = 0.006;

/** Hasta cuándo sonó algo, según el nivel de cada análisis. */
function sonoHasta(fotogramas: readonly FotogramaDeTono[]): number | undefined {
  for (let i = fotogramas.length - 1; i >= 0; i -= 1) {
    if (fotogramas[i]!.rms >= SIGUE_SONANDO) {
      return fotogramas[i]!.at - RETARDO_DEL_TONO_MS;
    }
  }
  return undefined;
}

/**
 * Una toma larga repartida en partes que caben.
 *
 * **Una toma no tiene tope y una parte sí**: sesenta y cuatro notas o treinta y
 * dos bloques. Antes lo que no cabía se tiraba por el final sin decir nada; ahora
 * se sigue en la parte siguiente.
 *
 * **Las partes tienen que encajar una detrás de otra**, porque así se tocan: la
 * siguiente empieza donde acaba la anterior (`partLength`). Así que se corta en
 * una barra donde la parte de antes acaba justo —su última nota llega a la barra
 * y ninguna la cruza—, buscando hacia atrás desde la nota que ya no cabe. Si no
 * hay ninguna barra así —un punteo con silencios antes de cada compás—, se corta
 * donde acaba la última nota que cabe: la parte siguiente no empieza en su uno,
 * pero todo suena donde se tocó, que es lo que no se puede perder.
 */
function repartirNotas(notes: readonly LeadNote[], beatsPerBar: number): LeadNote[][] {
  const partes: LeadNote[][] = [];
  let resto = notes;
  let desde = 0;
  while (resto.length > MAX_LEAD_NOTES) {
    // Dónde acaba lo que hay hasta cada nota, contando desde el principio.
    const finales: number[] = [];
    for (const nota of resto.slice(0, MAX_LEAD_NOTES)) {
      finales.push(Math.max(finales.at(-1) ?? 0, nota.start + nota.length));
    }
    let corte = MAX_LEAD_NOTES;
    for (let cuantas = MAX_LEAD_NOTES; cuantas >= 1; cuantas -= 1) {
      const acaba = finales[cuantas - 1]!;
      if (acaba % beatsPerBar === 0 && resto[cuantas]!.start >= acaba) {
        corte = cuantas;
        break;
      }
    }
    partes.push(resto.slice(0, corte).map((nota) => ({ ...nota, start: nota.start - desde })));
    desde = finales[corte - 1]!;
    resto = resto.slice(corte);
  }
  partes.push(resto.map((nota) => ({ ...nota, start: nota.start - desde })));
  return partes;
}

/**
 * Lo mismo con los bloques, que siempre encajan —una parte de bloques dura lo que
 * suman—: aquí solo se busca que la siguiente empiece en una barra, que es como se
 * lee una partitura.
 */
function repartirPasos(steps: readonly CapturedStep[], beatsPerBar: number): CapturedStep[][] {
  const partes: CapturedStep[][] = [];
  let resto = steps;
  while (resto.length > MAX_PART_BLOCKS) {
    let corte = MAX_PART_BLOCKS;
    let pulsos = resto.slice(0, MAX_PART_BLOCKS).reduce((suma, paso) => suma + paso.beats, 0);
    for (let cuantos = MAX_PART_BLOCKS; cuantos >= 1; cuantos -= 1) {
      if (pulsos % beatsPerBar === 0) {
        corte = cuantos;
        break;
      }
      pulsos -= resto[cuantos - 1]!.beats;
    }
    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }
  partes.push([...resto]);
  return partes;
}

export function apuntarLoTocado({
  tonic,
  mode,
  bpm,
  beatsPerBar,
  papel = PAPEL_POR_DEFECTO,
  nombre = 'Lo que has tocado',
  lectura,
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
  /** Lo que oyó la toma, si viene de una. */
  readonly lectura?: LecturaParaApuntar;
}): LoApuntado {
  // **Solo grabar no escribe nada, y eso no es un fallo.** Sin este camino, la
  // toma pasaba por leer los dos motores, no encontraba nada que apuntar —porque
  // no se le ha pedido— y contestaba «no he podido leer ni un acorde», que es
  // culpar al micro de hacer justo lo que se le mandó.
  if (papel === 'solo-grabar') {
    return { partId: null, aviso: null };
  }

  const sesion = useSessionStore.getState();

  // **Con la toma delante, contra su rejilla.** Los cambios se cuadran desde el
  // compás uno de la cuenta, y el último acorde acaba cuando dejó de sonar.
  const enLaRejilla =
    lectura === undefined
      ? {}
      : {
          startedAt: lectura.empiezaEn,
          tope: Infinity,
          ...(sonoHasta(lectura.fotogramas) === undefined
            ? {}
            : { sonoHasta: sonoHasta(lectura.fotogramas) }),
        };
  const capture =
    papel === 'ritmica'
      ? captureProgression(sesion.captured, {
          tonic,
          mode,
          bpm,
          endedAt: sesion.captureEndedAt,
          beatsPerBar,
          ...enLaRejilla,
        })
      : CAPTURA_VACIA;

  /**
   * El punteo se lee del historial de notas, que el motor de tono viene
   * llenando desde que se abre el micro. Se recorta al tramo apuntado: lo que
   * sonó antes de darle a apuntar no es parte de esta grabación.
   */
  //
  // **Con la toma delante, se lee cada análisis** y no el historial: el historial
  // guarda veinticuatro notas y no sabe de ataques ni de silencios. Si el motor
  // no dio análisis —uno que no sabe—, el historial de siempre.
  const punteo =
    papel !== 'punteo'
      ? PUNTEO_VACIO
      : lectura !== undefined && lectura.fotogramas.length > 0
        ? transcribirPunteo(lectura.fotogramas, {
            tonic,
            bpm,
            startedAt: lectura.empiezaEn,
            endedAt: lectura.acabaEn,
          })
        : captureMelody(sesion.noteHistory, {
            tonic,
            bpm,
            startedAt: sesion.captureStartedAt,
            endedAt: sesion.captureEndedAt,
          });

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

  const montaje = useArrangementStore.getState();
  const trozos: { steps: CapturedStep[]; notes: LeadNote[] }[] =
    papel === 'ritmica'
      ? repartirPasos(capture.steps, beatsPerBar).map((steps) => ({ steps, notes: [] }))
      : repartirNotas(punteo.notes, beatsPerBar).map((notes) => ({ steps: [], notes }));
  const caben = Math.max(0, MAX_PARTS - montaje.arrangement.parts.length);
  const escritos = trozos.slice(0, caben);

  if (escritos.length === 0) {
    return {
      partId: null,
      aviso: 'La canción ya tiene todas las partes que caben: quita alguna y vuelve a tocarlo.',
    };
  }

  const ids = escritos.map((trozo, indice) =>
    montaje.actions.addRecorded(
      trozo.steps,
      escritos.length === 1 && trozos.length === 1 ? nombre : `${nombre} (${indice + 1})`,
      trozo.notes,
    ),
  );

  const partes: string[] = [];
  if (trozos.length > 1) {
    partes.push(`Era largo: ha entrado en ${escritos.length} partes seguidas.`);
  }
  if (escritos.length < trozos.length) {
    partes.push(
      `Lo del final no cabía: la canción ya tiene ${MAX_PARTS} partes, que son todas las que admite.`,
    );
  }
  const aviso = avisoDeLaCaptura(capture, punteo, keyName(tonic, mode));
  if (aviso !== null) {
    partes.push(aviso);
  }

  return { partId: ids[0]!, aviso: partes.length === 0 ? null : partes.join(' ') };
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
