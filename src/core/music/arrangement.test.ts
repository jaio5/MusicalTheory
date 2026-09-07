import { describe, expect, it } from 'vitest';

import {
  addBlock,
  addNote,
  addPart,
  arrangementBeats,
  arrangementFromSong,
  arrangementLength,
  blocksInOrder,
  clampBeats,
  EMPTY_ARRANGEMENT,
  findBlock,
  findNote,
  keepDegreesOfMode,
  lastDegreeOf,
  MAX_BLOCK_BEATS,
  MAX_PART_BLOCKS,
  MAX_PARTS,
  moveBlock,
  moveNote,
  movePart,
  partFromCapture,
  partLength,
  playbackStepsOf,
  DUDOSO,
  fixBlock,
  isDoubtful,
  removeBlock,
  removeNote,
  writtenBlock,
  soundOf,
  removePart,
  renamePart,
  resizeBlock,
  resizeNote,
  sectionsFromArrangement,
  type Arrangement,
  type Block,
} from './arrangement';
import type { LeadNote } from './melody';
import type { Song } from './song';

function bloque(id: string, degree: Block['degree'], beats = 4): Block {
  return writtenBlock(id, degree, beats);
}

/** Un bloque como lo deja el micro: oído, y con la duda que traía. */
function oido(
  id: string,
  degree: Block['degree'],
  confidence: number,
  alternatives: Block['alternatives'] = [],
): Block {
  return { ...writtenBlock(id, degree, 4), source: 'heard', confidence, alternatives };
}

