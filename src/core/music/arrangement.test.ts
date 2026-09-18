import { describe, expect, it } from 'vitest';

import {
  addBlock,
  addNote,
  addPart,
  arrangementBeats,
  arrangementFromSong,
  arrangementLength,
  blocksInOrder,
  chordAt,
  clampBeats,
  EMPTY_ARRANGEMENT,
  findBlock,
  findNote,
  translateToMode,
  setRepeats,
  repeatsOf,
  partPlayBeats,
  partBeats,
  MAX_REPEATS,
  lastDegreeOf,
  melodyEnd,
  MAX_BLOCK_BEATS,
  MAX_PART_BLOCKS,
  MAX_PARTS,
  moveBlock,
  moveNote,
  movePart,
  partFromCapture,
  partLength,
  playbackStepsOf,
  setPartRole,
  BARS_POR_DEFECTO,
  DUDOSO,
  drawnBars,
  setBars,
  fixBlock,
  isDoubtful,
  removeBlock,
  removeNote,
  blockChord,
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
import { MAX_BARS, type Song } from './song';

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

        bars: 4,
      },
      { id: 'estribillo', name: 'Estribillo', blocks: [bloque('d', 'V')], notes: [], bars: 4 },
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
    let a: Arrangement = { parts: [{ id: 'p', name: 'P', blocks: [], notes: [], bars: 4 }] };
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
        { id: 'origen', name: 'O', blocks: [bloque('viajero', 'V')], notes: [], bars: 4 },
        { id: 'destino', name: 'D', blocks: llena, notes: [], bars: 4 },
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
    expect(lastDegreeOf({ id: 'v', name: 'V', blocks: [], notes: [], bars: 4 })).toBeNull();
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
      parts: [{ id: 'p', name: 'P', blocks: [bloque('b', 'I', 1)], notes: [], bars: 4 }],
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

/**
 * Las vueltas: el `|: :|` de toda la vida.
 *
 * Lo que se prueba con cuidado no es el número, es **que repetir es sonido y no
 * papel**. Sin esto, un estribillo que va dos veces son dos partes iguales y
 * cambiar un acorde obliga a cambiarlo en las dos.
 */
describe('las vueltas de una parte', () => {
  const conVueltas = (vueltas: number): Arrangement => setRepeats(montaje(), 'estrofa', vueltas);

  it('sin decir nada, una', () => {
    expect(repeatsOf(montaje().parts[0]!)).toBe(1);
    expect(partPlayBeats(montaje().parts[0]!)).toBe(partBeats(montaje().parts[0]!));
  });

  it('suena el doble y se escribe igual', () => {
    const a = conVueltas(2);

    expect(partPlayBeats(a.parts[0]!)).toBe(partBeats(a.parts[0]!) * 2);
    // El papel no se mueve: los mismos bloques y los mismos compases.
    expect(a.parts[0]?.blocks).toHaveLength(montaje().parts[0]!.blocks.length);
    expect(a.parts[0]?.bars).toBe(montaje().parts[0]?.bars);
  });

  it('el montaje entero dura lo que se oye, vueltas incluidas', () => {
    // 12 pulsos la estrofa y 4 el estribillo; con la estrofa dos veces, 28.
    expect(arrangementBeats(montaje())).toBe(16);
    expect(arrangementBeats(conVueltas(2))).toBe(28);
  });

  it('se acota al escribir y al leer, que puede llegar de una cancion guardada', () => {
    expect(repeatsOf({ ...montaje().parts[0]!, repeats: 0 })).toBe(1);
    expect(repeatsOf({ ...montaje().parts[0]!, repeats: 99 })).toBe(MAX_REPEATS);
    expect(repeatsOf(conVueltas(99).parts[0]!)).toBe(MAX_REPEATS);
  });

  /**
   * Los tres recorridos —lo que suena, los pasos y la lista de bloques— tienen
   * que dar lo mismo en el mismo orden, o el bloque que se enciende en pantalla
   * deja de ser el que suena. Con vueltas hay tres sitios donde descuadrarlo.
   */
  it('lo que suena, los pasos y los bloques siguen cuadrando', () => {
    const a = conVueltas(3);

    const pasos = playbackStepsOf(a, 0, 'major');
    const orden = blocksInOrder(a);
    const sonido = soundOf(a, 0, 'major', null, false);

    expect(pasos).toHaveLength(orden.length);
    expect(sonido.events).toHaveLength(orden.length);
    expect(sonido.owners).toEqual(orden.map((sitio) => sitio.blockId));
  });

  it('cada vuelta empieza donde acabo la anterior', () => {
    const a = setRepeats({ parts: [montaje().parts[0]!] }, 'estrofa', 2);
    const largo = partLength(a.parts[0]!);

    const inicios = soundOf(a, 0, 'major', null, false).events.map((e) => e.startBeat);
    const mitad = inicios.length / 2;

    expect(inicios.slice(mitad)).toEqual(inicios.slice(0, mitad).map((x) => x + largo));
  });
});

