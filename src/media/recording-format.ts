/**
 * Negociación de formato y nombre del fichero.
 *
 * No hay un contenedor que funcione en todas partes, así que se prueban
 * candidatos por orden. Está separado del grabador porque es lo único de esta
 * capa que se puede probar sin navegador.
 */

export interface RecordingFormat {
  readonly mimeType: string;
  readonly extension: string;
}

/**
 * Por orden de preferencia. VP9 da mejor calidad por bit; VP8 es el respaldo en
 * navegadores antiguos; MP4 existe porque Safari no graba WebM.
 */
export const FORMAT_CANDIDATES: readonly RecordingFormat[] = [
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
  { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
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
