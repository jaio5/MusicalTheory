/**
 * Las entradas de audio disponibles, **en un módulo que no abre nada**.
 *
 * Vivía en `web-audio-input.ts`, y el afinador lo importaba de allí solo para
 * llenar el selector de micrófonos: con la función viajaba la clase entera de la
 * entrada —el grabador, el analizador, el estado observable— a `/afinar` y a la
 * portada, que no la usan hasta que se pulsa escuchar. Listar no necesita ni un
 * `AudioContext`, así que no tiene por qué compartir fichero con quien lo abre.
 *
 * Los nombres solo llegan después de conceder el permiso: antes, el navegador
 * los deja en blanco para no delatar qué hardware hay conectado. Por eso el
 * selector solo tiene sentido una vez arrancada la escucha.
 */
export async function listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === 'undefined' || navigator.mediaDevices?.enumerateDevices === undefined) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput');
}
