/**
 * El montaje que hay en el lienzo, y el deshacer.
 *
 * Vive aparte de `session-store` a propósito. Aquel es «lo que está pasando
 * mientras alguien toca» —lo que suena, lo que se oye, el tono detectado— y se
 * borra al recargar sin que nadie lo eche de menos. Un montaje es trabajo: media
 * hora colocando bloques. Mezclarlos habría hecho que `reset()`, que existe para
 * empezar una sesión limpia, se llevara la canción por delante.
 *
 * La tonalidad no está aquí, sino en `session-store`: un montaje son grados
 * —[core/music/arrangement.ts]— y el tono con el que suenan lo pone la rueda. Es
 * lo que hace que cambiar de tonalidad no toque un solo bloque.
 *
 * **El deshacer es una pila de montajes enteros**, no de operaciones inversas.
 * Un montaje son unos cientos de bytes y todas las funciones del dominio
 * devuelven uno nuevo, así que guardar el anterior es gratis y no puede
 * descuadrarse; escribir la inversa de cada gesto sí, y el gesto que peor se
 * deshace —arrastrar entre partes— es justo el más frecuente.
 *
 * Un paso puede llevar algo más que el montaje: abrir una copia cambia también
 * la tonalidad y el tempo, y deshacerla los devuelve (`PasoAtras`).
 */

import { create, type StoreApi } from 'zustand';

import {
  addBlock,
  bloquesSinTraduccion,
  addNote,
  addPart,
  EMPTY_ARRANGEMENT,
  findBlock,
  fixBlock,
  translateToMode,
  leerMontaje,
  moveBlock,
  moveNote,
  movePart,
  removeBlock,
  removeNote,
  removePart,
  writtenBlock,
  renamePart,
  setPartRole,
  resizeBlock,
  resizeNote,
  setBars,
  type Arrangement,
  type Block,
  type CapturedStep,
  type CopiaDeLaCancion,
  type DegreeSymbol,
  type EspecieDeBloque,
  type LeadNote,
  type KeyMode,
  type SectionRole,
} from '@core/music';

import { apuntarHecho } from './hechos-de-componer';
import { vigilarElModoDelMontaje } from './montaje-en-su-modo';
import { selectActiveKey, useSessionStore, type SessionState } from './session-store';
import { createAlmacenDelLienzo, type AlmacenDelLienzo } from './session-storage';

/**
 * Cuántos pasos atrás se guardan.
 *
 * Veinte es lo que cabe en un rato de montaje sin que la pila crezca sola. Más
 * atrás nadie se acuerda de qué había.
 */
export const MAX_UNDO = 20;

export interface ArrangementActions {
  /** Una parte nueva al final, y devuelve su identificador. */
  addPart(name?: string): string;
  removePart(partId: string): void;
  renamePart(partId: string, name: string): void;
  /** Dice qué papel hace la parte. Ajusta el nombre si lo puso la aplicación. */
  setPartRole(partId: string, role: SectionRole): void;
  movePart(partId: string, to: number): void;
  /** Alarga o acorta una parte, en compases. Nunca por debajo de lo que hay. */
  setBars(partId: string, bars: number, beatsPerBar: number): void;

  /** Un bloque al final de esa parte, o en `at` si se dice. */
  addBlock(
    partId: string,
    degree: DegreeSymbol,
    beats: number,
    at?: number | null,
    especie?: EspecieDeBloque,
  ): string;
  removeBlock(blockId: string): void;
  /** Cambia el acorde de un bloque y lo da por bueno: es la corrección. */
  fixBlock(blockId: string, degree: DegreeSymbol): void;
  /** Deja el acorde como está y deja de preguntar por él. */
  confirmBlock(blockId: string): void;
  resizeBlock(blockId: string, beats: number): void;
  moveBlock(blockId: string, toPartId: string, to: number): void;

