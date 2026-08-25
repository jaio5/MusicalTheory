import { describe, expect, it } from 'vitest';

import { degreesFor, type DegreeSymbol } from './progressions';
import {
  applyMove,
  isMove,
  moveById,
  MOVES,
  reharmonizationsFor,
  type MoveId,
} from './reharmonization';

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

describe('la sustitución tritonal', () => {
  it('cambia la dominante por la que está a un tritono', () => {
    // En Do mayor: G se cambia por Db, que es el bII.
    expect(applyMove('major', 'V', 'tritono')).toBe('bII');
    expect(applyMove('minor', 'V', 'tritono')).toBe('bII');
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
});

describe('la cadencia interrumpida', () => {
  it('la dominante entrega el relativo de la tónica en vez de la tónica', () => {
    expect(applyMove('major', 'V', 'interrumpida')).toBe('vi');
    expect(applyMove('minor', 'V', 'interrumpida')).toBe('III');
    expect(applyMove('minor', 'v', 'interrumpida')).toBe('III');
  });

  it('solo se le hace a lo que empuja: lo demás no promete nada que romper', () => {
    expect(applyMove('major', 'I', 'interrumpida')).toBeNull();
    expect(applyMove('major', 'IV', 'interrumpida')).toBeNull();
  });
});

describe('el intercambio de especie', () => {
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

  it('un movimiento que no existe es falso, no un error', () => {
    expect(isMove('major', 'V', 'bII', 'brujeria')).toBe(false);
    expect(isMove('major', 'V', 'bII', null)).toBe(false);
    expect(isMove('major', 'V', 'bII', 42)).toBe(false);
  });
});

describe('reharmonizationsFor', () => {
  it('enseña lo que se puede poner en lugar del V, con su porqué', () => {
    const cambios = reharmonizationsFor('major', 'V');

    expect(cambios.map((cambio) => cambio.to)).toEqual(['iii', 'vi', 'bII']);
    expect(cambios.every((cambio) => cambio.move.why.length > 0)).toBe(true);
  });

  it('no repite un destino al que llegan dos movimientos', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const degree of degreesFor(mode)) {
        const destinos = reharmonizationsFor(mode, degree).map((cambio) => cambio.to);
        expect(new Set(destinos).size).toBe(destinos.length);
      }
    }
  });

  it('nunca propone el mismo grado que ya había', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const degree of degreesFor(mode)) {
        expect(reharmonizationsFor(mode, degree).map((c) => c.to)).not.toContain(degree);
      }
    }
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
