/**
 * Croma: cuánta energía hay de cada una de las doce notas, olvidando la octava.
 *
 * Es lo que permite reconocer un acorde, que la autocorrelación no puede: esa
 * busca un único periodo y un acorde tiene tres o cuatro a la vez.
 *
 * El problema de verdad no es doblar octavas, es que los armónicos mienten. Una
 * sexta al aire suena con su quinta y su tercera mayor encima por física pura, y
 * un croma ingenuo ve un acorde de E mayor donde solo hay una cuerda pulsada.
 * Por eso lo que se suma no es el espectro entero, sino los picos, y cada pico
 * se descuenta —no se borra— si una nota más grave lo explica como armónico suyo.
 *
 * **Cuánto explica se mide en la propia serie de esa nota, no en una tabla**
 * ([adr/0107](../../docs/adr/0107-los-armonicos-se-miden-en-su-serie.md)). Hubo una:
 * la octava a 0,35 de la fundamental, la quinta de encima a 0,2, y así hasta el
 * sexto armónico. Una cuerda grave no se parece a eso —su fundamental casi no
 * sale de la caja y sus armónicos pueden sonar más que ella—, y el séptimo, que
 * cae en la séptima menor, ni se miraba: un La grave metía un Sol, y el La menor
 * se leía `C6`.
 */

import { normalizePitchClass, type PitchClass } from '@core/music';

const SEMITONES = 12;
/** A4 = 440 Hz es la referencia de todo el dominio. */
const A4_HZ = 440;
const A4_MIDI = 69;

export interface ChromaOptions {
  readonly sampleRate: number;
  /** Muestras del bloque analizado. El espectro tiene la mitad de casillas. */
  readonly fftSize: number;
  /** Por debajo hay zumbido de red y ruido de sala. */
  readonly minHz?: number;
  /** Por encima solo quedan armónicos y siseo. */
  readonly maxHz?: number;
  /** Cuánto por debajo del pico más alto se sigue mirando, en decibelios. */
  readonly rangeDb?: number;
}

const DEFAULTS = {
  minHz: 70,
  maxHz: 2200,
  rangeDb: 40,
} as const;

/**
 * Hasta qué armónico se busca el padre de un pico.
 *
 * Doce, que en el Mi grave son 989 Hz: justo el techo de lo que mira el
 * reconocedor de acordes (`ACORDES_HASTA_HZ`). Con seis, el séptimo armónico de
 * un La grave —un Sol, treinta centésimas bajo— y el noveno —un Si— entraban
 * enteros en el croma como si fueran notas.
 */
const MAX_HARMONIC = 12;
/**
 * Margen para dar por bueno que un pico cae en un armónico, en semitonos.
 *
 * **Una décima, y no las 35 centésimas de antes.** Los armónicos de una cuerda
 * caen en múltiplos casi exactos de su fundamental —la rigidez de una cuerda de
 * guitarra los sube unas pocas centésimas hasta el décimo—, así que el margen no
 * tiene que tragarse nada más que el error de medir. Con 35 centésimas y hasta el
 * duodécimo armónico, casi cualquier pico tiene otro debajo a una razón entera:
 * en una sala en silencio el descuento se comía el ruido a bocados y lo que
 * quedaba parecía un acorde.
 */
const HARMONIC_TOLERANCE = 0.1;

/**
 * Margen para buscar los vecinos de un armónico en la serie, en semitonos.
 *
 * Más ancho que el de arriba porque aquí no se decide si algo es armónico, solo
 * cuánto suena la serie alrededor: equivocarse de pico vecino cambia un poco la
 * cuenta, no inventa una nota.
 */
const VECINO_TOLERANCE = 0.35;

/**
 * Lo que tiene que pesar una nota para poder explicar a otras como armónicos
 * suyos, frente al pico más fuerte.
 *
 * No se le pide ser **más fuerte** que su armónico, que era la regla de antes y
 * es la que no se cumple: la fundamental de una sexta cuerda pesa la mitad que su
 * octava, o menos. Lo que sí se le pide es no ser ruido, porque un pico de la
 * sala en un sitio desgraciado explicaría media guitarra.
 */
const PADRE_MINIMO = 0.1;

/**
 * Lo que tiene que pesar un pico, frente al más fuerte, para contar como el bajo.
 *
 * Por debajo hay faldas, ruido de la sala y el zumbido de la red, y el zumbido
 * cae justo donde vive el bajo: los cien hercios de la red europea son un Sol.
 */
const BAJO_MINIMO = 0.15;

