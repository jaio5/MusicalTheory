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
  nextDegrees,
  normalizePitchClass,
  type Accidental,
  type CapturedChord,
  type DegreeSymbol,
  type KeyMode,
  type PitchClass,
} from '@core/music';

import { chromaFromSpectrum } from './chroma';
import { espectroDb } from './fft';

export interface AnalisisOptions {
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
  readonly minVentanas?: number;
}

const DEFAULTS = {
  fftSize: 16_384,
  hop: 4096,
  accidental: 'sharp',
  minScore: 0.7,
  minVentanas: 2,
} as const;

/**
 * Cuánto se premia que un acorde siga sonando, frente a cambiar.
 *
 * Alto a propósito. Los acordes duran compases y las ventanas duran un tercio de
 * segundo, así que lo normal —con diferencia— es que la ventana siguiente traiga
 * el mismo acorde. Sin este premio, cualquier temblor del espectro parte un
 * acorde en dos, que es exactamente el defecto que se viene a arreglar.
 */
const PREMIO_POR_QUEDARSE = 1.2;

/** Lo que cuesta un cambio que el dominio no conoce, frente a uno que sí. */
const CASTIGO_POR_SALTO_RARO = 0.5;

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
function sueloDeRuido(energias: readonly number[]): number {
  const ordenadas = [...energias].sort((a, b) => a - b);
  const p10 = ordenadas[Math.floor(ordenadas.length * 0.1)] ?? 0;
  const mediana = ordenadas[Math.floor(ordenadas.length * 0.5)] ?? 0;
  return Math.min(p10 * 2.5, mediana * 0.25);
}

/** La energía de un bloque, en RMS. */
function rms(muestras: Float32Array, desde: number, cuantas: number): number {
  let suma = 0;
  for (let i = desde; i < desde + cuantas; i += 1) {
    const v = muestras[i] ?? 0;
    suma += v * v;
  }
  return Math.sqrt(suma / cuantas);
}

/** El grado de un acorde en esa tonalidad, o nulo si no es de la casa. */
function gradoDe(
  root: PitchClass,
  key: { readonly tonic: PitchClass; readonly mode: KeyMode },
  esMenor: boolean,
): DegreeSymbol | null {
  const distancia = normalizePitchClass(root - key.tonic);
  const MAYOR: Readonly<Record<number, string>> = {
    0: 'I',
    2: 'ii',
    4: 'iii',
    5: 'IV',
    7: 'V',
    9: 'vi',
    10: 'bVII',
    11: 'vii°',
  };
  const MENOR: Readonly<Record<number, string>> = {
    0: 'i',
    2: 'ii°',
    3: 'III',
    5: 'iv',
    7: 'v',
    8: 'VI',
    10: 'VII',
    1: 'bII',
  };
  const tabla = key.mode === 'minor' ? MENOR : MAYOR;
  const grado = tabla[distancia];
  if (grado === undefined) {
    return null;
  }
  // En menor, el V mayor y el v menor son los dos grados distintos y suenan
  // distinto: sin esto, una dominante con sensible se leería como la sin ella.
  if (key.mode === 'minor' && distancia === 7) {
    return (esMenor ? 'v' : 'V') as DegreeSymbol;
  }
  return grado as DegreeSymbol;
}

/** Lo que vale pasar de un acorde al siguiente, con el grafo del dominio. */
function pesoDelSalto(
  de: { root: PitchClass; menor: boolean },
  a: { root: PitchClass; menor: boolean },
  key: AnalisisOptions['key'],
): number {
  if (de.root === a.root && de.menor === a.menor) {
    return PREMIO_POR_QUEDARSE;
  }
  if (key === undefined) {
    return 1;
  }
  const desde = gradoDe(de.root, key, de.menor);
  const hasta = gradoDe(a.root, key, a.menor);
  if (desde === null || hasta === null) {
    // Uno de los dos no es de esta tonalidad. Puede pasar y no se castiga a
    // ciegas: un préstamo modal es música, no un error de lectura.
    return 1;
  }
  const salto = nextDegrees(key.mode, desde).find((m) => m.to === hasta);
  // El peso del grafo es de 0 a 1 y dice cuánto se usa ese movimiento. Un salto
  // que no está no se prohíbe: se le pone cuesta arriba.
  return salto === undefined ? CASTIGO_POR_SALTO_RARO : 1 + salto.weight;
}

