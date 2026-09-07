/**
 * El montaje: la canción vista como bloques en el tiempo.
 *
 * Es lo que hay debajo del lienzo de componer, y existe por una diferencia
 * pequeña con `song.ts` que lo cambia todo: **aquí un acorde dura lo que dura**.
 * Una canción guardada es una lista de grados y cada uno vale un compás; un
 * montaje es una lista de bloques y cada uno lleva sus pulsos. Sin eso no se
 * puede arrastrar el borde de un bloque para que ocupe dos compases, que es la
 * mitad de lo que se hace al montar una canción.
 *
 * La duración ya se medía y se estaba tirando: `captureProgression` devuelve
 * `CapturedStep` con sus pulsos, y `capturedDegrees` se queda solo con los
 * grados para poder guardar. Aquí no se pierde.
 *
 * ## Lo que este fichero no tiene, y es a propósito
 *
 * **No tiene tonalidad.** Un montaje son grados, y el tono con el que suenan lo
 * pone quien lo mira: cambiar la rueda cambia el lienzo entero sin tocar un
 * bloque. Es la misma razón por la que las canciones se guardan en grados
 * —[song.ts]— llevada a su conclusión: si el tono estuviera dentro, habría dos
 * sitios donde vive y uno de los dos se quedaría viejo.
 *
 * **No genera identificadores ni lee el reloj.** Los `id` entran por parámetro,
 * como el instante en `exercise.ts` y en `song.ts`. Un dominio que llama a
 * `crypto.randomUUID()` deja de poder probarse comparando estructuras.
 *
 * Dominio puro: ni `window`, ni fetch, ni azar.
 */

import type { KeyMode } from './keys';
import type { PitchClass } from './notes';
import type { PlaybackStep } from './playback';
import { degreesFor, resolveDegree, type DegreeSymbol } from './progressions';
import type { CapturedStep } from './capture';
import { MAX_SECTIONS, MAX_SECTION_DEGREES, type Song, type SongSection } from './song';
import { DEFAULT_BEATS_PER_BAR } from './tempo';

/** Un bloque del lienzo: un acorde y lo que ocupa. */
export interface Block {
  readonly id: string;
  readonly degree: DegreeSymbol;
  /** Pulsos. Siempre uno o más. */
  readonly beats: number;
}

/** Un tramo con nombre: la estrofa, el estribillo, el puente. */
export interface Part {
  readonly id: string;
  readonly name: string;
  readonly blocks: readonly Block[];
}

export interface Arrangement {
  readonly parts: readonly Part[];
}

/**
 * Los topes salen de `song.ts` y no se escriben otra vez.
 *
 * Un montaje que no cabe en una canción es un montaje que no se puede guardar,
 * y enterarse al pulsar «guardar» —con el trabajo hecho— es la peor manera de
 * enterarse. Al ser los mismos números, lo que entra en el lienzo entra en la
 * base de datos.
 */
export const MAX_PARTS = MAX_SECTIONS;
export const MAX_PART_BLOCKS = MAX_SECTION_DEGREES;

/**
 * Lo que puede durar un bloque, en pulsos.
 *
 * Cuatro compases de 4/4 es el techo. Más que eso no es un acorde largo: es que
 * esa parte se ha quedado en un solo acorde, y para eso están las partes.
 */
export const MIN_BLOCK_BEATS = 1;
export const MAX_BLOCK_BEATS = 16;

/**
 * Los pulsos de un bloque, siempre dentro de lo que se puede dibujar.
 *
 * Solo `NaN` cae al mínimo: es lo que llega si el puntero sale de la pantalla a
 * mitad de un arrastre, y no significa «grande» ni «pequeño». Un infinito sí
 * significa «lo más que se pueda», así que lo recortan los topes como a
 * cualquier número.
 */
export function clampBeats(beats: number): number {
  if (Number.isNaN(beats)) {
    return MIN_BLOCK_BEATS;
  }
  return Math.min(MAX_BLOCK_BEATS, Math.max(MIN_BLOCK_BEATS, Math.round(beats)));
}

export const EMPTY_ARRANGEMENT: Arrangement = { parts: [] };

/** El nombre de una parte nueva, numerada por su sitio. */
export function defaultPartName(index: number): string {
  return `Parte ${index + 1}`;
}

/** Cuántos pulsos ocupa una parte. */
export function partBeats(part: Part): number {
  return part.blocks.reduce((total, block) => total + block.beats, 0);
}

/** Cuántos pulsos ocupa el montaje entero. */
export function arrangementBeats(arrangement: Arrangement): number {
  return arrangement.parts.reduce((total, part) => total + partBeats(part), 0);
}

