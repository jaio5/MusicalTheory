import { describe, expect, it } from 'vitest';

import {
  addBlock,
  addPart,
  arrangementBeats,
  arrangementFromSong,
  arrangementLength,
  blocksInOrder,
  clampBeats,
  EMPTY_ARRANGEMENT,
  findBlock,
  keepDegreesOfMode,
  lastDegreeOf,
  MAX_BLOCK_BEATS,
  MAX_PART_BLOCKS,
  MAX_PARTS,
  moveBlock,
  movePart,
  partFromCapture,
  playbackStepsOf,
  removeBlock,
  removePart,
  renamePart,
  resizeBlock,
  sectionsFromArrangement,
  type Arrangement,
  type Block,
} from './arrangement';
import type { Song } from './song';

function bloque(id: string, degree: Block['degree'], beats = 4): Block {
  return { id, degree, beats };
}

/** Un montaje de dos partes, que es lo mínimo para probar mover entre ellas. */
function montaje(): Arrangement {
  return {
    parts: [
      {
        id: 'estrofa',
        name: 'Estrofa',
        blocks: [bloque('a', 'I'), bloque('b', 'vi'), bloque('c', 'IV')],
      },
      { id: 'estribillo', name: 'Estribillo', blocks: [bloque('d', 'V')] },
    ],
  };
}

describe('clampBeats', () => {
  it('redondea y recorta a los topes', () => {
    expect(clampBeats(3.4)).toBe(3);
    expect(clampBeats(0)).toBe(1);
    expect(clampBeats(999)).toBe(MAX_BLOCK_BEATS);
  });

  // Un ancho arrastrado puede llegar como NaN si el puntero sale de la pantalla
  // a mitad del gesto. Un bloque de NaN pulsos no se dibuja y no suena.
  it('lo que no es un número vale un pulso, y un infinito llega al tope', () => {
    expect(clampBeats(Number.NaN)).toBe(1);
    expect(clampBeats(Number.POSITIVE_INFINITY)).toBe(MAX_BLOCK_BEATS);
  });
});

describe('partes', () => {
  it('una parte nueva se llama por su sitio', () => {
    const con = addPart(EMPTY_ARRANGEMENT, 'p1');
    expect(con.parts[0]?.name).toBe('Parte 1');
  });

  it('no pasa del tope de partes', () => {
    let a = EMPTY_ARRANGEMENT;
    for (let i = 0; i < MAX_PARTS + 5; i += 1) {
      a = addPart(a, `p${i}`);
    }
    expect(a.parts).toHaveLength(MAX_PARTS);
  });

  it('renombrar con espacios en blanco deja el nombre que había', () => {
    const a = renamePart(montaje(), 'estrofa', '   ');
    expect(a.parts[0]?.name).toBe('Estrofa');
  });

  it('mover una parte la recoloca', () => {
    const a = movePart(montaje(), 'estribillo', 0);
    expect(a.parts.map((part) => part.id)).toEqual(['estribillo', 'estrofa']);
  });

  it('quitar una parte se lleva sus bloques', () => {
    const a = removePart(montaje(), 'estrofa');
    expect(arrangementLength(a)).toBe(1);
  });
});

