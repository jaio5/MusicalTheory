/**
 * Una guitarra de mentira y un micrófono de mentira, para medir sin tocar.
 *
 * Lo que se viene a probar con esto no cabe en un test de una nota: **si lo que
 * se toca durante una toma entera acaba escrito como sonó**, con el clic del
 * metrónomo sonando encima y colándose por el micro. Eso pide tres cosas que aquí
 * están juntas y nada más:
 *
 * - **Una cuerda pulsada de verdad**, con el algoritmo de Karplus-Strong: un
 *   golpe de ruido que circula por un retardo del largo del periodo y se va
 *   apagando. Sale con sus armónicos, su ataque y su caída, que es justo lo que
 *   engaña a los motores. Con senos pelados se mide otra cosa.
 * - **La fuga del clic**: el sonido del metrónomo sumado encima, en cada pulso,
 *   al volumen con el que llega del altavoz al micro.
 * - **Una entrada que lee de esa señal** al ritmo de un reloj que mueve el test,
 *   para que los motores de verdad —el de tono y el de acordes— la escuchen
 *   igual que escuchan el micro.
 *
 * Es el mismo algoritmo que el de los WAV con los que se prueba en Chromium
 * (un generador en Python puro, fuera del repositorio), para que lo que fija un
 * test y lo medido en el navegador hablen de la misma señal.
 *
 * No usa `vi`, como `para-tests.ts`: el reloj lo mueve quien lo llama.
 */

import { midiToFrequency, msPerBeat } from '@core/music';

import type { AudioInput, AudioInputState } from './audio-input';
import { filtrar } from './biquad';
import { spectrumDb } from './fft';
import { muestrasDelClic } from './metronome';

export const SAMPLE_RATE = 48_000;

/** Un generador de números que siempre da los mismos: la semilla manda. */
export function aleatorio(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1_664_525) + 1_013_904_223) >>> 0;
    return estado / 2_147_483_648 - 1;
  };
}

/**
 * Una cuerda pulsada, con su caída y apagada con la mano al final.
 *
 * El retardo se redondea al entero: a 48 kHz eso desafina menos de diez
 * centésimas en la zona aguda, que es menos de lo que se desafina una guitarra.
 */
export function cuerda(midi: number, segundos: number, amplitud = 0.35, semilla = 1): Float32Array {
  const azar = aleatorio(semilla * 1000 + midi);
  const periodo = Math.max(2, Math.round(SAMPLE_RATE / midiToFrequency(midi) - 0.5));
  let anillo = Float32Array.from({ length: periodo }, () => azar());
  // Una púa blanda: la excitación suavizada dos veces.
  for (let pasada = 0; pasada < 2; pasada += 1) {
    const previa = anillo;
    anillo = previa.map((valor, i) => (valor + previa[(i + periodo - 1) % periodo]!) / 2);
  }
  // **Sin continua.** El ruido de la excitación casi nunca suma cero, y en este
  // algoritmo la media no se apaga nunca: la cuerda quedaría montada sobre un
  // escalón que ninguna cuerda de verdad tiene —un micro no deja pasar la
  // continua—. Se mide aquí porque costó una tarde: con ese escalón la
  // autocorrelación no encontraba periodo y la nota se perdía a los 200 ms.
  const media = anillo.reduce((suma, valor) => suma + valor, 0) / periodo;
  anillo = anillo.map((valor) => valor - media);

  const total = Math.round(segundos * SAMPLE_RATE);
  const salida = new Float32Array(total);
  const caida = midiToFrequency(midi) > 300 ? 0.996 : 0.998;
  for (let i = 0; i < total; i += 1) {
    const indice = i % periodo;
    const valor = anillo[indice]!;
    anillo[indice] = caida * 0.5 * (valor + anillo[(indice + 1) % periodo]!);
    salida[i] = valor * amplitud;
  }

  // Apagarla con la mano: veinticinco milisegundos, que no suene a chasquido.
  const apagado = Math.min(total, Math.round(0.025 * SAMPLE_RATE));
  for (let i = 0; i < apagado; i += 1) {
    salida[total - apagado + i]! *= 1 - i / apagado;
  }
  return salida;
}

/** Suma un trozo a la señal empezando en ese instante, en segundos. */
function sumar(destino: Float32Array, trozo: Float32Array, desde: number): void {
  const inicio = Math.round(desde * SAMPLE_RATE);
  for (let i = 0; i < trozo.length && inicio + i < destino.length; i += 1) {
    destino[inicio + i]! += trozo[i]!;
  }
}

/** Una nota que se toca: en qué pulso empieza, cuántos dura y qué altura. */
export interface NotaTocada {
  readonly start: number;
  readonly length: number;
  readonly midi: number;
}

/** Un acorde que se rasguea en cada pulso, con las cuerdas de su postura. */
export interface AcordeTocado {
  readonly start: number;
  readonly beats: number;
  readonly midis: readonly number[];
}

export interface Toma {
  readonly bpm: number;
  /** Segundos antes del compás uno: lo que dura la cuenta, y algo más. */
  readonly antes: number;
  /** Pulsos que dura lo tocado desde el compás uno. */
  readonly pulsos: number;
}

/** Una señal vacía con su ruido de sala, del largo de la toma. */
export function sala({ bpm, antes, pulsos }: Toma, semilla = 7): Float32Array {
  const azar = aleatorio(semilla);
  const segundos = antes + (pulsos * msPerBeat(bpm)) / 1000 + 1;
  return Float32Array.from({ length: Math.round(segundos * SAMPLE_RATE) }, () => azar() * 0.0015);
}