  /** Una nota del punteo, y devuelve su identificador. */
  addNote(partId: string, offset: number, start: number, length: number): string;
  removeNote(noteId: string): void;
  /** Otro momento, otra altura, o las dos: arrastrando es un solo gesto. */
  moveNote(noteId: string, start: number, offset: number): void;
  resizeNote(noteId: string, length: number): void;

  /**
   * Mete de una vez lo que se acaba de grabar: los acordes y el punteo.
   *
   * Una sola entrada en el deshacer para toda la grabación, acordes y notas
   * juntos: quien acaba de tocar ocho compases quiere quitarlos de una vez.
   */
  addRecorded(steps: readonly CapturedStep[], name: string, notes?: readonly LeadNote[]): string;

  /** Abre un montaje entero: al cargar una canción, o al deshacerlo todo. */
  replace(arrangement: Arrangement): void;
  /**
   * Abre una copia `.caos.json`: su tonalidad, su tempo y su montaje.
   *
   * **Se deshace entera, en un paso.** La tonalidad y el tempo viven en
   * `session-store` y no en la pila, así que deshacer solo el montaje dejaba la
   * canción de antes sonando en la tonalidad y el tempo de la copia; y si la
   * copia era de otro modo, poner su tonalidad traducía antes la canción de
   * antes, y lo que se apilaba ya venía con los bloques que el modo tira.
   */
  abrirCopia(copia: CopiaDeLaCancion): void;
  /**
   * Pasa el montaje al modo pedido, traduciendo cada grado por su función.
   *
   * Lo llama `montaje-en-su-modo.ts`, que vigila la tonalidad desde que se crea
   * este almacén: aquí no se sabe cuál hay puesta, y durante un tiempo esto
   * estuvo escrito y sin que lo llamara nadie, que es como se cayó la pantalla
   * de componer.
   *
   * **No gasta un paso del deshacer.** Lo gastaba, y eso atascaba el botón:
   * deshacer devolvía los grados del modo viejo, la vigilancia los volvía a
   * traducir y apilaba otra vez, así que cada pulsación dejaba la pila igual que
   * estaba. Traducir no es un cambio de quien compone —el cambio fue pulsar la
   * rueda, y se deshace volviendo a pulsarla, que deja la canción como estaba—,
   * así que **reemplaza la cima** y la pila no se entera. Lo de antes de cambiar
   * de modo se deshace igual: sale en el modo viejo y la vigilancia lo traduce al
   * vuelo, también sin apilar.
   */
  keepMode(mode: KeyMode): void;
  /** Deja de avisar de lo que se quedó fuera al cambiar de modo. */
  olvidarQuitados(): void;

  /**
   * Pone la canción que se acaba de escribir en otra pestaña.
   *
   * **Con deshacer detrás**, al contrario que lo leído al abrir: lo de aquí era
   * trabajo de quien está mirando esta pestaña, y si no quería lo de la otra,
   * deshacer se lo devuelve.
   */
  traerDeOtraPestana(arrangement: Arrangement): void;
  /** Deja de avisar de que la canción llegó de otra pestaña. */
  olvidarOtraPestana(): void;

  /**
   * Un arrastre entero cuenta como un paso atrás.
   *
   * Sin esto, soltar una nota después de moverla veinte píxeles deja veinte
   * entradas en el deshacer y hacen falta veinte pulsaciones para volver.
   * Se abre al empezar el gesto y se cierra al soltar.
   */
  beginGesture(): void;
  endGesture(): void;

  undo(): void;
  clear(): void;

  /**
   * Qué bloque está elegido, o nulo si ninguno.
   *
   * Vive aquí y no en el lienzo porque **no lo mira solo el lienzo**: la columna
   * del acorde enseña cómo se toca el elegido y las propuestas salen desde él.
   * En estado del componente, esas dos cosas no tenían manera de enterarse y
   * acababan mirando `path`, que es una segunda canción paralela a la de verdad
   * ([adr/0032](../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
   */
  elegirBloque(blockId: string | null): void;
}

