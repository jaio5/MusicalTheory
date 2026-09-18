// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { useArrangementStore } from './arrangement-store';
import { usePropuestaStore } from './propuesta';
import { useSessionStore } from './session-store';

/**
 * Lo que el copiloto propone, mientras nadie lo ha aceptado.
 *
 * Lo que se prueba aquí es **la regla**, que es de producto y no de código:
 * nada entra en la canción sin que lo acepte una persona
 * ([adr/0033](../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md)).
 */

function parte(): string {
  return useArrangementStore.getState().actions.addPart('Estrofa');
}

function grados(): readonly string[] {
  return useArrangementStore
    .getState()
    .arrangement.parts.flatMap((p) => p.blocks.map((b) => b.degree));
}

beforeEach(() => {
  localStorage.clear();
  useArrangementStore.setState({ arrangement: { parts: [] }, past: [], selectedBlockId: null });
  usePropuestaStore.getState().acciones.descartar();
  useSessionStore.getState().actions.setTempo(100, 4);
});

describe('la propuesta del copiloto', () => {
  it('proponer no escribe ni un acorde', () => {
    const id = parte();

    usePropuestaStore.getState().acciones.proponer(id, ['vi', 'IV', 'I', 'V'], 'Bajar por tonos');

    expect(grados()).toEqual([]);
    expect(usePropuestaStore.getState().propuesta?.degrees).toEqual(['vi', 'IV', 'I', 'V']);
  });

  it('aceptar todo los escribe al final, en su orden', () => {
    const id = parte();
    usePropuestaStore.getState().acciones.proponer(id, ['vi', 'IV', 'I', 'V'], 'x');

    usePropuestaStore.getState().acciones.aceptarTodo();

    expect(grados()).toEqual(['vi', 'IV', 'I', 'V']);
    expect(usePropuestaStore.getState().propuesta).toBeNull();
  });

  // De uno en uno: se acepta lo que gusta y lo demás sigue propuesto.
  it('aceptar unos cuantos deja el resto propuesto', () => {
    const id = parte();
    usePropuestaStore.getState().acciones.proponer(id, ['vi', 'IV', 'I', 'V'], 'x');

    usePropuestaStore.getState().acciones.aceptar(2);

    expect(grados()).toEqual(['vi', 'IV']);
    expect(usePropuestaStore.getState().propuesta?.degrees).toEqual(['I', 'V']);
  });

  /**
   * Aceptar cuatro es **un paso de deshacer**, no cuatro: al arrepentirse se
   * piensa en la idea entera, no en el tercer acorde de la idea.
   */
  it('aceptar de golpe se deshace de una vez', () => {
    const id = parte();
    usePropuestaStore.getState().acciones.proponer(id, ['vi', 'IV', 'I', 'V'], 'x');
    usePropuestaStore.getState().acciones.aceptarTodo();

    useArrangementStore.getState().actions.undo();

    expect(grados()).toEqual([]);
  });

  it('descartar no deja rastro', () => {
    const id = parte();
    usePropuestaStore.getState().acciones.proponer(id, ['vi'], 'x');

    usePropuestaStore.getState().acciones.descartar();

    expect(usePropuestaStore.getState().propuesta).toBeNull();
    expect(grados()).toEqual([]);
  });

  // Hay una sola propuesta a la vez: dos listas de fantasmas en dos sitios
  // serían dos sitios donde mirar para una decisión que es una.
  it('proponer otra tira la anterior', () => {
    const id = parte();
    usePropuestaStore.getState().acciones.proponer(id, ['vi', 'IV'], 'primera');

    usePropuestaStore.getState().acciones.proponer(id, ['I'], 'segunda');

    expect(usePropuestaStore.getState().propuesta).toMatchObject({
      degrees: ['I'],
      titulo: 'segunda',
    });
  });

  it('lo aceptado queda elegido, que es de lo que habla la columna del acorde', () => {
    const id = parte();
    usePropuestaStore.getState().acciones.proponer(id, ['vi', 'IV'], 'x');

    usePropuestaStore.getState().acciones.aceptarTodo();

    const bloques = useArrangementStore.getState().arrangement.parts[0]!.blocks;
    expect(useArrangementStore.getState().selectedBlockId).toBe(bloques.at(-1)?.id);
  });

  it('cada acorde aceptado dura un compas', () => {
    useSessionStore.getState().actions.setTempo(100, 3);
    const id = parte();
    usePropuestaStore.getState().acciones.proponer(id, ['vi'], 'x');

    usePropuestaStore.getState().acciones.aceptarTodo();

    expect(useArrangementStore.getState().arrangement.parts[0]!.blocks[0]!.beats).toBe(3);
  });
});
