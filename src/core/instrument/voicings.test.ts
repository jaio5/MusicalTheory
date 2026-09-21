import { describe, expect, it } from 'vitest';

import { midiToPitchClass, pitchClassFromName } from '../music/notes';
import { STANDARD_TUNING } from './guitar';
import { chordVoicings, describeVoicing, voicingToText, type Voicing } from './voicings';

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

  it('no repite posición: son sitios distintos del mástil', () => {
    const positions = voicings.map((voicing) => voicing.position);
    expect(new Set(positions).size).toBe(positions.length);
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
    expect(chordVoicings(pitchClassFromName('E'), MAJOR)[0]!.name).toContain('posición');
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
  it('la del principio es al aire o primera, segun suene alguna cuerda suelta', () => {
    expect(describeVoicing(0, 2, false)).toBe('Al aire');
    expect(describeVoicing(0, 0, false)).toBe('Primera posición');
    expect(describeVoicing(5, 0, true)).toBe('5.ª posición con cejilla');
    expect(describeVoicing(5, 0, false)).toBe('5.ª posición');
  });
});
