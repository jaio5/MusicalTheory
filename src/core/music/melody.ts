/**
 * El punteo: las notas que van por encima de los acordes.
 *
 * Es la mitad que le faltaba al montaje. Hasta aquí una canción era armonía y su
 * reparto en el tiempo —`capture.ts` lo dice de su propia captura: «no hay ritmo
 * dentro del compás, no hay melodía»— y con eso se puede montar el acompañamiento
 * entero y ni una sola línea de solo.
 *
 * ## Semitonos desde la tónica, no notas ni grados de escala
 *
 * Una nota se guarda como **cuántos semitonos está por encima de la tónica de la
 * canción**: 0 es la tónica, 7 la quinta, 12 la octava, -5 la cuarta de abajo.
 *
 * Frente a guardar la nota (un `F#`), es la misma lección que ya aprendieron los
 * acordes tres veces: cambiar la canción de tonalidad se convierte en no hacer
 * nada, porque el punteo se mueve con ella. Un `F#` guardado tal cual solo
 * significa algo en la tonalidad en la que se escribió.
 *
 * Frente a guardar el **grado de la escala** —«la tercera nota de la pentatónica»—
 * que sería lo más seguro para quien no sabe música, se pierde una cosa y se gana
 * otra: se pierde que cambiar de escala arrastre el punteo, y se gana que se pueda
 * escribir una nota que no está en la escala. Y eso hace falta: la nota de paso
 * cromática es medio idioma del blues, y una partitura donde no se puede escribir
 * un cromatismo no es una partitura, es una rejilla.
 *
 * Quien no quiera salirse tiene `isInScaleOffset` y una interfaz que solo le
 * ofrece las de dentro; quien sepa, escribe la de fuera.
 *
 * ## El tiempo va en pulsos, y las duraciones son las que se pueden dibujar
 *
 * `start` son pulsos desde que empieza la parte, y `length` lo que dura. Las dos
 * caen en una rejilla de media pulso, y `length` además se limita a las seis que
 * tienen figura —de la corchea a la redonda, con sus puntillos—. Es lo que hace
 * que la misma melodía se pueda enseñar como bloques y como partitura sin que la
 * segunda tenga que inventarse una figura para un valor que no existe.
 *
 * Dominio puro: ni reloj, ni azar, ni `AudioContext`. Los identificadores entran
 * por parámetro, como en `arrangement.ts`.
 */

import type { KeyMode } from './keys';
import { accidentalForKey, keySignature, pitchOfLetter } from './circle-of-fifths';
import { normalizePitchClass, noteName, type PitchClass } from './notes';
import { scaleNotes, type ScaleId } from './scales';
import { clampBpm, msPerBeat } from './tempo';

/** Una nota del punteo. */
export interface LeadNote {
  readonly id: string;
  /** Semitonos sobre la tónica de la canción. Negativo va por debajo. */
  readonly offset: number;
  /** Pulsos desde el principio de la parte. */
  readonly start: number;
  /** Pulsos que suena. */
  readonly length: number;
  /**
   * Lo limpia que llegó al oírla, de 0 a 1. Ausente en lo escrito a mano.
   *
   * Es la hermana del margen de los acordes, y sirve para lo mismo: marcar en la
   * partitura de qué notas no se estuvo seguro para poder mirarlas. Una cuerda
   * que roza, dos que suenan a la vez o una nota apagada dan claridad baja, y
   * ahí es donde el motor monofónico se inventa alturas.
   */
  readonly clarity?: number;
}

/**
 * Por debajo de esto, una nota oída se marca como dudosa.
 *
 * El motor de tono ya descarta lo que no llega a `MIN_CLARITY` —ahí decide si
 * hay nota o no—. Esto es otra cosa: hay nota, pero llegó sucia. Medio camino
 * entre ese suelo y la señal limpia.
 */
export const NOTA_DUDOSA = 0.75;

/** Si de esta nota conviene dudar. Lo escrito a mano nunca lo es. */
export function isDoubtfulNote(note: LeadNote): boolean {
  return note.clarity !== undefined && note.clarity < NOTA_DUDOSA;
}

