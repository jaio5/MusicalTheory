// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { Profiler, memo, type ComponentProps } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_ARRANGEMENT, pitchClassFromName } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { ArrangeCanvas } from './ArrangeCanvas';
import { crearCabezal } from './cabezal';
import type * as FilaReal from './PartRow';

/**
 * **Cuántas veces se pinta cada fila**, que es lo que ningún otro test mira.
 *
 * `PartRow` va con `memo` y lo que le pasa el lienzo tiene que ser lo mismo de un
 * pintado a otro: una flecha nueva escrita en el lienzo lo anula **sin que falle
 * nada**, y las filas se repintan todas con sus pentagramas
 * ([adr/0059](../../../docs/adr/0059-memo-a-mano-y-no-el-compilador.md)). Aquí se
 * envuelve cada fila en un `<Profiler>` —con el mismo `memo` delante, que es lo
 * que decide si la fila se pinta— y se cuentan los pintados de cada una.
 */
const pintados: string[] = [];

vi.mock('./PartRow', async (importOriginal) => {
  const real = await importOriginal<typeof FilaReal>();
  const Contada = memo(function Contada(props: ComponentProps<typeof real.PartRow>) {
    return (
      <Profiler id={props.part.name} onRender={(id) => pintados.push(id)}>
        <real.PartRow {...props} />
      </Profiler>
    );
  });
  return { ...real, PartRow: Contada };
});

/**
 * El reproductor, con un cabezal que se mueve a mano: es lo que hace sonar
 * «otro bloque» sin un `AudioContext`, que jsdom no tiene.
 */
const cabezal = crearCabezal();
const reproductor = {
  playing: true,
  playingPartId: null,
  cabezal,
  toggle: vi.fn(),
  stop: vi.fn(),
};
vi.mock('./use-arrangement-player', () => ({ useArrangementPlayer: () => reproductor }));

const veces = (parte: string) => pintados.filter((id) => id === parte).length;

beforeEach(() => {
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
  useSessionStore.getState().actions.reset();
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  cabezal.cambiarA(null);
});

function dosPartes() {
  const acciones = useArrangementStore.getState().actions;
  const estrofa = acciones.addPart('Estrofa');
  const estribillo = acciones.addPart('Estribillo');
  const enLaEstrofa = acciones.addBlock(estrofa, 'I', 4);
  acciones.addBlock(estrofa, 'IV', 4);
  const enElEstribillo = acciones.addBlock(estribillo, 'V', 4);
  render(<ArrangeCanvas />);
  pintados.length = 0;
  return { estrofa, enLaEstrofa, enElEstribillo };
}

describe('Lo que se repinta', () => {
  it('cambiar una parte no repinta la otra', () => {
    const { estrofa } = dosPartes();

    act(() => {
      useArrangementStore.getState().actions.addBlock(estrofa, 'V', 4);
    });

    expect(veces('Estrofa')).toBeGreaterThan(0);
    expect(veces('Estribillo')).toBe(0);
  });

  it('elegir un acorde solo repinta su fila', () => {
    const { enLaEstrofa } = dosPartes();

    act(() => useArrangementStore.getState().actions.elegirBloque(enLaEstrofa));

    expect(veces('Estrofa')).toBe(1);
    expect(veces('Estribillo')).toBe(0);
  });

  /**
   * Lo que suena **ni siquiera pasa por el lienzo**: cada fila se suscribe al
   * cabezal, y solo se repinta la que tiene el bloque. Avanzar dentro de una
   * parte no toca la otra, y saltar de una a otra pinta las dos —la que se
   * apaga y la que se enciende— y una vez cada una.
   */
  it('al sonar otro bloque solo se repinta la fila donde suena', () => {
    const { enLaEstrofa, enElEstribillo } = dosPartes();

    act(() => cabezal.cambiarA(enLaEstrofa));
    expect(veces('Estrofa')).toBe(1);
    expect(veces('Estribillo')).toBe(0);

    act(() => cabezal.cambiarA(enElEstribillo));
    expect(veces('Estrofa')).toBe(2);
    expect(veces('Estribillo')).toBe(1);
  });
});

/**
 * **El alto de una caja no repinta lo que reparte a lo ancho.**
 *
 * El lienzo y cada pentagrama miden la caja que envuelve lo que pintan, y esa
 * caja crece a lo alto con lo pintado. Midiendo las dos cosas, cada cambio de
 * ancho traía un segundo aviso por el alto nuevo y un segundo pintado de todo,
 * que es lo que pasa en cada fotograma al arrastrar un divisor del banco.
 */
describe('Lo que se repinta al cambiar de tamaño', () => {
  /** Todos los observadores que se crean, para avisarlos a mano. */
  const avisos: Array<(entradas: unknown[]) => void> = [];
  class ObservadorDeMentira {
    constructor(callback: (entradas: unknown[]) => void) {
      avisos.push(callback);
    }
    observe(): void {}
    disconnect(): void {}
  }
  const medir = (width: number, height: number) =>
    act(() => avisos.forEach((avisar) => avisar([{ contentRect: { width, height } }])));

  it('un cambio de alto sin cambio de ancho no pinta nada', () => {
    avisos.length = 0;
    vi.stubGlobal('ResizeObserver', ObservadorDeMentira);
    try {
      const lienzo: string[] = [];
      const acciones = useArrangementStore.getState().actions;
      const estrofa = acciones.addPart('Estrofa');
      acciones.addBlock(estrofa, 'I', 4);
      acciones.addNote(estrofa, 0, 0, 1);
      render(
        <Profiler id="lienzo" onRender={(id) => lienzo.push(id)}>
          <ArrangeCanvas />
        </Profiler>,
      );
      // El lienzo y al menos un pentagrama miden su caja.
      expect(avisos.length).toBeGreaterThanOrEqual(2);
      medir(900, 200);
      lienzo.length = 0;
      pintados.length = 0;

      medir(900, 420);

      expect(lienzo).toHaveLength(0);
      expect(veces('Estrofa')).toBe(0);

      // Y un ancho nuevo sí se pinta: lo de arriba no es que no llegue nada.
      medir(700, 420);
      expect(lienzo.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
