import { describe, expect, it } from 'vitest';

import { midiToPitchClass, pitchClassFromName } from '../music/notes';
import { STANDARD_TUNING } from './guitar';
import { cejillaDe, chordVoicings, describeVoicing, voicingToText, type Voicing } from './voicings';

const MAJOR = [0, 4, 7];
const MINOR = [0, 3, 7];
const POWER = [0, 7];
const MAJOR7 = [0, 4, 7, 11];

function best(name: string, intervals: readonly number[]): string {
  return voicingToText(chordVoicings(pitchClassFromName(name as never), intervals)[0]!);
}

/** Las notas que suenan de verdad en esa digitación. */
function soundingNotes(voicing: Voicing): Set<number> {
  const notes = new Set<number>();
  voicing.frets.forEach((fret, index) => {
    if (fret !== null) {
      notes.add(midiToPitchClass(STANDARD_TUNING[index]!.midi + fret));
    }
  });
  return notes;
}

describe('encuentra las formas que se tocan de verdad', () => {
  it('E mayor es el primer acorde que aprende todo el mundo', () => {
    expect(best('E', MAJOR)).toBe('022100');
  });

  it('A menor', () => {
    expect(best('A', MINOR)).toBe('x02210');
  });

  it('C mayor', () => {
    expect(best('C', MAJOR)).toBe('x32010');
  });

  it('G mayor', () => {
    expect(best('G', MAJOR)).toBe('320003');
  });

  it('Do con séptima mayor', () => {
    expect(best('C', MAJOR7)).toBe('x32000');
  });

  it('una quinta se toca con dos o tres cuerdas, no con seis', () => {
    const voicing = chordVoicings(pitchClassFromName('A'), POWER)[0]!;
    expect(voicing.sounding).toBeLessThanOrEqual(3);
  });
});

