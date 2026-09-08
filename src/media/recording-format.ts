/**
 * Negociación de formato y nombre del fichero.
 *
 * No hay un contenedor de audio que funcione en todas partes, así que se prueban
 * candidatos por orden. Está separado del grabador porque es lo único de esta
 * capa que se puede probar sin navegador.
 */

export interface RecordingFormat {
  readonly mimeType: string;
  readonly extension: string;
}

/**
 * Por orden de preferencia, y todos de **audio solo**.
 *
 * Opus dentro de WebM es lo que mejor suena por bit y lo que aceptan Chrome,
 * Edge y Firefox. MP4/AAC existe porque Safari no graba WebM, y ese fichero lo
 * abre además cualquier reproductor sin pensar. `audio/webm` a secas es el
 * respaldo de un navegador que no sepa contestar por códec.
 */
export const FORMAT_CANDIDATES: readonly RecordingFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
];

/**
 * El primer formato que acepte el navegador, o null si no acepta ninguno.
 * Devolver null es una respuesta válida: la interfaz debe explicar que ese
 * navegador no puede grabar, en vez de fallar al pulsar el botón.
 */
export function pickFormat(
  isSupported: (mimeType: string) => boolean,
  candidates: readonly RecordingFormat[] = FORMAT_CANDIDATES,
): RecordingFormat | null {
  return candidates.find((candidate) => isSupported(candidate.mimeType)) ?? null;
}

/**
 * Nombre sugerido para la descarga. La fecha entra por parámetro porque esta
 * capa tampoco lee el reloj: así el nombre se puede probar.
 */
export function recordingFilename(format: RecordingFormat, at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    at.getFullYear(),
    pad(at.getMonth() + 1),
    pad(at.getDate()),
    pad(at.getHours()) + pad(at.getMinutes()),
  ].join('-');

  return `caos-ordenado-${stamp}.${format.extension}`;
}
