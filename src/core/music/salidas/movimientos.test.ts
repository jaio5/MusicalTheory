import { describe, expect, it } from 'vitest';

import type { KeyMode } from '../keys';
import { pitchClassFromName, type NoteName } from '../notes';
import { degreesFor, resolveDegree, type DegreeSymbol } from '../progressions';
import {
  applyMove,
  destinosDelMovimiento,
  especieDelMovimiento,
  isMove,
  moveById,
  MOVES,
  nombreDelCambio,
  type Entorno,
  type MoveId,
} from './movimientos';

/** El cifrado de un grado en una tonalidad, para leer los casos como se tocan. */
function cifrado(tonica: NoteName, mode: KeyMode, grado: DegreeSymbol | null): string | null {
  return grado === null ? null : resolveDegree(pitchClassFromName(tonica), mode, grado).symbol;
}

describe('el relativo', () => {
  it('en mayor lleva de los tres tonales a sus menores', () => {
    expect(applyMove('major', 'I', 'relativo')).toBe('vi');
    expect(applyMove('major', 'IV', 'relativo')).toBe('ii');
    expect(applyMove('major', 'V', 'relativo')).toBe('iii');
  });

  it('y de vuelta: es simétrico, que es lo que lo hace un parentesco', () => {
    expect(applyMove('major', 'vi', 'relativo')).toBe('I');
    expect(applyMove('major', 'ii', 'relativo')).toBe('IV');
    expect(applyMove('major', 'iii', 'relativo')).toBe('V');
  });

  it('en menor, el i abre a su relativa mayor', () => {
    expect(applyMove('minor', 'i', 'relativo')).toBe('III');
    expect(applyMove('minor', 'iv', 'relativo')).toBe('VI');
  });

  it('un disminuido no tiene relativo, y se dice callando', () => {
    expect(applyMove('major', 'vii°', 'relativo')).toBeNull();
  });
});

describe('la misma función', () => {
  it('en menor cambia las dos subdominantes, que el relativo no alcanza', () => {
    // En La menor, Si° y Rem comparten el Re y el Fa, y los dos empujan al Mi.
    expect(applyMove('minor', 'ii°', 'funcion')).toBe('iv');
    expect(applyMove('minor', 'iv', 'funcion')).toBe('ii°');
    expect(isMove('minor', 'ii°', 'iv', 'funcion')).toBe(true);
  });

  it('en mayor, la dominante con y sin fundamental, y la tónica con su otro reposo', () => {
    expect(applyMove('major', 'V', 'funcion')).toBe('vii°');
    expect(applyMove('major', 'vii°', 'funcion')).toBe('V');
    expect(applyMove('major', 'I', 'funcion')).toBe('iii');
    expect(applyMove('minor', 'i', 'funcion')).toBe('VI');
  });

  it('no repite el relativo ni cruza de función, y fuera de la escala calla', () => {
    // El ii y el IV ya son relativos; el vi y el iii no reposan como el IV empuja.
    expect(applyMove('major', 'ii', 'funcion')).toBeNull();
    expect(applyMove('major', 'IV', 'funcion')).toBeNull();
    expect(applyMove('minor', 'v', 'funcion')).toBeNull();
    expect(applyMove('major', 'bVI', 'funcion')).toBeNull();
    expect(applyMove('major', 'V/vi', 'funcion')).toBeNull();
    expect(especieDelMovimiento('funcion', 'iv')).toBeNull();
  });
});

