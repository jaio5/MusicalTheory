/**
 * Pedirle al navegador que guarde algo en el disco.
 *
 * Estaba escrito tres veces —la grabadora, la toma de tocando y ahora el
 * MIDI—, siempre igual: un `<a>` invisible al que se le da un `download` y se
 * le hace clic. **Con una copia más ya son demasiadas**, y la tercera traía
 * además lo que las otras dos no hacían: soltar la URL después.
 *
 * Vive en `media/` porque es lo que esta capa hace —hablar con el aparato— y
 * porque `core/` no sabe que existe un navegador.
 */

/** Guarda lo que hay detrás de una URL que ya existe. */
export function descargarUrl(url: string, nombre: string): void {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
}

/**
 * Guarda unos bytes, envolviéndolos en su propia URL.
 *
 * **Y la suelta después.** Una URL de objeto retiene los bytes hasta que se
 * revoca, así que sin esto cada descarga deja el fichero entero en memoria
 * hasta que se recarga la página.
 */
export function descargarBytes(bytes: Uint8Array, nombre: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }));
  try {
    descargarUrl(url, nombre);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Lo que dice un fichero MIDI que es. */
export const TIPO_MIDI = 'audio/midi';
