/**
 * La cuenta atrás antes de apuntar: suena dos compases y **se calla**.
 *
 * Que se calle es la decisión, no un descuido. El clic sale por los altavoces y
 * el micro lo oye, así que una claqueta que siguiera sonando entraría en el
 * análisis y el motor de acordes la vería como señal: un golpe de onda cuadrada
 * en cada pulso, justo donde caen los ataques que hay que reconocer
 * ([adr/0053](../../docs/adr/0053-la-claqueta-cuenta-y-se-calla.md)).
 *
 * **Y lo que devuelve es cuándo cae el compás uno, que no es el instante del
 * último clic.** El compás uno cae **un pulso después**, que es donde entra quien
 * toca. Equivocarse ahí no desafina nada: desplaza la canción entera un pulso, y
 * como el tramo se mide desde ese instante (`captureStartedAt`), la primera nota
 * saldría en el segundo pulso del primer compás y todo lo demás detrás.
 *
 * Vive en `state/` y no en `audio/` porque no hace sonido: usa el metrónomo que
 * ya existe —`audio/metronome.ts`, que es una interfaz— y lo único que añade es
 * contar y saber cuándo parar.
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
  /** Cortarla: deja de sonar y `terminada` sale a nulo. */
  readonly cortar: () => void;
}

export interface OpcionesDeCuenta {
  readonly metronomo: Metronome;
  readonly bpm: number;
  readonly beatsPerBar: number;
  /** Se llama con los golpes que quedan, empezando por todos. */
  readonly alQuedar: (quedan: number) => void;
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
  alQuedar,
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
  const arranque = metronomo.start({
    bpm,
    beatsPerBar,
    onBeat: () => {
      dados += 1;
      alQuedar(total - dados);
      if (dados >= total) {
        // El compás uno, un pulso después de este clic.
        terminar(performance.now() + msPerBeat(bpm));
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
      terminar(null);
    },
  };
}
