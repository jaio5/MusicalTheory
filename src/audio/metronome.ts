/**
 * El metrónomo.
 *
 * El pulso no se puede llevar con un temporizador de JavaScript: el hilo se
 * atasca con cualquier cosa y el clic llega tarde. Lo que se hace es programar
 * los golpes en el reloj del audio, que es independiente, y usar el temporizador
 * solo para ir mirando por delante y programar los siguientes.
 *
 * ## El clic es un golpe de ruido agudo, y por qué
 *
 * Era una onda cuadrada de 1000 y 1600 Hz. Mientras solo sonaba antes de grabar
 * daba igual cómo fuera; **ahora suena durante toda la toma, y el micro lo oye**.
 * Medido con una guitarra sintética y el clic sumado a su volumen de fuga, la
 * cuadrada partía cada nota larga en un trozo por pulso y metía notas de Si 5 en
 * los silencios: su periodo cae dentro del rango del motor de tono (70 a 1400
 * Hz), así que la autocorrelación la reconoce como una nota más, y sus armónicos
 * impares —Si, Fa#, Sol— entran en el croma.
 *
 * El golpe nuevo es **ruido filtrado por encima de 4,5 kHz**, y eso lo deja
 * fuera de los dos motores por dos razones distintas:
 *
 * - **No tiene altura.** El ruido no se repite, así que la autocorrelación no
 *   encuentra periodo y su claridad no llega a nada. Un tono puro agudo no
 *   valdría: un seno de 3 kHz también se repite cada tres periodos, a 1 kHz, y el
 *   motor lo leería ahí.
 * - **Vive donde no se mira.** El croma mira hasta 2,2 kHz y la entrada filtra
 *   por debajo de 3 kHz antes de analizar (`web-audio-input.ts`): lo que queda
 *   del clic llega veinte decibelios más abajo.
 *
 * Suena como el «tic» de madera de un metrónomo de los de siempre, que no es
 * casualidad: es el mismo truco, un golpe corto y brillante sin nota.
 *
 * El ruido se fabrica aquí —`muestrasDelClic`— y ya filtrado, una vez por
 * contexto. Así la guitarra de los tests (`guitarra-sintetica.ts`) suma
 * **exactamente** este clic, y lo que se mide allí es lo que suena aquí.
 */

import { clampBpm, DEFAULT_BEATS_PER_BAR } from '@core/music';

import { cerrarContexto, contextoDespierto } from './audio-context';
import { filtrar } from './biquad';

export interface MetronomeOptions {
  readonly bpm: number;
  /** Cuántos pulsos por compás. El primero suena más fuerte. */
  readonly beatsPerBar?: number;
  /**
   * Se llama en cada pulso, con el número dentro del compás empezando en 0 y
   * **cuándo suena**, en la escala de `performance.now`. El instante es opcional
   * para quien lo llama a mano —los dobles de los tests—: sin él, quien lo usa
   * cae al reloj del momento.
   *
   * El instante no es el del aviso: el aviso va por temporizador y llega cuando
   * llega. Es el del reloj del audio traducido, más lo que tarda el altavoz en
   * sacarlo, que es cuando lo oye quien toca y por tanto donde cae su nota.
   */
  readonly onBeat?: (beat: number, instante?: number) => void;
  /** De 0 a 1. Cero no para el pulso: lo calla, y los avisos siguen llegando. */
  readonly volume?: number;
}

export interface Metronome {
  readonly running: boolean;
  start(options: MetronomeOptions): Promise<void>;
  /** Cambia la velocidad sin cortar el pulso. */
  setBpm(bpm: number): void;
  /**
   * Cambia el volumen sin cortar el pulso, también el de los clics ya programados.
   *
   * Opcional porque solo lo pide la toma, que es donde el clic suena mientras se
   * toca y hay que poder bajarlo; los otros que llevan pulso no lo necesitan.
   */
  setVolume?(volume: number): void;
  stop(): void;
  dispose(): Promise<void>;
}

/** Cada cuánto se mira por delante, en milisegundos. */
const LOOKAHEAD_MS = 25;
/** Cuánto se programa por delante, en segundos. */
const SCHEDULE_AHEAD_S = 0.15;

/** Por debajo de esto el golpe se queda dentro de lo que miran los motores. */
export const CORTE_DEL_CLIC_HZ = 4500;

/**
 * El golpe, ya filtrado y con su envolvente: un milisegundo de subida y una
 * caída exponencial. El del primer pulso del compás dura más y suena más fuerte,
 * que es lo que lo distingue sin cambiarle el timbre.
 */
export function muestrasDelClic(sampleRate: number, fuerte: boolean): Float32Array {
  const dura = fuerte ? 0.035 : 0.025;
  const pico = fuerte ? 0.5 : 0.32;
  const total = Math.round(dura * sampleRate);
  // Siempre el mismo ruido: un generador congruencial con semilla fija. Con
  // `Math.random` cada pulso sonaría un poco distinto, y la guitarra de los
  // tests no podría sumar el mismo.
  let estado = 12_345;
  const golpe = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    estado = (Math.imul(estado, 1_664_525) + 1_013_904_223) >>> 0;
    const t = i / sampleRate;
    const ganancia =
      t < 0.001 ? (pico * t) / 0.001 : pico * (0.0001 / pico) ** ((t - 0.001) / (dura - 0.001));
    golpe[i] = (estado / 2_147_483_648 - 1) * ganancia;
  }
  // Dos pasadas: doce decibelios por octava no bastaban para sacarlo del croma.
  filtrar(golpe, 'paso-alto', CORTE_DEL_CLIC_HZ, sampleRate);
  return filtrar(golpe, 'paso-alto', CORTE_DEL_CLIC_HZ, sampleRate);
}