/**
 * Hasta dónde mira quien reconoce acordes, en hercios: en vivo y en diferido.
 *
 * Por encima de mil no suena ninguna fundamental de un acorde de guitarra —la
 * nota más aguda de una postura abierta es un Sol 4, a 392 Hz, y la de una
 * cejilla en el quinto traste, un La 4—: solo hay armónicos, y los armónicos
 * mienten. Estaba solo en el motor en vivo, y el diferido miraba hasta 2200 y
 * leía séptimas que nadie tocó; lo medido, en `docs/AUDIO-PITCH.md`.
 */
export const ACORDES_HASTA_HZ = 1000;

interface Peak {
  readonly frequency: number;
  /** Amplitud lineal, no decibelios. */
  readonly weight: number;
}

export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/** Distancia en semitonos entre dos frecuencias. Positiva si `to` es más aguda. */
function semitonesBetween(from: number, to: number): number {
  return SEMITONES * Math.log2(to / from);
}

function pitchClassOf(frequency: number): PitchClass {
  return normalizePitchClass(A4_MIDI + semitonesBetween(A4_HZ, frequency));
}

/**
 * Los picos del espectro, de más fuerte a más flojo.
 *
 * Se queda con los máximos locales, no con todas las casillas: entre dos notas
 * el espectro no está vacío, está lleno de faldas, y sumarlas emborrona el
 * croma hasta dejarlo plano.
 */
function findPeaks(
  spectrumDb: readonly number[] | Float32Array,
  options: Required<ChromaOptions>,
): Peak[] {
  const { sampleRate, fftSize, minHz, maxHz, rangeDb } = options;
  const binHz = sampleRate / fftSize;
  const first = Math.max(1, Math.floor(minHz / binHz));
  const last = Math.min(spectrumDb.length - 2, Math.ceil(maxHz / binHz));

  let loudest = -Infinity;
  for (let bin = first; bin <= last; bin += 1) {
    loudest = Math.max(loudest, spectrumDb[bin]!);
  }
  if (!Number.isFinite(loudest)) {
    return [];
  }

  const floor = loudest - rangeDb;
  const peaks: Peak[] = [];

  for (let bin = first; bin <= last; bin += 1) {
    const value = spectrumDb[bin]!;
    if (value < floor || value <= spectrumDb[bin - 1]! || value < spectrumDb[bin + 1]!) {
      continue;
    }

    // Interpolación parabólica sobre los tres puntos: sin esto, la resolución
    // de la FFT deja la nota a medio semitono de donde está de verdad.
    const previous = spectrumDb[bin - 1]!;
    const next = spectrumDb[bin + 1]!;
    /* v8 ignore next -- un pico con curvatura cero seria una meseta, y una meseta no pasa el filtro de arriba */
    const shift = (0.5 * (previous - next)) / (previous - 2 * value + next || 1);
    const frequency = (bin + shift) * binHz;

    if (frequency >= minHz && frequency <= maxHz) {
      peaks.push({ frequency, weight: dbToLinear(value - loudest) });
    }
  }

  return peaks.sort((a, b) => b.weight - a.weight);
}

/** Lo que mide el pico que cae en esa frecuencia, o null si no hay ninguno. */
function pesoEn(peaks: readonly Peak[], frequency: number): number | null {
  const pesos = peaks
    .filter((peak) => Math.abs(semitonesBetween(frequency, peak.frequency)) <= VECINO_TOLERANCE)
    .map((peak) => peak.weight);
  return pesos.length === 0 ? null : Math.max(...pesos);
}

/**
 * Cuánto debería medir el armónico `harmonic` de una nota, según sus vecinos.
 *
 * Una serie de armónicos va cayendo sin saltos, así que lo que mide el armónico
 * de en medio se parece a lo que miden el de debajo y el de encima. Se toma **el
 * menor de los dos**: si el armónico observado sube por encima, ese exceso no lo
 * pone esta cuerda, lo pone otra nota que cae en el mismo sitio, y se conserva.
 * Es lo que antes intentaba la tabla, con la diferencia de que esto lo mide cada
 * cuerda en su propia serie y no en una guitarra de catálogo.
 *
 * El de encima no se mira si cae por encima del techo del análisis —allí no hay
 * picos, y no estar no es medir cero—; si de verdad falta uno de los dos, se usa
 * el otro, porque una púa cerca del puente apaga armónicos sueltos. Si faltan
 * los dos, no hay serie y no se explica nada.
 */