describe('lo que hace válida una digitación', () => {
  const voicings = chordVoicings(pitchClassFromName('D'), MAJOR, { limit: 6 });

  it('siempre están todas las notas del acorde', () => {
    for (const voicing of voicings) {
      expect(soundingNotes(voicing).size).toBe(3);
    }
  });

  it('el bajo es siempre la fundamental', () => {
    for (const voicing of voicings) {
      const first = voicing.frets.findIndex((fret) => fret !== null);
      const bass = midiToPitchClass(STANDARD_TUNING[first]!.midi + voicing.frets[first]!);
      expect(bass).toBe(pitchClassFromName('D'));
    }
  });

  it('la mano nunca abarca más de cuatro trastes', () => {
    for (const voicing of voicings) {
      const pressed = voicing.frets.filter((fret): fret is number => fret !== null && fret > 0);
      if (pressed.length > 0) {
        expect(Math.max(...pressed) - Math.min(...pressed)).toBeLessThan(4);
      }
    }
  });

  it('no repite nombre: son maneras distintas de cogerlo', () => {
    const nombres = voicings.map((voicing) => voicing.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('nunca pide más de cuatro dedos', () => {
    for (const voicing of [
      ...voicings,
      ...chordVoicings(pitchClassFromName('F'), MAJOR, { limit: 12 }),
      ...chordVoicings(pitchClassFromName('B'), MINOR, { limit: 12 }),
    ]) {
      const pisadas = voicing.frets.filter((fret): fret is number => fret !== null && fret > 0);
      const dedos = voicing.barre
        ? 1 + pisadas.filter((fret) => fret > voicing.position).length
        : pisadas.length;
      expect(dedos, voicingToText(voicing)).toBeLessThanOrEqual(4);
    }
  });

  it('vienen de más a menos cómoda', () => {
    const scores = voicings.map((voicing) => voicing.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe('funciona con acordes que no salen en los libros', () => {
  it('encuentra el 7#9', () => {
    const voicings = chordVoicings(pitchClassFromName('E'), [0, 3, 4, 7, 10]);
    expect(voicings.length).toBeGreaterThan(0);
    expect(soundingNotes(voicings[0]!).size).toBe(5);
  });

  it('encuentra un suspendido', () => {
    expect(best('D', [0, 5, 7])).toBe('xx0233');
  });

  it('devuelve lista vacía si el acorde no cabe en el mástil', () => {
    // Un acorde de seis notas distintas con la fundamental al bajo no siempre
    // tiene solución dentro de cuatro trastes.
    const voicings = chordVoicings(pitchClassFromName('C'), [0, 1, 2, 3, 4, 5], { maxSpan: 2 });
    expect(voicings).toEqual([]);
  });
});

describe('nombre de la posición', () => {
  it('llama al aire a lo que se toca al aire', () => {
    expect(chordVoicings(pitchClassFromName('E'), MAJOR)[0]!.name).toBe('Al aire');
    expect(chordVoicings(pitchClassFromName('A'), POWER).some((v) => v.name === 'Al aire')).toBe(
      true,
    );
  });

  it('avisa de la cejilla', () => {
    const voicings = chordVoicings(pitchClassFromName('F'), MAJOR, { limit: 6 });
    expect(voicings.some((voicing) => voicing.barre)).toBe(true);
    expect(voicings.find((voicing) => voicing.barre)!.name).toContain('cejilla');
  });
});

/**
 * Las formas que enseña cualquier cancionero, con el nombre con el que se
 * conocen.
 *
 * Salían mal nombradas: G 320003 era «2.ª posición», C x32010 «1.ª posición»,
 * Em 022000 y D xx0232 llevaban «cejilla» sin llevarla, y la primera F que se
 * ofrecía, 103211, pedía cejilla en el 1 con la quinta al aire debajo —el índice
 * tumbado la pisa—: no se puede tocar. Bm con cejilla ni siquiera salía, porque
 * se guardaba una forma por traste y la del 2 era otra.
 */
describe('las formas reales, con su nombre', () => {
  function formas(nombre: string, intervalos: readonly number[]) {
    return chordVoicings(pitchClassFromName(nombre as never), intervalos, { limit: 6 }).map(
      (voicing) => ({ forma: voicingToText(voicing), nombre: voicing.name }),
    );
  }

  it.each([
    ['C', MAJOR, 'x32010'],
    ['G', MAJOR, '320003'],
    ['D', MAJOR, 'xx0232'],
    ['E', MINOR, '022000'],
    ['A', MAJOR, 'x02220'],
  ])('%s se coge al aire, y se llama así', (nombre, intervalos, forma) => {
    expect(formas(nombre, intervalos)[0]).toEqual({ forma, nombre: 'Al aire' });
  });

  it('F es la cejilla del 1, y la pequeña sin cejilla va justo detrás', () => {
    const f = formas('F', MAJOR);

    expect(f[0]).toEqual({ forma: '133211', nombre: '1.ª posición con cejilla' });
    expect(f[1]).toEqual({ forma: 'xx3211', nombre: '1.ª posición' });
  });

  it('la F con la quinta al aire debajo de la cejilla no se ofrece', () => {
    const todas = chordVoicings(pitchClassFromName('F'), MAJOR, { limit: 50 });
    expect(todas.map(voicingToText)).not.toContain('103211');
  });

  it('Bm sale en el 2, con cejilla y sin la primera cuerda', () => {
    const bm = formas('B', MINOR);

    expect(bm.slice(0, 2)).toEqual([
      { forma: 'x2443x', nombre: '2.ª posición' },
      { forma: 'x24432', nombre: '2.ª posición con cejilla' },
    ]);
  });

  /**
   * Dos dedos en el traste más bajo con una cuerda al aire en medio se pueden
   * poner si están cerca —A7 x02020—; separados, la mano se tumba y apaga las del
   * medio. No se descartan, pero no salen primero.
   */
  it('A7 se coge al aire aunque lleve una cuerda suelta entre dos dedos del mismo traste', () => {
    expect(formas('A', [0, 4, 7, 10])[0]).toEqual({ forma: 'x02020', nombre: 'Al aire' });
  });

  it('lo que obliga a tumbar la mano sobre cuerdas al aire no sale primero', () => {
    expect(formas('F', MAJOR)[0]!.forma).not.toBe('10321x');
    expect(formas('B', MINOR)[0]!.forma).not.toBe('x20402');
  });

  it('D no lleva cejilla: se coge con tres dedos', () => {
    const d = chordVoicings(pitchClassFromName('D'), MAJOR)[0]!;
    expect(d.barre).toBe(false);
  });

  /**
   * El nombre decía «con cejilla» y el diagrama pintaba un dedo por cuerda. La
   * barra va de la primera a la última cuerda pisada en el traste de la cejilla.
   */
  it('dice dónde va la cejilla para dibujarla, y nada si no la lleva', () => {
    const forma = (nombre: string, intervalos: readonly number[], texto: string) =>
      chordVoicings(pitchClassFromName(nombre as never), intervalos, { limit: 50 }).find(
        (voicing) => voicingToText(voicing) === texto,
      )!;

    expect(cejillaDe(forma('F', MAJOR, '133211'))).toEqual({ traste: 1, desde: 0, hasta: 5 });
    expect(cejillaDe(forma('B', MINOR, 'x24432'))).toEqual({ traste: 2, desde: 1, hasta: 5 });
    // La de la queja: Em en el 2, con la sexta al aire fuera de la barra.
    expect(cejillaDe(forma('E', MINOR, '022453'))).toEqual({ traste: 2, desde: 1, hasta: 2 });
    expect(cejillaDe(chordVoicings(pitchClassFromName('D'), MAJOR)[0]!)).toBeNull();
  });
});

describe('lo que no cabe en la mano', () => {
  /**
   * La distancia máxima entre el traste más bajo y el más alto es lo que separa
   * una digitación de un ejercicio de estiramiento. Con uno, solo salen las que
   * caben en un solo traste.
   */
  it('con un solo traste de alcance, solo salen las que caben ahi', () => {
    const anchas = chordVoicings(pitchClassFromName('C'), MAJOR, { maxSpan: 4 });
    const estrechas = chordVoicings(pitchClassFromName('C'), MAJOR, { maxSpan: 1 });

    expect(anchas.length).toBeGreaterThan(estrechas.length);
    for (const voicing of estrechas) {
      const pisados = voicing.frets.filter((traste): traste is number => (traste ?? 0) > 0);
      if (pisados.length > 0) {
        expect(Math.max(...pisados) - Math.min(...pisados)).toBeLessThan(1);
      }
    }
  });
});

describe('como se llama una posicion', () => {
  it('al aire es lo que suena con cuerdas sueltas en la primera posición de la mano', () => {
    expect(describeVoicing({ position: 0, open: 2, top: 0, barre: false })).toBe('Al aire');
    // G 320003: se pisa del 2 al 3, y suenan tres al aire.
    expect(describeVoicing({ position: 2, open: 3, top: 3, barre: false })).toBe('Al aire');
    expect(describeVoicing({ position: 1, open: 1, top: 4, barre: false })).toBe('Al aire');
  });

  it('más arriba, una cuerda al aire no lo convierte en acorde al aire', () => {
    expect(describeVoicing({ position: 3, open: 1, top: 5, barre: false })).toBe('3.ª posición');
  });

  it('sin cuerdas al aire es una posición, con su cejilla si la lleva', () => {
    expect(describeVoicing({ position: 1, open: 0, top: 3, barre: false })).toBe('1.ª posición');
    expect(describeVoicing({ position: 5, open: 0, top: 7, barre: true })).toBe(
      '5.ª posición con cejilla',
    );
    expect(describeVoicing({ position: 5, open: 0, top: 7, barre: false })).toBe('5.ª posición');
  });
});

describe('cómo se escribe una forma', () => {
  const forma = (frets: (number | null)[]): Voicing => ({
    frets,
    position: 0,
    sounding: 0,
    barre: false,
    name: '',
    score: 0,
  });

  it('pegada mientras todos los trastes son de una cifra', () => {
    expect(voicingToText(forma([null, 3, 2, 0, 1, 0]))).toBe('x32010');
  });

  /** «x8710108» no se sabe si es 10-10-8 o 1-0-1-0-8. */
  it('separada en cuanto hay un traste de dos cifras', () => {
    expect(voicingToText(forma([null, 8, 7, 10, 10, 8]))).toBe('x-8-7-10-10-8');
  });
});