interface Ventana {
  readonly at: number;
  readonly acorde: { root: PitchClass; notes: readonly PitchClass[]; menor: boolean } | null;
  readonly puntuacion: number;
}

/**
 * Los acordes de una grabación, con el instante en que empieza cada uno.
 *
 * Devuelve lo mismo que va acumulando el motor en vivo —`CapturedChord[]`—, así
 * que `core/music/capture.ts` y todo lo que hay encima no se entera de por dónde
 * ha venido. Ese es el punto de la costura: se puede cambiar cómo se oye sin
 * tocar cómo se compone.
 */
export function acordesDeGrabacion(
  muestras: Float32Array,
  options: AnalisisOptions,
): CapturedChord[] {
  const { sampleRate } = options;
  const fftSize = options.fftSize ?? DEFAULTS.fftSize;
  const hop = options.hop ?? DEFAULTS.hop;
  const accidental = options.accidental ?? DEFAULTS.accidental;
  const minScore = options.minScore ?? DEFAULTS.minScore;

  if (muestras.length < fftSize) {
    return [];
  }

  // --- 1. Una pasada midiendo, para saber cómo suena el silencio de esta sala.
  const energias: number[] = [];
  for (let i = 0; i + fftSize <= muestras.length; i += hop) {
    energias.push(rms(muestras, i, fftSize));
  }
  const suelo = sueloDeRuido(energias);

  // --- 2. Una ventana por salto: espectro, croma y el acorde que más se parece.
  const ventanas: Ventana[] = [];
  const bloque = new Float32Array(fftSize);
  const espectro = new Float32Array(fftSize / 2);

  for (const [indice, energia] of energias.entries()) {
    const desde = indice * hop;
    const at = Math.round(((desde + fftSize / 2) / sampleRate) * 1000);

    if (energia < suelo) {
      ventanas.push({ at, acorde: null, puntuacion: 0 });
      continue;
    }

    bloque.set(muestras.subarray(desde, desde + fftSize));
    espectroDb(bloque, espectro);
    const chroma = chromaFromSpectrum(espectro, { sampleRate, fftSize });
    const match = bestChord(chroma, { accidental, minScore });

    ventanas.push({
      at,
      acorde:
        match === null
          ? null
          : { root: match.root, notes: match.notes, menor: match.symbol.includes('m') },
      puntuacion: match?.score ?? 0,
    });
  }

  // --- 3. La secuencia entera, de una vez.
  //
  // Programación dinámica hacia delante: para cada ventana se guarda, por cada
  // acorde candidato, lo mejor que se puede haber llegado hasta ahí. Al final se
  // deshace el camino. Es lo que permite que una ventana con un acorde raro se
  // corrija con lo que vino después, que en tiempo real es imposible.
  const elegidos = elegirSecuencia(ventanas, options.key);

  // --- 4. Ventanas seguidas con el mismo acorde son un solo acorde, y las
  //        rachas demasiado cortas no son ningún acorde.
  const minVentanas = options.minVentanas ?? DEFAULTS.minVentanas;
  const rachas: { acorde: NonNullable<Candidato>; desde: number; largo: number }[] = [];

  for (const [i, acorde] of elegidos.entries()) {
    if (acorde === null) {
      continue;
    }
    const ultima = rachas[rachas.length - 1];
    const sigue =
      ultima !== undefined &&
      ultima.desde + ultima.largo === i &&
      ultima.acorde.root === acorde.root &&
      ultima.acorde.menor === acorde.menor;
    if (sigue) {
      ultima.largo += 1;
    } else {
      rachas.push({ acorde, desde: i, largo: 1 });
    }
  }

  const salida: CapturedChord[] = [];
  for (const racha of rachas) {
    if (racha.largo < minVentanas) {
      continue;
    }
    // Dos rachas del mismo acorde separadas solo por una que se ha caído son el
    // mismo acorde: se pegan en vez de aparecer dos veces.
    const anterior = salida[salida.length - 1];
    if (
      anterior !== undefined &&
      anterior.root === racha.acorde.root &&
      anterior.notes.length === racha.acorde.notes.length &&
      anterior.notes.every((n, j) => n === racha.acorde.notes[j])
    ) {
      continue;
    }
    salida.push({
      root: racha.acorde.root,
      notes: racha.acorde.notes,
      at: ventanas[racha.desde]!.at,
    });
  }

  return salida;
}