describe('la sustitución tritonal', () => {
  it('cambia la dominante por la que está a un tritono', () => {
    // En Do mayor: G se cambia por Db, que es el bII.
    expect(applyMove('major', 'V', 'tritono')).toBe('bII');
    expect(applyMove('minor', 'V', 'tritono')).toBe('bII');
  });

  /**
   * Y solo antes de adonde iba. Un Db en Do mayor comparte el tritono del G7
   * porque el G7 va a Do: en un compás que no va a ningún sitio es un acorde de
   * otra tonalidad, y así salía antes en las salidas.
   */
  it('con los vecinos delante, solo antes de su objetivo', () => {
    expect(applyMove('major', 'V', 'tritono', { siguiente: 'I' })).toBe('bII');
    expect(applyMove('major', 'V', 'tritono', { siguiente: 'vi' })).toBeNull();
    expect(applyMove('major', 'V', 'tritono', { siguiente: null })).toBeNull();
    // Deshacer el sustituto también va antes de la tónica: medio tono por encima.
    expect(applyMove('major', 'bII', 'tritono', { siguiente: 'I' })).toBe('V');
    // Y la dominante secundaria tiene el suyo: la del ii, delante del ii.
    expect(applyMove('major', 'V/ii', 'tritono', { siguiente: 'ii' })).toBe('bIII');
  });

  it('suena con séptima: sin ella no lleva el tritono del V', () => {
    expect(especieDelMovimiento('tritono', 'bII')).toBe('dominant7');
  });

  it('deshace la sustitución al aplicarla otra vez', () => {
    // El tritono es su propio inverso: es lo que hace que las dos compartan el
    // mismo tritono dentro.
    expect(applyMove('major', 'bII', 'tritono')).toBe('V');
  });

  it('a un acorde menor no se le hace: no lleva el tritono dentro', () => {
    expect(applyMove('major', 'ii', 'tritono')).toBeNull();
    expect(applyMove('major', 'vi', 'tritono')).toBeNull();
  });
});

describe('el préstamo modal', () => {
  it('en mayor baja el grado un semitono y lo vuelve mayor', () => {
    expect(applyMove('major', 'iii', 'prestamo')).toBe('bIII');
    expect(applyMove('major', 'vi', 'prestamo')).toBe('bVI');
    expect(applyMove('major', 'vii°', 'prestamo')).toBe('bVII');
  });

  it('en menor no hay préstamo, porque el catálogo ya los trae dentro', () => {
    // El V mayor de una tonalidad menor ya es un préstamo del menor armónico, y
    // el bII es el napolitano: no queda nada «de fuera» a lo que ir. Lo que se
    // querría hacer ahí —cambiar v por V— es el intercambio de especie.
    for (const degree of degreesFor('minor')) {
      expect(applyMove('minor', degree, 'prestamo')).toBeNull();
    }
  });

  it('lo que no tiene préstamo en el catálogo devuelve nulo', () => {
    expect(applyMove('major', 'I', 'prestamo')).toBeNull();
  });

  /**
   * El préstamo es el acorde del mismo grado en el menor paralelo, y el ii de Do
   * menor es Re semidisminuido, no Db. «Un semitono abajo y mayor» acertaba con
   * tres grados y se inventaba el cuarto.
   */
  it('el ii no se presta como bII, y el IV se presta como iv', () => {
    expect(applyMove('major', 'ii', 'prestamo')).toBeNull();
    expect(applyMove('major', 'IV', 'prestamo')).toBe('iv');
    expect(applyMove('major', 'V', 'prestamo')).toBeNull();
  });

  // Prestar es traer algo de fuera a la escala: lo prestado no se vuelve a prestar,
  // y antes el bVI «prestado» devolvía el V, que es deshacer el préstamo.
  it('lo que ya es prestado no se presta', () => {
    expect(applyMove('major', 'bVI', 'prestamo')).toBeNull();
    expect(applyMove('major', 'V/vi', 'prestamo')).toBeNull();
  });
});

/**
 * Lo que cambia es la tónica que la dominante prometía, no la dominante: antes se
 * le hacía al V, y lo que quedaba era una cadencia sin dominante.
 */
describe('la cadencia interrumpida', () => {
  it('la tónica pasa a ser el acorde de una tercera por debajo: vi, o VI en menor', () => {
    expect(applyMove('major', 'I', 'interrumpida')).toBe('vi');
    // En menor el VI, que comparte dos notas con el i; no el III, que es el relativo.
    expect(applyMove('minor', 'i', 'interrumpida')).toBe('VI');
  });

  it('a lo que no es la tónica no se le hace', () => {
    expect(applyMove('major', 'V', 'interrumpida')).toBeNull();
    expect(applyMove('major', 'IV', 'interrumpida')).toBeNull();
  });

  it('con los vecinos delante, solo después de una dominante', () => {
    expect(applyMove('major', 'I', 'interrumpida', { anterior: 'V' })).toBe('vi');
    expect(applyMove('minor', 'i', 'interrumpida', { anterior: 'v' })).toBe('VI');
    expect(applyMove('major', 'I', 'interrumpida', { anterior: 'IV' })).toBeNull();
    expect(applyMove('major', 'I', 'interrumpida', { anterior: null })).toBeNull();
  });
});