/**
 * La rejilla del tiempo: media pulso.
 *
 * Es la corchea en un compás de cuatro por cuatro, y es hasta donde llega lo que
 * esta aplicación puede oír y dibujar. Más fino daría notas que el pentagrama no
 * sabe escribir y que el motor de croma nunca ha distinguido.
 */
export const GRID = 0.5;

/**
 * Las duraciones que existen, en pulsos.
 *
 * Son las seis que tienen figura en un compás de cuatro por cuatro: corchea,
 * negra, negra con puntillo, blanca, blanca con puntillo y redonda. Que la lista
 * viva aquí y no en el dibujo es lo que garantiza que nunca haya una nota sin
 * figura con la que escribirla.
 */
export const NOTE_LENGTHS: readonly number[] = [0.5, 1, 1.5, 2, 3, 4];

/** Lo más grave y lo más agudo que se puede escribir, en semitonos sobre la tónica. */
export const MIN_OFFSET = -12;
export const MAX_OFFSET = 24;

/** Cuántas notas caben en una parte. El mismo orden que los bloques de acorde. */
export const MAX_LEAD_NOTES = 64;

/**
 * La octava del punteo, como número MIDI de referencia.
 *
 * 67 es el Sol de la segunda línea del pentagrama, y está elegido mirando la
 * partitura: con la referencia una octava más arriba, la tónica caía en el tercer
 * espacio y medio punteo se dibujaba por encima de las cinco líneas, todo a base
 * de líneas adicionales. Así el grueso de lo que se escribe cae dentro.
 */
export const MELODY_BASE_MIDI = 67;

export function snapToGrid(beats: number): number {
  return Math.round(beats / GRID) * GRID;
}

export function clampOffset(offset: number): number {
  if (Number.isNaN(offset)) {
    return 0;
  }
  return Math.min(MAX_OFFSET, Math.max(MIN_OFFSET, Math.round(offset)));
}

/**
 * La duración escribible más cercana.
 *
 * Redondea a la de la lista que menos se aleje, y no a la anterior ni a la
 * siguiente: arrastrando el borde de una nota de una negra hacia la blanca, lo
 * que se quiere a mitad de camino es la que esté más cerca, no siempre la corta.
 */
export function snapLength(beats: number): number {
  if (Number.isNaN(beats)) {
    return 1;
  }
  return NOTE_LENGTHS.reduce((mejor, candidata) =>
    Math.abs(candidata - beats) < Math.abs(mejor - beats) ? candidata : mejor,
  );
}

export function clampStart(beats: number): number {
  if (Number.isNaN(beats)) {
    return 0;
  }
  return Math.max(0, snapToGrid(beats));
}

/** Si esa altura cae dentro de la escala que se está usando. */
export function isInScaleOffset(offset: number, tonic: PitchClass, scaleId: ScaleId): boolean {
  const pitch = normalizePitchClass(tonic + offset);
  return scaleNotes(tonic, scaleId).includes(pitch);
}

/** El número MIDI con el que suena, para dársela al reproductor. */
export function midiOf(note: LeadNote, tonic: PitchClass, baseMidi = MELODY_BASE_MIDI): number {
  // La base se lleva a la tónica de la canción dentro de esa octava, y desde ahí
  // los semitonos son los que dice la nota. Sin esto, el mismo punteo saltaría de
  // octava al cambiar de tonalidad en la rueda.
  return baseMidi - (baseMidi % 12) + tonic + note.offset;
}

/**
 * Cómo se escribe esa altura: la letra, la alteración y en qué octava cae.
 *
 * El pentagrama necesita las tres por separado y no un nombre pegado: la **letra**
 * decide la línea —un F y un F# van en la misma—, la **alteración** es un signo
 * delante, y la **octava** dice cuántas líneas hay que subir.
 *
 * La alteración sale de la tonalidad, como en todo el resto de la aplicación: en
 * las de sostenidos se escribe con sostenidos y en las de bemoles con bemoles.
 * Nunca salen dobles alteraciones, porque los nombres de `notes.ts` son doce y no
 * hay un `F##` entre ellos; en tonalidades muy lejanas eso da alguna escritura
 * poco ortodoxa, y se acepta: es legible, y la alternativa era un catálogo de
 * nombres enarmónicos que este proyecto no necesita para nada más.
 */
