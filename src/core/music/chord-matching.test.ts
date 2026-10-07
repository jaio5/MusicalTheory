import { describe, expect, it } from 'vitest';

import { bestChord, matchChords, readChord } from './chord-matching';
import { pitchClassFromName } from './notes';

/** Un croma limpio: las notas que se dan suenan, el resto no. */
function chromaOf(...notes: readonly number[]): number[] {
  const chroma = new Array<number>(12).fill(0);
  for (const note of notes) {
    chroma[note] = 1;
  }
  return chroma;
}

const C = pitchClassFromName('C');
const E = pitchClassFromName('E');
const G = pitchClassFromName('G');
const A = pitchClassFromName('A');
const B = pitchClassFromName('B');
const D = pitchClassFromName('D');
const Eb = pitchClassFromName('D#');
const Bb = pitchClassFromName('A#');

describe('Reconocer el acorde', () => {
  it('tres notas dan su tríada', () => {
    expect(bestChord(chromaOf(C, E, G))?.symbol).toBe('C');
    expect(bestChord(chromaOf(A, C, E))?.symbol).toBe('Am');
  });

  it('la séptima cambia el acorde, no solo el nombre', () => {
    expect(bestChord(chromaOf(G, B, D, pitchClassFromName('F')))?.symbol).toBe('G7');
    expect(bestChord(chromaOf(C, E, G, B))?.symbol).toBe('Cmaj7');
  });

  it('dos notas sin tercera son una quinta, no un acorde a medias', () => {
    expect(bestChord(chromaOf(C, G))?.symbol).toBe('C5');
  });

  it('lo que sobra cuenta: una nota de más cambia la respuesta', () => {
    // C E G es C; con Bb encima ya no lo es.
    expect(bestChord(chromaOf(C, E, G, Bb))?.symbol).toBe('C7');
  });

  it('no se casa con la plantilla más larga por ser más larga', () => {
    // Con solo C, E y G, una novena cubriría todo lo que suena y añadiría dos
    // notas que no están: gana la tríada.
    const [primero] = matchChords(chromaOf(C, E, G), { limit: 1 });

    expect(primero?.shape.intervals).toHaveLength(3);
  });

  it('con silencio no devuelve nada', () => {
    expect(matchChords(new Array<number>(12).fill(0))).toEqual([]);
    expect(bestChord(new Array<number>(12).fill(0))).toBeNull();
  });

  it('con un revoltijo no se moja', () => {
    // Las doce notas a la vez no son un acorde, son ruido.
    expect(bestChord(new Array<number>(12).fill(1))).toBeNull();
  });

  it('aguanta que una nota del acorde suene floja', () => {
    const chroma = chromaOf(C, E, G);
    chroma[E] = 0.35;

    expect(bestChord(chroma)?.symbol).toBe('C');
  });

  it('escribe el cifrado como pida la tonalidad', () => {
    expect(bestChord(chromaOf(Eb, G, Bb), { accidental: 'flat' })?.symbol).toBe('Eb');
    expect(bestChord(chromaOf(Eb, G, Bb), { accidental: 'sharp' })?.symbol).toBe('D#');
  });

  it('devuelve los candidatos ordenados, para poder dudar', () => {
    const candidatos = matchChords(chromaOf(C, E, G, B), { limit: 3 });

    expect(candidatos).toHaveLength(3);
    expect(candidatos[0]!.score).toBeGreaterThanOrEqual(candidatos[1]!.score);
  });
});

describe('readChord', () => {
  /**
   * El margen es lo que dice si había duda, no la puntuación. Un croma con dos
   * acordes casi igual de parecidos deja margen pequeño; uno con un acorde claro
   * lo deja grande, y son los dos casos que hay que distinguir: uno se pregunta y
   * el otro no.
   */
  it('un acorde limpio se despega de su alternativa', () => {
    const lectura = readChord(chromaOf(C, E, G));

    expect(lectura?.best.symbol).toBe('C');
    expect(lectura?.margin).toBeGreaterThan(0);
    expect(lectura?.alternatives.length).toBeGreaterThan(0);
  });

  it('las alternativas no repiten al elegido', () => {
    const lectura = readChord(chromaOf(C, E, G));
    expect(lectura?.alternatives.map((m) => m.symbol)).not.toContain(lectura?.best.symbol);
  });

  it('sin nada que se parezca, no hay lectura', () => {
    expect(readChord(new Array(12).fill(0))).toBeNull();
  });

  // Las que se ofrecen al corregir son las que de verdad compitieron: el mismo
  // acorde con otra especie, o el relativo, que comparte dos notas.
  it('lo que compite con un Do mayor es de su familia', () => {
    const lectura = readChord(chromaOf(C, E, G));
    const raices = lectura?.alternatives.map((m) => m.root) ?? [];
    // Do, La menor y Mi menor comparten notas con Do mayor.
    expect(raices.some((root) => [0, 9, 4, 5].includes(root))).toBe(true);
  });
});