/**
 * Su dominante delante: el movimiento que faltaba, y por el que en las salidas no
 * había ni una dominante secundaria.
 */
describe('su dominante delante', () => {
  it('delante de un grado, su dominante secundaria; delante de la tónica, el V', () => {
    expect(applyMove('major', 'V', 'dominante', { siguiente: 'vi' })).toBe('V/vi');
    expect(applyMove('major', 'I', 'dominante', { siguiente: 'V' })).toBe('V/V');
    expect(applyMove('major', 'IV', 'dominante', { siguiente: 'I' })).toBe('V');
    expect(applyMove('minor', 'i', 'dominante', { siguiente: 'iv' })).toBe('V/iv');
    // Una dominante delante de otra: la cadena del rhythm changes.
    expect(applyMove('major', 'I', 'dominante', { siguiente: 'V/ii' })).toBe('V/vi');
  });

  it('sin saber qué viene después no hay de quién ser la dominante', () => {
    expect(applyMove('major', 'IV', 'dominante')).toBeNull();
    expect(applyMove('major', 'IV', 'dominante', { siguiente: null })).toBeNull();
    // Un grado que no es del modo tampoco tiene dominante.
    expect(applyMove('major', 'IV', 'dominante', { siguiente: 'VII' })).toBeNull();
  });

  it('delante de un grado sin dominante en el catálogo, nulo', () => {
    // La del IV es un I con séptima, que el grado no distingue; la del III en menor
    // es el VII, un acorde de la escala y no «su dominante».
    expect(applyMove('major', 'vi', 'dominante', { siguiente: 'IV' })).toBeNull();
    expect(applyMove('minor', 'i', 'dominante', { siguiente: 'III' })).toBeNull();
  });

  it('si ya lo es, no hay nada que cambiar', () => {
    expect(applyMove('major', 'V', 'dominante', { siguiente: 'I' })).toBeNull();
  });

  it('suena con séptima, la secundaria y también el V de siempre', () => {
    // Una dominante que se pone delante es una dominante: sin la séptima, el texto
    // decía «con séptima» encima de una tríada.
    expect(especieDelMovimiento('dominante', 'V/vi')).toBe('dominant7');
    expect(especieDelMovimiento('dominante', 'V')).toBe('dominant7');
    expect(especieDelMovimiento('relativo', 'vi')).toBeNull();
  });

  it('su porqué no promete una séptima que una canción de quintas no lleva', () => {
    expect(moveById('dominante')!.why).not.toContain('séptima');
  });
});

describe('el intercambio de especie', () => {
  it('se llama según hacia dónde va', () => {
    // «Cambia IV por iv (mayor por menor)»: lo que había, por lo que entra.
    expect(nombreDelCambio('major', 'intercambio', 'IV', 'iv')).toBe('Mayor por menor');
    expect(nombreDelCambio('major', 'intercambio', 'iv', 'IV')).toBe('Menor por mayor');
    expect(nombreDelCambio('minor', 'intercambio', 'v', 'V')).toBe('Menor por mayor');
    // Los que no tienen dirección se llaman como siempre.
    expect(nombreDelCambio('major', 'relativo', 'IV', 'ii')).toBe('Su relativo');
  });

  it('deja la fundamental y mueve la tercera', () => {
    expect(applyMove('minor', 'v', 'intercambio')).toBe('V');
    expect(applyMove('minor', 'V', 'intercambio')).toBe('v');
  });

  it('devuelve nulo cuando el catálogo no tiene ese grado con la otra especie', () => {
    // No hay un «i mayor» en el catálogo de menor: sería cambiar de tonalidad.
    expect(applyMove('minor', 'i', 'intercambio')).toBeNull();
  });
});

