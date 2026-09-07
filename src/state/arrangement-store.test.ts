import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_ARRANGEMENT, arrangementLength, findBlock } from '@core/music';

import { MAX_UNDO, nuevoId, selectCanUndo, useArrangementStore } from './arrangement-store';

function acciones() {
  return useArrangementStore.getState().actions;
}

function montaje() {
  return useArrangementStore.getState().arrangement;
}

beforeEach(() => {
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
});

describe('nuevoId', () => {
  it('no se repite', () => {
    const ids = new Set(Array.from({ length: 200 }, () => nuevoId('b')));
    expect(ids.size).toBe(200);
  });
});

describe('montar', () => {
  it('una parte con bloques', () => {
    const parte = acciones().addPart('Estrofa');
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'V', 4);

    expect(montaje().parts[0]?.name).toBe('Estrofa');
    expect(montaje().parts[0]?.blocks.map((b) => b.degree)).toEqual(['I', 'V']);
  });

  it('devuelve el identificador de lo que crea, para poder seguir usándolo', () => {
    const parte = acciones().addPart();
    const bloque = acciones().addBlock(parte, 'I', 4);
    expect(findBlock(montaje(), bloque)?.part.id).toBe(parte);
  });

  it('lo grabado entra con sus duraciones y en una sola parte', () => {
    acciones().addRecorded(
      [
        { degree: 'I', beats: 8 },
        { degree: 'IV', beats: 4 },
      ],
      'Lo que has tocado',
    );
    expect(montaje().parts[0]?.blocks.map((b) => b.beats)).toEqual([8, 4]);
  });
});

describe('deshacer', () => {
  it('vuelve al montaje anterior', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'V', 4);

    acciones().undo();
    expect(arrangementLength(montaje())).toBe(1);
  });

  it('sin nada que deshacer no hace nada', () => {
    acciones().undo();
    expect(montaje()).toEqual(EMPTY_ARRANGEMENT);
    expect(selectCanUndo(useArrangementStore.getState())).toBe(false);
  });

  // Sin esto, deshacer un arrastre pide tantos pasos como veces pasó el puntero
  // por encima del mismo hueco.
  it('un cambio que no cambia nada no gasta un paso', () => {
    const parte = acciones().addPart();
    const bloque = acciones().addBlock(parte, 'I', 4);
    const antes = useArrangementStore.getState().past.length;

    acciones().moveBlock(bloque, 'no-existe', 0);
    acciones().removeBlock('tampoco-existe');

    expect(useArrangementStore.getState().past.length).toBe(antes);
  });

  it('la pila no crece sin fin', () => {
    const parte = acciones().addPart();
    for (let i = 0; i < MAX_UNDO + 10; i += 1) {
      acciones().addBlock(parte, 'I', 4);
    }
    expect(useArrangementStore.getState().past.length).toBe(MAX_UNDO);
  });

  // Una grabación entera es un gesto: se quita de una vez o no se quita.
  it('lo grabado se deshace de una vez', () => {
    acciones().addRecorded(
      [
        { degree: 'I', beats: 4 },
        { degree: 'V', beats: 4 },
      ],
      'Grabado',
    );
    acciones().undo();
    expect(montaje()).toEqual(EMPTY_ARRANGEMENT);
  });
});

describe('cambiar de modo', () => {
  it('deja fuera los grados que el modo nuevo no tiene', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'V', 4);

    acciones().keepMode('minor');
    expect(montaje().parts[0]?.blocks.map((b) => b.degree)).toEqual(['V']);
  });

  // Pasar de mayor a mayor, o de un montaje que ya cuadra, no es un cambio: si
  // gastara un paso, el deshacer se llenaría de pasos que no hicieron nada.
  it('si no se cae nada, no gasta un paso del deshacer', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'V', 4);
    const antes = useArrangementStore.getState().past.length;

    acciones().keepMode('minor');
    expect(useArrangementStore.getState().past.length).toBe(antes);
  });
});
