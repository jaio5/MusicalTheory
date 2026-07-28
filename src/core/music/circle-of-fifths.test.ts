import { describe, expect, it } from 'vitest';

import {
  accidentalForKey,
  CIRCLE_OF_FIFTHS,
  circlePosition,
  keyPosition,
  positionAngle,
  relativeMajor,
  relativeMinor,
  rotationForKey,
  shortestRotation,
} from './circle-of-fifths';
import { noteName, pitchClassFromName } from './notes';

describe('el orden de la rueda', () => {
  it('avanza por quintas justas desde Do', () => {
    expect(CIRCLE_OF_FIFTHS.map((tonic) => noteName(tonic))).toEqual([
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'G#',
      'D#',
      'A#',
      'F',
    ]);
  });

  it('tiene las doce tonalidades sin repetir', () => {
    expect(new Set(CIRCLE_OF_FIFTHS).size).toBe(12);
  });

  it('cierra el círculo: de Fa a Do hay otra quinta', () => {
    expect(circlePosition(pitchClassFromName('F'))).toBe(11);
    expect(circlePosition(pitchClassFromName('C'))).toBe(0);
  });
});

describe('relativas', () => {
  it('la relativa menor de Do es A menor', () => {
    expect(noteName(relativeMinor(pitchClassFromName('C')))).toBe('A');
  });

  it('la relativa mayor de A menor es Do', () => {
    expect(noteName(relativeMajor(pitchClassFromName('A')))).toBe('C');
  });

  it('ida y vuelta deja la misma nota', () => {
    for (const tonic of CIRCLE_OF_FIFTHS) {
      expect(relativeMajor(relativeMinor(tonic))).toBe(tonic);
    }
  });
});

describe('posición de una tonalidad', () => {
  it('una menor ocupa el mismo sitio que su relativa mayor', () => {
    expect(keyPosition(pitchClassFromName('A'), 'minor')).toBe(
      keyPosition(pitchClassFromName('C'), 'major'),
    );
    expect(keyPosition(pitchClassFromName('E'), 'minor')).toBe(
      keyPosition(pitchClassFromName('G'), 'major'),
    );
  });

  it('reparte las doce posiciones en treinta grados cada una', () => {
    expect(positionAngle(0)).toBe(0);
    expect(positionAngle(1)).toBe(30);
    expect(positionAngle(11)).toBe(330);
  });
});

describe('giro de la rueda', () => {
  it('C mayor no necesita girar', () => {
    expect(rotationForKey(pitchClassFromName('C'), 'major')).toBe(0);
  });

  it('gira al revés que la posición, para traer la tonalidad arriba', () => {
    expect(rotationForKey(pitchClassFromName('G'), 'major')).toBe(-30);
    expect(rotationForKey(pitchClassFromName('A'), 'minor')).toBe(0);
  });

  it('elige siempre el camino corto', () => {
    // De Fa (-330) a Do (0): treinta grados hacia delante, no trescientos
    // treinta hacia atrás.
    expect(shortestRotation(-330, 0)).toBe(-360);
    expect(shortestRotation(0, -330)).toBe(30);
  });

  it('no da vueltas de más al quedarse donde está', () => {
    expect(shortestRotation(-90, -90)).toBe(-90);
  });

  it('acumula giro en vez de saltar de 350 a 10', () => {
    // Encadenar giros mantiene el ángulo creciendo o decreciendo sin saltos.
    let angle = 0;
    for (const step of [-30, -60, -90, -120]) {
      angle = shortestRotation(angle, step);
    }
    expect(angle).toBe(-120);
  });
});

describe('escritura de cada tonalidad', () => {
  it('usa sostenidos en el lado de los sostenidos', () => {
    for (const name of ['C', 'G', 'D', 'A', 'E', 'B', 'F#'] as const) {
      expect(accidentalForKey(pitchClassFromName(name), 'major')).toBe('sharp');
    }
  });

  it('usa bemoles en el lado de los bemoles', () => {
    // Fa lleva un bemol, Sib dos, Mib tres, Lab cuatro y Reb cinco.
    for (const name of ['F', 'A#', 'D#', 'G#', 'C#'] as const) {
      expect(accidentalForKey(pitchClassFromName(name), 'major')).toBe('flat');
    }
  });

  it('una menor se escribe como su relativa mayor', () => {
    // A menor es la relativa de Do: sin alteraciones, lado de los sostenidos.
    expect(accidentalForKey(pitchClassFromName('A'), 'minor')).toBe('sharp');
    // D menor es la relativa de Fa: lleva Sib.
    expect(accidentalForKey(pitchClassFromName('D'), 'minor')).toBe('flat');
  });

  it('escribe F mayor con Sib y no con La#', () => {
    const accidental = accidentalForKey(pitchClassFromName('F'), 'major');
    expect(noteName(pitchClassFromName('A#'), accidental)).toBe('Bb');
  });
});