/**
 * Cuántos compases ocupa eso, escrito para leerlo.
 *
 * Con coma decimal y no con punto, que es como se escriben los números en
 * español y como los escribe el resto de la aplicación. Un compás y cuarto sale
 * de estirar un bloque a mano, así que el decimal aparece de verdad.
 */
export function barsLabel(beats: number, beatsPerBar: number): string {
  const compases = beats / Math.max(1, beatsPerBar);
  const redondeado = Math.round(compases * 100) / 100;
  const texto = String(redondeado).replace('.', ',');
  return `${texto} ${redondeado === 1 ? 'compás' : 'compases'}`;
}

/** Cuántos bloques tiene entero. Es lo que se enseña en el rótulo. */
export function arrangementLength(arrangement: Arrangement): number {
  return arrangement.parts.reduce((total, part) => total + part.blocks.length, 0);
}

/** Dónde está un bloque, o nulo si ese identificador no existe. */
export function findBlock(
  arrangement: Arrangement,
  blockId: string,
): { readonly part: Part; readonly block: Block; readonly index: number } | null {
  for (const part of arrangement.parts) {
    const index = part.blocks.findIndex((block) => block.id === blockId);
    if (index !== -1) {
      // El índice ya se ha comprobado, así que aquí hay bloque.
      return { part, block: part.blocks[index] as Block, index };
    }
  }
  return null;
}

/** El último grado de una parte, que es desde donde se sugiere el siguiente. */
export function lastDegreeOf(part: Part): DegreeSymbol | null {
  return part.blocks.at(-1)?.degree ?? null;
}

/**
 * **Lo que no cambia devuelve lo mismo, con la misma referencia.**
 *
 * Es la propiedad que sostiene el deshacer y los repintados: quien llama compara
 * con `===` para saber si pasó algo. Sin ella, quitar un bloque que no existe o
 * estirar uno hasta el ancho que ya tenía cuentan como un paso atrás, y deshacer
 * un arrastre pide tantas pulsaciones como veces pasó el puntero por un hueco.
 *
 * Sale barato porque todo aquí es inmutable: basta con no construir nada nuevo
 * cuando ninguna pieza de dentro ha cambiado de referencia.
 */
function mapParts(arrangement: Arrangement, change: (part: Part) => Part): Arrangement {
  let alguna = false;
  const parts = arrangement.parts.map((part) => {
    const siguiente = change(part);
    if (siguiente !== part) {
      alguna = true;
    }
    return siguiente;
  });
  return alguna ? { parts } : arrangement;
}

function mapPart(
  arrangement: Arrangement,
  partId: string,
  change: (part: Part) => Part,
): Arrangement {
  return mapParts(arrangement, (part) => (part.id === partId ? change(part) : part));
}

/** Los mismos bloques, con el cambio aplicado solo al que toca. */
function mapBlocks(part: Part, change: (block: Block) => Block): Part {
  let alguno = false;
  const blocks = part.blocks.map((block) => {
    const siguiente = change(block);
    if (siguiente !== block) {
      alguno = true;
    }
    return siguiente;
  });
  return alguno ? { ...part, blocks } : part;
}

/**
 * Mueve un elemento dentro de una lista.
 *
 * El destino se recorta en vez de rechazarse: arrastrar más allá del final es
 * decir «al final», y contestar con la lista sin tocar haría que el bloque
 * volviera de un salto al sitio del que se lo sacó.
 */
function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const copia = [...items];
  const [movido] = copia.splice(from, 1);
  if (movido === undefined) {
    return copia;
  }
  copia.splice(Math.min(Math.max(0, to), copia.length), 0, movido);
  return copia;
}

export function addPart(arrangement: Arrangement, id: string, name?: string): Arrangement {
  if (arrangement.parts.length >= MAX_PARTS) {
    return arrangement;
  }
  const nombre = name?.trim() ?? '';
  return {
    parts: [
      ...arrangement.parts,
      {
        id,
        name: nombre === '' ? defaultPartName(arrangement.parts.length) : nombre,
        blocks: [],
      },
    ],
  };
}

export function removePart(arrangement: Arrangement, partId: string): Arrangement {
  const parts = arrangement.parts.filter((part) => part.id !== partId);
  return parts.length === arrangement.parts.length ? arrangement : { parts };
}

export function renamePart(arrangement: Arrangement, partId: string, name: string): Arrangement {
  const nombre = name.trim();
  return mapPart(arrangement, partId, (part) =>
    nombre === '' || nombre === part.name ? part : { ...part, name: nombre },
  );
}

export function movePart(arrangement: Arrangement, partId: string, to: number): Arrangement {
  const from = arrangement.parts.findIndex((part) => part.id === partId);
  const destino = Math.min(Math.max(0, to), arrangement.parts.length - 1);
  if (from === -1 || from === destino) {
    return arrangement;
  }
  return { parts: reorder(arrangement.parts, from, destino) };
}