describe('isMove, que es lo que verifica al modelo', () => {
  it('confirma un movimiento cierto', () => {
    expect(isMove('major', 'V', 'bII', 'tritono')).toBe(true);
    expect(isMove('major', 'I', 'vi', 'relativo')).toBe(true);
  });

  it('rechaza un movimiento que no lo es, aunque los dos grados existan', () => {
    // Esto es lo que sostiene la fase: un modelo puede devolver un acorde
    // razonable con una explicación falsa, y la explicación falsa se cae.
    expect(isMove('major', 'V', 'IV', 'tritono')).toBe(false);
    expect(isMove('major', 'I', 'IV', 'relativo')).toBe(false);
  });

  it('mira el sitio cuando se le da', () => {
    expect(isMove('major', 'V', 'bII', 'tritono', { anterior: 'ii', siguiente: 'I' })).toBe(true);
    expect(isMove('major', 'V', 'bII', 'tritono', { anterior: 'ii', siguiente: 'IV' })).toBe(false);
  });

  it('un movimiento que no existe es falso, no un error', () => {
    expect(isMove('major', 'V', 'bII', 'toString')).toBe(false);
    expect(isMove('major', 'V', 'bII', 'brujeria')).toBe(false);
    expect(isMove('major', 'V', 'bII', null)).toBe(false);
    expect(isMove('major', 'V', 'bII', 42)).toBe(false);
  });
});

describe('lo que se puede poner en lugar del V', () => {
  it('sus sustitutos, cada uno con su porqué', () => {
    const destinos = MOVES.flatMap((move) => applyMove('major', 'V', move.id) ?? []);

    // Sin la interrumpida, que ahora se le hace a la tónica que el V promete; con
    // el vii°, que es la misma dominante sin fundamental, y con el bVII, que es la
    // misma dominante sin sensible.
    expect(new Set(destinos.filter((grado) => grado !== 'V'))).toEqual(
      new Set(['iii', 'vii°', 'bVII', 'bII']),
    );
    expect(MOVES.every((move) => move.why.length > 0)).toBe(true);
  });
});

describe('la dominante con sensible y sin ella', () => {
  it('el V y el séptimo grado rebajado se cambian en los dos sentidos', () => {
    expect(applyMove('major', 'V', 'modal')).toBe('bVII');
    expect(applyMove('major', 'bVII', 'modal')).toBe('V');
    expect(applyMove('minor', 'V', 'modal')).toBe('VII');
    expect(applyMove('minor', 'VII', 'modal')).toBe('V');
    // Solo entre esos dos: lo demás no tiene la otra manera de tirar a casa.
    expect(applyMove('major', 'IV', 'modal')).toBeNull();
    expect(applyMove('minor', 'v', 'modal')).toBeNull();
    expect(isMove('major', 'V', 'bVII', 'modal')).toBe(true);
    expect(especieDelMovimiento('modal', 'bVII')).toBeNull();
  });

  it('se llama según adónde va: sin sensible, o con ella', () => {
    expect(nombreDelCambio('major', 'modal', 'V', 'bVII')).toBe('Sin sensible');
    expect(nombreDelCambio('major', 'modal', 'bVII', 'V')).toBe('Con sensible');
    expect(nombreDelCambio('minor', 'modal', 'VII', 'V')).toBe('Con sensible');
    // En quintas no hay sensible que ganar ni perder: se dice qué cambia.
    expect(nombreDelCambio('major', 'modal', 'V', 'bVII', 'quinta')).toBe('bVII en lugar de V');
  });
});

describe('el napolitano hace de subdominante', () => {
  it('el bII del menor cambia por el iv, que comparte el Re y el Fa y empuja igual', () => {
    expect(applyMove('minor', 'bII', 'funcion')).toBe('iv');
    // Al revés no: el iv tiene su pareja dentro de la escala, la ii°.
    expect(applyMove('minor', 'iv', 'funcion')).toBe('ii°');
    // En mayor el bII no comparte dos notas con nada de la escala que haga su papel.
    expect(applyMove('major', 'bII', 'funcion')).toBeNull();
  });
});

