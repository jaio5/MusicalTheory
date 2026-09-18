import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from './notes';
import {
  degreeInMode,
  degreeOfChord,
  degreesFor,
  nextDegrees,
  PROGRESSIONS,
  progressionsFor,
  resolveDegree,
  resolveProgression,
} from './progressions';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');

describe('caminos entre grados', () => {
  it('desde I lo más habitual es ir a IV', () => {
    expect(nextDegrees('major', 'I')[0]?.to).toBe('IV');
  });

  it('ofrece el bVII desde I, que en un coral no existiría', () => {
    expect(nextDegrees('major', 'I').map((move) => move.to)).toContain('bVII');
  });

  it('desde i en menor lo más habitual es bajar al VII', () => {
    expect(nextDegrees('minor', 'i')[0]?.to).toBe('VII');
  });

  it('devuelve los movimientos ordenados por frecuencia de uso', () => {
    const weights = nextDegrees('major', 'V').map((move) => move.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  /**
   * El ejemplo era el `iv`, y dejó de servir cuando el cuarto menor entró en el
   * catálogo mayor ([adr/0036](../../../docs/adr/0036-el-cuarto-menor-prestado.md)).
   * El `i` sigue sin existir en mayor: una tónica menor en tonalidad mayor no es
   * un préstamo, es otra tonalidad.
   */
  it('protesta si el grado no existe en ese modo', () => {
    expect(() => nextDegrees('major', 'i')).toThrow(RangeError);
    expect(() => nextDegrees('minor', 'vi')).toThrow(RangeError);
  });

  // Y el cuarto menor prestado sí tiene a dónde ir: sin movimientos, elegirlo
  // tumbaba la pantalla de componer, que es como se cayó al añadir los modos.
  it('el cuarto menor prestado sale a casa', () => {
    expect(nextDegrees('major', 'iv')[0]).toMatchObject({ to: 'I' });
  });
});

describe('resolución de grados a acordes', () => {
  it('convierte grados de C mayor en cifrado', () => {
    expect(resolveDegree(C, 'major', 'I').symbol).toBe('C');
    expect(resolveDegree(C, 'major', 'vi').symbol).toBe('Am');
    // Bb y no A#, que es lo que decía antes esta línea. Do mayor no tiene
    // alteraciones, así que la tonalidad no puede decidir por este grado: lo
    // decide su propio nombre, que empieza por bemol.
    expect(resolveDegree(C, 'major', 'bVII').symbol).toBe('Bb');
  });

  it('distingue las dos dominantes del menor', () => {
    expect(resolveDegree(A, 'minor', 'v').symbol).toBe('Em');
    expect(resolveDegree(A, 'minor', 'V').symbol).toBe('E');
  });

  it('resuelve el bucle de cuatro acordes en Do', () => {
    const loop = PROGRESSIONS.find((progression) => progression.id === 'four-chords');
    expect(loop).toBeDefined();
    expect(resolveProgression(C, 'major', loop!.degrees).map((chord) => chord.symbol)).toEqual([
      'C',
      'G',
      'Am',
      'F',
    ]);
  });

  it('resuelve el descenso menor en La', () => {
    const descent = PROGRESSIONS.find((progression) => progression.id === 'minor-descent');
    expect(resolveProgression(A, 'minor', descent!.degrees).map((chord) => chord.symbol)).toEqual([
      'Am',
      'G',
      'F',
      'G',
    ]);
  });
});

describe('identificación del grado que suena', () => {
  it('reconoce un acorde diatónico', () => {
    expect(degreeOfChord(C, 'major', pitchClassFromName('F'), 'major')).toBe('IV');
    expect(degreeOfChord(A, 'minor', pitchClassFromName('G'), 'major')).toBe('VII');
  });

  it('reconoce un prestado habitual', () => {
    expect(degreeOfChord(C, 'major', pitchClassFromName('A#'), 'major')).toBe('bVII');
  });

  it('devuelve null si el acorde no encaja', () => {
    expect(degreeOfChord(C, 'major', pitchClassFromName('C#'), 'minor')).toBeNull();
  });

  /**
   * Y ninguno se come a otro.
   *
   * Un grado se busca por fundamental y especie, así que dos con la misma pareja
   * serían indistinguibles y contestaría el que esté escrito antes en la tabla.
   * No es una posibilidad teórica: el catálogo tiene cuatro prestados y seis
   * dominantes secundarias metidos entre los diatónicos, y **está elegido para
   * que no choquen** —de las cuatro dominantes secundarias que se usarían en
   * menor solo caben dos, porque las otras caen encima del III y del VII—. Esta
   * vuelta es lo que avisa el día que se añada un grado que sí pise a alguien.
   */
  it('cada grado del catalogo se reconoce como el mismo', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const degree of degreesFor(mode)) {
        const { root, quality } = resolveDegree(C, mode, degree);

        expect(degreeOfChord(C, mode, root, quality), `${mode} ${degree}`).toBe(degree);
      }
    }
  });
});