describe('bloques', () => {
  it('se añade al final por omisión', () => {
    const a = addBlock(montaje(), 'estrofa', bloque('e', 'V'));
    expect(a.parts[0]?.blocks.map((b) => b.id)).toEqual(['a', 'b', 'c', 'e']);
  });

  it('se puede añadir en medio', () => {
    const a = addBlock(montaje(), 'estrofa', bloque('e', 'V'), 1);
    expect(a.parts[0]?.blocks.map((b) => b.id)).toEqual(['a', 'e', 'b', 'c']);
  });

  it('un bloque nuevo pasa por los topes de duración', () => {
    const a = addBlock(montaje(), 'estrofa', { id: 'e', degree: 'V', beats: 0 });
    expect(a.parts[0]?.blocks.at(-1)?.beats).toBe(1);
  });

  it('estirar un bloque cambia sus pulsos y nada más', () => {
    const a = resizeBlock(montaje(), 'b', 8);
    expect(findBlock(a, 'b')?.block.beats).toBe(8);
    expect(arrangementLength(a)).toBe(4);
  });

  it('quitar un bloque no toca a los demás', () => {
    const a = removeBlock(montaje(), 'b');
    expect(a.parts[0]?.blocks.map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('no entran más bloques de los que caben', () => {
    let a: Arrangement = { parts: [{ id: 'p', name: 'P', blocks: [] }] };
    for (let i = 0; i < MAX_PART_BLOCKS + 3; i += 1) {
      a = addBlock(a, 'p', bloque(`b${i}`, 'I'));
    }
    expect(a.parts[0]?.blocks).toHaveLength(MAX_PART_BLOCKS);
  });
});

describe('moveBlock', () => {
  it('reordena dentro de la misma parte', () => {
    const a = moveBlock(montaje(), 'c', 'estrofa', 0);
    expect(a.parts[0]?.blocks.map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('lleva un bloque a otra parte', () => {
    const a = moveBlock(montaje(), 'a', 'estribillo', 0);
    expect(a.parts[0]?.blocks.map((b) => b.id)).toEqual(['b', 'c']);
    expect(a.parts[1]?.blocks.map((b) => b.id)).toEqual(['a', 'd']);
  });

  // Soltar más allá del final es decir «al final». Devolver el montaje sin tocar
  // haría que el bloque volviera de un salto al sitio del que se sacó.
  it('soltar pasado el final lo pone al final', () => {
    const a = moveBlock(montaje(), 'a', 'estrofa', 99);
    expect(a.parts[0]?.blocks.map((b) => b.id)).toEqual(['b', 'c', 'a']);
  });

  it('un identificador que no existe no cambia nada', () => {
    const antes = montaje();
    expect(moveBlock(antes, 'nada', 'estrofa', 0)).toEqual(antes);
  });

  // Si el destino está lleno, dejarlo salir de su parte lo perdería por el
  // camino: se queda donde está y quien arrastra lo ve volver.
  it('no se mueve a una parte llena', () => {
    const llena = Array.from({ length: MAX_PART_BLOCKS }, (_, i) => bloque(`x${i}`, 'I'));
    const a: Arrangement = {
      parts: [
        { id: 'origen', name: 'O', blocks: [bloque('viajero', 'V')] },
        { id: 'destino', name: 'D', blocks: llena },
      ],
    };
    expect(moveBlock(a, 'viajero', 'destino', 0)).toEqual(a);
  });
});

describe('cuentas', () => {
  it('los pulsos son la suma de los bloques', () => {
    expect(arrangementBeats(montaje())).toBe(16);
    expect(arrangementBeats(EMPTY_ARRANGEMENT)).toBe(0);
  });

  it('el último grado de una parte es desde donde se sugiere', () => {
    expect(lastDegreeOf(montaje().parts[0] as never)).toBe('IV');
    expect(lastDegreeOf({ id: 'v', name: 'V', blocks: [] })).toBeNull();
  });
});

describe('playbackStepsOf', () => {
  it('convierte los grados en notas de la tonalidad', () => {
    const pasos = playbackStepsOf(montaje(), 0, 'major');
    expect(pasos).toHaveLength(4);
    // El I de Do mayor es Do mayor: Do, Mi, Sol.
    expect(pasos[0]).toEqual({ notes: [0, 4, 7], root: 0, beats: 4 });
    // El V es Sol mayor: Sol, Si, Re.
    expect(pasos[3]).toEqual({ notes: [7, 11, 2], root: 7, beats: 4 });
  });

  it('una sola parte suena sola', () => {
    expect(playbackStepsOf(montaje(), 0, 'major', 'estribillo')).toHaveLength(1);
  });

  // El reproductor avisa por índice —«va por el tercero»—, así que las dos listas
  // tienen que salir del mismo recorrido o se enciende el bloque equivocado.
  it('el orden de los bloques cuadra con el de los pasos', () => {
    const a = montaje();
    expect(blocksInOrder(a).map((b) => b.blockId)).toEqual(['a', 'b', 'c', 'd']);
    expect(blocksInOrder(a)).toHaveLength(playbackStepsOf(a, 0, 'major').length);
  });
});

describe('montaje y canción', () => {
  const cancion: Song = {
    id: 'x',
    name: 'Prueba',
    tonic: 0,
    mode: 'major',
    bpm: 100,
    sections: [{ name: 'Estrofa', degrees: ['I', 'V', 'vi', 'IV'] }],
    updatedAt: 1,
  };

  it('abrir una canción da un bloque por grado, de un compás', () => {
    const a = arrangementFromSong(cancion, 4);
    expect(a.parts[0]?.blocks.map((b) => b.degree)).toEqual(['I', 'V', 'vi', 'IV']);
    expect(a.parts[0]?.blocks.every((b) => b.beats === 4)).toBe(true);
  });

  // Es la garantía que hace que el lienzo se pueda usar sobre lo ya guardado:
  // abrir y volver a guardar sin tocar nada no puede cambiar la canción.
  it('abrir y guardar no cambia una canción', () => {
    expect(sectionsFromArrangement(arrangementFromSong(cancion, 4), 4)).toEqual(cancion.sections);
  });

  it('un bloque de dos compases se guarda como el grado dos veces', () => {
    const a = resizeBlock(arrangementFromSong(cancion, 4), 'c0b0', 8);
    expect(sectionsFromArrangement(a, 4)[0]?.degrees).toEqual(['I', 'I', 'V', 'vi', 'IV']);
  });

  it('un bloque más corto que el compás sigue contando una vez', () => {
    const a: Arrangement = { parts: [{ id: 'p', name: 'P', blocks: [bloque('b', 'I', 1)] }] };
    expect(sectionsFromArrangement(a, 4)[0]?.degrees).toEqual(['I']);
  });

  it('una parte sin bloques no se guarda', () => {
    const a = addPart(montaje(), 'vacia');
    expect(sectionsFromArrangement(a, 4)).toHaveLength(2);
  });
});

describe('partFromCapture', () => {
  // Lo que se graba tocando ya venía con sus pulsos medidos; era `capturedDegrees`
  // quien los tiraba para poder guardar. Aquí llegan enteros.
  it('conserva los pulsos que se midieron al tocar', () => {
    const part = partFromCapture(
      [
        { degree: 'I', beats: 8 },
        { degree: 'V', beats: 4 },
      ],
      'grabado',
      'Lo que has tocado',
    );
    expect(part.blocks.map((b) => b.beats)).toEqual([8, 4]);
    expect(part.blocks.map((b) => b.id)).toEqual(['grabadob0', 'grabadob1']);
  });

  it('no pasa del tope de bloques', () => {
    const muchos = Array.from({ length: MAX_PART_BLOCKS + 10 }, () => ({
      degree: 'I' as const,
      beats: 4,
    }));
    expect(partFromCapture(muchos, 'g', 'G').blocks).toHaveLength(MAX_PART_BLOCKS);
  });
});

describe('keepDegreesOfMode', () => {
  // Cambiar de mayor a menor con el lienzo lleno dejaría grados que no existen
  // en el modo nuevo, y `resolveDegree` lanza con uno de esos al ir a pintarlo.
  it('los grados que no existen en el modo se caen, y los que sí se quedan', () => {
    // De I, vi, IV y V, en menor solo existe el V: las dos dominantes están en
    // el catálogo de menor a propósito, y los otros tres no.
    const a = keepDegreesOfMode(montaje(), 'minor');
    expect(a.parts[0]?.blocks).toHaveLength(0);
    expect(a.parts[1]?.blocks.map((b) => b.degree)).toEqual(['V']);
  });

  // La parte se queda aunque se vacíe: borrarla haría desaparecer un nombre que
  // alguien escribió por cambiar de modo en la rueda.
  it('una parte que se queda sin bloques sigue existiendo', () => {
    expect(keepDegreesOfMode(montaje(), 'minor').parts).toHaveLength(2);
  });
});

/**
 * La propiedad de la que cuelgan el deshacer y los repintados: si una operación
 * no cambia nada, tiene que devolver **el mismo objeto**, no uno igual. Cada una
 * de estas líneas se saltó alguna vez, y el síntoma era el mismo: pulsar
 * «deshacer» seis veces para deshacer un arrastre.
 */
describe('lo que no cambia devuelve lo mismo', () => {
  const a = montaje();

  it.each([
    ['quitar un bloque que no existe', () => removeBlock(a, 'nada')],
    ['quitar una parte que no existe', () => removePart(a, 'nada')],
    ['estirar hasta el ancho que ya tenía', () => resizeBlock(a, 'a', 4)],
    ['estirar un bloque que no existe', () => resizeBlock(a, 'nada', 8)],
    ['renombrar con el mismo nombre', () => renamePart(a, 'estrofa', 'Estrofa')],
    ['renombrar una parte que no existe', () => renamePart(a, 'nada', 'Otra')],
    ['mover una parte a donde ya está', () => movePart(a, 'estrofa', 0)],
    ['soltar un bloque donde ya estaba', () => moveBlock(a, 'a', 'estrofa', 0)],
    ['añadir a una parte que no existe', () => addBlock(a, 'nada', bloque('z', 'I'))],
    ['un modo que no deja fuera nada', () => keepDegreesOfMode(a, 'major')],
  ])('%s', (_, operacion) => {
    expect(operacion()).toBe(a);
  });
});
