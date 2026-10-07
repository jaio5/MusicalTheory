import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  saltosDeSalidas,
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

/**
 * Las dominantes secundarias de mayor, al pasar a menor.
 *
 * Devolvían `null`, y el bloque se caía sin avisar: C G Am F E7 en Do mayor
 * pasaba a Do menor sin el E7. Se traducen por función, como todo lo demás.
 */
describe('las dominantes secundarias al cambiar de modo', () => {
  it('la del vi pasa a ser la del VI, que es el III', () => {
    expect(degreeInMode('V/vi', 'minor')).toBe('III');
  });

  it('la del iii pasa a ser la del III, que es el VII', () => {
    expect(degreeInMode('V/iii', 'minor')).toBe('VII');
  });

  // Un disminuido no se prepara con su dominante: esa no tiene dónde caer.
  it('la del ii no tiene contraparte', () => {
    expect(degreeInMode('V/ii', 'minor')).toBeNull();
  });
});

/**
 * Los saltos que faltaban a las salidas: los pedía la música que se toca y el
 * grafo no los conocía, así que ninguna salida podía construirlos. Van en
 * `saltosDeSalidas` y no en el grafo de siempre (lo fija el bloque de abajo).
 */
describe('los saltos que faltaban', () => {
  const va = (mode: 'major' | 'minor', from: string, to: string) =>
    saltosDeSalidas(mode, from as never).some((move) => move.to === to);

  // La plantilla `andalusian` de este mismo fichero no se podía recorrer.
  it('la andaluza baja del VI al V', () => {
    const andaluza = PROGRESSIONS.find((progression) => progression.id === 'andalusian')!;
    andaluza.degrees.slice(1).forEach((grado, i) => {
      expect(va('minor', andaluza.degrees[i]!, grado), `${andaluza.degrees[i]} → ${grado}`).toBe(
        true,
      );
    });
  });

  it('se llega a las dominantes secundarias desde donde se llega de verdad', () => {
    expect(va('major', 'I', 'V/vi')).toBe(true);
    expect(va('major', 'IV', 'V/vi')).toBe(true);
    expect(va('major', 'iii', 'V/ii')).toBe(true);
    expect(va('major', 'V/vi', 'V/ii')).toBe(true);
    expect(va('minor', 'i', 'V/iv')).toBe(true);
  });

  it('los saltos que pidió el corpus ciego: la escalera prestada, la plagal menor desde casa y el VI–iv', () => {
    // `bIII bVI bVII I`, la escalera del cine, cae por quintas como el III–VI del menor.
    expect(va('major', 'bIII', 'bVI')).toBe(true);
    expect(va('minor', 'III', 'VI')).toBe(true);
    // `I iv I iv`: la plagal menor sin el IV delante.
    expect(va('major', 'I', 'iv')).toBe(true);
    // `VI iv V i`: el IV–ii del mayor en menor, sin la tríada disminuida.
    expect(va('minor', 'VI', 'iv')).toBe(true);
    expect(va('major', 'IV', 'ii')).toBe(true);
  });

  it('el ii° del menor tiene de dónde venir, y el napolitano va al V', () => {
    expect(va('minor', 'VI', 'ii°')).toBe(true);
    expect(va('minor', 'bII', 'V')).toBe(true);
    expect(va('major', 'ii', 'bII')).toBe(true);
  });

  // Detrás de los giros de siempre: en el lienzo salen las últimas.
  it('ningún salto a una dominante secundaria pesa más de 0,3', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const degree of degreesFor(mode)) {
        for (const move of saltosDeSalidas(mode, degree)) {
          if (move.to.includes('/') && !degree.includes('/')) {
            expect(move.weight, `${mode} ${degree} → ${move.to}`).toBeLessThanOrEqual(0.3);
          }
        }
      }
    }
  });

  /**
   * Un grado al que no va nadie no puede ser el final de un puente que vuelve a
   * él: una canción que empezaba por el bIII o el vii° se quedaba sin contrastes.
   * Solo el II7 del menor sigue sin entrada, a propósito (lo dice el grafo).
   */
  it('a todo grado se llega desde alguno, menos al II7 del menor', () => {
    for (const mode of ['major', 'minor'] as const) {
      const llegan = new Set(
        degreesFor(mode).flatMap((d) => saltosDeSalidas(mode, d).map((m) => m.to)),
      );
      const solos = degreesFor(mode).filter((d) => !llegan.has(d));
      expect(solos, mode).toEqual(mode === 'major' ? [] : ['V/V']);
    }
    expect(va('major', 'I', 'bIII')).toBe(true);
    expect(va('major', 'IV', 'vii°')).toBe(true);
    expect(va('major', 'vi', 'V/iii')).toBe(true);
  });

  it('todo salto lleva a un grado del mismo modo', () => {
    for (const mode of ['major', 'minor'] as const) {
      const validos = new Set<string>(degreesFor(mode));
      for (const degree of degreesFor(mode)) {
        for (const move of saltosDeSalidas(mode, degree)) {
          expect(validos, `${mode} ${degree} → ${move.to}`).toContain(move.to);
          expect(move.why.length).toBeGreaterThan(10);
        }
      }
    }
  });
});

