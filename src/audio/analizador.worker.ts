/**
 * El análisis de la grabación, fuera del hilo principal.
 *
 * [adr/0003](../../docs/adr/0003-analisis-en-el-hilo-principal.md) decidió que
 * el análisis en vivo fuera en el hilo principal, y sigue siendo verdad: son
 * cuatro décimas de milisegundo por vuelta y un worker costaría más en pasar
 * mensajes que en calcular.
 *
 * Esto es lo contrario y por eso va aparte: **una sola vez, sobre dos minutos de
 * sonido**. Medido en un Ryzen de sobremesa son 1,1 s; un móvil anda entre cinco
 * y diez veces por detrás, así que en el hilo principal serían hasta diez
 * segundos con la pantalla congelada justo después de soltar la guitarra.
 *
 * Las muestras viajan como transferible, así que no se copian los 34 MB: se le
 * pasa la memoria al worker y el hilo principal se queda sin ella, que es
 * exactamente lo que se quiere porque ya no la necesita.
 */

import { acordesDeGrabacion, type AnalisisOptions } from './offline-chords';

export interface PeticionDeAnalisis {
  readonly samples: Float32Array<ArrayBuffer>;
  readonly options: AnalisisOptions;
}

self.addEventListener('message', (evento: MessageEvent<PeticionDeAnalisis>) => {
  const { samples, options } = evento.data;
  try {
    self.postMessage({ ok: true, acordes: acordesDeGrabacion(samples, options) });
  } catch {
    // Que el análisis falle no puede tumbar nada: quien llama se queda con lo
    // que el motor oyó en vivo, que es lo que había antes de todo esto.
    self.postMessage({ ok: false, acordes: [] });
  }
});
