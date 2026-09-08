/**
 * Abrir y cerrar el `AudioContext`, que es lo único que los tres aparatos de
 * sonido hacen igual.
 *
 * El metrónomo, el tono de referencia y el reproductor de progresiones son tres
 * cosas distintas y no comparten nada más: uno programa clics, otro un seno y el
 * tercero acordes encadenados. Lo que sí compartían eran **las dos cautelas del
 * navegador**, escritas seis veces entre los tres, y las dos son de esas que no
 * se descubren leyendo la documentación sino viendo fallar la aplicación:
 *
 * - Un contexto creado antes de la primera pulsación nace **suspendido** por la
 *   política de autoreproducción, y hay que despertarlo. Por eso se crea tarde y
 *   por eso se comprueba.
 * - Cerrar un contexto ya cerrado **lanza**. Pasa al desmontar dos veces —lo que
 *   React hace de propio en desarrollo— y deja una promesa rechazada que nadie
 *   coge.
 *
 * Aquí las dos están una vez, con su porqué al lado.
 */

/**
 * El contexto, creado si no lo había y despierto si estaba suspendido.
 *
 * Se le pasa el que se tenga y se devuelve el que hay que guardar: así el que
 * llama no puede quedarse con uno y usar otro, que es lo que pasaría separando
 * «crear» de «despertar».
 */
export async function contextoDespierto(actual: AudioContext | null): Promise<AudioContext> {
  const context = actual ?? new AudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
}

/** Cierra el contexto si hay uno y no estaba ya cerrado. */
export async function cerrarContexto(context: AudioContext | null): Promise<void> {
  if (context !== null && context.state !== 'closed') {
    await context.close();
  }
}
