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
  moveBlock,
  removeBlock,
  removeNote,
  barsLabel,
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
  bloquesEnDuda,
  bloquesSinTraduccion,
  leerMontaje,
} from './arrangement';
import { MAX_LEAD_NOTES, type LeadNote } from './melody';
import type { EspecieDeBloque } from './chords';
import { pitchClassFromName, type PitchClass } from './notes';
import { degreesFor, type DegreeSymbol } from './progressions';
import { MAX_BARS, parseSong, type Song } from './song';

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

  /**
   * Un punteo solo, sin acordes debajo, dura lo que dura: contaba solo los
   * bloques, medía cero y el lienzo apagaba «Escuchar la canción» y «MIDI» con
   * la melodía escrita delante.
   */
  it('un punteo sin acordes también dura, y con sus vueltas', () => {
    const soloPunteo: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'P',
          blocks: [],
          notes: [{ id: 'n', offset: 0, start: 4, length: 2 }],
          bars: 4,
          repeats: 2,
        },
      ],
    };

    expect(arrangementBeats(soloPunteo)).toBe(12);
    // Y es lo mismo que suena: la segunda vuelta empieza donde acaba la primera.
    expect(soundOf(soloPunteo, 0, 'major').events.map((e) => e.startBeat)).toEqual([4, 10]);
  });

  // Con acordes y punteo, manda el que llega más lejos.
  it('una melodía que se sale de los acordes alarga la canción', () => {
    const a = addNote(montaje(), 'estribillo', { id: 'n', offset: 0, start: 6, length: 2 });

    expect(arrangementBeats(a)).toBe(20);
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

  /**
   * **Y la agrupación vuelve.** Un grado sigue siendo un compás —eso lo leen la
   * ruta de salidas y la de canciones— pero aparte se guarda cuántos compases
   * ocupaba cada bloque, así que abrir no deja dos bloques de uno donde había uno
   * de dos. Con una canción que se monta en varias sesiones, volver a juntarlos a
   * mano era trabajo repetido cada vez.
   */
  it('un bloque de dos compases vuelve siendo uno de dos', () => {
    const estirado = resizeBlock(arrangementFromSong(cancion, 4), 'c0b0', 8);
    const secciones = sectionsFromArrangement(estirado, 4);

    expect(secciones[0]?.compasesPorBloque).toEqual([2, 1, 1, 1]);

    const vuelta = arrangementFromSong({ ...cancion, sections: secciones }, 4);
    expect(vuelta.parts[0]?.blocks.map((b) => [b.degree, b.beats])).toEqual([
      ['I', 8],
      ['V', 4],
      ['vi', 4],
      ['IV', 4],
    ]);
  });

  // Y con todos los bloques de un compás no se escribe: no diría nada y haría
  // crecer el documento de todas las canciones.
  it('sin agrupar de verdad, el campo no se escribe', () => {
    expect(sectionsFromArrangement(arrangementFromSong(cancion, 4), 4)[0]).not.toHaveProperty(
      'compasesPorBloque',
    );
  });

  /**
   * Las canciones de antes no lo traen y no están rotas: sale un bloque por
   * compás, que es lo que salía siempre.
   */
  it('una cancion de antes sigue abriendo un bloque por compas', () => {
    const a = arrangementFromSong(cancion, 4);
    expect(a.parts[0]?.blocks).toHaveLength(4);
    expect(a.parts[0]?.blocks.every((b) => b.beats === 4)).toBe(true);
  });

  /**
   * **El tope de compases puede cortar a mitad de un bloque**, y entonces la
   * agrupación tiene que contar los compases que de verdad entraron. Apuntando los
   * que se pedían saldría una lista que no suma, y al abrirla se descartaría
   * entera: la canción volvería desagrupada del todo por culpa del último bloque.
   */
  it('el tope corta el bloque y la agrupacion sigue sumando', () => {
    // Diecisiete bloques de dos compases son treinta y cuatro: dos más del tope.
    const muchos: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'P',
          blocks: Array.from({ length: 17 }, (_, i) => bloque(`b${i}`, 'I', 8)),
          notes: [],
          bars: 4,
        },
      ],
    };
    const seccion = sectionsFromArrangement(muchos, 4)[0]!;

    expect(seccion.degrees).toHaveLength(MAX_PART_BLOCKS);
    const suma = seccion.compasesPorBloque!.reduce((total, cuantos) => total + cuantos, 0);
    expect(suma, 'la agrupacion no suma los compases que hay').toBe(seccion.degrees.length);
  });

  /**
   * Y una agrupación que no suma se descarta entera: es de otra canción o de otro
   * compás, y aplicarla movería los acordes de sitio.
   */
  it('una agrupacion que no suma se ignora', () => {
    const rota = parseSong(
      {
        tonic: 0,
        mode: 'major',
        sections: [{ name: 'A', degrees: ['I', 'V', 'vi', 'IV'], compasesPorBloque: [2, 2, 2] }],
      },
      'x',
    );

    expect(rota?.sections[0]).not.toHaveProperty('compasesPorBloque');
    expect(arrangementFromSong(rota!, 4).parts[0]?.blocks).toHaveLength(4);
  });

  // Y una que sí suma se lee, que es el camino por el que llega una canción
  // guardada de verdad: desde el `jsonb`, no desde el lienzo.
  it('una agrupacion guardada se lee y agrupa', () => {
    const leida = parseSong(
      {
        tonic: 0,
        mode: 'major',
        sections: [{ name: 'A', degrees: ['I', 'I', 'V', 'IV'], compasesPorBloque: [2, 1, 1] }],
      },
      'x',
    );

    expect(leida?.sections[0]?.compasesPorBloque).toEqual([2, 1, 1]);
    expect(arrangementFromSong(leida!, 4).parts[0]?.blocks.map((b) => [b.degree, b.beats])).toEqual(
      [
        ['I', 8],
        ['V', 4],
        ['IV', 4],
      ],
    );
  });

  // Un número que no es un número de compases tira la lista entera: medio
  // agrupada sería peor que sin agrupar, porque nadie sabría qué falta.
  it('un valor que no es un compas tira la agrupacion', () => {
    for (const malo of [0, -1, 1.5, 'dos', null]) {
      const leida = parseSong(
        {
          tonic: 0,
          mode: 'major',
          sections: [{ name: 'A', degrees: ['I', 'I', 'V'], compasesPorBloque: [malo, 1] }],
        },
        'x',
      );

      expect(leida?.sections[0], `con ${String(malo)}`).not.toHaveProperty('compasesPorBloque');
    }
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

  /**
   * **Ir y volver deja la canción como estaba.** Antes no: el `vi` volvía como
   * `bVI` y el `IV` como `iv`, porque la tabla de vuelta no puede saber de cuál
   * de los dos venía un `VI`. Lo sabe el bloque, que se lleva lo que era.
   */
  it('y al volver al mayor, cada bloque vuelve a ser el que era', () => {
    const enMenor = translateToMode(montaje(), 'minor');

    expect(translateToMode(enMenor, 'major')).toEqual(montaje());
  });

  // Lo que se escribe en menor no trae recuerdo, así que va por la tabla: el
  // `VI` del menor se dice `bVI` en mayor, que suena el mismo acorde.
  it('lo escrito en menor pasa al mayor por la tabla, y vuelve como era', () => {
    const enMenor: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'P',
          blocks: [bloque('a', 'i'), bloque('b', 'VI'), bloque('c', 'iv')],
          notes: [],
          bars: 4,
        },
      ],
    };
    const enMayor = translateToMode(enMenor, 'major');

    expect(enMayor.parts[0]?.blocks.map((b) => b.degree)).toEqual(['I', 'bVI', 'iv']);
    expect(translateToMode(enMayor, 'minor')).toEqual(enMenor);
  });

  /**
   * La reproducción exacta del fallo: C G Am F y un E7 —la dominante del vi—
   * en Do mayor, y a Do menor. Quedaba Cm G Ab Fm: el E7 desaparecía sin avisar,
   * y al volver salía C G Ab Fm.
   */
  it('C G Am F E7 va a menor sin perder el E7, y vuelve entero', () => {
    const cancion: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'Estrofa',
          blocks: [
            bloque('c', 'I'),
            bloque('g', 'V'),
            bloque('am', 'vi'),
            bloque('f', 'IV'),
            writtenBlock('e7', 'V/vi', 4, 'dominant7'),
          ],
          notes: [],
          bars: 5,
        },
      ],
    };
    const DO = pitchClassFromName('C');
    const cifrados = (a: Arrangement, modo: 'major' | 'minor') =>
      a.parts[0]!.blocks.map((b) => blockChord(DO, modo, b).symbol);

    const enMenor = translateToMode(cancion, 'minor');
    // La dominante del vi es, en menor, la del VI: el Eb7 que lleva al Ab. Con
    // su séptima, que viaja con el bloque.
    expect(cifrados(enMenor, 'minor')).toEqual(['Cm', 'G', 'Ab', 'Fm', 'Eb7']);
    expect(bloquesSinTraduccion(cancion, 'minor')).toEqual([]);

    const deVuelta = translateToMode(enMenor, 'major');
    expect(cifrados(deVuelta, 'major')).toEqual(['C', 'G', 'Am', 'F', 'E7']);
    expect(deVuelta).toEqual(cancion);
  });

  // Las alternativas de un bloque oído también vuelven como eran: allí se cae la
  // que no existe, y al volver tiene que estar otra vez para poder elegirla.
  it('las alternativas vuelven enteras', () => {
    const a: Arrangement = {
      parts: [
        { id: 'p', name: 'P', blocks: [oido('a', 'I', 0.03, ['vi', 'V/ii'])], notes: [], bars: 4 },
      ],
    };
    const enMenor = translateToMode(a, 'minor');
    expect(enMenor.parts[0]!.blocks[0]!.alternatives).toEqual(['VI']);

    expect(translateToMode(enMenor, 'major')).toEqual(a);
  });

  /**
   * Lo que se corrige en el otro modo ya no vuelve como era: volver al acorde de
   * antes desharía la corrección sin decirlo. Corregido, el bloque pasa por la
   * tabla como si se hubiera escrito allí.
   */
  it('lo que se corrige en el otro modo se queda corregido', () => {
    const enMenor = translateToMode(montaje(), 'minor');
    const corregido = fixBlock(enMenor, 'b', 'VII');

    const deVuelta = translateToMode(corregido, 'major');
    expect(deVuelta.parts[0]?.blocks.map((b) => b.degree)).toEqual(['I', 'bVII', 'IV']);
  });

  // Confirmar lo que ya decía no lo cambia, así que no tiene por qué olvidar.
  it('confirmar en el otro modo no olvida lo que era', () => {
    const a: Arrangement = {
      parts: [{ id: 'p', name: 'P', blocks: [oido('a', 'vi', 0.03, ['I'])], notes: [], bars: 4 }],
    };
    const confirmado = fixBlock(translateToMode(a, 'minor'), 'a', 'VI', true);

    expect(translateToMode(confirmado, 'major').parts[0]?.blocks[0]?.degree).toBe('vi');
  });

  /**
   * Un recuerdo que no cuadra con lo que hay —llegó de fuera, o el bloque se
   * cambió por un camino que no lo borró— no se usa, y se olvida para que no
   * coincida un día por casualidad.
   */
  it('un recuerdo que ya no cuadra se ignora y se olvida', () => {
    const conRecuerdoViejo: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'P',
          blocks: [
            { ...bloque('a', 'V'), delOtroModo: { mode: 'major', degree: 'IV', alternatives: [] } },
          ],
          notes: [],
          bars: 4,
        },
      ],
    };

    expect(translateToMode(conRecuerdoViejo, 'major').parts[0]?.blocks[0]).toEqual(
      bloque('a', 'V'),
    );
  });

  // Ya en su modo, un bloque que recuerda el otro no cambia: el recuerdo es
  // para cuando se vuelva.
  it('traducir al modo que ya tiene no toca un bloque traducido', () => {
    const enMenor = translateToMode(montaje(), 'minor');

    expect(translateToMode(enMenor, 'minor')).toBe(enMenor);
  });

  // La dominante del ii es lo único que se cae: en menor el segundo grado es
  // disminuido y no se prepara con su dominante. Se cae, pero se dice cuál.
  it('lo que de verdad no existe en el modo nuevo se queda fuera, y se dice cuál es', () => {
    const conSecundaria = addBlock(montaje(), 'estrofa', bloque('z', 'V/ii'));

    const a = translateToMode(conSecundaria, 'minor');
    expect(a.parts[0]?.blocks.map((b) => b.degree)).not.toContain('V/ii');
    expect(a.parts[0]?.blocks).toHaveLength(3);
    expect(bloquesSinTraduccion(conSecundaria, 'minor')).toEqual([bloque('z', 'V/ii')]);
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
    // 1,3 cae en 1,25: la rejilla es la semicorchea, no la corchea.
    expect(findNote(a, 'n')?.note).toMatchObject({ start: 1.25, length: 2, offset: 24 });
  });

  it('una nota oída conserva su duda, y una escrita a mano no se inventa ninguna', () => {
    let a = addNote(montaje(), 'estrofa', nota('sucia', { clarity: 0.6 }));
    a = addNote(a, 'estrofa', nota('pasada', { start: 1, clarity: 3 }));
    a = addNote(a, 'estrofa', nota('a-mano', { start: 2 }));

    expect(findNote(a, 'sucia')?.note.clarity).toBe(0.6);
    expect(findNote(a, 'pasada')?.note.clarity).toBe(1);
    expect(findNote(a, 'a-mano')?.note).not.toHaveProperty('clarity');
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

/**
 * La fundamental de un bloque con especie se escribe como la de su tríada.
 *
 * La tríada sale de `resolveDegree`, que sabe que un grado «b» va con bemol; la
 * especie se escribía con la alteración de la tonalidad, y en Do mayor el `bVII`
 * era `Bb` a secas y `A#7` con séptima —y `D#7` el `bIII`, y `G#maj7` el `bVI`—.
 */
describe('la grafia de un bloque con especie', () => {
  const ESPECIES: readonly EspecieDeBloque[] = [
    'major7',
    'dominant7',
    'minor7',
    'halfDiminished7',
    'diminished7',
    'minorMajor7',
    'augmentedMajor7',
    'quinta',
    'sus2',
    'sus4',
    'dim',
    'aug',
    'menor',
  ];
  /** La letra y la alteración del principio de un cifrado. */
  const fundamental = (simbolo: string) => /^[A-G][#b]?/.exec(simbolo)?.[0];

  it('en Do mayor, los grados bemoles se escriben con bemol tambien con septima', () => {
    expect(blockChord(0, 'major', writtenBlock('a', 'bVII', 4)).symbol).toBe('Bb');
    expect(blockChord(0, 'major', writtenBlock('a', 'bVII', 4, 'dominant7')).symbol).toBe('Bb7');
    expect(blockChord(0, 'major', writtenBlock('a', 'bIII', 4, 'dominant7')).symbol).toBe('Eb7');
    expect(blockChord(0, 'major', writtenBlock('a', 'bVI', 4, 'major7')).symbol).toBe('Abmaj7');
    expect(blockChord(0, 'major', writtenBlock('a', 'bVII', 4, 'quinta')).symbol).toBe('Bb5');
  });

  it('en las 24 tonalidades, cada especie de cada grado lleva la fundamental de su triada', () => {
    let comparados = 0;
    for (const modo of ['major', 'minor'] as const) {
      for (let tonica = 0; tonica < 12; tonica += 1) {
        const tonic = tonica as PitchClass;
        for (const grado of degreesFor(modo)) {
          const triada = fundamental(blockChord(tonic, modo, writtenBlock('t', grado, 4)).symbol);
          for (const especie of ESPECIES) {
            const conEspecie = blockChord(tonic, modo, writtenBlock('e', grado, 4, especie));
            expect(fundamental(conEspecie.symbol), `${grado} ${especie} en ${tonica} ${modo}`).toBe(
              triada,
            );
            comparados += 1;
          }
        }
      }
    }
    // Que el bucle haya mirado algo: los grados de los dos modos por doce
    // tónicas por trece especies.
    expect(comparados).toBe(
      12 * ESPECIES.length * (degreesFor('major').length + degreesFor('minor').length),
    );
  });
});

describe('lo que faltaba por mirar del montaje', () => {
  const C = pitchClassFromName('C');

  /**
   * Un bloque guarda un grado **y una especie**, y quien lo traduce a acorde es
   * `blockChord` ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)):
   * con el grado a secas, un `C5` se enseñaría como un `C`.
   */
  it('la especie del bloque manda en el cifrado y en las notas', () => {
    const quinta: Block = { ...bloque('q', 'I'), especie: 'quinta' };
    const septima: Block = { ...bloque('s', 'V'), especie: 'dominant7' };

    expect(blockChord(C, 'major', quinta).symbol).toBe('C5');
    expect(blockChord(C, 'major', quinta).notes).toHaveLength(2);
    expect(blockChord(C, 'major', septima).symbol).toBe('G7');
    expect(blockChord(C, 'major', septima).notes).toHaveLength(4);
  });

  // Poner las vueltas que ya tenía no cambia nada: el montaje es el mismo.
  it('poner las vueltas que ya habia deja la parte igual', () => {
    const antes = montaje();

    const despues = setRepeats(antes, 'estrofa', repeatsOf(antes.parts[0]!));

    expect(despues.parts[0]).toBe(antes.parts[0]);
  });

  /**
   * Los compases, escritos para leerlos: con coma decimal, que es como se
   * escriben los números en español, y en singular cuando es uno solo.
   */
  it('los compases se escriben con coma y con su singular', () => {
    expect(barsLabel(4, 4)).toBe('1 compás');
    expect(barsLabel(8, 4)).toBe('2 compases');
    expect(barsLabel(5, 4)).toBe('1,25 compases');
    // Sin compás de nada, se cuenta por pulsos: dividir entre cero no.
    expect(barsLabel(3, 0)).toBe('3 compases');
  });

  /**
   * Dar por bueno lo que el motor dijo solo vale para lo que oyó: confirmar un
   * bloque escrito a mano no tiene sentido y no toca nada.
   */
  it('confirmar solo vale para lo que se oyo', () => {
    const conDuda: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'Estrofa',
          blocks: [oido('a', 'I', 0.4, ['vi']), bloque('b', 'IV')],
          notes: [],
          bars: 4,
        },
      ],
    };

    const confirmado = fixBlock(conDuda, 'a', 'I', true);
    expect(isDoubtful(confirmado.parts[0]!.blocks[0]!)).toBe(false);

    // Y el escrito a mano se queda como estaba, ni marcado ni con alternativas.
    const escrito = fixBlock(conDuda, 'b', 'IV', true);
    expect(escrito.parts[0]!.blocks[1]).toBe(conDuda.parts[0]!.blocks[1]);
  });

  // Mover un bloque entre dos partes no toca las demás.
  it('mover entre dos partes deja las otras intactas', () => {
    const tres: Arrangement = {
      ...montaje(),
      parts: [
        ...montaje().parts,
        { id: 'puente', name: 'Puente', blocks: [bloque('e', 'ii')], notes: [], bars: 4 },
      ],
    };

    const despues = moveBlock(tres, 'a', 'estribillo', 0);

    expect(despues.parts[2]).toBe(tres.parts[2]);
    expect(despues.parts[1]!.blocks.map((b) => b.id)).toEqual(['a', 'd']);
  });

  it('los bloques en orden se pueden pedir de una sola parte', () => {
    const todos = blocksInOrder(montaje());
    const solo = blocksInOrder(montaje(), 'estribillo');

    expect(todos).toHaveLength(4);
    expect(solo.map((sitio) => sitio.blockId)).toEqual(['d']);
  });

  // Una parte sin nombre se llama como le toque por su sitio: «Estrofa 2»,
  // «Estrofa 3». Nadie escribe un nombre antes de tener nada dentro.
  it('una parte sin nombre coge el que le toca', () => {
    const conNombre = addPart(montaje(), 'nueva', 'Puente');
    const sinNombre = addPart(montaje(), 'nueva', '   ');

    expect(conNombre.parts.at(-1)?.name).toBe('Puente');
    expect(sinNombre.parts.at(-1)?.name).not.toBe('');
    expect(addPart(montaje(), 'otra').parts.at(-1)?.name).toBe(sinNombre.parts.at(-1)?.name);
  });

  it('una nota que no esta no se encuentra', () => {
    expect(findNote(montaje(), 'ninguna')).toBeNull();
  });

  // Y el punteo tiene tope: pasado, la nota no entra en vez de crecer sin fin.
  it('el punteo no pasa de su tope', () => {
    let lleno: Arrangement = { parts: [{ ...montaje().parts[0]!, notes: [] }] };
    for (let indice = 0; indice < MAX_LEAD_NOTES + 5; indice += 1) {
      lleno = addNote(lleno, 'estrofa', { id: `n${indice}`, start: indice, length: 1, offset: 0 });
    }

    expect(lleno.parts[0]!.notes).toHaveLength(MAX_LEAD_NOTES);
  });

  /**
   * Al cambiar de modo, las alternativas de un bloque oído se traducen igual que
   * su grado, y la que no exista allí se cae: son grados del modo viejo, y
   * dejarlas tal cual reventaría `resolveDegree` al ofrecerlas como corrección.
   */
  it('cambiar de modo traduce tambien las alternativas', () => {
    const conAlternativas: Arrangement = {
      parts: [
        {
          id: 'p',
          name: 'Estrofa',
          blocks: [oido('a', 'I', 0.4, ['IV', 'V/ii'])],
          notes: [],
          bars: 4,
        },
      ],
    };

    const menor = translateToMode(conAlternativas, 'minor');

    expect(menor.parts[0]!.blocks[0]!.degree).toBe('i');
    // `IV` se dice `iv` en menor; `V/ii` no existe allí y se cae.
    expect(menor.parts[0]!.blocks[0]!.alternatives).toEqual(['iv']);
  });
});