/** Un montaje de dos partes, que es lo mínimo para probar mover entre ellas. */
function montaje(): Arrangement {
  return {
    parts: [
      {
        id: 'estrofa',
        name: 'Estrofa',
        blocks: [bloque('a', 'I'), bloque('b', 'vi'), bloque('c', 'IV')],
        notes: [],
      },
      { id: 'estribillo', name: 'Estribillo', blocks: [bloque('d', 'V')], notes: [] },
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
    const a = addBlock(montaje(), 'estrofa', bloque('e', 'V', 0));
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
    let a: Arrangement = { parts: [{ id: 'p', name: 'P', blocks: [], notes: [] }] };
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
        { id: 'origen', name: 'O', blocks: [bloque('viajero', 'V')], notes: [] },
        { id: 'destino', name: 'D', blocks: llena, notes: [] },
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
    expect(lastDegreeOf({ id: 'v', name: 'V', blocks: [], notes: [] })).toBeNull();
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

  /**
   * Es la garantía que hace que el lienzo se pueda usar sobre lo ya guardado:
   * abrir y volver a guardar sin tocar nada no puede cambiar la canción, **ni
   * siquiera añadiéndole campos**. Una canción sin punteo y escrita a mano se
   * guarda igual que antes de que el punteo existiera.
   */
  it('abrir y guardar no cambia una canción, ni le añade nada', () => {
    expect(sectionsFromArrangement(arrangementFromSong(cancion, 4), 4)).toEqual(cancion.sections);
  });

  it('un bloque de dos compases se guarda como el grado dos veces', () => {
    const a = resizeBlock(arrangementFromSong(cancion, 4), 'c0b0', 8);
    expect(sectionsFromArrangement(a, 4)[0]?.degrees).toEqual(['I', 'I', 'V', 'vi', 'IV']);
  });

  it('un bloque más corto que el compás sigue contando una vez', () => {
    const a: Arrangement = {
      parts: [{ id: 'p', name: 'P', blocks: [bloque('b', 'I', 1)], notes: [] }],
    };
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
        { degree: 'I', beats: 8, confidence: 1, alternatives: [] },
        { degree: 'V', beats: 4, confidence: 1, alternatives: [] },
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
      confidence: 1,
      alternatives: [],
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

describe('el punteo', () => {
  function nota(id: string, extra: Partial<LeadNote> = {}): LeadNote {
    return { id, offset: 0, start: 0, length: 1, ...extra };
  }

  function conNotas(): Arrangement {
    let a = montaje();
    a = addNote(a, 'estrofa', nota('n1', { start: 2, offset: 7 }));
    a = addNote(a, 'estrofa', nota('n2', { start: 0, offset: 0 }));
    return a;
  }

  // Tres sitios las recorren —el carril, el pentagrama y el reproductor— y los
  // tres necesitan el mismo orden. Ordenarlas al guardar es lo que evita que
  // alguno se olvide.
  it('se guardan en orden de entrada, aunque lleguen desordenadas', () => {
    expect(conNotas().parts[0]?.notes.map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  it('una nota entra pasando por la rejilla y por las figuras', () => {
    const a = addNote(montaje(), 'estrofa', nota('n', { start: 1.3, length: 1.9, offset: 99 }));
    expect(findNote(a, 'n')?.note).toMatchObject({ start: 1.5, length: 2, offset: 24 });
  });

  it('mover cambia el momento y la altura de una vez', () => {
    const a = moveNote(conNotas(), 'n1', 3, -5);
    expect(findNote(a, 'n1')?.note).toMatchObject({ start: 3, offset: -5 });
  });

  it('mover la reordena si se va delante de otra', () => {
    const a = moveNote(conNotas(), 'n1', 0, 7);
    expect(a.parts[0]?.notes.map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  it('estirar cambia la figura', () => {
    expect(findNote(resizeNote(conNotas(), 'n1', 3.9), 'n1')?.note.length).toBe(4);
  });

  it('quitar se lleva solo esa', () => {
    expect(removeNote(conNotas(), 'n1').parts[0]?.notes.map((n) => n.id)).toEqual(['n2']);
  });

  it('el punteo no toca los acordes', () => {
    expect(arrangementLength(conNotas())).toBe(arrangementLength(montaje()));
  });

  // Una nota que se sale por el final es una frase que se estira sobre el acorde
  // siguiente, y el pentagrama tiene que dibujar el compás en el que cae.
  it('una parte llega hasta donde llegue lo último, sea acorde o nota', () => {
    const corta = montaje().parts[1]!;
    expect(partLength(corta)).toBe(4);

    const conCola = addNote({ parts: [corta] }, 'estribillo', nota('n', { start: 4, length: 2 }));
    expect(partLength(conCola.parts[0]!)).toBe(6);
  });

  describe('lo que no cambia devuelve lo mismo', () => {
    const a = conNotas();

    it.each([
      ['quitar una nota que no existe', () => removeNote(a, 'nada')],
      ['moverla a donde ya estaba', () => moveNote(a, 'n1', 2, 7)],
      ['mover una que no existe', () => moveNote(a, 'nada', 1, 1)],
      ['estirar a la figura que ya tenía', () => resizeNote(a, 'n1', 1)],
      ['estirar una que no existe', () => resizeNote(a, 'nada', 2)],
    ])('%s', (_, operacion) => {
      expect(operacion()).toBe(a);
    });
  });
});

describe('soundOf', () => {
  function conPunteo(): Arrangement {
    return addNote(
      addNote(montaje(), 'estrofa', { id: 'n1', offset: 0, start: 0, length: 1 }),
      'estrofa',
      { id: 'n2', offset: 7, start: 6, length: 2 },
    );
  }

  it('los acordes van uno detrás de otro', () => {
    const { events } = soundOf(montaje(), 0, 'major', null, false);
    expect(events.map((e) => e.startBeat)).toEqual([0, 4, 8, 12]);
  });

  // Es lo que enciende el bloque que suena, y por eso tiene que ir junto a los
  // sonidos y no calcularse aparte.
  it('cada sonido dice de qué bloque es', () => {
    const { owners } = soundOf(montaje(), 0, 'major', null, false);
    expect(owners).toEqual(['a', 'b', 'c', 'd']);
  });

  it('el punteo entra en la misma lista, en su sitio', () => {
    const { events, owners } = soundOf(conPunteo(), 0, 'major', 'estrofa');
    expect(events.map((e) => e.startBeat)).toEqual([0, 0, 4, 6, 8]);
    // Las notas no tienen dueño: al sonar una, el bloque encendido no cambia.
    expect(owners.filter((dueño) => dueño === null)).toHaveLength(2);
  });

  it('sin punteo suenan solo los acordes', () => {
    expect(soundOf(conPunteo(), 0, 'major', 'estrofa', false).events).toHaveLength(3);
  });

  // Mover una parte de sitio tiene que llevarse su melodía con ella, así que el
  // punteo se mide desde el principio de su parte y no de la canción.
  it('el punteo de la segunda parte empieza donde acaba la primera', () => {
    const a = addNote(montaje(), 'estribillo', { id: 'n', offset: 0, start: 1, length: 1 });
    const { events, owners } = soundOf(a, 0, 'major');
    const nota = events[owners.indexOf(null)];
    expect(nota?.startBeat).toBe(13);
  });

  it('una nota suena a la altura que dice, sobre la tónica', () => {
    const { events, owners } = soundOf(conPunteo(), 0, 'major', 'estrofa');
    const notas = events.filter((_, i) => owners[i] === null);
    expect(notas[1]!.midis[0]! - notas[0]!.midis[0]!).toBe(7);
  });
});

describe('de dónde salió cada acorde', () => {
  /**
   * Lo escrito a mano es la intención de quien compone y no se discute. Lo oído
   * es la lectura de un micro en una habitación, y puede estar mal: solo eso se
   * marca, y solo cuando el motor eligió por poco.
   */
  it('solo lo oído y con poco margen está en duda', () => {
    expect(isDoubtful(oido('a', 'I', DUDOSO / 2))).toBe(true);
    expect(isDoubtful(oido('b', 'I', 0.5))).toBe(false);
    expect(isDoubtful(writtenBlock('c', 'I', 4))).toBe(false);
  });

  it('lo que se escribe no lleva duda ni alternativas', () => {
    expect(writtenBlock('a', 'I', 4)).toMatchObject({
      source: 'written',
      confidence: 1,
      alternatives: [],
    });
  });

  it('lo grabado llega oído y con lo que dudó', () => {
    const part = partFromCapture(
      [{ degree: 'I', beats: 4, confidence: 0.02, alternatives: ['vi'] }],
      'g',
      'Grabado',
    );
    expect(part.blocks[0]).toMatchObject({
      source: 'heard',
      confidence: 0.02,
      alternatives: ['vi'],
    });
    expect(isDoubtful(part.blocks[0]!)).toBe(true);
  });
});

describe('fixBlock', () => {
  const dudoso: Arrangement = {
    parts: [{ id: 'p', name: 'P', blocks: [oido('b', 'I', 0.01, ['vi', 'IV'])], notes: [] }],
  };

  // Quien tocó dice qué era de verdad, y eso vale más que cualquier puntuación.
  it('corregir da el acorde por bueno y le quita la duda', () => {
    const a = fixBlock(dudoso, 'b', 'vi');
    expect(findBlock(a, 'b')?.block).toMatchObject({
      degree: 'vi',
      source: 'fixed',
      confidence: 1,
    });
    expect(isDoubtful(findBlock(a, 'b')!.block)).toBe(false);
  });

  /**
   * La lectura que había pasa a ser la primera alternativa. Es lo que permite
   * volver atrás cuando la corrección fue el error, y sin ella corregir sería un
   * camino de ida.
   */
  it('lo que decía antes se guarda como la primera alternativa', () => {
    expect(findBlock(fixBlock(dudoso, 'b', 'vi'), 'b')?.block.alternatives).toEqual(['I', 'IV']);
  });

  it.each([
    ['corregir al mismo acorde', () => fixBlock(dudoso, 'b', 'I')],
    ['corregir uno que no existe', () => fixBlock(dudoso, 'nada', 'vi')],
  ])('%s no cambia nada', (_, operacion) => {
    expect(operacion()).toBe(dudoso);
  });
});

describe('lo que sobrevive al guardar', () => {
  /**
   * La garantía que hace útil todo lo demás: si al guardar se perdiera de dónde
   * salió cada acorde, guardar y reabrir sería una manera de dar por buena una
   * lectura que nadie ha mirado.
   */
  it('abrir y guardar conserva el punteo y la procedencia', () => {
    let a: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'Estrofa',
          blocks: [oido('b1', 'I', 0.01, ['vi']), bloque('b2', 'V')],
          notes: [],
        },
      ],
    };
    a = addNote(a, 'p', { id: 'n', offset: 7, start: 1.5, length: 2 });

    const secciones = sectionsFromArrangement(a, 4);
    expect(secciones[0]?.sources).toEqual(['heard', 'written']);
    expect(secciones[0]).not.toHaveProperty('lead', []);
    expect(secciones[0]?.lead).toEqual([[7, 1.5, 2]]);

    const vuelta = arrangementFromSong(
      { id: 'x', name: 'P', tonic: 0, mode: 'major', bpm: 100, sections: secciones, updatedAt: 1 },
      4,
    );
    expect(vuelta.parts[0]?.blocks.map((b) => b.source)).toEqual(['heard', 'written']);
    expect(vuelta.parts[0]?.notes[0]).toMatchObject({ offset: 7, start: 1.5, length: 2 });
  });

  // La procedencia se repite con el grado: los dos compases de un bloque de dos
  // salieron del mismo sitio, y las dos listas tienen que ir a la par.
  it('un bloque largo reparte su procedencia por sus compases', () => {
    const a: Arrangement = {
      parts: [{ id: 'p', name: 'P', blocks: [oido('b', 'I', 0.5)], notes: [] }],
    };
    const seccion = sectionsFromArrangement(resizeBlock(a, 'b', 8), 4)[0];

    expect(seccion?.degrees).toEqual(['I', 'I']);
    expect(seccion?.sources).toEqual(['heard', 'heard']);
  });

  // La confianza en sí no se guarda: lo que hace falta después es si aquello se
  // oyó o se escribió, y un número de un análisis de hace un mes no dice nada.
  it('lo oído sigue en duda al reabrirlo, y lo corregido no', () => {
    const a: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'P',
          blocks: [oido('b1', 'I', 0.01), oido('b2', 'V', 0.01)],
          notes: [],
        },
      ],
    };
    const secciones = sectionsFromArrangement(fixBlock(a, 'b2', 'IV'), 4);
    expect(secciones[0]?.sources).toEqual(['heard', 'fixed']);
  });
});