/** Un punteo: cada nota se pulsa y se apaga un poco antes de su final. */
export function puntear(notas: readonly NotaTocada[], toma: Toma): Float32Array {
  const senal = sala(toma);
  const pulso = msPerBeat(toma.bpm) / 1000;
  for (const nota of notas) {
    const trozo = cuerda(nota.midi, nota.length * pulso * 0.95, 0.35, Math.round(nota.start * 4));
    sumar(senal, trozo, toma.antes + nota.start * pulso);
  }
  return senal;
}

/** Una rítmica: un golpe hacia abajo en cada pulso, cuerda a cuerda. */
export function rasguear(acordes: readonly AcordeTocado[], toma: Toma): Float32Array {
  const senal = sala(toma);
  const pulso = msPerBeat(toma.bpm) / 1000;
  for (const acorde of acordes) {
    for (let golpe = 0; golpe < acorde.beats; golpe += 1) {
      const dura = pulso * (golpe < acorde.beats - 1 ? 0.97 : 0.95);
      acorde.midis.forEach((midi, orden) => {
        const trozo = cuerda(midi, dura, 0.16, Math.round(acorde.start * 10 + golpe));
        sumar(senal, trozo, toma.antes + (acorde.start + golpe) * pulso + orden * 0.012);
      });
    }
  }
  return senal;
}

/**
 * El clic de antes de que sonara toda la toma: una onda cuadrada de 1000 y 1600
 * Hz. Se queda aquí para poder medir el antes y el después con la misma vara.
 */
export function clicCuadrado(fuerte: boolean): Float32Array {
  const hz = fuerte ? 1600 : 1000;
  const pico = fuerte ? 0.35 : 0.22;
  const total = Math.round(0.03 * SAMPLE_RATE);
  return Float32Array.from({ length: total }, (_, i) => {
    const t = i / SAMPLE_RATE;
    const ganancia =
      t < 0.002 ? (pico * t) / 0.002 : pico * (0.0001 / pico) ** ((t - 0.002) / 0.028);
    return ganancia * (Math.sin(2 * Math.PI * hz * t) >= 0 ? 1 : -1);
  });
}

export type ClicDePrueba = 'ruido' | 'cuadrado';

/**
 * Suma el clic encima, desde la cuenta hasta el final, como lo oye el micro.
 *
 * `fuga` es cuánto llega del altavoz al micro frente a su nivel digital: 0,6 es
 * un portátil con la guitarra delante, que es el caso donde peor se cuela.
 * Devuelve los instantes de cada clic, en milisegundos desde el principio.
 */
export function sumarClic(
  senal: Float32Array,
  { bpm, antes, pulsos }: Toma,
  clic: ClicDePrueba,
  fuga = 0.6,
  beatsPerBar = 4,
): number[] {
  const pulso = msPerBeat(bpm) / 1000;
  const instantes: number[] = [];
  for (let k = -2 * beatsPerBar; k <= pulsos; k += 1) {
    const fuerte = ((k % beatsPerBar) + beatsPerBar) % beatsPerBar === 0;
    const trozo = clic === 'ruido' ? muestrasDelClic(SAMPLE_RATE, fuerte) : clicCuadrado(fuerte);
    const desde = antes + k * pulso;
    sumar(
      senal,
      trozo.map((valor) => valor * fuga),
      desde,
    );
    instantes.push(desde * 1000);
  }
  return instantes;
}

/**
 * Un micrófono que lee de una señal ya hecha, al instante que marque el reloj.
 *
 * Entrega lo mismo que el `AnalyserNode` de `web-audio-input.ts`: el último
 * bloque en el tiempo y su espectro en decibelios, con el mismo suavizado entre
 * análisis. Con `pasoBajo` filtra antes, como la entrada de verdad.
 */
export class EntradaGrabada implements AudioInput {
  readonly state: AudioInputState = 'running';
  readonly sampleRate = SAMPLE_RATE;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  readonly error = null;

  readonly #senal: Float32Array;
  readonly #reloj: () => number;
  #suavizado: Float32Array | null = null;

  constructor(senal: Float32Array, reloj: () => number, pasoBajo: number | null = null) {
    this.#senal =
      pasoBajo === null
        ? senal
        : filtrar(
            filtrar(Float32Array.from(senal), 'paso-bajo', pasoBajo, SAMPLE_RATE),
            'paso-bajo',
            pasoBajo,
            SAMPLE_RATE,
          );
    this.#reloj = reloj;
  }

  /** Copia el bloque que acaba en el instante del reloj; ceros antes del principio. */
  #bloque(destino: Float32Array): void {
    const fin = Math.round((this.#reloj() / 1000) * SAMPLE_RATE);
    for (let i = 0; i < destino.length; i += 1) {
      destino[i] = this.#senal[fin - destino.length + i] ?? 0;
    }
  }

  readTimeDomain(target: Float32Array<ArrayBuffer>): boolean {
    this.#bloque(target);
    return true;
  }

  readSpectrum(target: Float32Array<ArrayBuffer>): boolean {
    const bloque = new Float32Array(this.spectrumSize);
    this.#bloque(bloque);
    const db = spectrumDb(bloque);
    // El suavizado del analizador va sobre la magnitud, no sobre los decibelios.
    const anterior = this.#suavizado ?? db.map((valor) => 10 ** (valor / 20));
    this.#suavizado = anterior.map((previa, i) => 0.2 * previa + 0.8 * 10 ** (db[i]! / 20));
    for (let i = 0; i < target.length; i += 1) {
      target[i] = 20 * Math.log10(Math.max(1e-12, this.#suavizado[i]!));
    }
    return true;
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}
