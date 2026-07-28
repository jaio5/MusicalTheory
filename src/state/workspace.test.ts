import { describe, expect, it } from 'vitest';

import { DEFAULT_PREFERENCES, parsePreferences, SCREENS } from './workspace';

describe('Preferencias', () => {
  it('recupera pantalla, estilo, escala y afinación', () => {
    expect(
      parsePreferences({
        screen: 'tune',
        styleId: 'blues',
        scaleId: 'dorian',
        tuningId: 'dropD',
      }),
    ).toEqual({ screen: 'tune', styleId: 'blues', scaleId: 'dorian', tuningId: 'dropD' });
  });

  it('descarta una pantalla que ya no existe', () => {
    expect(parsePreferences({ screen: 'banco' }).screen).toBe(DEFAULT_PREFERENCES.screen);
  });

  it('con basura, se queda con lo de fábrica', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences([1, 2, 3])).toEqual(DEFAULT_PREFERENCES);
  });

  it('las tres pantallas tienen identificador propio', () => {
    expect(new Set(SCREENS.map((screen) => screen.id)).size).toBe(SCREENS.length);
  });
});
