'use client';

import { create } from 'zustand';

import {
  DEFAULT_BANCO,
  loadPreferences,
  savePreferences,
  TOPES_DEL_BANCO,
  type BancoLayout,
} from './workspace';

/**
 * El reparto del banco de trabajo de componer.
 *
 * Almacén propio y no un rincón de `session-store` por una razón concreta: aquel
 * tiene `reset()`, que existe para empezar una sesión limpia, y el reparto **no
 * es sesión**. Quien se ha montado su sitio no espera que pulsar «empezar de
 * cero» le devuelva las columnas a como venían de fábrica.
 *
 * Lo que se guarda vive en `workspace.ts` con el resto de preferencias, en la
 * misma clave y con la misma lectura tolerante: son la misma clase de cosa
 * —lo que quieres encontrarte igual mañana— y dos claves serían dos sitios donde
 * mirar cuando algo no se recuerda.
 *
 * **Nada de esto se lee en el servidor.** Se hidrata al montar la pantalla, con
 * `cargar`, por lo mismo que el tema: leer `localStorage` durante el render
 * daría un HTML distinto en servidor y en cliente.
 */

/** Los editores que caben abajo. El orden es el de la fila de pestañas. */
export const EDITORES_DE_ABAJO = [
  'mastil',
  'grabar',
  'ideas',
  'salidas',
  'canciones',
  'sesiones',
] as const;

export type EditorDeAbajo = (typeof EDITORES_DE_ABAJO)[number];

export type EspacioDeTrabajo = BancoLayout['espacio'];

function esEditor(valor: string | null): valor is EditorDeAbajo {
  return valor !== null && (EDITORES_DE_ABAJO as readonly string[]).includes(valor);
}

function acotar(valor: number, topes: { readonly min: number; readonly max: number }): number {
  return Math.min(topes.max, Math.max(topes.min, Math.round(valor * 10) / 10));
}

export interface BancoState {
  readonly espacio: EspacioDeTrabajo;
  /** Ancho de la columna izquierda, en rem. */
  readonly izquierda: number;
  readonly derecha: number;
  /** Qué editor hay abajo, o nulo si está cerrada. */
  readonly abajo: EditorDeAbajo | null;
  readonly alto: number;
  /** Si una columna está plegada a su tira de iconos. */
  readonly plegadaIzquierda: boolean;
  readonly plegadaDerecha: boolean;
  readonly actions: {
    /** Trae el reparto guardado. Se llama al montar la pantalla. */
    cargar(): void;
    espacio(espacio: EspacioDeTrabajo): void;
    mover(area: 'izquierda' | 'derecha' | 'alto', rem: number): void;
    /** Devuelve un área a la medida de fábrica. Es el doble clic del divisor. */
    devolver(area: 'izquierda' | 'derecha' | 'alto'): void;
    abrirAbajo(editor: EditorDeAbajo | null): void;
    plegar(lado: 'izquierda' | 'derecha'): void;
  };
}

const INICIAL = {
  espacio: DEFAULT_BANCO.espacio,
  izquierda: DEFAULT_BANCO.izquierda,
  derecha: DEFAULT_BANCO.derecha,
  abajo: null as EditorDeAbajo | null,
  alto: DEFAULT_BANCO.alto,
  plegadaIzquierda: false,
  plegadaDerecha: false,
};

/**
 * Guarda el reparto sin pisar el resto de preferencias.
 *
 * Se parte de lo que hay guardado porque en esa misma clave viven la tonalidad,
 * el estilo, la escala y la afinación, que este almacén no conoce.
 */
function guardar(estado: Omit<BancoState, 'actions'>): void {
  savePreferences({
    ...loadPreferences(),
    banco: {
      espacio: estado.espacio,
      izquierda: estado.izquierda,
      derecha: estado.derecha,
      abajo: estado.abajo,
      alto: estado.alto,
    },
  });
}

export const useBancoStore = create<BancoState>()((set, get) => {
  /** Cambia el reparto y lo deja guardado, que siempre van juntos. */
  const cambiar = (patch: Partial<Omit<BancoState, 'actions'>>): void => {
    const siguiente = { ...get(), ...patch };
    set(patch);
    guardar(siguiente);
  };

  return {
    ...INICIAL,
    actions: {
      cargar() {
        const { banco } = loadPreferences();
        set({
          espacio: banco.espacio,
          izquierda: banco.izquierda,
          derecha: banco.derecha,
          // Un editor que ya no existe —renombrado, retirado— deja el área
          // cerrada en vez de dejarla abierta y vacía.
          abajo: esEditor(banco.abajo) ? banco.abajo : null,
          alto: banco.alto,
        });
      },

      espacio(espacio) {
        cambiar({ espacio });
      },

      mover(area, rem) {
        cambiar({ [area]: acotar(rem, TOPES_DEL_BANCO[area]) } as Partial<BancoState>);
      },

      devolver(area) {
        cambiar({ [area]: DEFAULT_BANCO[area] } as Partial<BancoState>);
      },

      abrirAbajo(editor) {
        // Pulsar la que ya está abierta la cierra: es lo que hacía la fila de
        // herramientas de antes y es lo que espera quien la usa.
        cambiar({ abajo: get().abajo === editor ? null : editor });
      },

      plegar(lado) {
        // Plegar no se guarda: es un gesto de un momento —«déjame ver la
        // canción entera»— y no una manera de tener puesto el sitio. Guardarlo
        // haría que abrir la pantalla mañana te la encontrase a medias sin
        // acordarte de por qué.
        set(
          lado === 'izquierda'
            ? { plegadaIzquierda: !get().plegadaIzquierda }
            : { plegadaDerecha: !get().plegadaDerecha },
        );
      },
    },
  };
});
