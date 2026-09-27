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
 * caen en una rejilla de un cuarto de pulso, y `length` además se limita a las
 * siete que tienen figura —de la semicorchea a la redonda, con sus puntillos—. Es
 * lo que hace
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
 * La rejilla del tiempo: un cuarto de pulso.
 *
 * Es la semicorchea en un compás de cuatro por cuatro. **Era media pulsación —la
 * corchea— y eso partía los punteos.** Un guitarrista tocando semicorcheas a 100
 * bpm pone una nota cada 150 ms, y con la rejilla en la corchea cada dos caían en
 * el mismo sitio: seis notas seguidas salían en cuatro posiciones, dibujadas una
 * encima de otra. No es un caso raro, es un punteo normal.
 *
 * Aquí se decía que más fino daría «notas que el pentagrama no sabe escribir»,
 * y era verdad mientras la lista de figuras empezara en la corchea. Ahora empieza
 * en la semicorchea y el dibujo la sabe hacer, así que el argumento se mueve con
 * ella. Lo que sigue en pie es que **la rejilla y las figuras se mueven juntas**:
 * una rejilla más fina que la figura más corta vuelve a poner notas donde no se
 * pueden escribir.
 */
export const GRID = 0.25;

/**
 * Las duraciones que existen, en pulsos.
 *
 * Son las siete que tienen figura en un compás de cuatro por cuatro:
 * semicorchea, corchea, negra, negra con puntillo, blanca, blanca con puntillo y
 * redonda. Que la lista viva aquí y no en el dibujo es lo que garantiza que nunca
 * haya una nota sin figura con la que escribirla.
 *
 * La semicorchea entró con la rejilla: sin ella, un punteo normal no se podía
 * escribir y las notas se apilaban.
 */
export const NOTE_LENGTHS: readonly number[] = [0.25, 0.5, 1, 1.5, 2, 3, 4];

/**
 * Cómo se escribe una duración: la figura, en datos.
 *
 * **Vive aquí porque son hechos de notación y no píxeles**, y porque los pedían
 * dos dibujos que no se conocen: el pentagrama (`arrange/Staff.tsx`) y la figura
 * suelta del selector de duración (`arrange/Figura.tsx`). Estaban los dos con su
 * propia copia, y eso costó un fallo de los que la duplicación produce siempre:
 * al bajar la rejilla a la semicorchea ([adr/0049](../../../docs/adr/0049-la-rejilla-llega-a-la-semicorchea.md))
 * se le pusieron dos corchetes en el pentagrama y en el selector se quedó con uno,
 * así que la semicorchea se dibujaba igual que la corchea y se llamaba «0.25
 * pulsos».
 */
export interface Figura {
  /** El nombre, que es lo que oye quien no ve el dibujo. */
  readonly nombre: string;
  /** Si la cabeza va sin rellenar: la blanca y las más largas. */
  readonly hueca: boolean;
  /** Si lleva plica. La redonda no. */
  readonly plica: boolean;
  /**
   * Cuántos corchetes lleva la plica: uno la corchea, **dos la semicorchea**.
   *
   * Era un sí o no, y con la semicorchea dejó de valer: las dos llevarían uno y un
   * punteo rápido saldría escrito al doble de lo que dura. Es lo mismo que pasa en
   * cualquier partitura: el número de corchetes **es** la figura.
   */
  readonly corchetes: number;
  /** Si lleva puntillo. */
  readonly punto: boolean;
}

/** Cómo se llama cada duración de `NOTE_LENGTHS`. */
const NOMBRES: Readonly<Record<number, string>> = {
  0.25: 'semicorchea',
  0.5: 'corchea',
  1: 'negra',
  1.5: 'negra con puntillo',
  2: 'blanca',
  3: 'blanca con puntillo',
  4: 'redonda',
};

export function figuraDe(length: number): Figura {
  return {
    // Nunca hace falta el respaldo con una duración de `NOTE_LENGTHS`, que son
    // las únicas que el modelo deja escribir; está para que un número que venga
    // de fuera se lea como algo en vez de quedarse en blanco.
    nombre: NOMBRES[length] ?? `${length} pulsos`,
    hueca: length >= 2,
    plica: length < 4,
    corchetes: length < 0.5 ? 2 : length < 1 ? 1 : 0,
    // Los puntillos son los dos valores de la lista que no son potencia de dos.
    punto: length === 1.5 || length === 3,
  };
}

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
const MELODY_BASE_MIDI = 67;

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

/**
 * La figura más larga que cabe en ese hueco, sin pasarse.
 *
 * `snapLength` busca la más **parecida**, y eso sirve para escribir lo que duró
 * una nota pero no para recortarla: la más parecida a 0,7 pulsos es la negra, que
 * no cabe. Y un hueco no cae siempre en una figura —dos inicios de la rejilla
 * pueden estar a 0,75 de distancia, que es una corchea con puntillo y no está en
 * la lista—, así que hay que bajar a la que cabe.
 *
 * El hueco nunca es menor que `GRID`, y `GRID` es la figura más corta, así que
 * siempre hay una.
 */
function figuraQueCabe(beats: number): number {
  // La lista va de menor a mayor, así que la última que cabe es la más larga.
  let mejor = NOTE_LENGTHS[0]!;
  for (const figura of NOTE_LENGTHS) {
    if (figura <= beats) {
      mejor = figura;
    }
  }
  return mejor;
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

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** La letra y la octava que le tocan a un escalón del pentagrama. */
function letterOfStep(step: number): { letter: string; octave: number } {
  const indice = ((step % 7) + 7) % 7;
  /* v8 ignore next -- el indice ya viene dado la vuelta dentro de las siete letras */
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

    // **Dos notas no pueden caer en el mismo sitio, y ninguna puede durar más
    // allá de donde empieza la siguiente.**
    //
    // Redondear cada una por su cuenta no lo garantiza: el inicio va a la
    // rejilla y la duración a la figura más parecida, y son dos redondeos
    // distintos. Con la rejilla en la corchea, un punteo de semicorcheas metía
    // dos notas en cada posición y se dibujaban una encima de otra; con la
    // rejilla más fina eso casi no pasa, pero «casi» no es una garantía y el
    // pentagrama no tiene forma de enseñar dos cosas en el mismo punto.
    //
    // Se empuja hacia delante y no se descarta: la nota sonó. Lo que se pierde
    // es exactitud de milisegundos, que es lo que ya se pierde al escribir en
    // figuras.
    const anterior = notes.at(-1);
    const suyo = clampStart((nota.at - desde) / porPulso);
    const start = anterior === undefined ? suyo : Math.max(suyo, anterior.start + GRID);

    if (anterior !== undefined && anterior.start + anterior.length > start) {
      // Recortada a una figura que exista, no al hueco exacto: el hueco puede ser
      // 0,75 —una corchea con puntillo— y en la lista no está.
      notes[notes.length - 1] = { ...anterior, length: figuraQueCabe(start - anterior.start) };
    }

    notes.push({
      id: `p${notes.length}`,
      offset,
      start,
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
  /* v8 ignore next -- un nombre de nota siempre empieza por letra */
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
    /* v8 ignore next -- la letra sale de `noteName`, asi que esta entre las siete */
    step: (octave - 4) * 7 + (indice === -1 ? 0 : indice),
  };
}
