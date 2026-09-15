/**
 * Lo que has tocado, convertido en una progresión con duraciones.
 *
 * Esto es «grabar un trozo» sin grabar nada: el motor de croma ya dice qué
 * acorde suena y cuándo, así que lo que se guarda de la grabación son **símbolos
 * y milisegundos**, nunca una muestra de sonido. Es lo que permite pedirle
 * versiones a la IA sin subir audio, y por eso la regla 4 de la arquitectura
 * sigue en pie.
 *
 * Dominio puro y con el instante por parámetro, como `exercise.ts`: una
 * grabación de tres minutos se prueba entera sin esperar ni un milisegundo real.
 *
 * Lo que se pierde y conviene tener presente: no hay ritmo dentro del compás, no
 * hay melodía y las inversiones se leen como el acorde en estado fundamental
 * —el croma olvida la octava, [adr/0004]—. Lo que sale de aquí es la armonía y
 * su reparto en el tiempo, que es justo lo que hace falta para rearmonizar.
 */

import { chordSymbol, TRIADS, type ChordQuality } from './chords';
import { accidentalForKey } from './circle-of-fifths';
import type { KeyMode } from './keys';
import { normalizePitchClass, type PitchClass } from './notes';
import { degreeOfChord, type DegreeSymbol } from './progressions';
import { MAX_SECTION_DEGREES } from './song';
import { clampBpm, DEFAULT_BEATS_PER_BAR, msPerBeat } from './tempo';

/** Un acorde oído, con el instante en que empezó a sonar. */
export interface CapturedChord {
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
  /** Milisegundos, del reloj que sea. Solo se usan las diferencias. */
  readonly at: number;
  /** Lo que se parecía, de 0 a 1. Opcional: hay capturas escritas a mano. */
  readonly score?: number;
  /** Cuánto se despegaba del siguiente candidato. Cero es un empate. */
  readonly margin?: number;
  /** Lo que también pudo ser, para poder corregirlo después. */
  readonly alternatives?: readonly {
    readonly root: PitchClass;
    readonly notes: readonly PitchClass[];
  }[];
}

export interface CaptureOptions {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
  readonly bpm: number;
  /** Cuándo se paró de grabar. Es lo que mide el último acorde. */
  readonly endedAt: number;
  readonly beatsPerBar?: number;
  /**
   * Lo que tiene que durar un acorde para contar, en pulsos.
   *
   * Medio pulso por defecto, y no cero: al pasar de un acorde a otro el croma
   * enseña un instante el de en medio —las dos manos no cambian a la vez— y sin
   * este filtro cada cambio metería un acorde fantasma en la progresión.
   */
  readonly minBeats?: number;
}

/** Un grado con lo que dura, y con lo seguro que se estuvo de él. */
export interface CapturedStep {
  readonly degree: DegreeSymbol;
  /** Pulsos, siempre uno o más. */
  readonly beats: number;
  /**
   * Cuánto se despegaba del siguiente candidato, de 0 a 1. Uno es «no había con
   * qué confundirlo».
   *
   * **Es el mínimo de los acordes que se fundieron en este paso, no la media.**
   * Si de los tres fotogramas que se unieron uno era dudoso, el paso es dudoso:
   * promediar escondería la duda justo donde hay que preguntar.
   */
  readonly confidence: number;
  /** Los grados que también pudo ser, para poder corregirlo sin volver a tocar. */
  readonly alternatives: readonly DegreeSymbol[];
}

/**
 * Un tramo que sonó y no se pudo leer.
 *
 * Antes esto era un número —«se han caído tres»— y con un número no se puede
 * hacer nada: ni saber dónde estaban, ni preguntar qué eran, ni dejar el hueco
 * marcado en la progresión. Con el instante y el cifrado que se oyó, el hueco se
 * puede enseñar donde estaba y quien tocó puede decir qué era.
 *
 * Se cae por dos motivos y los dos se distinguen: `fuera` es un acorde que se
 * oyó bien y no es ninguno de los grados del modo —un F#m en Do mayor—, y
 * `ilegible` es que no se pareció lo bastante a nada.
 */
export interface UnreadChord {
  /** Milisegundos desde que empezó a grabarse. */
  readonly at: number;
  readonly beats: number;
  /** El cifrado que se oyó, cuando se oyó alguno. */
  readonly symbol: string | null;
  readonly reason: 'fuera' | 'ilegible';
}