type Candidato = Ventana['acorde'];

function elegirSecuencia(ventanas: readonly Ventana[], key: AnalisisOptions['key']): Candidato[] {
  const elegidos: Candidato[] = new Array<Candidato>(ventanas.length).fill(null);

  // Los tramos con sonido se resuelven por separado: un silencio corta la
  // canción, y arrastrar el acorde de antes de un silencio al de después sería
  // inventarse una continuidad que no existe.
  let inicio = 0;
  while (inicio < ventanas.length) {
    if (ventanas[inicio]!.acorde === null) {
      inicio += 1;
      continue;
    }
    let fin = inicio;
    while (fin < ventanas.length && ventanas[fin]!.acorde !== null) {
      fin += 1;
    }
    for (const [i, acorde] of resolverTramo(ventanas.slice(inicio, fin), key).entries()) {
      elegidos[inicio + i] = acorde;
    }
    inicio = fin;
  }

  return elegidos;
}

function resolverTramo(tramo: readonly Ventana[], key: AnalisisOptions['key']): Candidato[] {
  if (tramo.length === 0) {
    return [];
  }

  // Los candidatos del tramo son los acordes que alguna ventana ha propuesto. No
  // hace falta considerar los doce por doce: si nadie lo ha oído, no está.
  const candidatos: NonNullable<Candidato>[] = [];
  for (const ventana of tramo) {
    const a = ventana.acorde;
    if (a !== null && !candidatos.some((c) => c.root === a.root && c.menor === a.menor)) {
      candidatos.push(a);
    }
  }

  const mejor: number[][] = [];
  const venimosDe: number[][] = [];

  for (const [t, ventana] of tramo.entries()) {
    mejor.push(new Array<number>(candidatos.length).fill(-Infinity));
    venimosDe.push(new Array<number>(candidatos.length).fill(0));

    for (const [c, candidato] of candidatos.entries()) {
      // Lo bien que ese candidato explica lo que se oye en esta ventana.
      const encaja =
        ventana.acorde !== null &&
        ventana.acorde.root === candidato.root &&
        ventana.acorde.menor === candidato.menor
          ? ventana.puntuacion
          : 0;

      if (t === 0) {
        mejor[t]![c] = encaja;
        continue;
      }
      for (const [p, previo] of candidatos.entries()) {
        const valor = mejor[t - 1]![p]! + pesoDelSalto(previo, candidato, key) * 0.5 + encaja;
        if (valor > mejor[t]![c]!) {
          mejor[t]![c] = valor;
          venimosDe[t]![c] = p;
        }
      }
    }
  }

  // Deshacer el camino desde el mejor final.
  const ultimo = tramo.length - 1;
  let indice = 0;
  for (let c = 1; c < candidatos.length; c += 1) {
    if (mejor[ultimo]![c]! > mejor[ultimo]![indice]!) {
      indice = c;
    }
  }

  const salida: Candidato[] = new Array<Candidato>(tramo.length).fill(null);
  for (let t = ultimo; t >= 0; t -= 1) {
    salida[t] = candidatos[indice] ?? null;
    indice = venimosDe[t]![indice]!;
  }
  return salida;
}
