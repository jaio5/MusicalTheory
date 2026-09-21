// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BANCO,
  DEFAULT_PREFERENCES,
  loadPreferences,
  parsePreferences,
  REPARTOS_DE_FABRICA,
} from './workspace';

describe('Preferencias', () => {
  it('recupera estilo, escala y afinación', () => {
    expect(parsePreferences({ styleId: 'blues', scaleId: 'dorian', tuningId: 'dropD' })).toEqual({
      styleId: 'blues',
      scaleId: 'dorian',
      tuningId: 'dropD',
      pinnedKey: null,
      banco: DEFAULT_BANCO,
    });
  });

  /**
   * Y la tonalidad, que llegó tarde y era la que más falta hacía: sin ella no
   * hay acordes, ni escala que enseñar, ni preguntas que generar, así que las
   * cinco pantallas volvían a pedirla en cada recarga.
   */
  it('recupera la tonalidad que habías dejado puesta', () => {
    expect(parsePreferences({ pinnedKey: { tonic: 7, mode: 'minor' } }).pinnedKey).toEqual({
      tonic: 7,
      mode: 'minor',
    });
  });

  /**
   * La tonalidad se comprueba de verdad, a diferencia del estilo o la escala.
   *
   * Esos son cadenas que, si están mal, dejan un desplegable sin seleccionar y
   * poco más. Una tónica fuera de 0-11 se cuela en `scaleNotes`, en la rueda y en
   * el generador de preguntas, y de ahí sale una pantalla rota con un `NaN` en
   * medio. Lo que no cuadra se descarta y se vuelve a seguir la detección.
   */
  it.each([
    ['una tónica fuera de la octava', { tonic: 12, mode: 'major' }],
    ['una tónica negativa', { tonic: -1, mode: 'major' }],
    ['una tónica con decimales', { tonic: 3.5, mode: 'major' }],
    ['un modo que no existe', { tonic: 0, mode: 'frigio' }],
    ['una tónica que no es número', { tonic: '0', mode: 'major' }],
    ['un objeto vacío', {}],
    ['una lista', [0, 'major']],
    ['texto suelto', 'C mayor'],
  ])('descarta %s y vuelve a la detección', (_que, guardado) => {
    expect(parsePreferences({ pinnedKey: guardado }).pinnedKey).toBeNull();
  });

  it('ignora lo que ya no guarda, como la pantalla', () => {
    expect(parsePreferences({ screen: 'banco', styleId: 'blues' })).toEqual({
      ...DEFAULT_PREFERENCES,
      styleId: 'blues',
    });
  });

  it('con basura, se queda con lo de fábrica', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences([1, 2, 3])).toEqual(DEFAULT_PREFERENCES);
  });

  /**
   * El reparto se lee medida a medida y no de golpe: si un día se añade un área
   * más, lo guardado por la versión anterior sigue valiendo para las que ya
   * había. Descartarlo entero convertiría cada campo nuevo en un reparto perdido
   * para todo el mundo.
   */
  it('del reparto guardado se queda lo que vale y lo demas sale de fabrica', () => {
    const banco = parsePreferences({
      banco: {
        espacio: 'inventado',
        repartos: { escribir: { izquierda: 26, derecha: 'ancha', plegadas: ['inventada'] } },
      },
    }).banco;

    expect(banco.repartos.escribir.izquierda).toBe(26);
    expect(banco.repartos.escribir.derecha).toBe(REPARTOS_DE_FABRICA.escribir.derecha);
    expect(banco.repartos.escribir.plegadas).toEqual([]);
    expect(banco.espacio).toBe(DEFAULT_BANCO.espacio);
    // Y los espacios que no venían guardados salen de fábrica, no vacíos.
    expect(banco.repartos.tocando).toEqual(REPARTOS_DE_FABRICA.tocando);
  });
});

describe('un reparto guardado con la forma cambiada', () => {
  /**
   * Lo guardado puede venir de una versión vieja o de alguien que lo editó a
   * mano. Se acota al leer y no solo al escribir: un ancho de nueve mil deja un
   * área que tapa la pantalla y ningún divisor a mano para arreglarlo.
   */
  function leer(banco: unknown) {
    localStorage.setItem('caos-ordenado:workspace', JSON.stringify({ banco }));
    return loadPreferences().banco;
  }

  it('unos repartos que no son un objeto se leen de fabrica', () => {
    expect(leer({ espacio: 'escribir', repartos: ['uno'] }).repartos).toEqual(
      DEFAULT_BANCO.repartos,
    );
    expect(leer({ espacio: 'escribir', repartos: 'ninguno' }).repartos).toEqual(
      DEFAULT_BANCO.repartos,
    );
  });

  it('y un espacio que no existe, el de siempre', () => {
    expect(leer({ espacio: 'inventado', repartos: {} }).espacio).toBe(DEFAULT_BANCO.espacio);
  });

  // Un área plegada que no existe se cae; el resto se queda.
  it('un area plegada inventada se cae', () => {
    const reparto = leer({
      espacio: 'escribir',
      repartos: { escribir: { plegadas: ['izquierda', 'inventada', 'izquierda'] } },
    }).repartos.escribir;

    expect(reparto.plegadas).toEqual(['izquierda']);
  });

  // Y unas plegadas que no son una lista dejan las de fábrica.
  it('unas plegadas que no son lista dejan las de fabrica', () => {
    const reparto = leer({
      espacio: 'escribir',
      repartos: { escribir: { plegadas: 'todas', abajo: '' } },
    }).repartos.escribir;

    expect(reparto.plegadas).toEqual(REPARTOS_DE_FABRICA.escribir.plegadas);
    // Y un editor abierto sin nombre es ninguno.
    expect(reparto.abajo).toBeNull();
  });

  // Lo que no es ni un objeto se lee entero de fábrica.
  it('lo que no es ni un objeto se lee de fabrica', () => {
    expect(leer('el banco').repartos).toEqual(DEFAULT_BANCO.repartos);
  });
});

describe('lo que hay guardado en el equipo', () => {
  /**
   * Un JSON roto —una pestaña que se cerró a medio escribir, alguien toqueteando
   * el almacenamiento— no puede dejar la aplicación sin arrancar: se vuelve a lo
   * de fábrica y se sigue.
   */
  it('un json roto se lee como si no hubiera nada', () => {
    localStorage.setItem('caos-ordenado:workspace', '{no es json');

    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('y sin nada guardado, tambien', () => {
    localStorage.clear();

    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
