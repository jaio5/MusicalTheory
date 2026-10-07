/**
 * La cuenta atrás antes de apuntar: suena dos compases, **y la claqueta sigue**.
 *
 * Se callaba al acabar la cuenta, y era una decisión con su motivo: el clic sale
 * por los altavoces, el micro lo oye y el análisis lo veía como un golpe en cada
 * pulso ([adr/0053](../../docs/adr/0053-la-claqueta-cuenta-y-se-calla.md)). El
 * precio era tocar sin pulso, y quien toca se iba de tempo mientras la rejilla
 * seguía creyéndose el ajuste. Ahora el motivo está resuelto donde nace: el clic
 * es un golpe de ruido sin altura por encima de lo que miran los motores
 * (`audio/metronome.ts`) y la entrada filtra por debajo antes de analizar
 * (`audio/web-audio-input.ts`). Así que la cuenta solo dice cuándo entrar, y el
 * metrónomo sigue dando el pulso hasta que se para la toma.
 *
 * **Y lo que devuelve es cuándo cae el compás uno, que no es el instante del
 * último clic.** El compás uno cae **un pulso después**, que es donde entra quien
 * toca. Equivocarse ahí no desafina nada: desplaza la canción entera un pulso, y
 * como el tramo se mide desde ese instante (`captureStartedAt`), la primera nota
 * saldría en el segundo pulso del primer compás y todo lo demás detrás.
 *
 * El instante de cada clic es **el de cuando suena**, que lo da el metrónomo
 * desde el reloj del audio, y no el de cuando llega el aviso: el aviso va por
 * temporizador, y con el hilo ocupado llega decenas de milisegundos tarde.
 *
 * Vive en `state/` y no en `audio/` porque no hace sonido: usa el metrónomo que
 * ya existe —`audio/metronome.ts`, que es una interfaz— y lo único que añade es
 * contar y saber dónde empieza la toma.
 */

import type { Metronome } from '@audio/metronome';
import { msPerBeat, pulsosDeCuenta } from '@core/music';

export interface CuentaAtras {
  /**
   * Cuándo cae el compás uno, en la escala de `performance.now`, o nulo si se
   * cortó antes de terminar.
   *
   * `performance.now` y no `Date.now` porque es el reloj con el que el motor
   * apunta los acordes y las notas: mezclarlos deja los instantes a mil millones
   * de distancia y el tramo se queda vacío.
   */
  readonly terminada: Promise<number | null>;
  /** Cortarla: `terminada` sale a nulo. Callar el metrónomo es cosa de quien lo creó. */
  readonly cortar: () => void;
}

export interface OpcionesDeCuenta {
  readonly metronomo: Metronome;
  readonly bpm: number;
  readonly beatsPerBar: number;
  /** De 0 a 1. Cero calla el clic y no la cuenta: el pulso se sigue contando. */
  readonly volumen?: number;
  /** Se llama con los golpes que quedan, empezando por todos. */
  readonly alQuedar: (quedan: number) => void;
  /**
   * Cada clic **después** de la cuenta, con el instante en que sonó. El primero
   * es el del compás uno.
   */
  readonly alClic?: (instante: number) => void;
}

/**
 * Arranca la cuenta y devuelve cómo esperarla y cómo cortarla.
 *
 * No es `async` a propósito: quien la llama necesita **poder cortarla mientras
 * corre**, así que lo que vuelve es un mando y no una espera. Con una función
 * asíncrona a secas, parar en mitad de la cuenta pedía otro camino.
 */
export function contarAtras({
  metronomo,
  bpm,
  beatsPerBar,
  volumen,
  alQuedar,
  alClic,
}: OpcionesDeCuenta): CuentaAtras {
  const total = pulsosDeCuenta(beatsPerBar);
  alQuedar(total);

  // Se asigna dentro del constructor de la promesa, que corre **ya**: por eso la
  // aserción de asignación y no un valor de relleno, que sería una función que
  // nadie llama nunca.
  let terminar!: (at: number | null) => void;
  const terminada = new Promise<number | null>((resolve) => {
    terminar = resolve;
  });

  let dados = 0;
  let cortada = false;
  const arranque = metronomo.start({
    bpm,
    beatsPerBar,
    ...(volumen === undefined ? {} : { volume: volumen }),
    onBeat: (_beat, instante = performance.now()) => {
      if (cortada) {
        return;
      }
      dados += 1;
      if (dados > total) {
        alClic?.(instante);
        return;
      }
      alQuedar(total - dados);
      if (dados === total) {
        // El compás uno, un pulso después de este clic.
        terminar(instante + msPerBeat(bpm));
      }
    },
  });

  // **Si la claqueta no puede sonar, no se espera a nada.** Sin esto, un
  // metrónomo que no arranca deja la promesa sin resolver para siempre y grabar
  // se queda colgado en la cuenta: el peor fallo posible aquí, porque no se
  // parece a un fallo, se parece a que la aplicación se ha quedado pensando.
  void arranque.then(() => {
    if (!metronomo.running) {
      terminar(performance.now());
    }
  });

  return {
    terminada,
    cortar: () => {
      cortada = true;
      terminar(null);
    },
  };
}