/**
 * Lo que se quedó fuera la última vez que cambiar de modo dejó algo fuera.
 *
 * Hoy solo puede ser la dominante del `ii`, que en menor no tiene dónde caer
 * (`degreeInMode`). Se guarda aquí **para poder decirlo**: un acorde que
 * desaparece sin avisar es trabajo perdido que nadie sabe que ha perdido, que es
 * lo que pasaba con el E7 de un C G Am F antes de traducirse por función.
 */
export interface QuitadosAlCambiarDeModo {
  /** El modo al que se pasó, que es el que no los tiene. */
  readonly hacia: KeyMode;
  /** Los bloques tal como eran, con su grado del modo de antes. */
  readonly bloques: readonly Block[];
}

/** Lo de `session-store` que una copia cambia y deshacerla devuelve. */
type AjustesDeLaSesion = Pick<SessionState, 'pinnedKey' | 'bpm' | 'beatsPerBar'>;

/**
 * Un paso del deshacer: el montaje de antes y, si el paso fue abrir una copia,
 * los ajustes de la sesión que había antes de abrirla.
 *
 * **Es el montaje mismo, con los ajustes al lado**, y no una caja que lo
 * envuelva: así lo apilado por un cambio cualquiera es el montaje de antes, el
 * mismo objeto, y quien compara la pila con un montaje que guardó —Salidas, para
 * saber si lo último fue probar una propuesta— sigue pudiendo hacerlo. Solo el
 * paso de una copia es un objeto propio, y deshacerlo pone el montaje sin los
 * ajustes.
 */
export type PasoAtras = Arrangement & { readonly ajustesDeAntes?: AjustesDeLaSesion };

export interface ArrangementState {
  readonly arrangement: Arrangement;
  /** Lo que se deshace, el último primero. */
  readonly past: readonly PasoAtras[];
  /** Lo que el último cambio de modo dejó fuera, o nulo si no dejó nada. */
  readonly quitadosAlCambiarDeModo: QuitadosAlCambiarDeModo | null;
  /** El bloque elegido, o nulo. Lo miran el lienzo y la columna del acorde. */
  readonly selectedBlockId: string | null;
  /**
   * Si la canción que se ve llegó de otra pestaña y todavía no se ha dicho que
   * vale. Es para poder decirlo: que la canción cambie sola, sin que nadie la
   * toque aquí, sin una frase es un fallo (adr/0118).
   */
  readonly llegoDeOtraPestana: boolean;
  readonly actions: ArrangementActions;
}

/**
 * Un identificador único para un bloque o una parte.
 *
 * `crypto.randomUUID` no está en todas partes —hace falta contexto seguro, y en
 * `http://` de una red local no lo hay—, así que hay respaldo. No se usa para
 * nada que dependa de que sea impredecible: solo tiene que no repetirse dentro
 * de un montaje.
 */