export interface Capture {
  readonly steps: readonly CapturedStep[];
  /**
   * Lo que sonó y no se pudo apuntar, con dónde estaba y qué se oyó.
   *
   * No es una lista de errores: es lo que hace falta para poder arreglarlo. Un
   * `F#m` tocado en una canción en Do es casi siempre que la tonalidad detectada
   * está mal, y eso solo se ve si se enseña qué se cayó.
   */
  readonly unread: readonly UnreadChord[];
  /** Acordes que no encajan en la tonalidad ni entre los prestados. */
  readonly dropped: number;
  /** Acordes que sonaron menos de lo que pide `minBeats`. */
  readonly skipped: number;
  /** Compases que ocupa entera, redondeando hacia arriba. */
  readonly bars: number;
}

/**
 * Lo que suena, medido desde la fundamental y sin repetir.
 *
 * Conjunto y no lista porque el croma devuelve las notas en el orden en que
 * salen del vector, no en el de la partitura.
 */
function intervalosDesde(root: PitchClass, notes: readonly PitchClass[]): ReadonlySet<number> {
  return new Set(notes.map((note) => normalizePitchClass(note - root)));
}

/**
 * La primera tríada del catálogo que está entera ahí dentro.
 *
 * El catálogo es `TRIADS`, de `chords.ts`, y **no una copia**: que un acorde
 * mayor sea 0-4-7 se escribe en un sitio. Que sea la primera que encaja y no la
 * que mejor encaje también viene de allí, con su porqué.
 */
function triadaDentro(relativos: ReadonlySet<number>): ChordQuality | null {
  const found = TRIADS.find(
    (candidate) =>
      relativos.has(0) && relativos.has(candidate.third) && relativos.has(candidate.fifth),
  );
  return found?.quality ?? null;
}

/**
 * Qué especie de tríada forman esas notas sobre esa fundamental.
 *
 * Una cuatríada devuelve nulo: la séptima todavía no tiene grado en el catálogo,
 * y adivinar la tríada de dentro sería tirar la nota que más define el acorde.
 * Eso —y solo eso— es lo que la separa de `triadInside`.
 */
export function triadQuality(root: PitchClass, notes: readonly PitchClass[]): ChordQuality | null {
  const relativos = intervalosDesde(root, notes);
  return relativos.size === 3 ? triadaDentro(relativos) : null;
}

/**
 * La tríada que hay **dentro** de un acorde, tenga las notas que tenga.
 *
 * `triadQuality` exige que sean exactamente tres, porque eso es lo que oye el
 * croma y ahí de más significa que se ha colado una nota. Al escribir un cifrado
 * es al revés: un `Am7` tiene cuatro notas y sigue siendo el mismo grado que un
 * `Am`, y un `C7b9` tiene cinco y sigue siendo el I.
 *
 * Se busca la primera calidad cuyos intervalos estén todos presentes, y por eso
 * el orden de `TRIADS` importa: un `7#9` lleva dentro la tercera mayor y la
 * menor, y es un acorde mayor con una tensión, no un acorde menor.
 *
 * No vale mirar las tres primeras notas: van ordenadas por semitono, así que las
 * tres primeras de un `add9` son la fundamental, la novena y la tercera.
 */
export function triadInside(root: PitchClass, notes: readonly PitchClass[]): ChordQuality | null {
  return triadaDentro(intervalosDesde(root, notes));
}

/** Si dos acordes oídos son el mismo. El croma no distingue inversiones. */
function esElMismo(a: CapturedChord, b: CapturedChord): boolean {
  if (a.root !== b.root || a.notes.length !== b.notes.length) {
    return false;
  }
  const suyas = new Set(b.notes);
  return a.notes.every((note) => suyas.has(note));
}

/**
 * Los candidatos que también cabían, traducidos a grados de esta tonalidad.
 *
 * Se cae lo que no es un grado del modo y lo que ya es el elegido: al corregir
 * hay que ofrecer lo que **cambia** algo, y una lista con el mismo acorde dentro
 * es una lista con una opción que no hace nada.
 */
function gradosDe(
  alternatives: CapturedChord['alternatives'],
  tonic: PitchClass,
  mode: KeyMode,
  elegido: DegreeSymbol,
): DegreeSymbol[] {
  const salida: DegreeSymbol[] = [];
  for (const otra of alternatives ?? []) {
    const quality = triadQuality(otra.root, otra.notes) ?? triadInside(otra.root, otra.notes);
    const degree = quality === null ? null : degreeOfChord(tonic, mode, otra.root, quality);
    if (degree !== null && degree !== elegido && !salida.includes(degree)) {
      salida.push(degree);
    }
  }
  return salida;
}