/** El volumen que se pide, dentro de lo que se puede dar. */
function acotarVolumen(volume: number | undefined): number {
  if (volume === undefined || Number.isNaN(volume)) {
    return 1;
  }
  return Math.min(1, Math.max(0, volume));
}

export class WebAudioMetronome implements Metronome {
  #context: AudioContext | null = null;
  /** Por donde pasan todos los golpes: cambiar el volumen es tocar solo este. */
  #salida: GainNode | null = null;
  /** Los dos golpes, hechos una vez por contexto. */
  #golpes: { fuerte: AudioBuffer; flojo: AudioBuffer } | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #nextBeatAt = 0;
  #beat = 0;
  #bpm = 100;
  #volume = 1;
  #beatsPerBar = DEFAULT_BEATS_PER_BAR;
  #onBeat: ((beat: number, instante?: number) => void) | undefined;

  get running(): boolean {
    return this.#timer !== null;
  }

  async start({
    bpm,
    beatsPerBar = DEFAULT_BEATS_PER_BAR,
    onBeat,
    volume,
  }: MetronomeOptions): Promise<void> {
    if (typeof AudioContext === 'undefined') {
      return;
    }
    this.stop();

    this.#bpm = clampBpm(bpm);
    this.#beatsPerBar = Math.max(1, Math.round(beatsPerBar));
    this.#onBeat = onBeat;
    this.#volume = acotarVolumen(volume);

    // Se crea en el primer uso, que siempre viene de una pulsación: creado
    // antes, la política de autoreproducción lo deja suspendido.
    const context = await contextoDespierto(this.#context);
    if (this.#context !== context) {
      this.#context = context;
      this.#salida = context.createGain();
      this.#salida.connect(context.destination);
      this.#golpes = {
        fuerte: this.#buffer(context, true),
        flojo: this.#buffer(context, false),
      };
    }
    this.#salida!.gain.value = this.#volume;

    this.#beat = 0;
    this.#nextBeatAt = context.currentTime + 0.1;
    this.#timer = setInterval(() => this.#schedule(), LOOKAHEAD_MS);
  }

  setBpm(bpm: number): void {
    this.#bpm = clampBpm(bpm);
  }

  setVolume(volume: number): void {
    this.#volume = acotarVolumen(volume);
    if (this.#salida !== null) {
      this.#salida.gain.value = this.#volume;
    }
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#onBeat = undefined;
  }

  async dispose(): Promise<void> {
    this.stop();
    const context = this.#context;
    this.#context = null;
    this.#salida = null;
    this.#golpes = null;
    await cerrarContexto(context);
  }

  #buffer(context: AudioContext, fuerte: boolean): AudioBuffer {
    const muestras = muestrasDelClic(context.sampleRate, fuerte) as Float32Array<ArrayBuffer>;
    const buffer = context.createBuffer(1, muestras.length, context.sampleRate);
    buffer.copyToChannel(muestras, 0);
    return buffer;
  }

  #schedule(): void {
    const context = this.#context;
    /* v8 ignore next 3 -- el reloj solo corre con el contexto abierto */
    if (context === null) {
      return;
    }

    while (this.#nextBeatAt < context.currentTime + SCHEDULE_AHEAD_S) {
      this.#click(context, this.#nextBeatAt, this.#beat === 0);
      this.#announce(context, this.#nextBeatAt, this.#beat);

      this.#nextBeatAt += 60 / this.#bpm;
      this.#beat = (this.#beat + 1) % this.#beatsPerBar;
    }
  }

  #click(context: AudioContext, at: number, downbeat: boolean): void {
    const golpes = this.#golpes;
    const salida = this.#salida;
    /* v8 ignore next 3 -- los golpes y la salida se hacen con el contexto, y solo se programa con él abierto */
    if (golpes === null || salida === null) {
      return;
    }
    const fuente = context.createBufferSource();
    fuente.buffer = downbeat ? golpes.fuerte : golpes.flojo;
    fuente.connect(salida);
    fuente.start(at);
  }

  /**
   * El aviso para la pantalla va por temporizador porque React no entiende de
   * relojes de audio. Que la luz llegue un fotograma tarde no importa; que el
   * clic llegue tarde, sí.
   *
   * **Y el instante que lleva no es el del aviso, es el del sonido.** La toma
   * mide sus notas contra los clics, y el temporizador puede llegar decenas de
   * milisegundos tarde con el hilo ocupado: medir contra el aviso desplazaría la
   * rejilla entera. Se traduce el reloj del audio al de `performance.now` en el
   * momento de programar, y se le suma lo que tarda el altavoz
   * (`outputLatency`): con unos auriculares inalámbricos son doscientos
   * milisegundos, y quien toca entra cuando lo oye, no cuando se programó.
   */
  #announce(context: AudioContext, at: number, beat: number): void {
    const onBeat = this.#onBeat;
    if (onBeat === undefined) {
      return;
    }
    const delay = Math.max(0, (at - context.currentTime) * 1000);
    const altavoz = ((context.baseLatency ?? 0) + (context.outputLatency ?? 0)) * 1000;
    const instante = performance.now() + (at - context.currentTime) * 1000 + altavoz;
    setTimeout(() => {
      /* v8 ignore next 3 -- el caso de parar justo entre el aviso programado y su disparo no se puede provocar con el reloj de un test */
      if (this.#timer !== null) {
        onBeat(beat, instante);
      }
    }, delay);
  }
}
