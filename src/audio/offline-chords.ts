/**
 * Los acordes de una grabación, analizada entera y del tirón.
 *
 * El motor de croma (`chord-engine.ts`) decide **mientras suena**: diez análisis
 * por segundo, una media móvil y cuatro confirmaciones seguidas antes de enseñar
 * nada. Eso le impone tres cosas que no tienen arreglo en tiempo real:
 *
 * 1. **La ventana tiene que ser corta**, o el retardo se nota. Y con ventana
 *    corta, dos semitonos en el grave caen en la misma casilla del espectro, que
 *    es justo donde una guitarra pasa más tiempo.
 * 2. **Solo puede mirar hacia atrás.** Por eso hacen falta las cuatro
 *    confirmaciones: cuatro décimas en las que el acorde ya sonaba y no se decía.
 * 3. **Decide acorde a acorde**, sin saber si lo que viene después tiene sentido
 *    con lo que puso antes.
 *
 * Aquí no hay ninguna de las tres. Con el trozo entero delante se usa una ventana
 * cuatro veces más larga, se mide el ruido de fondo en los silencios de la propia
 * grabación en vez de con un umbral fijo, cada instante se decide sabiendo lo que
 * vino después, y **la secuencia se elige entera de una vez** con los pesos del
 * grafo armónico del dominio.
 *
 * **El audio no sale del equipo.** Esto recibe las muestras que ya están en
 * memoria y devuelve símbolos: la regla 4 de la arquitectura sigue en pie, y lo
 * que sube a la IA sigue siendo lo mismo que subía —grados y milisegundos—.
 *
 * Dominio puro salvo por el tipo de dato: entra un `Float32Array` y salen
 * acordes con su instante. No toca `AudioContext` ni `window`, así que se prueba
 * en Node con señal sintética.
 */

import {
  bestChord,
  degreeOfChord,
  nextDegrees,
  triadQuality,
  type Accidental,
  type CapturedChord,
  type KeyMode,
  type PitchClass,
} from '@core/music';

import { chromaFromSpectrum } from './chroma';
import { spectrumDb } from './fft';

export interface AnalysisOptions {
  readonly sampleRate: number;
  /**
   * Muestras por ventana. 16384 a 48 kHz son 341 ms.
   *
   * Cuatro veces lo que usa el motor en vivo, y es el punto entero de analizar
   * después: a 48 kHz una casilla pasa de medir 23,4 Hz a 2,9 Hz, y eso es lo
   * que separa el Mi y el Fa graves —que están a 4,9 Hz— en vez de fundirlos.
   */
  readonly fftSize?: number;
  /**
   * Cada cuántas muestras se abre una ventana nueva.
   *
   * Un cuarto de la ventana: solapan al 75 %, así que un acorde de medio segundo
   * cae entero dentro de varias. Sin solape, un cambio de acorde justo en el
   * borde de una ventana se leería como un acorde de en medio que no existe.
   */
  readonly hop?: number;
  /**
   * La tonalidad, si se sabe.
   *
   * Con ella, la secuencia se elige usando los pesos de `nextDegrees` —de cada
   * grado, a dónde se suele ir—, que es lo que descarta un acorde suelto que no
   * pega con sus vecinos. Sin ella se sigue suavizando, pero solo premiando que
   * un acorde dure.
   */
  readonly key?: { readonly tonic: PitchClass; readonly mode: KeyMode };
  readonly accidental?: Accidental;
  /** Por debajo de esto no se parece a ningún acorde. */
  readonly minScore?: number;
  /**
   * Cuántas ventanas seguidas tiene que ocupar un acorde para contar.
   *
   * Dos por defecto, que con el salto de serie son unos 170 ms. Es la misma idea
   * que el mínimo de pulsos de `core/music/capture.ts`, y hace falta por un
   * motivo concreto: **la ventana que cae a caballo entre el silencio y el
   * ataque** lleva medio ruido y medio acorde, y produce un acorde fantasma que
   * además se cuela el primero de la lista. Un acorde que solo aparece en una
   * ventana no es un acorde, es un borde.
   */
  readonly minFrames?: number;
}

const DEFAULTS = {
  fftSize: 16_384,
  hop: 4096,
  accidental: 'sharp',
  minScore: 0.7,
  minFrames: 2,
} as const;

/**
 * Cuánto se premia que un acorde siga sonando, frente a cambiar.
 *
 * Alto a propósito. Los acordes duran compases y las ventanas duran un tercio de
 * segundo, así que lo normal —con diferencia— es que la ventana siguiente traiga
 * el mismo acorde. Sin este premio, cualquier temblor del espectro parte un
 * acorde en dos, que es exactamente el defecto que se viene a arreglar.
 */
const STAY_BONUS = 1.2;

/** Lo que cuesta un cambio que el dominio no conoce, frente a uno que sí. */
const ODD_STEP_PENALTY = 0.5;