/**
 * El grafo de siempre **no cambia por las salidas**: lo leen el reanálisis de lo
 * grabado, como probabilidad de que un acorde siga a otro, y el lienzo, que
 * enseña sus seis primeros saltos. Cuando los saltos de las salidas entraron en
 * él, los dos cambiaron sin que nadie lo midiera. Esta tabla es el grafo tal como
 * estaba antes de ellos; cambiarla es una decisión del reconocimiento o del lienzo,
 * no de las salidas.
 */
describe('el grafo de siempre', () => {
  const ANTES: Readonly<Record<'major' | 'minor', Readonly<Record<string, string>>>> = {
    major: {
      I: 'IV 0.9, V 0.85, vi 0.8, bVII 0.6, iii 0.35, ii 0.3',
      ii: 'V 0.9, I 0.4, IV 0.35',
      iii: 'vi 0.7, IV 0.6, I 0.4',
      IV: 'I 0.9, V 0.8, iv 0.5, vi 0.4, bVII 0.3',
      V: 'I 0.95, vi 0.5, IV 0.45',
      vi: 'IV 0.9, V 0.5, ii 0.4, I 0.35',
      'vii°': 'I 0.7, V 0.3',
      bII: 'I 0.85, V 0.3',
      bIII: 'bVII 0.7, IV 0.55, I 0.5',
      iv: 'I 0.9, V 0.4, bVII 0.3',
      bVI: 'bVII 0.8, I 0.5',
      bVII: 'I 0.9, IV 0.6, bVI 0.3',
      'V/ii': 'ii 0.95, V 0.3',
      'V/iii': 'iii 0.95',
      'V/V': 'V 0.95, I 0.2',
      'V/vi': 'vi 0.95',
    },
    minor: {
      i: 'VII 0.9, VI 0.85, iv 0.7, III 0.6, bII 0.3, V 0.3',
      'ii°': 'V 0.6, i 0.3',
      bII: 'i 0.9, VII 0.3',
      III: 'VII 0.7, VI 0.6, iv 0.4',
      iv: 'i 0.9, V 0.5, v 0.4, VII 0.35',
      v: 'i 0.85, iv 0.35',
      V: 'i 0.95, VI 0.4',
      VI: 'VII 0.85, III 0.4, i 0.4',
      VII: 'i 0.9, III 0.5, VI 0.4',
      'V/iv': 'iv 0.95',
      'V/V': 'V 0.95, v 0.4',
    },
  };

  it('nextDegrees es exactamente el de antes de las salidas, grado a grado', () => {
    for (const mode of ['major', 'minor'] as const) {
      const ahora = Object.fromEntries(
        degreesFor(mode).map((grado) => [
          grado,
          nextDegrees(mode, grado)
            .map((move) => `${move.to} ${move.weight}`)
            .join(', '),
        ]),
      );
      expect(ahora, mode).toEqual(ANTES[mode]);
    }
  });

  // Leen el fichero porque lo que se vigila es qué grafo importan, no cómo lo usan.
  it('el reconocimiento y el lienzo leen el de siempre, y no el de las salidas', () => {
    for (const fichero of ['audio/offline-chords.ts', 'features/arrange/ArrangeCanvas.tsx']) {
      const fuente = readFileSync(join(import.meta.dirname, '../..', fichero), 'utf8');
      expect(fuente, fichero).toMatch(/\bnextDegrees\b/);
      expect(fuente, fichero).not.toMatch(/\bsaltosDeSalidas\b/);
    }
  });

  it('las salidas ven el de siempre, más lo suyo y sin el II7 que cae en casa', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const grado of degreesFor(mode)) {
        const suyos = saltosDeSalidas(mode, grado).map((move) => move.to);
        const deSiempre = nextDegrees(mode, grado)
          .map((move) => move.to)
          .filter((to) => !(mode === 'major' && grado === 'V/V' && to === 'I'));
        expect(suyos, `${mode} ${grado}`).toEqual(expect.arrayContaining(deSiempre));
      }
    }
    expect(saltosDeSalidas('major', 'V/V').map((move) => move.to)).toEqual(['V']);
    // Ordenados por peso, como los de siempre: en un empate, primero el de siempre.
    expect(saltosDeSalidas('major', 'vi').map((move) => move.to)).toEqual([
      'IV',
      'V',
      'ii',
      'I',
      'iii',
      'V/V',
      'V/iii',
    ]);
  });
});
