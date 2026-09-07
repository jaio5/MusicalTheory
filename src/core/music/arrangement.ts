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
import { voiceForPlayback, type PlaybackStep, type TimedEvent } from './playback';
import { degreesFor, resolveDegree, type DegreeSymbol } from './progressions';
import type { CapturedStep } from './capture';
import {
  clampOffset,
  clampStart,
  midiOf,
  snapLength,
  MAX_LEAD_NOTES,
  type LeadNote,
} from './melody';
import { MAX_SECTIONS, MAX_SECTION_DEGREES, type Song, type SongSection } from './song';
import { DEFAULT_BEATS_PER_BAR } from './tempo';

/**
 * De dónde salió un acorde del lienzo.
 *
 * No es una etiqueta informativa: es lo que decide de qué se puede fiar quien
 * mire esta canción. Lo escrito a mano es la intención de quien compone y no se
 * discute; lo oído es una lectura de un micro en una habitación, y puede estar
 * mal. Lo corregido es lo oído que ya pasó por delante de quien tocó, así que
 * vale tanto como lo escrito.
 */
export type BlockSource = 'heard' | 'written' | 'fixed';

/** Un bloque del lienzo: un acorde, lo que ocupa y de dónde salió. */
export interface Block {
  readonly id: string;
  readonly degree: DegreeSymbol;
  /** Pulsos. Siempre uno o más. */
  readonly beats: number;
  readonly source: BlockSource;
  /**
   * Cuánto se despegaba del siguiente candidato al oírlo, de 0 a 1.
   *
   * Uno para lo escrito y lo corregido: ahí no hay duda que valga. Por debajo de
   * `DUDOSO` el bloque se marca en pantalla y se ofrece cambiarlo.
   */
  readonly confidence: number;
  /** Los grados que también pudo ser. Es lo que se ofrece al corregir. */
  readonly alternatives: readonly DegreeSymbol[];
}

/**
 * Por debajo de esto, un acorde oído se marca como dudoso.
 *
 * Sale de lo que significa el margen: el segundo candidato se quedó a menos de
 * seis centésimas del elegido. Con dos acordes tan pegados, el motor eligió por
 * poco y **preguntar cuesta menos que arrastrar el error por toda la canción**.
 *
 * No es un umbral de calidad del sonido —de eso ya se encarga `minScore` en el
 * motor, que decide si hay acorde o no—: es un umbral de *ambigüedad*, que es
 * otra cosa y la que importa aquí.
 */
export const DUDOSO = 0.06;

/** Un bloque escrito a mano: sin duda y sin alternativas que ofrecer. */
export function writtenBlock(id: string, degree: DegreeSymbol, beats: number): Block {
  return {
    id,
    degree,
    beats: clampBeats(beats),
    source: 'written',
    confidence: 1,
    alternatives: [],
  };
}

/** Si de este acorde conviene preguntar. */
export function isDoubtful(block: Block): boolean {
  return block.source === 'heard' && block.confidence < DUDOSO;
}

/**
 * Un tramo con nombre: la estrofa, el estribillo, el puente.
 *
 * Los acordes van en `blocks`, uno detrás de otro y cada uno con lo que dura. El
 * punteo va en `notes` **y por separado**, porque no es lo mismo: los acordes se
 * suceden sin huecos y una melodía tiene silencios, se adelanta al compás y se
 * queda callada media parte. Cada nota lleva su sitio en el tiempo; un bloque no
 * lo necesita porque su sitio es venir después del anterior.
 */