describe('translateToMode', () => {
  /**
   * Cambiar de modo con el lienzo lleno dejaba grados que el modo nuevo no
   * nombra, y `resolveDegree` y `nextDegrees` lanzan con uno de esos al ir a
   * pintarlo: la pantalla de componer entera se caía con un «This page couldn't
   * load» encima del trabajo de media hora.
   *
   * Y filtrarlos, que fue lo primero que se hizo, cambiaba el fallo por otro:
   * de `I`, `vi` y `IV` no sobrevive ninguno en menor, así que el lienzo se
   * quedaba en blanco sin avisar. Por eso se traduce por función.
   */
  it('cada grado se dice en el modo nuevo, y no se pierde ninguno', () => {
    const a = translateToMode(montaje(), 'minor');

    // I, vi y IV pasan a i, VI y iv: la casa sigue siendo la casa.
    expect(a.parts[0]?.blocks.map((b) => b.degree)).toEqual(['i', 'VI', 'iv']);
    expect(a.parts[1]?.blocks.map((b) => b.degree)).toEqual(['V']);
  });

  it('y se vuelve del menor al mayor por el mismo camino', () => {
    const enMenor = translateToMode(montaje(), 'minor');

    // El vi vuelve como bVI: en menor el sexto grado es mayor, y al volver se
    // dice con su bemol. Suena el mismo acorde que sonaba en menor.
    expect(translateToMode(enMenor, 'major').parts[0]?.blocks.map((b) => b.degree)).toEqual([
      'I',
      'bVI',
      'IV',
    ]);
  });

  // Las tres dominantes secundarias de mayor que el menor no tiene son lo único
  // que se cae, y se cae porque allí no existe ese acorde.
  it('lo que de verdad no existe en el modo nuevo se queda fuera', () => {
    const conSecundaria = addBlock(montaje(), 'estrofa', bloque('z', 'V/ii'));

    const a = translateToMode(conSecundaria, 'minor');
    expect(a.parts[0]?.blocks.map((b) => b.degree)).not.toContain('V/ii');
    expect(a.parts[0]?.blocks).toHaveLength(3);
  });

  // La parte se queda aunque se vacíe: borrarla haría desaparecer un nombre que
  // alguien escribió por cambiar de modo en la rueda.
  it('las partes siguen siendo las mismas', () => {
    expect(translateToMode(montaje(), 'minor').parts).toHaveLength(2);
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
    ['pasar al modo que ya tenía', () => translateToMode(a, 'major')],
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
    parts: [
      { id: 'p', name: 'P', blocks: [oido('b', 'I', 0.01, ['vi', 'IV'])], notes: [], bars: 4 },
    ],
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

          bars: 4,
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
      parts: [{ id: 'p', name: 'P', blocks: [oido('b', 'I', 0.5)], notes: [], bars: 4 }],
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

          bars: 4,
        },
      ],
    };
    const secciones = sectionsFromArrangement(fixBlock(a, 'b2', 'IV'), 4);
    expect(secciones[0]?.sources).toEqual(['heard', 'fixed']);
  });
});