describe('los sufijos que se le piden', () => {
  /** Un croma con las tres notas de Do mayor sonando y el resto a cero. */
  function doMayor(): number[] {
    const chroma = Array.from({ length: 12 }, () => 0);
    chroma[0] = 1;
    chroma[4] = 1;
    chroma[7] = 1;
    return chroma;
  }

  /**
   * La lista de sufijos se puede acotar desde fuera —el motor en vivo no busca
   * las catorce especies—, y un sufijo que no está en el catálogo de formas se
   * salta en vez de reventar la comparación entera.
   */
  it('un sufijo que no existe se salta', () => {
    const soloMayores = matchChords(doMayor(), { suffixes: ['', 'noexiste'] });

    expect(soloMayores.length).toBeGreaterThan(0);
    for (const match of soloMayores) {
      expect(match.symbol).not.toContain('noexiste');
    }
  });

  /**
   * El margen no se mide dentro de la lista que se pide, sino contra todo lo que
   * se comparó: con un candidato pedido sigue habiendo de quién despegarse, y
   * decir «no había con qué confundirlo» sería mentir.
   */
  it('con un solo candidato pedido, el margen se mide igual contra los demás', () => {
    const solo = readChord(doMayor(), { suffixes: [''], limit: 1 });

    expect(solo?.alternatives).toEqual([]);
    expect(solo?.margin).toBeGreaterThan(0);
    expect(solo?.margin).toBeLessThan(1);
  });
});

describe('la duda es entre acordes que se escribirían distinto', () => {
  /**
   * Un Do con su séptima mayor sonando por simpatía: `C` y `Cmaj7` empatan casi,
   * y los dos se apuntan como Do mayor. Eso no es una duda; dudar sería entre Do
   * y otro acorde, y ahí se mide el margen.
   */
  it('el mismo acorde con otra especie no cuenta como rival', () => {
    const chroma = chromaOf(C, E, G);
    chroma[B] = 0.45;
    const lectura = readChord(chroma);
    const [segundo] = lectura?.alternatives ?? [];

    expect(lectura?.best.root).toBe(C);
    expect(segundo?.root).toBe(C);
    expect(lectura!.best.score - segundo!.score).toBeLessThan(0.06);
    expect(lectura?.margin).toBeGreaterThan(0.06);
  });

  it('entre Do y La menor, sí', () => {
    const lectura = readChord(chromaOf(C, E, G, A));

    expect(lectura?.margin).toBe(0);
  });
});

describe('el bajo desempata', () => {
  /** La, Do, Mi y Sol: `Am7` y `C6`, las mismas notas y la misma puntuación. */
  const laDoMiSol = () => chromaOf(A, C, E, G);

  it('sin bajo, el empate sigue como estaba', () => {
    expect(readChord(laDoMiSol())?.best.symbol).toBe('C6');
  });

  it('con La abajo es La menor con séptima, y con Do, Do con sexta', () => {
    expect(readChord(laDoMiSol(), { bajo: A })?.best.symbol).toBe('Am7');
    expect(readChord(laDoMiSol(), { bajo: C })?.best.symbol).toBe('C6');
  });

  /** Y sigue siendo un empate, así que se pregunta: el bajo elige, no asegura. */
  it('elegir por el bajo no quita la duda', () => {
    expect(readChord(laDoMiSol(), { bajo: A })?.margin).toBe(0);
  });

  /**
   * Fuera de un empate exacto el bajo no manda: un Do con Mi abajo es `C/E`, y se
   * escribe Do, no Mi menor.
   */
  it('una inversión sigue siendo su acorde', () => {
    expect(readChord(chromaOf(C, E, G), { bajo: E })?.best.symbol).toBe('C');
    expect(readChord(laDoMiSol(), { bajo: E })?.best.symbol).toBe('C6');
  });
});