function esperadoPorLaSerie(
  peaks: readonly Peak[],
  padre: number,
  harmonic: number,
  maxHz: number,
): number {
  const vecinos = [pesoEn(peaks, padre * (harmonic - 1))];
  if (padre * (harmonic + 1) <= maxHz) {
    vecinos.push(pesoEn(peaks, padre * (harmonic + 1)));
  }
  const medidos = vecinos.filter((peso): peso is number => peso !== null);
  return medidos.length === 0 ? 0 : Math.min(...medidos);
}

/** Si el armónico cae en la misma nota que su fundamental: la octava y sus dobles. */
function esOctava(harmonic: number): boolean {
  return (harmonic & (harmonic - 1)) === 0;
}

/**
 * Descuenta de cada pico lo que una nota más grave ya explica como armónico suyo.
 *
 * Solo se descuentan los armónicos **que caen en otra nota**: el tercero (la
 * quinta), el quinto (la tercera mayor), el séptimo (la séptima menor), el
 * noveno (la segunda)… La octava y sus dobles no: caen en la misma nota que la
 * cuerda, y sumarlos al croma no miente. Lo que miente de un armónico es la otra
 * nota que parece.
 *
 * Lo explicado se resta y lo demás se queda, porque puede ser una nota real que
 * cae en el mismo sitio: en un acorde de verdad la quinta de arriba suena más que
 * lo que la serie de la fundamental pone ahí.
 */
function discountHarmonics(peaks: readonly Peak[], maxHz: number): Peak[] {
  return peaks
    .map((peak) => {
      let explained = 0;

      for (const parent of peaks) {
        if (parent.frequency >= peak.frequency || parent.weight < PADRE_MINIMO) {
          continue;
        }
        const ratio = peak.frequency / parent.frequency;
        for (let harmonic = 3; harmonic <= MAX_HARMONIC; harmonic += 1) {
          if (
            !esOctava(harmonic) &&
            Math.abs(semitonesBetween(harmonic, ratio)) <= HARMONIC_TOLERANCE
          ) {
            const esperado = esperadoPorLaSerie(peaks, parent.frequency, harmonic, maxHz);
            explained = Math.max(explained, Math.min(esperado, peak.weight));
          }
        }
      }

      return { ...peak, weight: peak.weight - explained };
    })
    .filter((peak) => peak.weight > 0);
}

/** Lo que se lee de un espectro: el croma y la nota más grave que suena. */
export interface LecturaDelEspectro {
  /** Doce números, uno por nota empezando en C, con el máximo a 1. */
  readonly croma: number[];
  /**
   * La nota más grave que suena de verdad, o null si no suena nada.
   *
   * Es lo único que el croma tira a propósito —olvida la octava— y lo único que
   * separa dos acordes con las mismas notas: `Am7` y `C6`, `Bm7` y `D6`.
   */
  readonly bajo: PitchClass | null;
}

/**
 * El croma de un espectro y su bajo.
 *
 * El croma va normalizado para que el máximo valga 1, y es todo ceros si no hay
 * nada que mirar, que es información: significa que no suena nada reconocible.
 *
 * El bajo se busca **después** del descuento, entre los picos que pesan algo: un
 * armónico nunca cae por debajo de su fundamental, así que lo que queda más abajo
 * es una cuerda.
 */
export function leerEspectro(
  spectrumDb: readonly number[] | Float32Array,
  options: ChromaOptions,
): LecturaDelEspectro {
  const settings: Required<ChromaOptions> = { ...DEFAULTS, ...options };
  const chroma = new Array<number>(SEMITONES).fill(0);
  const picos = discountHarmonics(findPeaks(spectrumDb, settings), settings.maxHz);

  for (const peak of picos) {
    const pitchClass = pitchClassOf(peak.frequency);
    chroma[pitchClass]! += peak.weight;
  }

  const top = Math.max(...chroma);
  if (top <= 0) {
    return { croma: chroma, bajo: null };
  }

  const masFuerte = Math.max(...picos.map((peak) => peak.weight));
  const bajo = picos
    .filter((peak) => peak.weight >= masFuerte * BAJO_MINIMO)
    .reduce((grave, peak) => (peak.frequency < grave.frequency ? peak : grave));

  return { croma: chroma.map((value) => value / top), bajo: pitchClassOf(bajo.frequency) };
}

/** Solo el croma de un espectro: `leerEspectro` sin el bajo. */
export function chromaFromSpectrum(
  spectrumDb: readonly number[] | Float32Array,
  options: ChromaOptions,
): number[] {
  return leerEspectro(spectrumDb, options).croma;
}
