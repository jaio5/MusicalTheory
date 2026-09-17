import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BANCO,
  DEFAULT_PREFERENCES,
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