describe('el catálogo entero', () => {
  it('todo lo que sale de un movimiento es un grado que existe en ese modo', () => {
    // Es lo que evita que una versión llegue a la pantalla con un grado que
    // `resolveDegree` no sabe pintar y reviente al dibujarla.
    for (const mode of ['major', 'minor'] as const) {
      const validos = new Set<string>(degreesFor(mode));
      for (const degree of degreesFor(mode)) {
        for (const move of MOVES) {
          const salida = applyMove(mode, degree, move.id);
          if (salida !== null) {
            expect(validos).toContain(salida);
          }
        }
      }
    }
  });

  it('cada movimiento tiene nombre y porqué, y se encuentra por su id', () => {
    for (const move of MOVES) {
      expect(moveById(move.id)).toBe(move);
      expect(move.name).not.toBe('');
      expect(move.why).not.toBe('');
    }
    expect(moveById('brujeria')).toBeNull();
  });

  it('un grado de mayor aplicado a una canción menor no revienta', () => {
    // `resolveDegree` lanza RangeError con un grado que no existe en el modo, y
    // eso llegaría desde una versión mal formada del modelo.
    for (const move of MOVES) {
      expect(() => applyMove('minor', 'IV' as DegreeSymbol, move.id as MoveId)).not.toThrow();
    }
  });
});

describe('ninguna sustitucion lleva al mismo sitio', () => {
  /**
   * Proponer cambiar un acorde por sí mismo no es una sustitución: es una
   * casilla que se pulsa y no hace nada. Pasa cuando el catálogo solo tiene uno
   * de los dos lados —el tritono de un grado cuyo par no está escrito—, así que
   * se comprueba grado a grado en los dos modos.
   */
  it('en ninguno de los dos modos, para ningun grado', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const degree of degreesFor(mode)) {
        for (const move of MOVES) {
          expect(applyMove(mode, degree, move.id), `${mode} ${degree} por ${move.id}`).not.toBe(
            degree,
          );
        }
      }
    }
  });
});

/**
 * La predominante delante de la dominante: el compás que no preparaba nada pasa a
 * ser una subdominante, y la frase queda en tónica, subdominante, dominante.
 */
