import { describe, expect, it } from 'vitest';

import {
  clampOffset,
  clampStart,
  isInScaleOffset,
  MAX_OFFSET,
  midiOf,
  MIN_OFFSET,
  offsetOfStep,
  NOTE_LENGTHS,
  snapLength,
  snapToGrid,
  writeNote,
  type LeadNote,
} from './melody';
import { pitchClassFromName } from './notes';

const C = pitchClassFromName('C');
const G = pitchClassFromName('G');
const Eb = pitchClassFromName('Eb');

function nota(extra: Partial<LeadNote> = {}): LeadNote {
  return { id: 'n', offset: 0, start: 0, length: 1, ...extra };
}

describe('la rejilla', () => {
  it('el tiempo cae en medios pulsos', () => {
    expect(snapToGrid(1.2)).toBe(1);
    expect(snapToGrid(1.3)).toBe(1.5);
    expect(clampStart(-4)).toBe(0);
  });

  // Arrastrando el borde de una negra hacia la blanca, a mitad de camino lo que
  // se quiere es la que esté más cerca, no siempre la corta.
  it('la duración se va a la figura más cercana, no a la de abajo', () => {
    expect(snapLength(1.9)).toBe(2);
    expect(snapLength(1.1)).toBe(1);
    expect(snapLength(0.1)).toBe(0.5);
    expect(snapLength(99)).toBe(4);
  });

  it('toda duración que sale tiene figura con la que escribirse', () => {
    for (const pedida of [0.1, 0.7, 1.4, 2.6, 3.9, 12]) {
      expect(NOTE_LENGTHS).toContain(snapLength(pedida));
    }
  });

  it('lo que no es un número no rompe nada', () => {
    expect(snapLength(Number.NaN)).toBe(1);
    expect(clampStart(Number.NaN)).toBe(0);
    expect(clampOffset(Number.NaN)).toBe(0);
  });

  it('la altura tiene techo y suelo', () => {
    expect(clampOffset(99)).toBe(MAX_OFFSET);
    expect(clampOffset(-99)).toBe(MIN_OFFSET);
  });
});

describe('isInScaleOffset', () => {
  // Es lo que separa la interfaz de quien no sabe música de la de quien sí: a uno
  // solo se le ofrecen las de dentro, el otro escribe la de fuera.
  it('distingue las de la escala de las de fuera', () => {
    expect(isInScaleOffset(0, C, 'major')).toBe(true);
    expect(isInScaleOffset(4, C, 'major')).toBe(true);
    expect(isInScaleOffset(1, C, 'major')).toBe(false);
  });

  it('vale para cualquier octava, arriba y abajo', () => {
    expect(isInScaleOffset(12, C, 'major')).toBe(true);
    expect(isInScaleOffset(-5, C, 'major')).toBe(true);
    expect(isInScaleOffset(-11, C, 'major')).toBe(false);
  });
});

describe('midiOf', () => {
  it('el mismo punteo suena transportado al cambiar de tonalidad', () => {
    const enDo = midiOf(nota({ offset: 7 }), C);
    const enSol = midiOf(nota({ offset: 7 }), G);
    expect(enSol - enDo).toBe(7);
  });

  it('los semitonos se cuentan sobre la tónica', () => {
    expect(midiOf(nota({ offset: 12 }), C) - midiOf(nota({ offset: 0 }), C)).toBe(12);
  });
});

describe('writeNote', () => {
  // La letra es lo que decide la línea del pentagrama: un F y un F# van en la
  // misma, y la alteración es un signo delante que no la mueve de sitio.
  it('separa la letra de la alteración', () => {
    expect(writeNote(nota({ offset: 0 }), C, 'major')).toMatchObject({
      letter: 'C',
      accidental: '',
    });
    expect(writeNote(nota({ offset: 6 }), C, 'major')).toMatchObject({
      letter: 'F',
      accidental: '#',
    });
  });

  it('una tonalidad de bemoles se escribe con bemoles', () => {
    expect(writeNote(nota({ offset: 3 }), Eb, 'major').accidental).toBe('b');
  });

  // Cada escalón es media línea del pentagrama. Una octava son siete, y no doce:
  // es lo que hace que un Do# y un Do se dibujen en el mismo sitio.
  it('los escalones son diatónicos, no cromáticos', () => {
    const grave = writeNote(nota({ offset: 0 }), C, 'major').step;
    const agudo = writeNote(nota({ offset: 12 }), C, 'major').step;
    expect(agudo - grave).toBe(7);

    expect(writeNote(nota({ offset: 1 }), C, 'major').step).toBe(grave);
  });

  it('sube de escalón al pasar de nota, no al pasar de semitono', () => {
    const pasos = [0, 2, 4, 5, 7, 9, 11].map(
      (offset) => writeNote(nota({ offset }), C, 'major').step,
    );
    expect(pasos).toEqual([
      pasos[0]! + 0,
      pasos[0]! + 1,
      pasos[0]! + 2,
      pasos[0]! + 3,
      pasos[0]! + 4,
      pasos[0]! + 5,
      pasos[0]! + 6,
    ]);
  });
});

describe('offsetOfStep', () => {
  // La vuelta de writeNote. Sin ella, arrastrar una nota en el pentagrama no
  // sabría a qué altura la están soltando.
  it('deshace lo que hace writeNote', () => {
    for (const offset of [-12, -5, 0, 2, 4, 7, 12, 16, 24]) {
      const escrita = writeNote(nota({ offset }), C, 'major');
      expect(offsetOfStep(escrita.step, C, 'major'), String(offset)).toBe(offset);
    }
  });

  /**
   * En Sol mayor, subir del Mi al Fa tiene que dar un Fa **sostenido**: es lo que
   * espera cualquiera que esté escribiendo en Sol, y es la razón de que esto pase
   * por la armadura y no por la escala.
   */
  it('la armadura decide qué nota es cada línea', () => {
    const enDo = offsetOfStep(3, C, 'major');
    const enSol = offsetOfStep(3, G, 'major');
    expect(midiOf(nota({ offset: enDo }), C)).toBe(65); // Fa natural
    expect(midiOf(nota({ offset: enSol }), G)).toBe(66); // Fa sostenido
  });

  // Las siete letras, una vez cada una, incluso donde los doce nombres se pisan:
  // en Fa sostenido mayor el Mi sostenido se llama `F` y taparía al Fa sostenido
  // si esto buscara la letra entre las notas de la escala.
  it('funciona también en las tonalidades lejanas', () => {
    const Fs = pitchClassFromName('F#');
    const alturas = [0, 1, 2, 3, 4, 5, 6].map((step) =>
      midiOf(nota({ offset: offsetOfStep(step, Fs, 'major') }), Fs),
    );
    expect(new Set(alturas.map((m) => m % 12)).size).toBe(7);
  });
});