/**
 * Mete un bloque en una parte.
 *
 * `at` nulo es «al final», que es como se añade tocando: se pulsa el acorde que
 * viene después y se coloca detrás del último.
 */
export function addBlock(
  arrangement: Arrangement,
  partId: string,
  block: Block,
  at: number | null = null,
): Arrangement {
  return mapPart(arrangement, partId, (part) => {
    if (part.blocks.length >= MAX_PART_BLOCKS) {
      return part;
    }
    const nuevo: Block = { ...block, beats: clampBeats(block.beats) };
    const destino =
      at === null ? part.blocks.length : Math.min(Math.max(0, at), part.blocks.length);
    const blocks = [...part.blocks];
    blocks.splice(destino, 0, nuevo);
    return { ...part, blocks };
  });
}

export function removeBlock(arrangement: Arrangement, blockId: string): Arrangement {
  return mapParts(arrangement, (part) => {
    const blocks = part.blocks.filter((block) => block.id !== blockId);
    return blocks.length === part.blocks.length ? part : { ...part, blocks };
  });
}

export function resizeBlock(arrangement: Arrangement, blockId: string, beats: number): Arrangement {
  const pulsos = clampBeats(beats);
  return mapParts(arrangement, (part) =>
    mapBlocks(part, (block) =>
      block.id === blockId && block.beats !== pulsos ? { ...block, beats: pulsos } : block,
    ),
  );
}

/**
 * Lleva un bloque a otro sitio: otra posición de su parte, u otra parte.
 *
 * Es una sola función y no dos porque arrastrando son el mismo gesto: se coge un
 * bloque y se suelta en un hueco, y que el hueco esté en la misma fila o en la
 * de abajo no es algo que decida quien arrastra. Con dos funciones, la interfaz
 * tendría que adivinar cuál llamar a mitad del gesto.
 *
 * Si la parte de destino está llena, no se mueve nada: perder el bloque en el
 * viaje sería peor que no dejarlo salir.
 */
export function moveBlock(
  arrangement: Arrangement,
  blockId: string,
  toPartId: string,
  to: number,
): Arrangement {
  const origen = findBlock(arrangement, blockId);
  if (origen === null) {
    return arrangement;
  }

  if (origen.part.id === toPartId) {
    const destino = Math.min(Math.max(0, to), origen.part.blocks.length - 1);
    if (destino === origen.index) {
      return arrangement;
    }
    return mapPart(arrangement, toPartId, (part) => ({
      ...part,
      blocks: reorder(part.blocks, origen.index, destino),
    }));
  }

  const destino = arrangement.parts.find((part) => part.id === toPartId);
  if (destino === undefined || destino.blocks.length >= MAX_PART_BLOCKS) {
    return arrangement;
  }

  return {
    parts: arrangement.parts.map((part) => {
      if (part.id === origen.part.id) {
        return { ...part, blocks: part.blocks.filter((block) => block.id !== blockId) };
      }
      if (part.id === toPartId) {
        const blocks = [...part.blocks];
        blocks.splice(Math.min(Math.max(0, to), blocks.length), 0, origen.block);
        return { ...part, blocks };
      }
      return part;
    }),
  };
}

/**
 * Los bloques de una parte, o los de todo el montaje seguidos, listos para sonar.
 *
 * Devuelve `PlaybackStep`, que es lo que `scheduleProgression` sabe repartir en
 * el tiempo. Aquí no hay `AudioContext`: esto dice qué notas y cuántos pulsos, y
 * `audio/progression-player.ts` lo convierte en sonido.
 */
export function playbackStepsOf(
  arrangement: Arrangement,
  tonic: PitchClass,
  mode: KeyMode,
  partId: string | null = null,
): PlaybackStep[] {
  const partes =
    partId === null ? arrangement.parts : arrangement.parts.filter((part) => part.id === partId);

  return partes.flatMap((part) =>
    part.blocks.map((block) => {
      const chord = resolveDegree(tonic, mode, block.degree);
      return { notes: chord.notes, root: chord.root, beats: block.beats };
    }),
  );
}

/**
 * Los bloques en el orden en que van a sonar.
 *
 * Quien reproduce recibe un índice —«va por el tercero»— y necesita saber qué
 * bloque es ese para encenderlo en pantalla. Esta lista es esa traducción, y sale
 * del mismo recorrido que `playbackStepsOf` para que los índices no puedan
 * descuadrarse.
 */
export function blocksInOrder(
  arrangement: Arrangement,
  partId: string | null = null,
): { readonly partId: string; readonly blockId: string }[] {
  const partes =
    partId === null ? arrangement.parts : arrangement.parts.filter((part) => part.id === partId);

  return partes.flatMap((part) =>
    part.blocks.map((block) => ({ partId: part.id, blockId: block.id })),
  );
}