/**
 * La progresión que sale de lo que se ha tocado.
 *
 * Colapsa dos veces, y las dos hacen falta por motivos distintos: la primera une
 * repeticiones del **mismo acorde oído**, que es lo que emite el motor mientras
 * la mano no se mueve; la segunda une grados iguales seguidos, que es lo que
 * pasa cuando se cambia de postura sin cambiar de acorde —de C al aire a C en
 * cejilla— y el croma lo lee como dos acordes distintos y el mismo grado.
 */
export function captureProgression(
  heard: readonly CapturedChord[],
  options: CaptureOptions,
): Capture {
  const bpm = clampBpm(options.bpm);
  const porPulso = msPerBeat(bpm);
  const beatsPerBar = options.beatsPerBar ?? DEFAULT_BEATS_PER_BAR;
  const minBeats = options.minBeats ?? 0.5;

  // Primer colapso: lo que el motor repite mientras no cambia nada.
  const unicos: CapturedChord[] = [];
  for (const chord of heard) {
    const ultimo = unicos.at(-1);
    if (ultimo === undefined || !esElMismo(ultimo, chord)) {
      unicos.push(chord);
      continue;
    }
    // **La duda del repetido no se tira.** El motor emite el mismo acorde
    // muchas veces mientras la mano no se mueve, y cada vez con su margen: si
    // en alguno de esos análisis estuvo a punto de decir otra cosa, el acorde
    // entero es dudoso. Quedarse con el margen del primero escondía justo eso.
    if ((chord.margin ?? 1) < (ultimo.margin ?? 1)) {
      unicos[unicos.length - 1] = { ...ultimo, margin: chord.margin, score: chord.score };
    }
  }

  let dropped = 0;
  let skipped = 0;
  const pasos: CapturedStep[] = [];
  const unread: UnreadChord[] = [];
  const desde = unicos[0]?.at ?? 0;

  for (const [index, chord] of unicos.entries()) {
    const hasta = unicos[index + 1]?.at ?? options.endedAt;
    const pulsos = (hasta - chord.at) / porPulso;

    if (!Number.isFinite(pulsos) || pulsos < minBeats) {
      skipped += 1;
      continue;
    }

    const beats = Math.max(1, Math.round(pulsos));
    const quality = triadQuality(chord.root, chord.notes);
    const degree =
      quality === null ? null : degreeOfChord(options.tonic, options.mode, chord.root, quality);

    if (degree === null) {
      dropped += 1;
      // Se apunta dónde estaba y qué se oyó. Con un contador no se puede
      // preguntar «aquí sonó algo que no supe leer, ¿qué era?».
      unread.push({
        at: chord.at - desde,
        beats,
        symbol:
          quality === null
            ? null
            : chordSymbol(chord.root, quality, accidentalForKey(options.tonic, options.mode)),
        reason: quality === null ? 'ilegible' : 'fuera',
      });
      continue;
    }

    // La confianza que trae el acorde. Sin ella —una captura escrita a mano o de
    // un test viejo— se da por cierta: lo contrario sería marcar como dudoso todo
    // lo que no venga del micro.
    const confidence = chord.margin ?? 1;
    const alternatives = gradosDe(chord.alternatives, options.tonic, options.mode, degree);
    const anterior = pasos.at(-1);

    // Segundo colapso: el mismo grado dos veces seguidas es un cambio de
    // postura, no un acorde nuevo. Se suman los pulsos en vez de repetirlo.
    if (anterior !== undefined && anterior.degree === degree) {
      pasos[pasos.length - 1] = {
        degree,
        beats: anterior.beats + beats,
        // El mínimo, no la media: si uno de los que se funden era dudoso, el
        // paso entero lo es. Promediar escondería la duda donde hay que
        // preguntar.
        confidence: Math.min(anterior.confidence, confidence),
        alternatives: [...new Set([...anterior.alternatives, ...alternatives])],
      };
    } else {
      pasos.push({ degree, beats, confidence, alternatives });
    }
  }

  const steps = pasos.slice(0, MAX_SECTION_DEGREES);
  const totalBeats = steps.reduce((total, step) => total + step.beats, 0);

  return {
    steps,
    unread,
    dropped,
    skipped,
    bars: Math.ceil(totalBeats / Math.max(1, beatsPerBar)),
  };
}

/** Los grados a secas, que es lo que guarda una canción. */
export function capturedDegrees(capture: Capture): DegreeSymbol[] {
  return capture.steps.map((step) => step.degree);
}
