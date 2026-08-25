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

import type { ChordQuality } from './chords';
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

/** Un grado con lo que dura. */
export interface CapturedStep {
  readonly degree: DegreeSymbol;
  /** Pulsos, siempre uno o más. */
  readonly beats: number;
}

export interface Capture {
  readonly steps: readonly CapturedStep[];
  /** Acordes que no encajan en la tonalidad ni entre los prestados. */
  readonly dropped: number;
  /** Acordes que sonaron menos de lo que pide `minBeats`. */
  readonly skipped: number;
  /** Compases que ocupa entera, redondeando hacia arriba. */
  readonly bars: number;
}

const CALIDADES: ReadonlyArray<{
  readonly intervals: readonly number[];
  readonly quality: ChordQuality;
}> = [
  { intervals: [0, 4, 7], quality: 'major' },
  { intervals: [0, 3, 7], quality: 'minor' },
  { intervals: [0, 3, 6], quality: 'diminished' },
  { intervals: [0, 4, 8], quality: 'augmented' },
];

/**
 * Qué especie de tríada forman esas notas sobre esa fundamental.
 *
 * Compara conjuntos y no listas porque el croma devuelve las notas en el orden
 * que salen del vector, no en el de la partitura. Una cuatríada devuelve nulo: la
 * séptima todavía no tiene grado en el catálogo, y adivinar la tríada de dentro
 * sería tirar la nota que más define el acorde.
 */
export function triadQuality(root: PitchClass, notes: readonly PitchClass[]): ChordQuality | null {
  const relativos = new Set(notes.map((note) => normalizePitchClass(note - root)));
  if (relativos.size !== 3) {
    return null;
  }
  const found = CALIDADES.find((candidate) =>
    candidate.intervals.every((interval) => relativos.has(interval as PitchClass)),
  );
  return found?.quality ?? null;
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
    }
  }

  let dropped = 0;
  let skipped = 0;
  const pasos: CapturedStep[] = [];

  for (const [index, chord] of unicos.entries()) {
    const hasta = unicos[index + 1]?.at ?? options.endedAt;
    const pulsos = (hasta - chord.at) / porPulso;

    if (!Number.isFinite(pulsos) || pulsos < minBeats) {
      skipped += 1;
      continue;
    }

    const quality = triadQuality(chord.root, chord.notes);
    const degree =
      quality === null ? null : degreeOfChord(options.tonic, options.mode, chord.root, quality);

    if (degree === null) {
      dropped += 1;
      continue;
    }

    const beats = Math.max(1, Math.round(pulsos));
    const anterior = pasos.at(-1);

    // Segundo colapso: el mismo grado dos veces seguidas es un cambio de
    // postura, no un acorde nuevo. Se suman los pulsos en vez de repetirlo.
    if (anterior !== undefined && anterior.degree === degree) {
      pasos[pasos.length - 1] = { degree, beats: anterior.beats + beats };
    } else {
      pasos.push({ degree, beats });
    }
  }

  const steps = pasos.slice(0, MAX_SECTION_DEGREES);
  const totalBeats = steps.reduce((total, step) => total + step.beats, 0);

  return {
    steps,
    dropped,
    skipped,
    bars: Math.ceil(totalBeats / Math.max(1, beatsPerBar)),
  };
}

/** Los grados a secas, que es lo que guarda una canción. */
export function capturedDegrees(capture: Capture): DegreeSymbol[] {
  return capture.steps.map((step) => step.degree);
}