/**
 * El ruido de fondo de esta grabación, medido en ella misma.
 *
 * El motor en vivo usa un umbral fijo porque no tiene otra: cuando empieza a
 * sonar no sabe todavía cómo suena el silencio de esa sala. Aquí sí, y se toma
 * el percentil 10 de la energía de las ventanas, que en una grabación con
 * silencios es el suelo real del ampli y de la habitación.
 *
 * **Y va acotado, que es lo que costó descubrir.** Una grabación de alguien
 * tocando sin parar no tiene percentil 10 de silencio: tiene percentil 10 de
 * guitarra floja, porque una cuerda pulsada decae. Con solo el percentil, el
 * umbral salía por encima de la propia guitarra y no se detectaba **ni un
 * acorde** en ocho segundos de progresión. El tope —nunca por encima de un
 * cuarto de la energía típica— es lo que hace que medir la sala no se coma la
 * música cuando no hay sala que medir.
 *
 * Pasarse de permisivo no es grave: el reconocedor de acordes es la segunda
 * puerta, y el ruido no se parece a ningún acorde.
 */
function noiseFloor(energies: readonly number[]): number {
  const sorted = [...energies].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const median = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  return Math.min(p10 * 2.5, median * 0.25);
}

/** La energía de un bloque, en RMS. */
function rms(samples: Float32Array, from: number, howMany: number): number {
  let sum = 0;
  for (let i = from; i < from + howMany; i += 1) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / howMany);
}

/**
 * Lo que vale pasar de un acorde al siguiente, con el grafo del dominio.
 *
 * El grado sale de `triadQuality` y `degreeOfChord`, que es lo que ya usa
 * `capture.ts` para lo mismo. Aquí hubo un rato una tabla propia de semitonos a
 * grados, y no solo era teoría musical duplicada fuera de `core/`: deducía «es
 * menor» de si el cifrado llevaba una eme, y `Cmaj7` lleva una eme.
 */
function stepWeight(before: HeardChord, after: HeardChord, key: AnalysisOptions['key']): number {
  if (sameChord(before, after)) {
    return STAY_BONUS;
  }
  if (key === undefined) {
    return 1;
  }
  const from = degreeOfHeard(before, key);
  const to = degreeOfHeard(after, key);
  if (from === null || to === null) {
    // Uno de los dos no es de esta tonalidad. Puede pasar y no se castiga a
    // ciegas: un préstamo modal es música, no un error de lectura.
    return 1;
  }
  const step = nextDegrees(key.mode, from).find((move) => move.to === to);
  // El peso del grafo es de 0 a 1 y dice cuánto se usa ese movimiento. Un salto
  // que no está no se prohíbe: se le pone cuesta arriba.
  return step === undefined ? ODD_STEP_PENALTY : 1 + step.weight;
}

/** Un acorde tal y como se ha oído: su fundamental y las notas que suenan. */
interface HeardChord {
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
}

function sameChord(a: HeardChord, b: HeardChord): boolean {
  return (
    a.root === b.root &&
    a.notes.length === b.notes.length &&
    a.notes.every((note, i) => note === b.notes[i])
  );
}

function degreeOfHeard(chord: HeardChord, key: NonNullable<AnalysisOptions['key']>) {
  const quality = triadQuality(chord.root, chord.notes);
  return quality === null ? null : degreeOfChord(key.tonic, key.mode, chord.root, quality);
}

interface Frame {
  readonly at: number;
  readonly chord: HeardChord | null;
  readonly score: number;
}

/**
 * Los acordes de una grabación, con el instante en que empieza cada uno.
 *
 * Devuelve lo mismo que va acumulando el motor en vivo —`CapturedChord[]`—, así
 * que `core/music/capture.ts` y todo lo que hay encima no se entera de por dónde
 * ha venido. Ese es el punto de la costura: se puede cambiar cómo se oye sin
 * tocar cómo se compone.
 */
