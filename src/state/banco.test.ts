// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { useBancoStore } from './banco';
import { DEFAULT_BANCO, loadPreferences, savePreferences, TOPES_DEL_BANCO } from './workspace';

/**
 * El reparto del banco de trabajo.
 *
 * Lo que se prueba aquí no son los números: es **que el reparto se recuerda sin
 * llevarse por delante lo demás**, y que lo guardado por una versión anterior
 * —o por alguien con la consola abierta— no deja la pantalla rota.
 */

const acciones = () => useBancoStore.getState().actions;

beforeEach(() => {
  localStorage.clear();
  useBancoStore.setState({
    espacio: DEFAULT_BANCO.espacio,
    izquierda: DEFAULT_BANCO.izquierda,
    derecha: DEFAULT_BANCO.derecha,
    abajo: null,
    alto: DEFAULT_BANCO.alto,
    plegadaIzquierda: false,
    plegadaDerecha: false,
  });
});

describe('mover un area', () => {
  it('se recuerda de una vez para otra', () => {
    acciones().mover('izquierda', 26);

    expect(loadPreferences().banco.izquierda).toBe(26);
  });

  it('se acota, que un ancho de nueve mil tapa la pantalla', () => {
    acciones().mover('izquierda', 9000);

    expect(useBancoStore.getState().izquierda).toBe(TOPES_DEL_BANCO.izquierda.max);
  });

  it('y el doble clic la devuelve a la de fabrica', () => {
    acciones().mover('derecha', 30);
    acciones().devolver('derecha');

    expect(useBancoStore.getState().derecha).toBe(DEFAULT_BANCO.derecha);
  });
});

describe('el area de abajo', () => {
  it('pulsar la que ya esta abierta la cierra', () => {
    acciones().abrirAbajo('mastil');
    expect(useBancoStore.getState().abajo).toBe('mastil');

    acciones().abrirAbajo('mastil');
    expect(useBancoStore.getState().abajo).toBeNull();
  });

  // Un editor renombrado o retirado deja el area cerrada, no abierta y vacia.
  it('un editor que ya no existe no abre nada', () => {
    savePreferences({
      ...loadPreferences(),
      banco: { ...DEFAULT_BANCO, abajo: 'una-pestana-que-ya-no-esta' },
    });

    acciones().cargar();

    expect(useBancoStore.getState().abajo).toBeNull();
  });
});

/**
 * La razón por la que `remember` parte de lo guardado: en esa clave viven el
 * estilo, la escala, la afinación y la tonalidad, y este almacén no los conoce.
 * Sin eso, mover un divisor borraba en qué tonalidad estabas.
 */
describe('guardar el reparto no pisa el resto', () => {
  it('la tonalidad y la escala siguen ahi despues de mover un divisor', () => {
    savePreferences({
      ...loadPreferences(),
      scaleId: 'dorian',
      pinnedKey: { tonic: 9, mode: 'minor' },
    });

    acciones().mover('alto', 20);

    const guardado = loadPreferences();
    expect(guardado.scaleId).toBe('dorian');
    expect(guardado.pinnedKey).toEqual({ tonic: 9, mode: 'minor' });
    expect(guardado.banco.alto).toBe(20);
  });
});

describe('plegar una columna', () => {
  // A diferencia de los anchos, plegar es un gesto de un momento: no se guarda,
  // para no encontrarte la pantalla a medias manana sin acordarte de por que.
  it('no se recuerda', () => {
    acciones().plegar('izquierda');

    expect(useBancoStore.getState().plegadaIzquierda).toBe(true);
    expect(loadPreferences().banco).toEqual(DEFAULT_BANCO);
  });
});
