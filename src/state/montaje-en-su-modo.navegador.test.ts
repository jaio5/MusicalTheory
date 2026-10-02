// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_ARRANGEMENT } from '@core/music';

import { useArrangementStore } from './arrangement-store';
import { useSessionStore } from './session-store';

/**
 * La vigilancia del modo, en el navegador: **puesta sin que la pida nadie**.
 *
 * Estuvo en un efecto de la pantalla de componer, y fuera de ella el montaje se
 * quedaba en el modo viejo. Reproducido en un navegador de verdad: cuatro
 * bloques en Do mayor, una unidad, La menor en su rueda, y al volver a componer
 * «This page couldn't load» con `El grado IV no existe en tonalidad minor`.
 *
 * Aquí no se monta ninguna pantalla ni se llama a `vigilarElModoDelMontaje`: lo
 * que se prueba es que basta con que exista el almacén.
 */

const acciones = () => useArrangementStore.getState().actions;
const grados = () =>
  useArrangementStore.getState().arrangement.parts[0]?.blocks.map((b) => b.degree);

beforeEach(() => {
  useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
});

describe('sin ninguna pantalla montada', () => {
  it('cambiar de modo traduce el montaje que hay en memoria', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'IV', 4);

    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });

    expect(grados()).toEqual(['i', 'iv']);
  });

  it('y una canción que se abre en el otro modo llega ya traducida', () => {
    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });

    acciones().replace({
      parts: [
        {
          id: 'estrofa',
          name: 'Estrofa',
          blocks: [
            { id: 'a', degree: 'IV', beats: 4, source: 'written', confidence: 1, alternatives: [] },
          ],
          notes: [],
          bars: 4,
        },
      ],
    });

    expect(grados()).toEqual(['iv']);
  });
});