describe('chordAt', () => {
  // Lo que puede ir después no depende solo de la escala, sino sobre todo de qué
  // acorde hay debajo. Sin esto, la sugerencia sería la misma en toda la canción.
  it('dice qué acorde suena en cada pulso', () => {
    const part = montaje().parts[0]!;
    expect(chordAt(part, 0)).toBe('I');
    expect(chordAt(part, 3.5)).toBe('I');
    expect(chordAt(part, 4)).toBe('vi');
    expect(chordAt(part, 11)).toBe('IV');
  });

  // Una nota que se sale por el final es una frase que se estira sobre lo que ya
  // sonaba, no sobre el silencio.
  it('pasado el final, sigue mandando el último acorde', () => {
    expect(chordAt(montaje().parts[0]!, 99)).toBe('IV');
  });

  it('una parte sin acordes no tiene ninguno', () => {
    expect(chordAt({ id: 'v', name: 'V', blocks: [], notes: [], bars: 4 }, 0)).toBeNull();
  });
});

describe('melodyEnd', () => {
  it('es donde acaba la última nota, que es donde entra la siguiente', () => {
    const a = addNote(montaje(), 'estrofa', { id: 'n', offset: 0, start: 2, length: 2 });
    expect(melodyEnd(a.parts[0]!)).toBe(4);
  });

  it('sin punteo empieza en cero', () => {
    expect(melodyEnd(montaje().parts[0]!)).toBe(0);
  });
});

describe('los compases de una parte', () => {
  /**
   * Una parte tiene sitio antes de tener contenido. Sin esto, la única manera de
   * alargar una partitura era meterle notas: para escribir en el compás cuatro
   * había que rellenar antes los tres primeros, al revés de como se escribe
   * música.
   */
  it('una parte nueva trae cuatro compases vacíos', () => {
    const a = addPart(EMPTY_ARRANGEMENT, 'p');
    expect(a.parts[0]?.bars).toBe(BARS_POR_DEFECTO);
    expect(drawnBars(a.parts[0]!, 4)).toBe(BARS_POR_DEFECTO);
  });

  it('se alarga y se acorta de uno en uno', () => {
    // De dos en dos no cabía: pegado al suelo de lo que hay escrito, el botón de
    // acortar movía uno en vez de dos, así que el número saltaba distinto según
    // lo que hubiera dentro.
    let a = addPart(EMPTY_ARRANGEMENT, 'p');

    a = setBars(a, 'p', BARS_POR_DEFECTO + 1, 4);
    expect(a.parts[0]?.bars).toBe(5);

    a = setBars(a, 'p', 4, 4);
    expect(a.parts[0]?.bars).toBe(4);
  });

  // Un botón que borra compases con acordes dentro borra trabajo sin decirlo.
  it('no se acorta por debajo de lo que hay dentro', () => {
    // Cuatro acordes de un compás: ocupan cuatro y no se puede bajar de ahí.
    const a = setBars({ parts: [montaje().parts[0]!] }, 'estrofa', 1, 4);
    expect(a.parts[0]?.bars).toBe(3);
  });

  it('ni por encima del tope', () => {
    const a = setBars(addPart(EMPTY_ARRANGEMENT, 'p'), 'p', 999, 4);
    expect(a.parts[0]?.bars).toBe(MAX_BARS);
  });

  // Al traer una grabación larga nadie ha pulsado el botón, y los compases están
  // ahí igual.
  it('se dibujan los que hagan falta si el contenido es más largo', () => {
    // Tres bloques de un compás; el primero pasa a cuatro, así que la parte
    // ocupa seis y se dibujan seis aunque tenga cuatro reservados.
    const larga = resizeBlock({ parts: [montaje().parts[0]!] }, 'a', 16);
    expect(drawnBars(larga.parts[0]!, 4)).toBe(6);
  });

  it('no cambiar la longitud devuelve el mismo montaje', () => {
    const a = addPart(EMPTY_ARRANGEMENT, 'p');
    expect(setBars(a, 'p', BARS_POR_DEFECTO, 4)).toBe(a);
  });

  /**
   * Es sitio para escribir, no sonido: una parte de ocho compases con dos
   * acordes suena lo que suenan los dos acordes.
   */
  it('alargar no añade silencio al final', () => {
    const antes = soundOf({ parts: [montaje().parts[0]!] }, 0, 'major').events.length;
    const a = setBars({ parts: [montaje().parts[0]!] }, 'estrofa', 12, 4);
    expect(soundOf(a, 0, 'major').events).toHaveLength(antes);
  });

  // Perderlo al reabrir dejaría la partitura encogida a lo que hay dentro.
  it('la longitud sobrevive al guardar, y solo si no es la de fábrica', () => {
    const corta = sectionsFromArrangement(addPart(EMPTY_ARRANGEMENT, 'p'), 4);
    expect(corta).toHaveLength(0);

    const a = setBars({ parts: [montaje().parts[0]!] }, 'estrofa', 8, 4);
    const seccion = sectionsFromArrangement(a, 4)[0];
    expect(seccion?.bars).toBe(8);

    const vuelta = arrangementFromSong(
      { id: 'x', name: 'P', tonic: 0, mode: 'major', bpm: 100, sections: [seccion!], updatedAt: 1 },
      4,
    );
    expect(vuelta.parts[0]?.bars).toBe(8);
  });
});

