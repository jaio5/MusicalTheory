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
    const dejarlo = vigilarElModoDelMontaje(useArrangementStore);

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
    const dejarlo = vigilarElModoDelMontaje(useArrangementStore);

    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'minor' });
    // Sin `await`, sin timers: justo después de la llamada ya está.
    expect(grados()).toEqual(['VI']);
    dejarlo();
  });

  it('un montaje que se abre en el otro modo también se traduce', () => {
    const dejarlo = vigilarElModoDelMontaje(useArrangementStore);
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
    const dejarlo = vigilarElModoDelMontaje(useArrangementStore);

    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });

    expect(grados()).toEqual(['I']);
    dejarlo();
  });

  /**
   * La reproducción exacta del fallo, con la vigilancia puesta: C G Am F y un E7
   * en Do mayor, a Do menor y de vuelta. Quedaba `Cm | G | Ab | Fm` —el E7 se
   * caía sin avisar— y al volver `C | G | Ab | Fm`, con el deshacer atascado:
   * cada pulsación devolvía los grados de mayor, esto los traducía y apilaba
   * otra vez.
   */
  it('ir a menor y volver deja la canción como estaba, y el deshacer sigue', () => {
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });
    const dejarlo = vigilarElModoDelMontaje(useArrangementStore);
    const parte = acciones().addPart();
    for (const grado of ['I', 'V', 'vi', 'IV'] as const) {
      acciones().addBlock(parte, grado, 4);
    }
    acciones().addBlock(parte, 'V/vi', 4, null, 'dominant7');
    const escrita = useArrangementStore.getState().arrangement;
    const pila = useArrangementStore.getState().past.length;

    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'minor' });
    // El E7 sigue: en Do menor es la dominante del VI, el Eb7.
    expect(grados()).toEqual(['i', 'V', 'VI', 'iv', 'III']);

    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });
    expect(useArrangementStore.getState().arrangement).toEqual(escrita);
    // Ir y volver no ha gastado ni un paso.
    expect(useArrangementStore.getState().past.length).toBe(pila);

    // Y deshacer deshace lo último que se escribió: el E7.
    acciones().undo();
    expect(grados()).toEqual(['I', 'V', 'vi', 'IV']);
    dejarlo();
  });

  /**
   * Deshacer en menor lo que se escribió en mayor: el montaje de antes sale con
   * sus grados de mayor, la vigilancia lo traduce al vuelo y **la pila baja**,
   * que es lo que no pasaba.
   */
  it('deshacer en el otro modo deshace, y no se queda atascado', () => {
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });
    const dejarlo = vigilarElModoDelMontaje(useArrangementStore);
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'vi', 4);
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'minor' });
    const pila = useArrangementStore.getState().past.length;

    acciones().undo();

    expect(grados()).toEqual(['i']);
    expect(useArrangementStore.getState().past.length).toBe(pila - 1);
    dejarlo();
  });

  it('al dejar de vigilar, deja de tocar el montaje', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    const dejarlo = vigilarElModoDelMontaje(useArrangementStore);
    dejarlo();

    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });

    expect(grados()).toEqual(['I']);
  });

  /**
   * **Este fichero corre en `node`**, que es lo que ve el servidor: allí el
   * almacén es uno para todas las peticiones y no se apunta a nadie solo. La
   * vigilancia que se pone sola es la del navegador
   * (`montaje-en-su-modo.navegador.test.ts`).
   */
  it('sin navegador, nadie vigila si no se le pide', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);

    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });

    expect(grados()).toEqual(['I']);
  });
});