/**
 * Los identificadores de un montaje recién abierto.
 *
 * Deterministas y por posición, para que abrir dos veces la misma canción dé el
 * mismo montaje y se pueda comparar en un test sin trucos. No colisionan con los
 * de un bloque añadido después porque esos los pone la capa de estado con su
 * propio generador; aquí no se puede, que no hay azar en `core/`.
 */
function idDePosicion(prefijo: string, parte: number, bloque?: number): string {
  return bloque === undefined ? `${prefijo}${parte}` : `${prefijo}${parte}b${bloque}`;
}

/**
 * Un montaje a partir de una canción guardada.
 *
 * Cada grado ocupa un compás, que es lo que un grado significa en `song.ts`. Al
 * volver a guardar, un bloque que nadie haya tocado escribe exactamente el mismo
 * grado: abrir y guardar no cambia una canción.
 */
export function arrangementFromSong(
  song: Song,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR,
  prefijo = 'c',
): Arrangement {
  const porCompas = clampBeats(beatsPerBar);
  return {
    parts: song.sections.map((section, parte) => ({
      id: idDePosicion(prefijo, parte),
      name: section.name,
      blocks: section.degrees.map((degree, bloque) => ({
        id: idDePosicion(prefijo, parte, bloque),
        degree,
        beats: porCompas,
      })),
    })),
  };
}

/**
 * Las secciones que guardaría este montaje.
 *
 * **Aquí es donde se pierde la duración**, y conviene saber por qué se pierde en
 * vez de arreglarlo: una canción guardada es una lista de grados, la leen la API
 * de salidas y la de canciones, y las dos llevan meses funcionando así. Un
 * bloque de dos compases se escribe como el mismo grado dos veces, que suena
 * igual y cabe en el formato de siempre. Lo que se pierde al abrirla otra vez es
 * saber que eran un bloque y no dos, y eso no cambia ni una nota.
 *
 * Cambiar el formato para conservarlo tendría que tocar el esquema de la base de
 * datos, el contrato de las dos rutas y todas las canciones ya guardadas, y a
 * cambio daría un lienzo con los bloques agrupados como estaban. No compensa
 * todavía.
 */
export function sectionsFromArrangement(
  arrangement: Arrangement,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR,
): SongSection[] {
  const porCompas = clampBeats(beatsPerBar);

  return arrangement.parts
    .slice(0, MAX_PARTS)
    .map((part) => {
      const degrees: DegreeSymbol[] = [];
      for (const block of part.blocks) {
        // Al menos una vez: un bloque más corto que el compás sigue siendo un
        // acorde de la canción, y redondear a cero lo borraría sin decirlo.
        const compases = Math.max(1, Math.round(block.beats / porCompas));
        for (let i = 0; i < compases && degrees.length < MAX_PART_BLOCKS; i += 1) {
          degrees.push(block.degree);
        }
      }
      return { name: part.name, degrees };
    })
    .filter((section) => section.degrees.length > 0);
}

/**
 * Un montaje a partir de lo que se acaba de tocar.
 *
 * Es el puente que faltaba: `captureProgression` ya mide cuántos pulsos duró
 * cada acorde y `capturedDegrees` los tiraba para poder guardar. Aquí entran
 * enteros, y lo que se grabó tocando aparece en el lienzo con los compases que
 * ocupaba de verdad.
 */
export function partFromCapture(
  steps: readonly CapturedStep[],
  id: string,
  name: string,
  prefijo = id,
): Part {
  return {
    id,
    name,
    blocks: steps.slice(0, MAX_PART_BLOCKS).map((step, indice) => ({
      id: `${prefijo}b${indice}`,
      degree: step.degree,
      beats: clampBeats(step.beats),
    })),
  };
}

/**
 * Quita del montaje los grados que no existen en ese modo.
 *
 * Hace falta al cambiar de mayor a menor con el lienzo lleno: los grados no son
 * los mismos y `resolveDegree` lanza `RangeError` con uno que no le toca, que es
 * un error en el sitio equivocado —lo dice `song.ts` de su propio filtro—. Un
 * bloque que no sobrevive se cae, y quien llama sabe cuántos por la diferencia
 * de longitud.
 */
export function keepDegreesOfMode(arrangement: Arrangement, mode: KeyMode): Arrangement {
  const conocidos = new Set<string>(degreesFor(mode));
  return mapParts(arrangement, (part) => {
    const blocks = part.blocks.filter((block) => conocidos.has(block.degree));
    return blocks.length === part.blocks.length ? part : { ...part, blocks };
  });
}