describe('qué papel hace cada parte del lienzo', () => {
  /** Un montaje con una parte que tiene un acorde dentro. */
  function conUnaParte() {
    return addBlock(addPart(EMPTY_ARRANGEMENT, 'p1'), 'p1', writtenBlock('b1', 'I', 4));
  }

  it('se le pone el papel y el nombre se ajusta solo', () => {
    const puesto = setPartRole(conUnaParte(), 'p1', 'estribillo');

    expect(puesto.parts[0]?.role).toBe('estribillo');
    expect(puesto.parts[0]?.name).toBe('Estribillo');
  });

  it('pero un nombre escrito a mano no se pisa', () => {
    const conNombre = renamePart(conUnaParte(), 'p1', 'lo del puente de Marta');

    const puesto = setPartRole(conNombre, 'p1', 'estribillo');

    expect(puesto.parts[0]?.name).toBe('lo del puente de Marta');
    expect(puesto.parts[0]?.role).toBe('estribillo');
  });

  it('una parte que no existe no cambia nada', () => {
    const antes = conUnaParte();

    expect(setPartRole(antes, 'no-esta', 'puente')).toBe(antes);
  });

  it('y el papel viaja a la canción al guardar', () => {
    // Es el punto de todo esto: si se perdiera aquí, la IA volvería a recibir
    // una progresión sin saber qué le están pidiendo.
    const puesto = setPartRole(conUnaParte(), 'p1', 'puente');

    expect(sectionsFromArrangement(puesto)[0]?.role).toBe('puente');
  });

  it('salvo cuando es una idea, que es lo que se supone sin decir nada', () => {
    const secciones = sectionsFromArrangement(conUnaParte());

    expect(secciones[0]).not.toHaveProperty('role');
  });
});

/**
 * Un bloque de quinta: la tríada sin la tercera.
 *
 * Un `C5` **tiene grado** —el de su fundamental— y no tiene tríada, que es lo
 * que hacía que no se pudiera escribir, y un riff de rock es una sucesión de
 * quintas ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
 */
describe('un bloque sin tercera', () => {
  it('suena a dos notas y se cifra con el cinco', () => {
    const chord = blockChord(0, 'major', writtenBlock('a', 'I', 4, 'quinta'));

    expect(chord.symbol).toBe('C5');
    expect(chord.notes).toEqual([0, 7]);
  });

  /**
   * Y sigue siendo un grado, así que cambiar de tonalidad lo traduce sin tocar
   * el bloque: el `I5` de Do es un `C5` y el de La es un `A5`.
   */
  it('se traduce con la tonalidad, como cualquier grado', () => {
    const bloque = writtenBlock('a', 'I', 4, 'quinta');

    expect(blockChord(9, 'major', bloque).symbol).toBe('A5');
    expect(blockChord(3, 'major', bloque).symbol).toBe('Eb5');
  });

  // Un grado menor tocado sin tercera es la misma quinta: eso es lo que pasa al
  // tocarlo, y por eso el cifrado no lleva la «m».
  it('el grado menor sin tercera se cifra igual, que es lo que suena', () => {
    expect(blockChord(0, 'major', writtenBlock('a', 'vi', 4, 'quinta')).symbol).toBe('A5');
  });

  it('sin especie, un bloque es exactamente lo que era', () => {
    expect(writtenBlock('a', 'I', 4)).not.toHaveProperty('especie');
    expect(blockChord(0, 'major', writtenBlock('a', 'I', 4)).notes).toEqual([0, 4, 7]);
  });
});
