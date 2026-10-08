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

/**
 * Los editores que caben abajo. El orden es el de la fila de pestañas.
 *
 * Un reparto guardado puede traer uno que ya no está —«grabar», que pasó a ser
 * un papel de la toma (adr/0056), o «ideas», retirada (adr/0066)—, y por eso se
 * lee con `conEditorValido`: lo que no está aquí se abre cerrado.
 */
const EDITORES_DE_ABAJO = ['mastil', 'salidas', 'canciones', 'sesiones'] as const;

export type EditorDeAbajo = (typeof EDITORES_DE_ABAJO)[number];

export type { AreaPlegable, EspacioDeTrabajo, RepartoDeAreas };

function esEditor(valor: string | null): valor is EditorDeAbajo {
  return valor !== null && (EDITORES_DE_ABAJO as readonly string[]).includes(valor);
}

/**
 * Una medida del banco redondeada a la décima de rem, que es lo que se guarda.
 *
 * La usa también el arrastre, que escribe la medida en la caja sin pasar por
 * aquí: si redondearan distinto, al soltar en una medida que redondea a la de
 * antes el almacén no cambiaría, React no volvería a escribir el `style` y la
 * caja se quedaría con la décima de más.
 */
export function aLaDecima(rem: number): number {
  return Math.round(rem * 10) / 10;
}

function acotar(valor: number, topes: { readonly min: number; readonly max: number }): number {
  return Math.min(topes.max, Math.max(topes.min, aLaDecima(valor)));
}

/**
 * Las áreas que se enseñan de una en una por debajo de `lg`, con pestañas.
 *
 * El arreglo es el del espacio en el que se está —tocando, el lienzo o el
 * ensayo—; las otras dos son las mismas en los tres.
 */
type AreaEnElMovil = 'arreglo' | 'camino' | 'acorde';

export interface BancoState {
  readonly espacio: EspacioDeTrabajo;
  readonly repartos: Readonly<Record<EspacioDeTrabajo, RepartoDeAreas>>;
  /**
   * Qué área se ve en un teléfono. **No se guarda**: es por dónde ibas en esta
   * visita, no cómo quieres encontrarte la pantalla mañana.
   *
   * Vive aquí y no en la pantalla porque la cambia también quien no es ella:
   * Salidas sin plan lleva a «A dónde ir», y en un teléfono eso es cambiar de
   * pestaña.
   */
  readonly areaEnElMovil: AreaEnElMovil;
  readonly actions: {
    /** Trae el reparto guardado. Se llama al montar la pantalla. */
    cargar(): void;
    espacio(espacio: EspacioDeTrabajo): void;
    /**
     * Cambia la medida de un área y la guarda.
     *
     * Mientras se arrastra un divisor **no se llama**: la pantalla mueve sus
     * variables CSS a mano y esto llega una vez, al soltar. Llamado en cada
     * movimiento, el almacén cambiaba sesenta veces por segundo y con él se
     * repintaba componer entero, que lee el reparto.
     */
    mover(area: 'izquierda' | 'derecha' | 'alto', rem: number): void;
    /** Devuelve un área a la medida de fábrica. Es el doble clic del divisor. */
    devolver(area: 'izquierda' | 'derecha' | 'alto'): void;
    abrirAbajo(editor: EditorDeAbajo | null): void;
    /** Pliega un área a su tira, o la despliega. */
    plegar(area: AreaPlegable): void;
    /** Devuelve este espacio al reparto de fábrica, entero. */
    devolverElReparto(): void;
    /** Enseña esa área en un teléfono. Donde hay banco no cambia nada. */
    verEnElMovil(area: AreaEnElMovil): void;
    /**
     * Lleva a «A dónde ir»: la despliega en el banco, la enseña en un teléfono y
     * cierra el área de abajo.
     *
     * Es la salida de Salidas sin plan: lo que pide es la versión gratis de lo
     * mismo, y quedarse con las dos abiertas dejaba «A dónde ir» sin alto —con
     * el área de abajo abierta pierde su suelo— justo cuando se iba a mirar.
     */
    irADondeIr(): void;
  };
}

/** El reparto del espacio en el que se está. */
export const selectReparto = (state: BancoState): RepartoDeAreas =>
  /* v8 ignore start -- los tres espacios tienen su reparto desde que se crea el almacen */
  state.repartos[state.espacio] ?? REPARTOS_DE_FABRICA[state.espacio];
/* v8 ignore stop */

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
    areaEnElMovil: 'arreglo',
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
        // Pulsar un espacio en un teléfono es también pulsar su pestaña: los
        // espacios hacen de pestañas del arreglo.
        set({ ...siguiente, areaEnElMovil: 'arreglo' });
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

      verEnElMovil(area) {
        set({ areaEnElMovil: area });
      },

      irADondeIr() {
        const { plegadas } = selectReparto(get());
        cambiar({ abajo: null, plegadas: plegadas.filter((otra) => otra !== 'camino') });
        set({ areaEnElMovil: 'camino' });
      },
    },
  };
});

function conEditorValido(reparto: RepartoDeAreas): RepartoDeAreas {
  return esEditor(reparto.abajo) ? reparto : { ...reparto, abajo: null };
}
