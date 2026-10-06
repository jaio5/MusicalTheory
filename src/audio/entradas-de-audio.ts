import { canShareStream } from './stream-source';

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

/**
 * Una entrada tal como se enseña para elegirla: su identificador y su nombre.
 *
 * El nombre vacío no se rellena aquí: «sin nombre» es una frase de la interfaz, y
 * esta capa no escribe textos.
 */
export interface EntradaDeAudio {
  readonly id: string;
  readonly nombre: string;
}

/** Lo que el navegador sabe de las entradas, ya separado para elegir. */
export interface EntradasConocidas {
  /** Las que se pueden elegir una a una, sin las dos de mentira del sistema. */
  readonly entradas: readonly EntradaDeAudio[];
  /** El nombre de la que el sistema usa por defecto, si el navegador lo dice. */
  readonly delSistema: string | null;
  /**
   * Si el navegador ya enseña los nombres, que es lo mismo que decir que hay
   * permiso: antes de darlo devuelve una sola entrada, sin nombre y sin
   * identificador.
   */
  readonly conNombres: boolean;
}

/**
 * Los dos identificadores que no son un aparato sino una manera de nombrar otro.
 *
 * Chromium añade `default` —el que el sistema tiene puesto— y, en Windows,
 * `communications`, el de las llamadas. Los dos repiten una entrada que ya está
 * en la lista con su propio identificador, y la interfaz ya tiene su «El del
 * sistema»: enseñarlos sería ofrecer el mismo micrófono tres veces.
 */
const ALIAS_DEL_SISTEMA = new Set(['default', 'communications']);

/** Separa lo que se lista para elegir de lo que solo nombra al del sistema. */
export function conocerEntradas(devices: readonly MediaDeviceInfo[]): EntradasConocidas {
  const porDefecto = devices.find((device) => device.deviceId === 'default');
  return {
    entradas: devices
      .filter((device) => device.deviceId !== '' && !ALIAS_DEL_SISTEMA.has(device.deviceId))
      .map((device) => ({ id: device.deviceId, nombre: device.label })),
    delSistema: porDefecto === undefined || porDefecto.label === '' ? null : porDefecto.label,
    conNombres: devices.some((device) => device.label !== ''),
  };
}

/**
 * Avisa cada vez que se conecta o se desconecta una entrada.
 *
 * Es el evento `devicechange`, que salta también al dar el permiso en algunos
 * navegadores: por eso quien escucha vuelve a pedir la lista entera en vez de
 * fiarse de lo que cambió. Donde no hay navegador no avisa de nada.
 */
export function vigilarEntradas(alCambiar: () => void): () => void {
  const dispositivos = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (dispositivos?.addEventListener === undefined) {
    return () => {};
  }
  dispositivos.addEventListener('devicechange', alCambiar);
  return () => dispositivos.removeEventListener('devicechange', alCambiar);
}

/**
 * De qué aparato sale una entrada abierta, y si sigue viva.
 *
 * Lo dice la pista del flujo, que es lo único que sabe qué eligió el navegador de
 * verdad: pedir «el del sistema» no dice cuál es, y un aparato desenchufado deja
 * la pista terminada sin que el `AudioContext` se entere —sigue leyendo ceros—.
 * Una entrada sin flujo que prestar, como los dobles de los tests, no lo sabe.
 */
export function pistaDe(
  input: unknown,
): { readonly dispositivo: string | null; readonly viva: boolean } | null {
  if (!canShareStream(input)) {
    return null;
  }
  const pista = input.stream?.getAudioTracks()[0];
  if (pista === undefined) {
    return null;
  }
  return {
    dispositivo: pista.getSettings().deviceId ?? null,
    viva: pista.readyState === 'live',
  };
}