describe('catálogo de progresiones', () => {
  it('filtra por modo', () => {
    expect(progressionsFor('major').every((item) => item.mode === 'major')).toBe(true);
    expect(progressionsFor('minor').every((item) => item.mode === 'minor')).toBe(true);
  });

  it('usa solo grados que existen en su modo', () => {
    for (const progression of PROGRESSIONS) {
      const valid = degreesFor(progression.mode);
      for (const degree of progression.degrees) {
        expect(valid).toContain(degree);
      }
    }
  });
});

describe('los grados prestados se escriben con bemol', () => {
  it('en Do mayor son Db, Eb, Ab y Bb, y no C#, D#, G# y A#', () => {
    // Suenan igual y no los reconoce nadie. Es la misma regla que ya cuidan las
    // afinaciones: la bajada de medio tono es Eb Ab Db Gb Bb Eb.
    expect(resolveDegree(0, 'major', 'bII').symbol).toBe('Db');
    expect(resolveDegree(0, 'major', 'bIII').symbol).toBe('Eb');
    expect(resolveDegree(0, 'major', 'bVI').symbol).toBe('Ab');
    expect(resolveDegree(0, 'major', 'bVII').symbol).toBe('Bb');
  });

  it('el napolitano de La menor es Bb', () => {
    expect(resolveDegree(9, 'minor', 'bII').symbol).toBe('Bb');
  });

  it('los demás grados siguen escribiéndose como pide su tonalidad', () => {
    // Mi mayor lleva sostenidos, y su IV es La, no Si bemol menor de nada.
    expect(resolveDegree(4, 'major', 'V').symbol).toBe('B');
    expect(resolveDegree(4, 'major', 'ii').symbol).toBe('F#m');
  });
});

/**
 * El cuarto menor prestado, y cómo se llega a él.
 *
 * El sugeridor ya lo proponía —`iv`, prestado— y el catálogo de grados no lo
 * tenía, así que la pantalla ofrecía un acorde que luego no dejaba escribir
 * ([adr/0036](../../../docs/adr/0036-el-cuarto-menor-prestado.md)).
 */
describe('el cuarto menor prestado', () => {
  it('es un grado de la tonalidad mayor, y es menor', () => {
    expect(resolveDegree(0, 'major', 'iv').symbol).toBe('Fm');
  });

  // El giro clásico: el mismo acorde con la tercera bajada.
  it('se llega desde el IV, que es el giro de toda la vida', () => {
    expect(nextDegrees('major', 'IV').map((move) => move.to)).toContain('iv');
  });

  /**
   * Y un Fa menor oído en Do mayor ya sabe dónde ponerse: antes no tenía grado,
   * así que el micro que lo oía no podía meterlo en la canción.
   */
  it('un acorde menor sobre el cuarto grado ya tiene grado', () => {
    expect(degreeOfChord(0, 'major', 5, 'minor')).toBe('iv');
  });

  // Y al cambiar de modo se queda: en menor se llama igual.
  it('en menor se llama igual, asi que no hay nada que traducir', () => {
    expect(degreeInMode('iv', 'minor')).toBe('iv');
    expect(degreeInMode('iv', 'major')).toBe('iv');
  });
});