export interface WrittenNote {
  /** C, D, E, F, G, A o B. Es la que decide la línea del pentagrama. */
  readonly letter: string;
  /** `''`, `'#'` o `'b'`. */
  readonly accidental: string;
  /** Octava científica: el Do central es la 4. */
  readonly octave: number;
  /**
   * Escalones diatónicos desde el Do de la octava 4.
   *
   * Es lo único que hace falta para colocarla: cada escalón es media línea del
   * pentagrama, y da igual la alteración porque no mueve la nota de sitio.
   */
  readonly step: number;
}

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** La letra y la octava que le tocan a un escalón del pentagrama. */
export function letterOfStep(step: number): { letter: string; octave: number } {
  const indice = ((step % 7) + 7) % 7;
  return { letter: LETTERS[indice] ?? 'C', octave: 4 + Math.floor(step / 7) };
}

/**
 * La altura que se escribe en ese escalón del pentagrama.
 *
 * Es la inversa de `writeNote`, y la que hace que arrastrar una nota hacia arriba
 * en la partitura se mueva **por las notas de la tonalidad** y no de semitono en
 * semitono. En Sol mayor, subir del Mi al Fa da un Fa sostenido, que es lo que
 * espera cualquiera que esté escribiendo en Sol.
 *
 * Los cromatismos no se escriben moviendo la nota, sino alterándola: eso es
 * sumar o restar un semitono a su altura, y lo hace quien llama.
 */
export function offsetOfStep(
  step: number,
  tonic: PitchClass,
  mode: KeyMode,
  baseMidi = MELODY_BASE_MIDI,
): number {
  const { letter, octave } = letterOfStep(step);
  const pitch = pitchOfLetter(letter, keySignature(tonic, mode));
  const midi = (octave + 1) * 12 + pitch;
  return midi - (baseMidi - (baseMidi % 12) + tonic);
}

/** Una nota que se ha oído, con su instante y lo limpia que llegó. */
export interface HeardNote {
  readonly midi: number;
  /** Milisegundos, del reloj que sea. Solo se usan las diferencias. */
  readonly at: number;
  /** Lo clara que llegó la señal, de 0 a 1. Sin ella se da por buena. */
  readonly clarity?: number;
}

export interface CaptureMelodyOptions {
  readonly tonic: PitchClass;
  readonly bpm: number;
  /** Cuándo se paró. Es lo que mide la última nota. */
  readonly endedAt: number;
  /** El instante en que empieza el punteo. Antes de esto no se apunta nada. */
  readonly startedAt?: number;
  /**
   * Lo que tiene que durar una nota para contar, en pulsos.
   *
   * Un cuarto de pulso: la semicorchea. Por debajo de eso, en una guitarra, es
   * casi siempre un roce de púa o el ataque de la siguiente, no una nota. Es más
   * fino que el filtro de los acordes —medio pulso— porque una melodía se mueve
   * el doble de rápido que una progresión.
   */
  readonly minBeats?: number;
}

export interface MelodyCapture {
  readonly notes: readonly LeadNote[];
  /** Notas que sonaron menos de lo que pide `minBeats`. */
  readonly skipped: number;
  /** Notas que se salen de lo que se puede escribir, por arriba o por abajo. */
  readonly outOfRange: number;
}

/**
 * Lo que has punteado, convertido en notas de la partitura.
 *
 * Es el hermano de `captureProgression`, y lo que le faltaba a la otra mitad:
 * los acordes que tocas ya caían en el lienzo y las notas sueltas no, aunque el
 * motor de tono las viniera midiendo desde el principio.
 *
 * ## Las iguales seguidas se funden, y hay que saber por qué
 *
 * El historial de la sesión vuelve a apuntar la misma altura cada cuarto de
 * segundo mientras suena —`NOTE_REPEAT_MS`—, porque para lo que se hizo eso
 * bastaba: saber qué notas han sonado para adivinar la tonalidad. Al transcribir
 * eso convierte **una negra en dos corcheas iguales**, y un punteo de seis notas
 * en quince.
 *
 * Así que se funden, y con ello se acepta una pérdida que conviene decir:
 * **dos notas iguales repetidas seguidas se escriben como una sola larga.** No es
 * que se prefiera; es que este motor no las distingue —no hay detección de
 * ataque, solo altura— y entre escribir una redonda donde había dos negras o
 * escribir quince notas donde había seis, lo primero se parece más a lo que
 * sonó. Es hermana de la limitación del croma con las inversiones: se asume y se
 * dice.
 *
 * Lo demás que se pierde: no hay dinámica, no hay ligaduras, los silencios no se
 * escriben —salen del hueco entre dos notas— y la altura viene de un motor
 * monofónico, así que dos cuerdas a la vez dan una nota o ninguna.
 */
