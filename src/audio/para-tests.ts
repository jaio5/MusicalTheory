/**
 * Un contexto de audio de mentira, con reloj propio.
 *
 * Tres piezas del proyecto —el metrónomo, la nota de referencia y el reproductor
 * de progresiones— hacen lo mismo: **programan sonido contra el reloj del audio
 * en vez de con temporizadores**, porque el hilo de JavaScript se atasca y un
 * clic que llega tarde se oye. Eso es justo lo que no se puede comprobar oyendo
 * un test, y sí se puede comprobando *cuándo* se programó cada cosa.
 *
 * Así que esto no finge sonido: finge un reloj que se mueve a mano y apunta todo
 * lo que se le programa. Lo que se prueba con él es el orden, los tiempos y las
 * frecuencias, que es donde están las decisiones.
 *
 * No usa `vi`: así vale igual desde un test de nodo que desde uno de jsdom, y no
 * mete una dependencia de pruebas en una carpeta que el navegador importa.
 */

/** Un cambio programado en un parámetro. */
interface Cambio {
  readonly clase: 'valor' | 'rampa';
  readonly valor: number;
  readonly cuando: number;
}

class ParametroFalso {
  readonly cambios: Cambio[] = [];

  setValueAtTime(valor: number, cuando: number): this {
    this.cambios.push({ clase: 'valor', valor, cuando });
    return this;
  }

  linearRampToValueAtTime(valor: number, cuando: number): this {
    this.cambios.push({ clase: 'rampa', valor, cuando });
    return this;
  }

  /** El volumen más alto al que llega, que es lo que se compara entre sonidos. */
  get maximo(): number {
    return Math.max(0, ...this.cambios.map((c) => c.valor));
  }
}

/** Un parámetro que programa cambios y además tiene valor. */
class ParametroConValor extends ParametroFalso {
  value = 1;
}

export class OsciladorFalso {
  type = '';
  readonly frequency = new ParametroFalso();
  /** Cuándo empieza y cuándo acaba, en segundos del reloj del audio. */
  empiezaEn: number | null = null;
  acabaEn: number | null = null;
  /**
   * Cuántas veces se le ha cortado a mano, con `stop()` sin instante.
   *
   * Se cuenta aparte del `stop(cuando)` con el que se programa el final porque
   * son dos cosas distintas: uno es «acaba a los novecientos milisegundos» y el
   * otro es «para ya». Confundirlos hacía que cualquier nota pareciera cortada.
   */
  cortes = 0;
  /** Si ya se apagó sola. Pararla entonces lanza, como la de verdad. */
  terminado = false;
  onended: (() => void) | null = null;
  salida: GananciaFalsa | null = null;

  connect<T>(destino: T): T {
    this.salida = destino as unknown as GananciaFalsa;
    return destino;
  }

  start(cuando: number): void {
    this.empiezaEn = cuando;
  }

  stop(cuando?: number): void {
    if (this.terminado) {
      // La carrera normal entre el temporizador del oscilador y la pulsación de
      // quien escucha. Hay código que cuenta con que esto lanza.
      throw new Error('InvalidStateError');
    }
    if (cuando === undefined) {
      this.cortes += 1;
    } else {
      this.acabaEn = cuando;
    }
  }

  /** Lo que pasa cuando la nota llega a su final por su cuenta. */
  terminarSola(): void {
    this.terminado = true;
    this.onended?.();
  }

  /** El volumen máximo al que llega, mirando la ganancia a la que está enchufado. */
  get volumen(): number {
    /* v8 ignore next -- solo se pregunta por el volumen de un oscilador ya enchufado */
    return this.salida?.gain.maximo ?? 0;
  }
}

export class GananciaFalsa {
  readonly gain = new ParametroFalso();

  connect<T>(destino: T): T {
    return destino;
  }
}

/** Un trozo de sonido ya hecho, como el golpe del metrónomo. */
export class BufferFalso {
  readonly datos: Float32Array;
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.datos = new Float32Array(length);
  }

  copyToChannel(origen: Float32Array): void {
    this.datos.set(origen);
  }
}

/** Lo que reproduce un buffer: se apunta cuándo y cuál. */
export class FuenteFalsa {
  buffer: BufferFalso | null = null;
  empiezaEn: number | null = null;
  salida: unknown = null;

  connect<T>(destino: T): T {
    this.salida = destino;
    return destino;
  }

  start(cuando: number): void {
    this.empiezaEn = cuando;
  }

  /** Lo más fuerte que suena el golpe, mirando sus muestras. Sin buffer, cero. */
  get pico(): number {
    return this.buffer === null ? 0 : Math.max(0, ...Array.from(this.buffer.datos, Math.abs));
  }
}

/** Una ganancia que guarda su valor, como la de salida del metrónomo. */
export type GananciaConValor = GananciaFalsa & { readonly gain: { value: number } };

export class ContextoDeAudioFalso {
  state: 'running' | 'suspended' | 'closed' = 'running';
  currentTime = 0;
  readonly sampleRate = 48_000;
  /** Lo que tarda en salir por el altavoz, en segundos. */
  baseLatency = 0;
  outputLatency = 0;
  readonly destination = {};
  /** Todos los osciladores que se han creado, en orden. */
  readonly osciladores: OsciladorFalso[] = [];
  /** Todos los buffers que se han reproducido, en orden. */
  readonly fuentes: FuenteFalsa[] = [];
  /** Las ganancias de valor fijo: la salida del metrónomo es la primera. */
  readonly salidas: GananciaConValor[] = [];
  reanudaciones = 0;
  cierres = 0;

  async resume(): Promise<void> {
    this.reanudaciones += 1;
    this.state = 'running';
  }

  async close(): Promise<void> {
    this.cierres += 1;
    this.state = 'closed';
  }

  createOscillator(): OsciladorFalso {
    const oscilador = new OsciladorFalso();
    this.osciladores.push(oscilador);
    return oscilador;
  }

  createGain(): GananciaConValor {
    // Las dos formas de ganancia a la vez: la que programa rampas (el
    // reproductor, la nota de referencia) y la que se fija con un valor (el
    // volumen del metrónomo). Cada pieza usa la suya.
    const ganancia = Object.assign(new GananciaFalsa(), { gain: new ParametroConValor() });
    this.salidas.push(ganancia);
    return ganancia;
  }

  createBuffer(canales: number, largo: number, sampleRate: number): BufferFalso {
    return new BufferFalso(canales, largo, sampleRate);
  }

  createBufferSource(): FuenteFalsa {
    const fuente = new FuenteFalsa();
    this.fuentes.push(fuente);
    return fuente;
  }

  /** Mueve el reloj del audio, que es lo único que aquí pasa el tiempo. */
  avanzar(segundos: number): void {
    this.currentTime += segundos;
  }
}

/**
 * Pone un `AudioContext` de mentira y devuelve el que se va a crear.
 *
 * `function` y no una flecha: `new AudioContext()` necesita un constructor, y una
 * flecha no lo es. Es el mismo detalle que ya estaba en `web-audio-input.test.ts`
 * y que cuesta diez minutos la primera vez.
 */
export function ponerAudioFalso(): ContextoDeAudioFalso {
  const contexto = new ContextoDeAudioFalso();
  (globalThis as { AudioContext?: unknown }).AudioContext = function AudioContextFalso() {
    return contexto;
  };
  return contexto;
}

/** Quita el `AudioContext` de mentira. */
export function quitarAudioFalso(): void {
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
}
