/**
 * Una entrada que puede **prestar su flujo** a quien grabe.
 *
 * Existe porque componer tocando abría **dos micrófonos**: `audio/` el suyo para
 * el tono y el croma, y `media/` otro para los bytes de la toma. Dos
 * `getUserMedia` sobre el mismo aparato es, en el mejor caso, dos pilotos
 * encendidos y dos permisos; en un iPhone el segundo puede quedarse con el
 * dispositivo y dejar al primero sin señal, que es la mitad de la aplicación
 * apagándose sola.
 *
 * No hacía falta abrir nada: el grabador de `media/` **recibe un `MediaStream`**,
 * no lo pide. Lo único que faltaba era que alguien le pasara el que ya estaba
 * abierto.
 *
 * **Es un puerto aparte y no un campo más en `AudioInput`**, que es la misma
 * decisión —y por lo mismo— que ya tomó `recorder.ts`: no toda entrada tiene un
 * flujo del navegador detrás. Los dobles de los tests no lo tienen, y meterlo en
 * la interfaz grande obligaría a todos a fingir que sí.
 *
 * Prestar no es ceder: quien lo recibe **no lo cierra**. Las pistas las suelta
 * quien las abrió, que es la entrada, al pararse.
 */

export interface StreamSource {
  /** El flujo abierto, o nulo si el micro está cerrado. Nunca sale del equipo. */
  readonly stream: MediaStream | null;
}

/** Si esta entrada puede prestar su flujo. */
export function canShareStream(input: unknown): input is StreamSource {
  return typeof input === 'object' && input !== null && 'stream' in input;
}