/**
 * La cola de lo que hay que preguntar.
 *
 * Existe para que no haya que ir a buscarlo: la corrección estaba puesta y solo
 * aparecía para el bloque que tuvieras elegido.
 */
describe('los bloques en duda', () => {
  /** Un bloque oído, con la claridad y las alternativas que se digan. */
  function oido(id: string, confidence: number, alternatives: DegreeSymbol[] = ['vi']): Block {
    return { ...bloque(id, 'I', 4), source: 'heard', confidence, alternatives };
  }

  function montaje(...blocks: Block[]): Arrangement {
    return { parts: [{ id: 'p', name: 'P', blocks, notes: [], bars: 4 }] };
  }

  it('salen los dudosos, en el orden de la canción', () => {
    const a = montaje(oido('a', 0.5), oido('b', 0.01), oido('c', 0.02));

    expect(bloquesEnDuda(a).map((b) => b.id)).toEqual(['b', 'c']);
  });

  // De varias partes, todos: la cola es de la canción y no de una parte.
  it('recorre todas las partes', () => {
    const a: Arrangement = {
      parts: [
        { id: 'p1', name: 'A', blocks: [oido('a', 0.01)], notes: [], bars: 4 },
        { id: 'p2', name: 'B', blocks: [oido('b', 0.01)], notes: [], bars: 4 },
      ],
    };

    expect(bloquesEnDuda(a).map((b) => b.id)).toEqual(['a', 'b']);
  });

  /**
   * Sin alternativas no se pregunta: no hay nada que ofrecer, y preguntar sin
   * opciones es dar trabajo sin dar salida.
   */
  it('uno dudoso sin alternativas no entra en la cola', () => {
    expect(bloquesEnDuda(montaje(oido('a', 0.01, [])))).toEqual([]);
  });

  // Y lo escrito a mano no se pregunta nunca, por dudoso que parezca el número.
  it('lo escrito a mano no entra', () => {
    expect(bloquesEnDuda(montaje(bloque('a', 'I', 4)))).toEqual([]);
  });
});

