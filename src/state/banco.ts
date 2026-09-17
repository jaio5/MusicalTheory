'use client';

import { create } from 'zustand';

import {
  DEFAULT_BANCO,
  loadPreferences,
  REPARTOS_DE_FABRICA,
  savePreferences,
  TOPES_DEL_BANCO,
  type AreaPlegable,
  type BancoLayout,
  type EspacioDeTrabajo,
  type RepartoDeAreas,
} from './workspace';

/**
 * El reparto del banco de trabajo de componer.
 *
 * Almacén propio y no un rincón de `session-store` por una razón concreta: aquel
 * tiene `reset()`, que existe para empezar una sesión limpia, y el reparto **no
 * es sesión**. Quien se ha montado su sitio no espera que pulsar «empezar de
 * cero» le devuelva las columnas a como venían de fábrica.
 *
 * **Hay un reparto por espacio de trabajo**, y las acciones tocan el del espacio
 * en el que estés. Con uno solo, los tres modos enseñaban las cinco áreas y la
 * pantalla se leía como un panel de control; cada modo necesita otra cosa
 * delante, y venir repartidos de fábrica es lo que hace que no haya que montarse
 * nada para empezar.
 *
 * Lo que se guarda vive en `workspace.ts` con el resto de preferencias, en la
 * misma clave y con la misma lectura tolerante: son la misma clase de cosa —lo
 * que quieres encontrarte igual mañana— y dos claves serían dos sitios donde
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

export type { AreaPlegable, EspacioDeTrabajo, RepartoDeAreas };

function esEditor(valor: string | null): valor is EditorDeAbajo {
  return valor !== null && (EDITORES_DE_ABAJO as readonly string[]).includes(valor);
}

function acotar(valor: number, topes: { readonly min: number; readonly max: number }): number {
  return Math.min(topes.max, Math.max(topes.min, Math.round(valor * 10) / 10));
}

export interface BancoState {
  readonly espacio: EspacioDeTrabajo;
  readonly repartos: Readonly<Record<EspacioDeTrabajo, RepartoDeAreas>>;
  readonly actions: {
    /** Trae el reparto guardado. Se llama al montar la pantalla. */
    cargar(): void;
    espacio(espacio: EspacioDeTrabajo): void;
    mover(area: 'izquierda' | 'derecha' | 'alto', rem: number): void;
    /** Devuelve un área a la medida de fábrica. Es el doble clic del divisor. */
    devolver(area: 'izquierda' | 'derecha' | 'alto'): void;
    abrirAbajo(editor: EditorDeAbajo | null): void;
    /** Pliega un área a su tira, o la despliega. */
    plegar(area: AreaPlegable): void;
    /** Devuelve este espacio al reparto de fábrica, entero. */
    devolverElReparto(): void;
  };
}

/** El reparto del espacio en el que se está. */
export const selectReparto = (state: BancoState): RepartoDeAreas =>
  state.repartos[state.espacio] ?? REPARTOS_DE_FABRICA[state.espacio];

/** Si un área está plegada ahora mismo. */
export const selectPlegada =
  (area: AreaPlegable) =>
  (state: BancoState): boolean =>
    selectReparto(state).plegadas.includes(area);

/**
 * Guarda el reparto sin pisar el resto de preferencias.
 *
 * Se parte de lo que hay guardado porque en esa misma clave viven la tonalidad,
 * el estilo, la escala y la afinación, que este almacén no conoce.
 */
function guardar(banco: BancoLayout): void {
  savePreferences({ ...loadPreferences(), banco });
}

export const useBancoStore = create<BancoState>()((set, get) => {
  /** Cambia el reparto del espacio en el que se está, y lo deja guardado. */
  const cambiar = (patch: Partial<RepartoDeAreas>): void => {
    const { espacio, repartos } = get();
    const siguiente = {
      espacio,
      repartos: { ...repartos, [espacio]: { ...selectReparto(get()), ...patch } },
    };
    set(siguiente);
    guardar(siguiente);
  };

  return {
    espacio: DEFAULT_BANCO.espacio,
    repartos: DEFAULT_BANCO.repartos,
    actions: {
      cargar() {
        const { banco } = loadPreferences();
        set({
          espacio: banco.espacio,
          repartos: {
            // Un editor que ya no existe —renombrado, retirado— deja el área
            // cerrada en vez de dejarla abierta y vacía.
            tocando: conEditorValido(banco.repartos.tocando),
            escribir: conEditorValido(banco.repartos.escribir),
            ensayar: conEditorValido(banco.repartos.ensayar),
          },
        });
      },

      espacio(espacio) {
        const siguiente = { espacio, repartos: get().repartos };
        set(siguiente);
        guardar(siguiente);
      },

      mover(area, rem) {
        cambiar({ [area]: acotar(rem, TOPES_DEL_BANCO[area]) } as Partial<RepartoDeAreas>);
      },

      devolver(area) {
        cambiar({
          [area]: REPARTOS_DE_FABRICA[get().espacio][area],
        } as Partial<RepartoDeAreas>);
      },

      abrirAbajo(editor) {
        // Pulsar la que ya está abierta la cierra: es lo que hacía la fila de
        // herramientas de antes y es lo que espera quien la usa.
        cambiar({ abajo: selectReparto(get()).abajo === editor ? null : editor });
      },

      plegar(area) {
        const plegadas = selectReparto(get()).plegadas;
        cambiar({
          plegadas: plegadas.includes(area)
            ? plegadas.filter((otra) => otra !== area)
            : [...plegadas, area],
        });
      },

      devolverElReparto() {
        cambiar({ ...REPARTOS_DE_FABRICA[get().espacio] });
      },
    },
  };
});

function conEditorValido(reparto: RepartoDeAreas): RepartoDeAreas {
  return esEditor(reparto.abajo) ? reparto : { ...reparto, abajo: null };
}
