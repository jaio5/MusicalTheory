import { describe, expect, it } from 'vitest';

import { nearestOffset, nextNotes } from './melody-suggestions';
import { pitchClassFromName } from './notes';

const C = pitchClassFromName('C');
const G = pitchClassFromName('G');

/** Las notas que se proponen en Do mayor, con la escala mayor entera. */
function enDo(chord: Parameters<typeof nextNotes>[0]['chord'], from: number | null) {
  return nextNotes({ tonic: C, mode: 'major', scaleId: 'major', chord, from });
}

describe('nearestOffset', () => {
  /**
   * Es lo que convierte «un Mi» en «este Mi». Sin ello, ofrecer una nota daría
   * saltos de octava según de dónde saliera el número, y una melodía escrita así
   * no se puede cantar.
   */
  it('coloca la nota en la octava más cercana a donde estás', () => {
    // El Si está a un semitono por debajo del Do de arriba: se coge ese, no el
    // de once semitonos más abajo.
    expect(nearestOffset(pitchClassFromName('B'), C, 12)).toBe(11);
    expect(nearestOffset(pitchClassFromName('B'), C, 0)).toBe(-1);
  });

  it('no se sale de lo que se puede escribir', () => {
    const arriba = nearestOffset(C, C, 90);
    expect(arriba).toBeLessThanOrEqual(24);
    expect(nearestOffset(C, C, -90)).toBeGreaterThanOrEqual(-12);
  });
});

describe('nextNotes', () => {
  // Una nota del acorde cae de pie: suena bien la toques cuando la toques, y por
  // eso son las que se ofrecen primero.
  it('lo primero son notas del acorde que suena debajo', () => {
    const notas = enDo('I', 0);
    expect(notas[0]?.role).toBe('acorde');
    // Do mayor: do, mi y sol.
    expect(['C', 'E', 'G']).toContain(notas[0]?.name);
  });

  it('cambiar el acorde cambia lo que se ofrece primero', () => {
    expect(enDo('V', 0)[0]?.name).not.toBe(enDo('IV', 0)[0]?.name);
  });

  /**
   * Después de una nota, lo más fácil de cantar es la de al lado. Entre dos
   * notas del mismo acorde, gana la cercana.
   */
  it('a igual papel, gana la que está más cerca', () => {
    const notas = enDo('I', 4); // desde el Mi
    const primeras = notas.slice(0, 2).map((n) => n.name);
    // Do y Sol están a cuatro y tres semitonos; las dos son saltos cómodos y van
    // antes que las de la escala que no son del acorde.
    expect(primeras.every((name) => ['C', 'G'].includes(name))).toBe(true);
  });

  it('las de fuera de la escala van al final, y se dicen', () => {
    const notas = nextNotes({
      tonic: C,
      mode: 'major',
      scaleId: 'major',
      chord: 'I',
      from: 0,
      limit: 12,
    });
    const fuera = notas.filter((n) => n.role === 'fuera');
    expect(fuera.length).toBeGreaterThan(0);
    expect(notas.at(-1)?.role).toBe('fuera');
    expect(fuera[0]?.why).toMatch(/fuera de la escala/);
  });

  // Repetir una nota es una decisión, no una propuesta, y ocuparía el primer
  // sitio de la lista por ser la más cercana de todas.
  it('no se propone la nota en la que ya estás', () => {
    expect(enDo('I', 4).map((n) => n.offset)).not.toContain(4);
  });

  it('sin acorde debajo solo manda la escala', () => {
    const notas = enDo(null, 0);
    expect(notas.every((n) => n.role !== 'acorde')).toBe(true);
    expect(notas[0]?.role).toBe('escala');
  });

  it('sin nota anterior se colocan alrededor de la tónica', () => {
    expect(enDo('I', null).every((n) => Math.abs(n.offset) <= 12)).toBe(true);
  });

  // La escala manda sobre la tonalidad al escribir los nombres, como en todo el
  // resto de la aplicación: la pentatónica menor de Do es C Eb F G Bb.
  it('los nombres siguen la ortografía de la escala', () => {
    const notas = nextNotes({
      tonic: C,
      mode: 'minor',
      scaleId: 'minorPentatonic',
      chord: 'i',
      from: 0,
      limit: 12,
    });
    expect(notas.map((n) => n.name)).toContain('Eb');
    expect(notas.map((n) => n.name)).not.toContain('D#');
  });

  it('en otra tonalidad las notas son otras', () => {
    const enSol = nextNotes({ tonic: G, mode: 'major', scaleId: 'major', chord: 'I', from: 0 });
    expect(['G', 'B', 'D']).toContain(enSol[0]?.name);
  });
});
