'use client';

import { create } from 'zustand';

import { conocerEntradas, type EntradaDeAudio } from '@audio/entradas-de-audio';

import { loadPreferences, savePreferences, type MicrofonoGuardado } from './workspace';

/**
 * Qué micrófono se usa, **elegido una vez para toda la aplicación**.
 *
 * Solo el afinador dejaba elegirlo, con un `useState` suyo: lo elegido allí no lo
 * sabía nadie más, así que componer, las unidades de oído y la toma abrían siempre
 * el del sistema —con una tarjeta de sonido enchufada, el del portátil—, y al
 * recargar el afinador también lo olvidaba. Eran dos verdades sobre el mismo
 * aparato, y el micro es uno (`use-listening.ts`).
 *
 * Aquí vive **la elección y lo que se sabe de las entradas**; abrir y cambiar el
 * aparato es de `use-listening.ts`, que es quien lo sujeta. Almacén propio y no un
 * rincón de `session-store`, por lo mismo que el banco: aquel tiene `reset()`, y
 * empezar una sesión limpia no puede devolverte al micrófono del portátil.
 *
 * Lo elegido se guarda con el resto de preferencias, en `workspace.ts`, y se lee
 * con la misma desconfianza.
 *
 * **Se le reconoce por el nombre si el identificador ha cambiado.** El navegador
 * solo mantiene el identificador entre recargas si el permiso es para siempre;
 * con «solo esta vez» da otro en cada página, y lo elegido se perdía al recargar
 * aunque el aparato siguiera enchufado (medido en Chromium). El nombre es el
 * mismo: si el identificador guardado no está en la lista y una entrada se llama
 * igual, es ésa, y se guarda su identificador nuevo.
 */

export interface EstadoDelMicrofono {
  /** El elegido, por su identificador, o nulo para el del sistema. */
  readonly elegido: string | null;
  /** Su nombre cuando se eligió, para reconocerlo si cambia de identificador. */
  readonly nombreElegido: string;
  /** Si ya se ha leído lo guardado. Antes de eso `elegido` no dice nada. */
  readonly cargado: boolean;
  /** Las entradas que se pueden elegir, tal como las da el navegador. */
  readonly entradas: readonly EntradaDeAudio[];
  /** El nombre del que usa el sistema, si el navegador lo dice. */
  readonly delSistema: string | null;
  /** Si los nombres ya se ven: sin permiso, el navegador los deja en blanco. */
  readonly conNombres: boolean;
  /**
   * **El elegido no estaba y se escucha por el del sistema.** Se dice en el mando
   * y no se calla hasta que vuelva o se elija otro: quien ha desenchufado la
   * tarjeta sin darse cuenta tiene que poder ver por qué suena distinto.
   */
  readonly cayo: boolean;
  /**
   * El cambio espera a que acabe la toma. Cambiar de aparato a mitad corta el
   * sonido que se está grabando (`use-listening.ts`, `cambiarDeMicro`).
   */
  readonly pendiente: boolean;
  /** La última frase para la región viva del mando. */
  readonly anuncio: string;
  readonly acciones: {
    /** Trae lo guardado. Una vez por carga, como el resto del espacio de trabajo. */
    cargar(): void;
    /** Guarda la elección. Abrir el aparato nuevo no es cosa de este almacén. */
    elegir(id: string | null): void;
    /** Pone al día la lista con lo que dice el navegador. */
    ponerEntradas(devices: readonly MediaDeviceInfo[]): void;
    marcarCaida(cayo: boolean): void;
    marcarPendiente(pendiente: boolean): void;
    anunciar(frase: string): void;
  };
}

export const useMicrofono = create<EstadoDelMicrofono>()((set, get) => ({
  elegido: null,
  nombreElegido: '',
  cargado: false,
  entradas: [],
  delSistema: null,
  conNombres: false,
  cayo: false,
  pendiente: false,
  anuncio: '',
  acciones: {
    cargar: () => {
      const guardado = loadPreferences().microfono;
      set({ elegido: guardado?.id ?? null, nombreElegido: guardado?.nombre ?? '', cargado: true });
    },
    elegir: (id) => {
      const nombre = get().entradas.find((entrada) => entrada.id === id)?.nombre ?? '';
      set({ elegido: id, nombreElegido: nombre, cargado: true, cayo: false });
      guardar(id === null ? null : { id, nombre });
    },
    ponerEntradas: (devices) => {
      const conocidas = conocerEntradas(devices);
      set(conocidas);
      const { elegido, nombreElegido } = get();
      if (
        elegido === null ||
        nombreElegido === '' ||
        conocidas.entradas.some((entrada) => entrada.id === elegido)
      ) {
        return;
      }
      const mismoNombre = conocidas.entradas.find((entrada) => entrada.nombre === nombreElegido);
      if (mismoNombre !== undefined) {
        set({ elegido: mismoNombre.id });
        guardar({ id: mismoNombre.id, nombre: nombreElegido });
      }
    },
    marcarCaida: (cayo) => {
      if (get().cayo !== cayo) {
        set({ cayo });
      }
    },
    marcarPendiente: (pendiente) => {
      set({ pendiente });
    },
    anunciar: (anuncio) => {
      set({ anuncio });
    },
  },
}));

function guardar(microfono: MicrofonoGuardado | null): void {
  savePreferences({ ...loadPreferences(), microfono });
}

/** El elegido, leyendo lo guardado si nadie lo había leído todavía. */
export function microfonoElegido(): string | null {
  const estado = useMicrofono.getState();
  if (!estado.cargado) {
    estado.acciones.cargar();
  }
  return useMicrofono.getState().elegido;
}

/**
 * Cómo se llama una entrada, para enseñarla y para decirla.
 *
 * Sin nombre no se puede saber cuál es, pero sí se puede distinguir de las demás:
 * «Entrada sin nombre 2» es la segunda de la lista.
 */
export function nombreDeLaEntrada(
  id: string | null,
  estado: Pick<EstadoDelMicrofono, 'entradas' | 'elegido' | 'nombreElegido'>,
): string {
  if (id === null) {
    return 'El del sistema';
  }
  const posicion = estado.entradas.findIndex((entrada) => entrada.id === id);
  if (posicion === -1) {
    // El que no está solo se puede decir por el nombre que tenía al elegirlo.
    return id === estado.elegido && estado.nombreElegido !== ''
      ? estado.nombreElegido
      : 'El que elegiste';
  }
  const nombre = estado.entradas[posicion]!.nombre;
  return nombre === '' ? `Entrada sin nombre ${posicion + 1}` : nombre;
}