describe('la predominante delante', () => {
  it('en mayor, el IV donde había tónica y el ii donde había dominante', () => {
    // `I I V I` → `I IV V I`: el IV conserva el Do del I.
    expect(applyMove('major', 'I', 'predominante', { anterior: 'I', siguiente: 'V' })).toBe('IV');
    // `I V V I` → `I ii V I`: el ii conserva el Re del V, y llega por quintas.
    expect(applyMove('major', 'V', 'predominante', { siguiente: 'V' })).toBe('ii');
    expect(applyMove('major', 'vi', 'predominante', { siguiente: 'V' })).toBe('IV');
    // El iii no comparte nada con ninguno: va el ii, que está una quinta por encima del V.
    expect(applyMove('major', 'iii', 'predominante', { siguiente: 'V' })).toBe('ii');
  });

  it('en menor, el iv donde había tónica y la ii° donde había dominante', () => {
    expect(applyMove('minor', 'i', 'predominante', { siguiente: 'V' })).toBe('iv');
    // El VI de la andaluza ya baja medio tono al V: ya lo prepara, y no se toca.
    expect(applyMove('minor', 'VI', 'predominante', { siguiente: 'V' })).toBeNull();
    expect(applyMove('major', 'bVI', 'predominante', { siguiente: 'V' })).toBeNull();
    expect(applyMove('minor', 'III', 'predominante', { siguiente: 'V' })).toBe('ii°');
    expect(applyMove('minor', 'V', 'predominante', { siguiente: 'V' })).toBe('ii°');
    // Delante de la v del menor natural también: `i i v i` → `i iv v i`.
    expect(applyMove('minor', 'i', 'predominante', { siguiente: 'v' })).toBe('iv');
  });

  it('las dos subdominantes son verdad, y se ofrecen las dos', () => {
    expect(destinosDelMovimiento('major', 'I', 'predominante', { siguiente: 'V' })).toEqual([
      'IV',
      'ii',
    ]);
    expect(destinosDelMovimiento('minor', 'V', 'predominante', { siguiente: 'V' })).toEqual([
      'ii°',
      'iv',
    ]);
    expect(isMove('major', 'I', 'ii', 'predominante', { siguiente: 'V' })).toBe(true);
    expect(isMove('major', 'I', 'IV', 'predominante', { siguiente: 'V' })).toBe(true);
    expect(isMove('major', 'I', 'vi', 'predominante', { siguiente: 'V' })).toBe(false);
  });

  it('suena como se toca, en varias tonalidades', () => {
    const en = (tonica: NoteName, mode: KeyMode, grado: DegreeSymbol) =>
      cifrado(tonica, mode, applyMove(mode, grado, 'predominante', { siguiente: 'V' }));
    expect(en('G', 'major', 'I')).toBe('C');
    expect(en('Eb', 'major', 'V')).toBe('Fm');
    expect(en('D', 'minor', 'i')).toBe('Gm');
    expect(en('E', 'minor', 'V')).toBe('F#dim');
  });

  it('no tuerce una llegada: la tónica a la que llega una dominante se queda', () => {
    expect(applyMove('major', 'I', 'predominante', { anterior: 'V', siguiente: 'V' })).toBeNull();
    expect(applyMove('minor', 'i', 'predominante', { anterior: 'v', siguiente: 'V' })).toBeNull();
    expect(applyMove('major', 'I', 'predominante', { anterior: null, siguiente: 'V' })).toBe('IV');
    // Después del IV, el ii, que se adelanta; el IV sería repetirlo.
    expect(
      destinosDelMovimiento('major', 'I', 'predominante', { anterior: 'IV', siguiente: 'V' }),
    ).toEqual(['ii']);
    // Después del ii nada: el IV volvería atrás dentro de la misma función.
    expect(applyMove('major', 'V', 'predominante', { anterior: 'ii', siguiente: 'V' })).toBeNull();
    expect(applyMove('minor', 'V', 'predominante', { anterior: 'ii°', siguiente: 'V' })).toBeNull();
    expect(
      destinosDelMovimiento('minor', 'i', 'predominante', { anterior: 'iv', siguiente: 'V' }),
    ).toEqual(['ii°']);
  });

  it('solo delante de la dominante, y solo lo que no prepara ya', () => {
    expect(applyMove('major', 'I', 'predominante')).toBeNull();
    expect(applyMove('major', 'I', 'predominante', { siguiente: null })).toBeNull();
    expect(applyMove('major', 'I', 'predominante', { siguiente: 'IV' })).toBeNull();
    // La v no es del catálogo de mayor: no hay delante de qué.
    expect(applyMove('major', 'I', 'predominante', { siguiente: 'v' })).toBeNull();
    // Lo que ya es subdominante, o una secundaria, ya prepara.
    expect(applyMove('major', 'ii', 'predominante', { siguiente: 'V' })).toBeNull();
    expect(applyMove('major', 'V/V', 'predominante', { siguiente: 'V' })).toBeNull();
    expect(applyMove('major', 'bVII', 'predominante', { siguiente: 'V' })).toBeNull();
    // Un grado de mayor en una canción menor no revienta: calla.
    expect(applyMove('minor', 'IV', 'predominante', { siguiente: 'V' })).toBeNull();
  });

  it('no pide especie: la séptima la pone el idioma de la canción', () => {
    expect(especieDelMovimiento('predominante', 'ii')).toBeNull();
    expect(nombreDelCambio('major', 'predominante', 'I', 'IV')).toBe('Predominante delante');
  });
});