export interface Part {
  readonly id: string;
  readonly name: string;
  readonly blocks: readonly Block[];
  readonly notes: readonly LeadNote[];
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
        notes: [],
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
 * Cambia el acorde de un bloque, y lo da por bueno.
 *
 * Es la corrección: quien tocó dice qué era de verdad. El bloque pasa a
 * `fixed` y deja de estar en duda, porque ya ha pasado por delante de quien lo
 * tocó y eso vale más que cualquier puntuación. **Las alternativas se conservan**
 * —incluida la lectura que había— para poder volver atrás si la corrección fue
 * un error.
 */
export function fixBlock(
  arrangement: Arrangement,
  blockId: string,
  degree: DegreeSymbol,
  /**
   * Dar por bueno lo que ya decía, sin cambiar el acorde.
   *
   * Es media corrección y hace la misma falta que la otra: si el motor dudó y
   * acertó, decírselo tiene que dejar de preguntar. Sin esto, un acorde bien
   * leído se quedaría marcado como dudoso para siempre.
   */
  confirmar = false,
): Arrangement {
  return mapParts(arrangement, (part) =>
    mapBlocks(part, (block) => {
      if (block.id !== blockId || (block.degree === degree && !confirmar)) {
        return block;
      }
      if (confirmar && block.source !== 'heard') {
        return block;
      }
      const alternatives = [
        block.degree,
        ...block.alternatives.filter((otro) => otro !== degree && otro !== block.degree),
      ];
      return { ...block, degree, source: 'fixed', confidence: 1, alternatives };
    }),
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
 * Todo lo que suena de un montaje —acordes y punteo— con su sitio en el tiempo.
 *
 * Una sola lista y no dos, para que el acompañamiento y la melodía se programen
 * contra el mismo reloj. Junto a ella va `owners`, que dice de qué bloque es cada
 * sonido y **nulo cuando es una nota del punteo**: así quien enseña por dónde va
 * enciende el bloque cuando toca y no apaga nada cuando lo que suena es una nota.
 *
 * `withMelody` en falso deja solo los acordes, que es lo que hace falta para oír
 * el acompañamiento mientras se escribe encima.
 */
export interface ArrangementSound {
  readonly events: readonly TimedEvent[];
  readonly owners: readonly (string | null)[];
}

export function soundOf(
  arrangement: Arrangement,
  tonic: PitchClass,
  mode: KeyMode,
  partId: string | null = null,
  withMelody = true,
  baseMidi?: number,
): ArrangementSound {
  const partes =
    partId === null ? arrangement.parts : arrangement.parts.filter((part) => part.id === partId);

  const events: TimedEvent[] = [];
  const owners: (string | null)[] = [];

  // Las partes van una detrás de otra, así que cada una empieza donde acabó la
  // anterior. El punteo se mide desde el principio de su parte, no de la canción:
  // mover una parte de sitio se lleva su melodía con ella.
  let desde = 0;
  for (const part of partes) {
    let enPulsos = desde;
    for (const block of part.blocks) {
      const chord = resolveDegree(tonic, mode, block.degree);
      events.push({
        startBeat: enPulsos,
        beats: block.beats,
        midis: voiceForPlayback(chord.root, chord.notes, baseMidi),
      });
      owners.push(block.id);
      enPulsos += block.beats;
    }

    if (withMelody) {
      for (const note of part.notes) {
        events.push({
          startBeat: desde + note.start,
          beats: note.length,
          midis: [midiOf(note, tonic)],
        });
        owners.push(null);
      }
    }

    desde += partLength(part);
  }

  // Se ordenan a la vez que sus dueños: `scheduleEvents` también ordena, y si
  // cada lista se ordenara por su cuenta el bloque encendido sería otro.
  const orden = events
    .map((event, indice) => ({ event, indice }))
    .sort((a, b) => a.event.startBeat - b.event.startBeat || a.indice - b.indice);

  return {
    events: orden.map(({ event }) => event),
    owners: orden.map(({ indice }) => owners[indice] ?? null),
  };
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
 * Dónde está una nota del punteo, o nulo si ese identificador no existe.
 *
 * Hermana de `findBlock`, y por el mismo motivo: quien arrastra tiene un
 * identificador y necesita saber de qué parte salió.
 */
export function findNote(
  arrangement: Arrangement,
  noteId: string,
): { readonly part: Part; readonly note: LeadNote } | null {
  for (const part of arrangement.parts) {
    const note = part.notes.find((candidata) => candidata.id === noteId);
    if (note !== undefined) {
      return { part, note };
    }
  }
  return null;
}

/**
 * Las notas de una parte, siempre en orden de entrada.
 *
 * Se ordenan al guardar y no al dibujar porque hay tres sitios que las recorren
 * —los bloques, el pentagrama y el reproductor— y los tres necesitan lo mismo.
 * Ordenar en cada uno era pedir que alguno se olvidara.
 */
function ordenar(notes: readonly LeadNote[]): LeadNote[] {
  return [...notes].sort((a, b) => a.start - b.start || a.offset - b.offset);
}

export function addNote(arrangement: Arrangement, partId: string, note: LeadNote): Arrangement {
  return mapPart(arrangement, partId, (part) => {
    if (part.notes.length >= MAX_LEAD_NOTES) {
      return part;
    }
    const nueva: LeadNote = {
      id: note.id,
      offset: clampOffset(note.offset),
      start: clampStart(note.start),
      length: snapLength(note.length),
    };
    return { ...part, notes: ordenar([...part.notes, nueva]) };
  });
}

export function removeNote(arrangement: Arrangement, noteId: string): Arrangement {
  return mapParts(arrangement, (part) => {
    const notes = part.notes.filter((note) => note.id !== noteId);
    return notes.length === part.notes.length ? part : { ...part, notes };
  });
}

/**
 * Lleva una nota a otro sitio: otro momento, otra altura, o las dos.
 *
 * Una sola función porque en el pentagrama y en el carril es un solo gesto: se
 * coge la nota y se suelta donde sea. Separar «mover en el tiempo» de «cambiar de
 * altura» obligaría a la interfaz a decidir cuál de las dos está pasando a mitad
 * de un arrastre en diagonal.
 */
export function moveNote(
  arrangement: Arrangement,
  noteId: string,
  start: number,
  offset: number,
): Arrangement {
  const inicio = clampStart(start);
  const altura = clampOffset(offset);

  return mapParts(arrangement, (part) => {
    const note = part.notes.find((candidata) => candidata.id === noteId);
    if (note === undefined || (note.start === inicio && note.offset === altura)) {
      return part;
    }
    return {
      ...part,
      notes: ordenar(
        part.notes.map((candidata) =>
          candidata.id === noteId ? { ...candidata, start: inicio, offset: altura } : candidata,
        ),
      ),
    };
  });
}

export function resizeNote(arrangement: Arrangement, noteId: string, length: number): Arrangement {
  const pulsos = snapLength(length);
  return mapParts(arrangement, (part) =>
    part.notes.some((note) => note.id === noteId && note.length !== pulsos)
      ? {
          ...part,
          notes: part.notes.map((note) =>
            note.id === noteId ? { ...note, length: pulsos } : note,
          ),
        }
      : part,
  );
}

/**
 * Hasta dónde llega una parte, contando el punteo.
 *
 * Puede ser más de lo que ocupan sus acordes: una nota que se sale por el final
 * es una frase que se estira sobre el acorde siguiente, y el pentagrama tiene que
 * dibujar el compás en el que cae.
 */
export function partLength(part: Part): number {
  const acordes = partBeats(part);
  const punteo = part.notes.reduce((mayor, note) => Math.max(mayor, note.start + note.length), 0);
  return Math.max(acordes, punteo);
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
        ...writtenBlock(idDePosicion(prefijo, parte, bloque), degree, porCompas),
        // De dónde salió cada acorde vuelve tal cual. Lo que se guardó como
        // oído sigue siendo oído al reabrirlo: si no, guardar y volver a abrir
        // sería una manera de dar por buena una lectura que nadie miró.
        source: section.sources?.[bloque] ?? 'written',
      })),
      notes: (section.lead ?? []).map(([offset, start, length], nota) => ({
        id: `${idDePosicion(prefijo, parte)}n${nota}`,
        offset,
        start,
        length,
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
      const sources: BlockSource[] = [];
      for (const block of part.blocks) {
        // Al menos una vez: un bloque más corto que el compás sigue siendo un
        // acorde de la canción, y redondear a cero lo borraría sin decirlo.
        const compases = Math.max(1, Math.round(block.beats / porCompas));
        for (let i = 0; i < compases && degrees.length < MAX_PART_BLOCKS; i += 1) {
          degrees.push(block.degree);
          // La procedencia va en paralelo y se repite con el grado: los dos
          // compases de un bloque de dos salieron del mismo sitio.
          sources.push(block.source);
        }
      }
      const lead = part.notes.map((note) => [note.offset, note.start, note.length] as const);

      // **Lo que no dice nada no se escribe.** Una canción sin punteo y toda
      // escrita a mano se guarda exactamente igual que antes de que existieran
      // estos dos campos: sin ellos. Si no, cada canción cargaría con una lista
      // de «written» repetido y un `lead` vacío, y el documento crecería para no
      // decir nada.
      return {
        name: part.name,
        degrees,
        ...(lead.length > 0 ? { lead } : {}),
        ...(sources.some((source) => source !== 'written') ? { sources } : {}),
      };
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
      // Oído, con la duda que traía. Es lo que permite marcar en el lienzo los
      // compases de los que el motor no estaba seguro.
      source: 'heard' as const,
      confidence: step.confidence,
      alternatives: step.alternatives,
    })),
    // El croma oye acordes, no melodías: lo que se graba tocando entra como
    // acompañamiento y el punteo se escribe encima.
    notes: [],
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