let contador = 0;
export function nuevoId(prefijo: string): string {
  contador += 1;
  const azar =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefijo}-${azar}-${contador}`;
}

/**
 * Si hay un arrastre en marcha, y si ya se guardó su punto de partida.
 *
 * Van fuera del estado porque no se pintan: que haya un gesto abierto no cambia
 * nada de lo que se ve, y meterlo en el store repintaría la pantalla entera dos
 * veces por arrastre. Y fuera del almacén, en el módulo, porque además lo mira
 * quien guarda el lienzo (`gestoAbierto`): a mitad de un arrastre no se guarda.
 */
let enGesto = false;
let yaApilado = false;

/**
 * Quien quiere enterarse de que se ha soltado un arrastre: el guardado, que con
 * el gesto abierto no programa nada y espera a esto en vez de mirar cada poco.
 */
const alCerrarElGesto = new Set<() => void>();

/** Avisa al soltar cada arrastre. Devuelve con qué dejar de avisar. */
export function avisarAlCerrarElGesto(aviso: () => void): () => void {
  alCerrarElGesto.add(aviso);
  return () => alCerrarElGesto.delete(aviso);
}

function devolverAjustes({ pinnedKey, bpm, beatsPerBar }: AjustesDeLaSesion): void {
  const sesion = useSessionStore.getState().actions;
  if (pinnedKey === null) {
    sesion.followDetection();
  } else {
    sesion.pinKey(pinnedKey);
  }
  sesion.setTempo(bpm, beatsPerBar);
}

/** Si hay un arrastre a medias. Mientras lo haya, el lienzo no se guarda. */
export function gestoAbierto(): boolean {
  return enGesto;
}

export const useArrangementStore = create<ArrangementState>((set, get) => {
  /**
   * Aplica un cambio guardando lo que había.
   *
   * Si el cambio no cambia nada —soltar un bloque donde ya estaba, estirar hasta
   * un ancho que ya tenía, cambiar de modo sin perder ningún grado— no se apunta
   * en el deshacer. La comparación es por referencia y basta con eso porque el
   * dominio lo garantiza: `arrangement.ts` devuelve el mismo montaje cuando no
   * hay nada que cambiar.
   */
  function cambiar(cambio: (actual: Arrangement) => Arrangement): void {
    const { arrangement, past } = get();
    const siguiente = cambio(arrangement);
    if (siguiente === arrangement) {
      return;
    }
    // Dentro de un gesto solo se apila la primera vez: lo que se deshace es el
    // arrastre entero, no cada píxel por el que pasó el puntero.
    const apilar = !enGesto || !yaApilado;
    yaApilado = true;
    set({
      arrangement: siguiente,
      past: apilar ? [arrangement, ...past].slice(0, MAX_UNDO) : past,
    });
  }

  return {
    arrangement: EMPTY_ARRANGEMENT,
    past: [],
    quitadosAlCambiarDeModo: null,
    selectedBlockId: null,
    llegoDeOtraPestana: false,
    actions: {
      elegirBloque(blockId) {
        set({ selectedBlockId: blockId });
      },
      addPart(name) {
        const id = nuevoId('parte');
        cambiar((actual) => addPart(actual, id, name));
        return id;
      },
      removePart(partId) {
        cambiar((actual) => removePart(actual, partId));
      },
      renamePart(partId, name) {
        cambiar((actual) => renamePart(actual, partId, name));
      },
      setPartRole(partId, role) {
        cambiar((actual) => setPartRole(actual, partId, role));
        // Decir qué es lo que acabas de tocar cuenta como practicar: es la
        // decisión que convierte cuatro compases en una parte de una canción, y
        // es el dato con el que la IA sabe qué le estás pidiendo.
        apuntarHecho('parte');
      },
      movePart(partId, to) {
        cambiar((actual) => movePart(actual, partId, to));
      },
      setBars(partId, bars, beatsPerBar) {
        cambiar((actual) => setBars(actual, partId, bars, beatsPerBar));
      },

      addBlock(partId, degree, beats, at = null, especie) {
        const id = nuevoId('bloque');
        cambiar((actual) => addBlock(actual, partId, writtenBlock(id, degree, beats, especie), at));
        return id;
      },
      removeBlock(blockId) {
        cambiar((actual) => removeBlock(actual, blockId));
      },
      fixBlock(blockId, degree) {
        cambiar((actual) => fixBlock(actual, blockId, degree));
      },
      confirmBlock(blockId) {
        const actual = findBlock(get().arrangement, blockId);
        if (actual !== null) {
          cambiar((montaje) => fixBlock(montaje, blockId, actual.block.degree, true));
        }
      },
      resizeBlock(blockId, beats) {
        cambiar((actual) => resizeBlock(actual, blockId, beats));
      },
      moveBlock(blockId, toPartId, to) {
        cambiar((actual) => moveBlock(actual, blockId, toPartId, to));
      },

      addNote(partId, offset, start, length) {
        const id = nuevoId('nota');
        const note: LeadNote = { id, offset, start, length };
        cambiar((actual) => addNote(actual, partId, note));
        return id;
      },
      removeNote(noteId) {
        cambiar((actual) => removeNote(actual, noteId));
      },
      moveNote(noteId, start, offset) {
        cambiar((actual) => moveNote(actual, noteId, start, offset));
      },
      resizeNote(noteId, length) {
        cambiar((actual) => resizeNote(actual, noteId, length));
      },

      addRecorded(steps, name, notes = []) {
        const partId = nuevoId('parte');
        cambiar((actual) => {
          // Una sola entrada en el deshacer para toda la grabación: quien acaba
          // de tocar ocho compases quiere quitarlos de una vez, no uno a uno.
          let siguiente = addPart(actual, partId, name);
          for (const step of steps) {
            // Oído, con la duda que traía: es lo que permite marcar en el
            // lienzo los compases de los que el motor no estaba seguro.
            siguiente = addBlock(siguiente, partId, {
              id: nuevoId('bloque'),
              degree: step.degree,
              beats: step.beats,
              source: 'heard',
              confidence: step.confidence,
              alternatives: step.alternatives,
            });
          }
          for (const note of notes) {
            siguiente = addNote(siguiente, partId, { ...note, id: nuevoId('nota') });
          }
          return siguiente;
        });
        return partId;
      },

      replace(arrangement) {
        cambiar(() => arrangement);
      },
      abrirCopia(copia) {
        const { pinnedKey, bpm, beatsPerBar, actions: sesion } = useSessionStore.getState();
        const { arrangement, past } = get();
        // Se apila antes de poner la tonalidad, que tradujera lo de antes al modo
        // de la copia, y con los ajustes que deshacerla devuelve.
        const antes: PasoAtras = {
          ...arrangement,
          ajustesDeAntes: { pinnedKey, bpm, beatsPerBar },
        };
        sesion.pinKey({ tonic: copia.tonic, mode: copia.mode });
        sesion.setTempo(copia.bpm, copia.beatsPerBar);
        set({
          arrangement: copia.arrangement,
          past: [antes, ...past].slice(0, MAX_UNDO),
          // Lo que el cambio de modo quitó era de la canción de antes, que vuelve
          // entera al deshacer; y lo elegido allí no existe aquí.
          quitadosAlCambiarDeModo: null,
          selectedBlockId: null,
          llegoDeOtraPestana: false,
        });
      },
      keepMode(mode) {
        const { arrangement, selectedBlockId } = get();
        const siguiente = translateToMode(arrangement, mode);
        if (siguiente === arrangement) {
          return;
        }
        const quitados = bloquesSinTraduccion(arrangement, mode);
        // Sin tocar `past`: es lo que deja el deshacer donde estaba.
        set({
          arrangement: siguiente,
          ...(quitados.length === 0
            ? {}
            : {
                quitadosAlCambiarDeModo: { hacia: mode, bloques: quitados },
                // Un bloque elegido que se ha quedado fuera no puede seguir
                // elegido: la columna del acorde enseñaría algo que no está.
                ...(quitados.some((bloque) => bloque.id === selectedBlockId)
                  ? { selectedBlockId: null }
                  : {}),
              }),
        });
      },
      olvidarQuitados() {
        set({ quitadosAlCambiarDeModo: null });
      },
      traerDeOtraPestana(arrangement) {
        cambiar(() => arrangement);
        const { selectedBlockId } = get();
        // El bloque elegido aquí puede no existir en lo que llega: la columna del
        // acorde enseñaría algo que ya no está en la canción.
        set({
          llegoDeOtraPestana: true,
          ...(selectedBlockId !== null && findBlock(arrangement, selectedBlockId) === null
            ? { selectedBlockId: null }
            : {}),
        });
      },
      olvidarOtraPestana() {
        set({ llegoDeOtraPestana: false });
      },

      beginGesture() {
        enGesto = true;
        yaApilado = false;
      },
      endGesture() {
        enGesto = false;
        yaApilado = false;
        for (const aviso of alCerrarElGesto) {
          aviso();
        }
      },

      undo() {
        const { past } = get();
        const [anterior, ...resto] = past;
        if (anterior === undefined) {
          return;
        }
        const { ajustesDeAntes, ...montaje } = anterior;
        if (ajustesDeAntes === undefined) {
          // El mismo objeto que se apiló, no una copia: es el montaje de antes.
          set({ arrangement: anterior, past: resto });
          return;
        }
        // La tonalidad antes que el montaje: al revés, la vigilancia del modo
        // traduciría la canción de antes al de la copia y la volvería a recortar.
        devolverAjustes(ajustesDeAntes);
        set({
          arrangement: montaje,
          past: resto,
          quitadosAlCambiarDeModo: null,
          selectedBlockId: null,
        });
      },
      clear() {
        cambiar(() => EMPTY_ARRANGEMENT);
        // Sin esto quedaba elegido un bloque que ya no existe, y la columna del
        // acorde seguía enseñando las formas de algo que no está en la canción.
        set({ selectedBlockId: null });
      },
    },
  };
});

/**
 * El montaje, siempre escrito en el modo de la tonalidad que hay puesta.
 *
 * **Se pone aquí, al crear el almacén, y no en una pantalla.** Estuvo en un
 * efecto de componer, y fuera de componer no había nadie mirando: un cambio de
 * modo en una unidad o en la rueda de la portada dejaba el montaje en el modo
 * viejo, y al volver la pantalla se caía entera
 * ([montaje-en-su-modo.ts](./montaje-en-su-modo.ts) cuenta por qué). Puesto
 * aquí, no puede haber un montaje sin su vigilancia.
 *
 * **Solo en el navegador.** En el servidor este módulo es uno para todas las
 * peticiones, y apuntarse a la tonalidad allí sería mezclar la de una persona
 * con el montaje de otra. Tampoco hace falta: allí nadie cambia de modo. No se
 * quita nunca, porque el almacén tampoco se va: vive lo que vive la pestaña.
 */
if (typeof window !== 'undefined') {
  vigilarElModoDelMontaje(useArrangementStore);
}

/**
 * Cuánto se espera después del último cambio para guardar el lienzo.
 *
 * Corto, para que recargar justo después de escribir no pierda el último
 * acorde; y no cero, para que una ráfaga de cambios —teclear cuatro acordes con
 * los atajos, traer una toma de ocho compases— sea una sola escritura.
 */
export const RETRASO_DEL_GUARDADO = 300;

/** Lo que hace falta del almacén para guardarlo: leerlo, escribirlo y enterarse. */
type AlmacenQueSeGuarda = Pick<StoreApi<ArrangementState>, 'getState' | 'setState' | 'subscribe'>;

/**
 * Lo que hace falta de un canal entre pestañas: mandar y oír. Es lo que tiene
 * `BroadcastChannel`, y en los tests, un doble.
 */
export type CanalEntrePestanas = Pick<
  BroadcastChannel,
  'postMessage' | 'addEventListener' | 'removeEventListener'
>;

/** El nombre del canal: el mismo en todas las pestañas del mismo sitio. */
const CANAL_DEL_LIENZO = 'caos-ordenado:lienzo';

/** Si dos montajes dicen lo mismo, aunque sean objetos distintos. */
function iguales(uno: Arrangement, otro: Arrangement): boolean {
  return JSON.stringify(uno) === JSON.stringify(otro);
}

/**
 * Que el lienzo sobreviva a recargar: lo lee al empezar y lo guarda al cambiar.
 *
 * **Primero se lee y después se guarda.** Al revés, el lienzo vacío con el que
 * nace el almacén se escribiría encima de lo guardado antes de haberlo leído, y
 * la canción se perdería justo al intentar no perderla.
 *
 * **Lo leído solo entra si no hay nada.** La lectura es asíncrona, y si para
 * cuando llega alguien ya ha escrito un acorde —o ha abierto una canción—, lo
 * suyo manda: pisarlo con lo de la última vez sería borrar lo que acaba de hacer.
 * Y entra **sin deshacer detrás**: recuperar lo de ayer no es un cambio que se
 * deshaga, es como estaba.
 *
 * **No se guarda en cada movimiento.** Cada cambio reinicia la espera, y a mitad
 * de un arrastre no se escribe: arrastrar un bloque cambia el montaje en cada
 * hueco por el que pasa, y serían decenas de escrituras para quedarse con la
 * última. Con el gesto abierto no se programa nada: queda pendiente, y al soltar
 * (`avisarAlCerrarElGesto`) empieza la espera. Las
 * escrituras van en fila y cada una lee el montaje del momento, así que una lenta
 * no puede dejar en la base uno más viejo que el siguiente.
 *
 * Y al irse de la página se guarda lo pendiente sin esperar (`pagehide`), que es
 * lo que da tiempo a recargar justo después de escribir. El deshacer no se
 * guarda: es de la sesión, y volver mañana a una pila de pasos de ayer no
 * devuelve a nadie a donde estaba.
 *
 * **Y lo escrito se cuenta a las otras pestañas** (`canal`). El lienzo guardado
 * es uno, y con dos pestañas abiertas cada una guardaba el suyo encima del de la
 * otra sin que ninguna lo supiera: lo último que se tocaba en una borraba lo
 * hecho en la otra. `storage` no sirve, porque solo avisa de `localStorage` y
 * esto vive en IndexedDB; un `BroadcastChannel` avisa de lo que se le diga.
 * Lo que llega entra con su deshacer y con un aviso, en el modo de la tonalidad
 * de esta pestaña, y **no se vuelve a contar**: si cada pestaña repitiera lo que
 * oye, dos pestañas se lo devolverían para siempre. A mitad de un arrastre no
 * entra: lo de esta pestaña, al soltar, se guarda y se cuenta, y manda
 * ([adr/0118](../../docs/adr/0118-la-cancion-vive-en-este-navegador-y-se-dice.md)).
 *
 * Solo en el navegador: escucha a la ventana, y en el servidor no hay ni ventana
 * ni de quién guardar nada.
 */
export function guardarElLienzo(
  montaje: AlmacenQueSeGuarda,
  lienzo: AlmacenDelLienzo,
  canal: CanalEntrePestanas | null = null,
  retraso: number = RETRASO_DEL_GUARDADO,
): () => void {
  let leido = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let fila: Promise<void> = Promise.resolve();
  /** Lo último que llegó de otra pestaña: eso no se guarda ni se cuenta otra vez. */
  let deFuera: Arrangement | null = null;
  /** Si algo cambió con el gesto abierto y espera a que se suelte para guardarse. */
  let alSoltar = false;

  const escribir = (): void => {
    temporizador = null;
    fila = fila
      .then(async () => {
        const { arrangement } = montaje.getState();
        await lienzo.guardar(arrangement);
        canal?.postMessage({ arrangement });
      })
      // Si el navegador no deja guardar —modo privado, cuota llena—, se pierde
      // el guardado y no la sesión: el lienzo sigue en memoria y se puede seguir.
      .catch(() => {});
  };

  const pararLaEspera = (): void => {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  };

  /**
   * Empieza la espera, o la deja para cuando se suelte el gesto.
   *
   * **Con el gesto abierto no se programa nada.** Se volvía a esperar cada
   * `retraso`, y un arrastre largo era un temporizador cada 300 ms para
   * comprobar que seguía abierto.
   */
  const esperar = (): void => {
    pararLaEspera();
    if (gestoAbierto()) {
      alSoltar = true;
      return;
    }
    temporizador = setTimeout(() => {
      // Una espera que empezó antes del gesto y se cumple dentro también lo deja
      // para el final: a mitad de un arrastre no se escribe.
      if (gestoAbierto()) {
        temporizador = null;
        alSoltar = true;
        return;
      }
      escribir();
    }, retraso);
  };

  const dejarDeOirElGesto = avisarAlCerrarElGesto(() => {
    if (alSoltar) {
      alSoltar = false;
      esperar();
    }
  });

  void lienzo
    .leer()
    .catch(() => null)
    .then((guardado) => {
      leido = true;
      const { arrangement } = montaje.getState();
      if (arrangement.parts.length > 0) {
        // Alguien escribió mientras se leía: lo suyo es lo que vale, y se guarda.
        esperar();
        return;
      }
      if (guardado !== null && guardado.parts.length > 0) {
        montaje.setState({ arrangement: guardado, past: [] });
      }
    });

  const dejarDeMirar = montaje.subscribe((estado, anterior) => {
    if (leido && estado.arrangement !== anterior.arrangement && estado.arrangement !== deFuera) {
      esperar();
    }
  });

  const alLlegar = (evento: MessageEvent): void => {
    const llegado = leerMontaje((evento.data as { arrangement?: unknown } | null)?.arrangement);
    if (llegado === null || gestoAbierto()) {
      return;
    }
    // En el modo de esta pestaña, que puede tener otra tonalidad puesta: sin
    // traducirlo aquí lo traduciría la vigilancia del modo, y eso sería un
    // cambio de esta pestaña que se guardaría y se contaría de vuelta.
    const modo = selectActiveKey(useSessionStore.getState())?.mode;
    const traducido = modo === undefined ? llegado : translateToMode(llegado, modo);
    if (iguales(traducido, montaje.getState().arrangement)) {
      return;
    }
    deFuera = traducido;
    montaje.getState().actions.traerDeOtraPestana(traducido);
  };
  canal?.addEventListener('message', alLlegar);

  const alIrse = (): void => {
    // Lo que esperaba al final del gesto también: quien se va a mitad de un
    // arrastre no lo va a soltar aquí.
    if (temporizador !== null || alSoltar) {
      pararLaEspera();
      alSoltar = false;
      escribir();
    }
  };
  window.addEventListener('pagehide', alIrse);

  return () => {
    dejarDeMirar();
    dejarDeOirElGesto();
    canal?.removeEventListener('message', alLlegar);
    window.removeEventListener('pagehide', alIrse);
    pararLaEspera();
  };
}

/**
 * El lienzo se guarda en este navegador desde que existe el almacén, y por lo
 * mismo que la vigilancia del modo: puesto en una pantalla, lo que se hiciera
 * fuera de ella no se guardaría. Solo en el navegador, que en el servidor no hay
 * dónde guardar ni de quién.
 */
if (typeof window !== 'undefined') {
  /**
   * El guardado de la vez anterior que se evaluó este módulo, para quitarlo.
   *
   * En el navegador de verdad se evalúa una vez; **en desarrollo, una por cada
   * recarga en caliente**, y cada una dejaba otro canal abierto y otros oyentes
   * guardando un almacén que ya nadie pinta. Colgado de `globalThis`, como la
   * conexión de `server/db/client.ts`, porque es lo único que sobrevive a la
   * recarga.
   */
  const anterior = globalThis as { __caosGuardadoDelLienzo?: () => void };
  anterior.__caosGuardadoDelLienzo?.();
  // Sin comprobar si existe: lo traen todos los navegadores desde 2022, y esta
  // aplicación ya pide `popover`, que es de 2024.
  const canal = new BroadcastChannel(CANAL_DEL_LIENZO);
  const dejarDeGuardar = guardarElLienzo(useArrangementStore, createAlmacenDelLienzo(), canal);
  anterior.__caosGuardadoDelLienzo = () => {
    dejarDeGuardar();
    canal.close();
  };
}

/** Si hay algo que deshacer, para no dejar el botón encendido sin nada detrás. */
export function selectCanUndo(state: ArrangementState): boolean {
  return state.past.length > 0;
}