/** El cambio rápido: el IV en el compás 2 de un blues, que vuelve a la I en el 3. */
describe('el cambio rápido del blues', () => {
  const enElDos: Entorno = { anterior: 'I', siguiente: 'I', compasDelBlues: 1 };
  const enElDosMenor: Entorno = { anterior: 'i', siguiente: 'i', compasDelBlues: 1 };

  it('pone el cuarto en el compás 2, y lo quita', () => {
    expect(applyMove('major', 'I', 'cambio-rapido', enElDos)).toBe('IV');
    expect(applyMove('major', 'IV', 'cambio-rapido', enElDos)).toBe('I');
    expect(applyMove('minor', 'i', 'cambio-rapido', enElDosMenor)).toBe('iv');
    expect(applyMove('minor', 'iv', 'cambio-rapido', enElDosMenor)).toBe('i');
  });

  it('suena como se toca: el D de un blues en La, el Fm de uno en Do menor', () => {
    expect(cifrado('A', 'major', applyMove('major', 'I', 'cambio-rapido', enElDos))).toBe('D');
    expect(cifrado('C', 'minor', applyMove('minor', 'i', 'cambio-rapido', enElDosMenor))).toBe(
      'Fm',
    );
  });

  it('solo en el 2 de un blues, entre dos tónicas', () => {
    // Sin saber que es un blues, `I I I` es igual en cualquier canción.
    expect(applyMove('major', 'I', 'cambio-rapido', { anterior: 'I', siguiente: 'I' })).toBeNull();
    expect(applyMove('major', 'I', 'cambio-rapido', { ...enElDos, compasDelBlues: 2 })).toBeNull();
    expect(
      applyMove('major', 'I', 'cambio-rapido', { ...enElDos, compasDelBlues: null }),
    ).toBeNull();
    expect(applyMove('major', 'I', 'cambio-rapido', { ...enElDos, siguiente: 'IV' })).toBeNull();
    expect(applyMove('major', 'I', 'cambio-rapido', { ...enElDos, anterior: 'V' })).toBeNull();
    expect(applyMove('major', 'V', 'cambio-rapido', enElDos)).toBeNull();
    expect(applyMove('major', 'I', 'cambio-rapido')).toBeNull();
  });

  it('se llama según si lo pone o lo quita, y no pide especie', () => {
    expect(nombreDelCambio('major', 'cambio-rapido', 'I', 'IV')).toBe('Cambio rápido');
    expect(nombreDelCambio('major', 'cambio-rapido', 'IV', 'I')).toBe('Sin cambio rápido');
    expect(nombreDelCambio('minor', 'cambio-rapido', 'iv', 'i')).toBe('Sin cambio rápido');
    expect(especieDelMovimiento('cambio-rapido', 'IV')).toBeNull();
  });
});

/**
 * El semitono frigio: el acorde mayor medio tono por encima del que le sigue, que
 * baja a él sin dominante. Es el VI que baja al V al final de la andaluza.
 */
describe('el semitono frigio', () => {
  it('delante del V de un menor, el VI: el final de la andaluza', () => {
    // `i VII iv V` → `i VII VI V`.
    expect(applyMove('minor', 'iv', 'frigio', { siguiente: 'V' })).toBe('VI');
    expect(applyMove('minor', 'VII', 'frigio', { siguiente: 'V' })).toBe('VI');
    // Y delante de la v, que con el Fa encima es el frigio de Mi de verdad.
    expect(applyMove('minor', 'i', 'frigio', { siguiente: 'v' })).toBe('VI');
  });

  it('delante de la tónica, el bII; delante del V de un mayor, el bVI', () => {
    expect(applyMove('minor', 'V', 'frigio', { siguiente: 'i' })).toBe('bII');
    expect(applyMove('minor', 'iv', 'frigio', { siguiente: 'i' })).toBe('bII');
    expect(applyMove('major', 'IV', 'frigio', { siguiente: 'V' })).toBe('bVI');
    expect(applyMove('major', 'ii', 'frigio', { siguiente: 'I' })).toBe('bII');
  });

  it('suena como se toca, en varias tonalidades', () => {
    expect(cifrado('A', 'minor', applyMove('minor', 'iv', 'frigio', { siguiente: 'V' }))).toBe('F');
    expect(cifrado('E', 'minor', applyMove('minor', 'iv', 'frigio', { siguiente: 'V' }))).toBe('C');
    expect(cifrado('C', 'major', applyMove('major', 'IV', 'frigio', { siguiente: 'V' }))).toBe(
      'Ab',
    );
    expect(cifrado('D', 'minor', applyMove('minor', 'V', 'frigio', { siguiente: 'i' }))).toBe('Eb');
  });

  it('solo delante de un centro, y si cambia algo', () => {
    expect(applyMove('minor', 'i', 'frigio', { siguiente: 'iv' })).toBeNull();
    expect(applyMove('major', 'I', 'frigio', { siguiente: 'vi' })).toBeNull();
    // Lo que ya es su semitono no cambia.
    expect(applyMove('minor', 'VI', 'frigio', { siguiente: 'V' })).toBeNull();
    // La v no es del catálogo de mayor.
    expect(applyMove('major', 'I', 'frigio', { siguiente: 'v' })).toBeNull();
    expect(applyMove('minor', 'IV', 'frigio', { siguiente: 'V' })).toBeNull();
    expect(applyMove('minor', 'iv', 'frigio')).toBeNull();
    expect(applyMove('minor', 'iv', 'frigio', { siguiente: null })).toBeNull();
  });

  it('es un acorde mayor, sin especie que pedir', () => {
    expect(especieDelMovimiento('frigio', 'VI')).toBeNull();
    expect(nombreDelCambio('minor', 'frigio', 'iv', 'VI')).toBe('Semitono frigio');
  });
});