export function chordsOfRecording(
  samples: Float32Array,
  options: AnalysisOptions,
): CapturedChord[] {
  const { sampleRate } = options;
  const fftSize = options.fftSize ?? DEFAULTS.fftSize;
  const hop = options.hop ?? DEFAULTS.hop;
  const accidental = options.accidental ?? DEFAULTS.accidental;
  const minScore = options.minScore ?? DEFAULTS.minScore;

  if (samples.length < fftSize) {
    return [];
  }

  // --- 1. Una pasada midiendo, para saber cómo suena el silencio de esta sala.
  const energies: number[] = [];
  for (let i = 0; i + fftSize <= samples.length; i += hop) {
    energies.push(rms(samples, i, fftSize));
  }
  const floor = noiseFloor(energies);

  // --- 2. Una ventana por salto: espectro, croma y el acorde que más se parece.
  const frames: Frame[] = [];
  const block = new Float32Array(fftSize);
  const spectrum = new Float32Array(fftSize / 2);

  for (const [index, energy] of energies.entries()) {
    const from = index * hop;
    const at = Math.round(((from + fftSize / 2) / sampleRate) * 1000);

    if (energy < floor) {
      frames.push({ at, chord: null, score: 0 });
      continue;
    }

    block.set(samples.subarray(from, from + fftSize));
    spectrumDb(block, spectrum);
    const chroma = chromaFromSpectrum(spectrum, { sampleRate, fftSize });
    const match = bestChord(chroma, { accidental, minScore });

    frames.push({
      at,
      chord: match === null ? null : { root: match.root, notes: match.notes },
      score: match?.score ?? 0,
    });
  }

  // --- 3. La secuencia entera, de una vez.
  //
  // Programación dinámica hacia delante: para cada ventana se guarda, por cada
  // acorde candidato, lo mejor que se puede haber llegado hasta ahí. Al final se
  // deshace el camino. Es lo que permite que una ventana con un acorde raro se
  // corrija con lo que vino después, que en tiempo real es imposible.
  const chosen = chooseSequence(frames, options.key);

  // --- 4. Ventanas seguidas con el mismo acorde son un solo acorde, y las
  //        tramos demasiado cortas no son ningún acorde.
  const minFrames = options.minFrames ?? DEFAULTS.minFrames;
  const runs: { chord: NonNullable<Candidate>; from: number; largo: number }[] = [];

  for (const [i, chord] of chosen.entries()) {
    if (chord === null) {
      continue;
    }
    const last = runs[runs.length - 1];
    const continues =
      last !== undefined && last.from + last.largo === i && sameChord(last.chord, chord);
    if (continues) {
      last.largo += 1;
    } else {
      runs.push({ chord, from: i, largo: 1 });
    }
  }

  const out: CapturedChord[] = [];
  for (const run of runs) {
    if (run.largo < minFrames) {
      continue;
    }
    // Dos tramos del mismo acorde separadas solo por una que se ha caído son el
    // mismo acorde: se pegan en vez de aparecer dos veces.
    const previous = out[out.length - 1];
    if (
      previous !== undefined &&
      previous.root === run.chord.root &&
      previous.notes.length === run.chord.notes.length &&
      previous.notes.every((n, j) => n === run.chord.notes[j])
    ) {
      continue;
    }
    out.push({
      root: run.chord.root,
      notes: run.chord.notes,
      at: frames[run.from]!.at,
    });
  }

  return out;
}

type Candidate = Frame['chord'];

function chooseSequence(frames: readonly Frame[], key: AnalysisOptions['key']): Candidate[] {
  const chosen: Candidate[] = new Array<Candidate>(frames.length).fill(null);

  // Los tramos con sonido se resuelven por separado: un silencio corta la
  // canción, y arrastrar el acorde de antes de un silencio al de después sería
  // inventarse una continuidad que no existe.
  let inicio = 0;
  while (inicio < frames.length) {
    if (frames[inicio]!.chord === null) {
      inicio += 1;
      continue;
    }
    let fin = inicio;
    while (fin < frames.length && frames[fin]!.chord !== null) {
      fin += 1;
    }
    for (const [i, chord] of solveRun(frames.slice(inicio, fin), key).entries()) {
      chosen[inicio + i] = chord;
    }
    inicio = fin;
  }

  return chosen;
}

function solveRun(run: readonly Frame[], key: AnalysisOptions['key']): Candidate[] {
  if (run.length === 0) {
    return [];
  }

  // Los candidatos del tramo son los acordes que alguna ventana ha propuesto. No
  // hace falta considerar los doce por doce: si nadie lo ha oído, no está.
  const candidates: NonNullable<Candidate>[] = [];
  for (const frame of run) {
    const a = frame.chord;
    if (a !== null && !candidates.some((c) => sameChord(c, a))) {
      candidates.push(a);
    }
  }

  const best: number[][] = [];
  const cameFrom: number[][] = [];

  for (const [t, frame] of run.entries()) {
    best.push(new Array<number>(candidates.length).fill(-Infinity));
    cameFrom.push(new Array<number>(candidates.length).fill(0));

    for (const [c, candidate] of candidates.entries()) {
      // Lo bien que ese candidato explica lo que se oye en esta ventana.
      const fits = frame.chord !== null && sameChord(frame.chord, candidate) ? frame.score : 0;

      if (t === 0) {
        best[t]![c] = fits;
        continue;
      }
      for (const [p, previous] of candidates.entries()) {
        const value = best[t - 1]![p]! + stepWeight(previous, candidate, key) * 0.5 + fits;
        if (value > best[t]![c]!) {
          best[t]![c] = value;
          cameFrom[t]![c] = p;
        }
      }
    }
  }

  // Deshacer el camino from el mejor final.
  const lastIndex = run.length - 1;
  let index = 0;
  for (let c = 1; c < candidates.length; c += 1) {
    if (best[lastIndex]![c]! > best[lastIndex]![index]!) {
      index = c;
    }
  }

  const out: Candidate[] = new Array<Candidate>(run.length).fill(null);
  for (let t = lastIndex; t >= 0; t -= 1) {
    out[t] = candidates[index] ?? null;
    index = cameFrom[t]![index]!;
  }
  return out;
}