export function captureMelody(
  heard: readonly HeardNote[],
  options: CaptureMelodyOptions,
): MelodyCapture {
  const porPulso = msPerBeat(clampBpm(options.bpm));
  const minBeats = options.minBeats ?? 0.25;
  const desde = options.startedAt ?? heard[0]?.at ?? 0;
  const base = MELODY_BASE_MIDI - (MELODY_BASE_MIDI % 12) + options.tonic;

  // Se funden las iguales seguidas: el historial reapunta la misma altura
  // mientras suena, y sin esto cada nota sostenida sale partida en trozos.
  const dentro: HeardNote[] = [];
  for (const nota of heard) {
    if (nota.at < desde) {
      continue;
    }
    const ultima = dentro.at(-1);
    if (ultima !== undefined && Math.round(ultima.midi) === Math.round(nota.midi)) {
      // La peor claridad de las que se funden, por lo mismo que el peor margen
      // en los acordes: si en algún trozo la señal llegó sucia, la nota entera
      // es dudosa.
      if ((nota.clarity ?? 1) < (ultima.clarity ?? 1)) {
        dentro[dentro.length - 1] = { ...ultima, clarity: nota.clarity };
      }
      continue;
    }
    dentro.push(nota);
  }

  const notes: LeadNote[] = [];
  let skipped = 0;
  let outOfRange = 0;

  for (const [indice, nota] of dentro.entries()) {
    const hasta = dentro[indice + 1]?.at ?? options.endedAt;
    const pulsos = (hasta - nota.at) / porPulso;

    if (!Number.isFinite(pulsos) || pulsos < minBeats) {
      skipped += 1;
      continue;
    }

    const offset = Math.round(nota.midi) - base;
    if (offset < MIN_OFFSET || offset > MAX_OFFSET) {
      // Fuera del rango escribible. Se cuenta en vez de recortarla: una nota
      // arrastrada dos octavas hasta el techo es una nota que no tocaste, y
      // meterla mentiría sobre lo que sonó.
      outOfRange += 1;
      continue;
    }

    if (notes.length >= MAX_LEAD_NOTES) {
      break;
    }

    notes.push({
      id: `p${notes.length}`,
      offset,
      start: clampStart((nota.at - desde) / porPulso),
      length: snapLength(pulsos),
      // La claridad viaja con la nota. Se calculaba en cada análisis, se
      // guardaba en el historial y no llegaba a ninguna parte.
      ...(nota.clarity === undefined ? {} : { clarity: nota.clarity }),
    });
  }

  return { notes, skipped, outOfRange };
}

export function writeNote(
  note: LeadNote,
  tonic: PitchClass,
  mode: KeyMode,
  baseMidi = MELODY_BASE_MIDI,
): WrittenNote {
  const midi = midiOf(note, tonic, baseMidi);
  const nombre = noteName(normalizePitchClass(midi), accidentalForKey(tonic, mode));
  const letter = nombre[0] ?? 'C';
  const accidental = nombre.slice(1);

  // La octava sale del MIDI y basta con eso: ninguno de los doce nombres cruza la
  // frontera de octava —no hay `Cb` ni `B#` entre ellos—, así que la octava en la
  // que suena y la que se escribe son siempre la misma.
  const octave = Math.floor(midi / 12) - 1;
  const indice = LETTERS.indexOf(letter as (typeof LETTERS)[number]);

  return {
    letter,
    accidental,
    octave,
    step: (octave - 4) * 7 + (indice === -1 ? 0 : indice),
  };
}
