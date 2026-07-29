import { describe, expect, it } from 'vitest';

import { DEFAULT_PREFERENCES, parsePreferences } from './workspace';

describe('Preferencias', () => {
  it('recupera estilo, escala y afinación', () => {
    expect(parsePreferences({ styleId: 'blues', scaleId: 'dorian', tuningId: 'dropD' })).toEqual({
      styleId: 'blues',
      scaleId: 'dorian',
      tuningId: 'dropD',
    });
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
});