/**
 * Leer un montaje guardado en el navegador.
 *
 * Lo escribió esta aplicación, pero quizá otra versión, y lo que hay en el
 * navegador lo puede tocar cualquiera: se lee sin creerse nada y sin tumbar lo
 * que sí se entiende.
 */
describe('leerMontaje', () => {
  it('lo que guarda el lienzo se lee tal cual', () => {
    const a = translateToMode(
      addNote(montaje(), 'estrofa', { id: 'n', offset: 3, start: 1, length: 1, clarity: 0.5 }),
      'minor',
    );
    const conTodo = setRepeats(setPartRole(a, 'estrofa', 'estribillo'), 'estrofa', 2);
    const leido = leerMontaje(JSON.parse(JSON.stringify(conTodo)));

    expect(leido).toEqual(conTodo);
  });

  it('lo que no es un montaje no se lee', () => {
    expect(leerMontaje(null)).toBeNull();
    expect(leerMontaje('texto')).toBeNull();
    expect(leerMontaje([])).toBeNull();
    expect(leerMontaje({ parts: 'no' })).toBeNull();
  });

  it('lo que no se entiende se cae, y lo demás se queda', () => {
    const leido = leerMontaje({
      parts: [
        'basura',
        { id: 7, name: 'Sin identificador' },
        { id: 'z', name: 3 },
        { id: 'p', name: 'P', blocks: 'no', notes: 'no' },
        {
          id: 'q',
          name: '   ',
          bars: 900,
          repeats: 99,
          role: 'inventado',
          blocks: [
            null,
            { id: 'x', degree: 'XIII' },
            { id: 1, degree: 'I' },
            {
              id: 'a',
              degree: 'IV',
              especie: 'rara',
              beats: 'mucho',
              source: 'quien-sabe',
              confidence: 7,
              alternatives: ['V', 'nada', 3],
              delOtroModo: { mode: 'dorico', degree: 'iv' },
            },
            { id: 'b', degree: 'VI', beats: 3, delOtroModo: { mode: 'major', degree: 'XX' } },
            { id: 'c', degree: 'V', source: 'heard', confidence: 0.02, delOtroModo: 'no' },
            { id: 'd', degree: 'ii', source: 'fixed', especie: 'quinta' },
          ],
          notes: [
            null,
            { id: 5, offset: 0, start: 0, length: 1 },
            { id: 'mala', offset: null, start: 0, length: 1 },
            { id: 'n2', offset: 99, start: 2.1, length: 0.9 },
            { id: 'n1', offset: 0, start: 0, length: 1, clarity: 'mucha' },
          ],
        },
      ],
    });

    expect(leido).toEqual({
      parts: [
        { id: 'p', name: 'P', blocks: [], notes: [], bars: BARS_POR_DEFECTO },
        {
          id: 'q',
          name: 'Parte',
          bars: MAX_BARS,
          repeats: MAX_REPEATS,
          blocks: [
            {
              id: 'a',
              degree: 'IV',
              beats: 1,
              source: 'written',
              confidence: 1,
              alternatives: ['V'],
            },
            { id: 'b', degree: 'VI', beats: 3, source: 'written', confidence: 1, alternatives: [] },
            {
              id: 'c',
              degree: 'V',
              beats: 1,
              source: 'heard',
              confidence: 0.02,
              alternatives: [],
            },
            {
              id: 'd',
              degree: 'ii',
              especie: 'quinta',
              beats: 1,
              source: 'fixed',
              confidence: 1,
              alternatives: [],
            },
          ],
          notes: [
            { id: 'n1', offset: 0, start: 0, length: 1 },
            { id: 'n2', offset: 24, start: 2, length: 1 },
          ],
        },
      ],
    });
  });

  // Los topes son los de escribir: lo guardado por otra versión no los salta.
  it('no deja pasar más partes ni más bloques de los que caben', () => {
    const muchos = Array.from({ length: MAX_PART_BLOCKS + 3 }, (_, i) => bloque(`b${i}`, 'I'));
    const partes = Array.from({ length: MAX_PARTS + 2 }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      blocks: muchos,
      notes: [],
      bars: 4,
    }));

    const leido = leerMontaje({ parts: partes });
    expect(leido?.parts).toHaveLength(MAX_PARTS);
    expect(leido?.parts[0]?.blocks).toHaveLength(MAX_PART_BLOCKS);
  });
});
