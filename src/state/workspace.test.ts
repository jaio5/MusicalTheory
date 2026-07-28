import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  DEFAULT_VISIBLE,
  PANELS,
  parsePreferences,
  togglePanel,
} from './workspace';

describe('encender y apagar paneles', () => {
  it('apaga el que estaba encendido', () => {
    expect(togglePanel(['tuner', 'key'], 'key')).toEqual(['tuner']);
  });

  it('enciende el que estaba apagado', () => {
    expect(togglePanel(['tuner'], 'key')).toEqual(['tuner', 'key']);
  });

  it('mantiene el orden del catálogo, no el de pulsación', () => {
    // Sesiones está el último del catálogo aunque se encienda primero.
    const result = togglePanel(togglePanel([], 'sessions'), 'tuner');
    expect(result).toEqual(['tuner', 'sessions']);
  });

  it('no duplica al encender dos veces lo mismo', () => {
    expect(togglePanel(togglePanel(['tuner'], 'key'), 'key')).toEqual(['tuner']);
  });

  it('se pueden apagar todos', () => {
    let visible = [...DEFAULT_VISIBLE];
    for (const id of DEFAULT_VISIBLE) {
      visible = togglePanel(visible, id);
    }
    expect(visible).toEqual([]);
  });
});

describe('lo guardado en el equipo', () => {
  it('acepta lo que escribió una versión anterior', () => {
    expect(parsePreferences({ visible: ['tuner', 'key'], styleId: 'blues' })).toEqual({
      visible: ['tuner', 'key'],
      styleId: 'blues',
    });
  });

  it('descarta paneles que ya no existen', () => {
    expect(parsePreferences({ visible: ['tuner', 'metronomo'] }).visible).toEqual(['tuner']);
  });

  it('vuelve a lo de fábrica si no queda nada válido', () => {
    expect(parsePreferences({ visible: ['inventado'] }).visible).toEqual(DEFAULT_VISIBLE);
  });

  it('no revienta con basura', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences([1, 2, 3])).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('catálogo de paneles', () => {
  it('no repite identificadores', () => {
    expect(new Set(PANELS.map((panel) => panel.id)).size).toBe(PANELS.length);
  });

  it('los que salen de fábrica existen', () => {
    const ids = new Set(PANELS.map((panel) => panel.id));
    for (const id of DEFAULT_VISIBLE) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