describe('partir en ii–V no es un cambio de grado', () => {
  it('aquí no tiene destino: lo comprueba `partir.ts`', () => {
    expect(applyMove('major', 'V', 'ii-v', { siguiente: 'I' })).toBeNull();
    expect(destinosDelMovimiento('major', 'V', 'ii-v')).toEqual([]);
    expect(isMove('major', 'V', 'ii', 'ii-v')).toBe(false);
    expect(especieDelMovimiento('ii-v', 'ii')).toBeNull();
    expect(nombreDelCambio('major', 'ii-v', 'V', 'ii')).toBe('Partir la dominante');
  });
});

/** Los cuatro que dependen del sitio de la forma. */
const NUEVOS = MOVES.filter((move) =>
  ['predominante', 'ii-v', 'cambio-rapido', 'frigio'].includes(move.id),
);

describe('los movimientos que dependen de la forma', () => {
  it('son cuatro, y sin entorno el catálogo no los enseña', () => {
    expect(NUEVOS).toHaveLength(4);
    for (const mode of ['major', 'minor'] as const) {
      for (const degree of degreesFor(mode)) {
        for (const move of NUEVOS) {
          expect(applyMove(mode, degree, move.id), `${mode} ${degree} por ${move.id}`).toBeNull();
        }
      }
    }
    expect(destinosDelMovimiento('major', 'V', 'brujeria')).toEqual([]);
  });

  it('el porqué de la predominante no promete una séptima', () => {
    expect(moveById('predominante')!.why).not.toMatch(/séptima|ii7|ø/u);
  });

  it('todo lo que sale es un grado del modo, distinto del que había', () => {
    for (const mode of ['major', 'minor'] as const) {
      const validos = new Set<string>(degreesFor(mode));
      for (const degree of degreesFor(mode)) {
        for (const vecino of degreesFor(mode)) {
          const entornos: Entorno[] = [
            { anterior: vecino, siguiente: vecino, compasDelBlues: 1 },
            { anterior: null, siguiente: vecino },
          ];
          for (const entorno of entornos) {
            for (const { id } of NUEVOS) {
              for (const destino of destinosDelMovimiento(mode, degree, id, entorno)) {
                expect(validos, `${mode} ${degree} ${id}`).toContain(destino);
                expect(destino, `${mode} ${degree} ${id}`).not.toBe(degree);
              }
            }
          }
        }
      }
    }
  });

  it('un grado de mayor aplicado a una canción menor no revienta', () => {
    for (const { id } of NUEVOS) {
      expect(() =>
        applyMove('minor', 'IV' as DegreeSymbol, id, { siguiente: 'IV' as DegreeSymbol }),
      ).not.toThrow();
    }
  });
});
