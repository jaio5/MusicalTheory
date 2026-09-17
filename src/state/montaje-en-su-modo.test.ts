import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_ARRANGEMENT } from '@core/music';

import { useArrangementStore } from './arrangement-store';
import { vigilarElModoDelMontaje } from './montaje-en-su-modo';
import { useSessionStore } from './session-store';

/**
 * Que el montaje siga al modo de la tonalidad.
 *
 * Esto no se prueba por gusto: sin la vigilancia, pulsar una tonalidad menor en
 * la rueda con cuatro bloques puestos **tumbaba la pantalla de componer entera**
 * —«This page couldn't load» encima del trabajo hecho—, porque el lienzo va a
 * resolver grados que en ese modo no existen y `resolveDegree` lanza.
 *
 * La acción que lo arregla llevaba tiempo escrita y probada en
 * `arrangement-store`, con un comentario que decía «lo llama el cambio de
 * rueda». No lo llamaba nadie. Estos tests son el enchufe.
 */

const acciones = () => useArrangementStore.getState().actions;
const grados = () =>
  useArrangementStore.getState().arrangement.parts[0]?.blocks.map((b) => b.degree);

beforeEach(() => {
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
  useSessionStore.getState().actions.followDetection();
});

describe('el montaje sigue al modo de la tonalidad', () => {
  it('al pasar la rueda a menor, los grados se dicen en menor', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'IV', 4);
    const dejarlo = vigilarElModoDelMontaje();

    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });

    expect(grados()).toEqual(['i', 'iv']);
    dejarlo();
  });

  /**
   * El aviso llega **dentro** del `set` de Zustand, antes de que React vuelva a
   * pintar. Es lo que hace que el lienzo no llegue a ver nunca los grados
   * viejos; con un `useEffect`, que corre después de pintar, ya sería tarde.
   */
  it('y queda hecho en cuanto la tonalidad cambia, sin esperar a nada', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'vi', 4);
    const dejarlo = vigilarElModoDelMontaje();

    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'minor' });
    // Sin `await`, sin timers: justo después de la llamada ya está.
    expect(grados()).toEqual(['VI']);
    dejarlo();
  });

  it('un montaje que se abre en el otro modo también se traduce', () => {
    const dejarlo = vigilarElModoDelMontaje();
    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });

    // `replace` es lo que hace abrir una canción guardada: mete grados de golpe,
    // y pueden venir escritos en el modo contrario.
    acciones().replace({
      parts: [
        {
          id: 'estrofa',
          name: 'Estrofa',
          blocks: [
            { id: 'a', degree: 'I', beats: 4, source: 'written', confidence: 1, alternatives: [] },
          ],
          notes: [],
          bars: 4,
        },
      ],
    });

    expect(grados()).toEqual(['i']);
    dejarlo();
  });

  it('volver a mayor devuelve los grados de mayor', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    const dejarlo = vigilarElModoDelMontaje();

    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });

    expect(grados()).toEqual(['I']);
    dejarlo();
  });

  it('al dejar de vigilar, deja de tocar el montaje', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    const dejarlo = vigilarElModoDelMontaje();
    dejarlo();

    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });

    expect(grados()).toEqual(['I']);
  });
});
