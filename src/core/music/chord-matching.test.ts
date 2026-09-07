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
