import { describe, expect, it } from 'vitest';

import {
  activatePanel,
  closePanel,
  DEFAULT_LAYOUT,
  DEFAULT_PREFERENCES,
  MAX_ZONE_SIZE,
  MIN_ZONE_SIZE,
  movePanel,
  openPanel,
  PANELS,
  parseLayout,
  parsePreferences,
  resizeZone,
  zoneOf,
  ZONES,
  type Layout,
} from './workspace';

describe('Mover paneles', () => {
  it('lleva un panel a otra zona y lo deja al frente', () => {
    const layout = movePanel(DEFAULT_LAYOUT, 'chord', 'bottom');

    expect(zoneOf(layout, 'chord')).toBe('bottom');
    expect(layout.bottom.active).toBe('chord');
    expect(layout.left.panels).toEqual([]);
  });

  it('un panel no puede estar en dos zonas a la vez', () => {
    const layout = movePanel(DEFAULT_LAYOUT, 'key', 'left');

    expect(layout.right.panels).not.toContain('key');
    expect(layout.left.panels).toContain('key');
  });

  it('la zona que pierde su pestaña activa enseña la vecina', () => {
    const stacked = movePanel(DEFAULT_LAYOUT, 'key', 'left');
    const layout = movePanel(stacked, 'key', 'right');

    expect(layout.left.active).toBe('chord');
  });

  it('respeta la posición pedida', () => {
    const layout = movePanel(movePanel(DEFAULT_LAYOUT, 'tuner', 'left'), 'key', 'left', 0);

    expect(layout.left.panels).toEqual(['key', 'chord', 'tuner']);
  });

  it('una zona vacía se queda sin nadie al frente', () => {
    const layout = closePanel(DEFAULT_LAYOUT, 'chord');

    expect(layout.left.panels).toEqual([]);
    expect(layout.left.active).toBeNull();
  });

  it('abrir uno ya abierto lo trae al frente sin moverlo de sitio', () => {
    const stacked = movePanel(DEFAULT_LAYOUT, 'tuner', 'left');
    const layout = openPanel(activatePanel(stacked, 'chord'), 'tuner');

    expect(layout.left.active).toBe('tuner');
    expect(layout.left.panels).toEqual(['chord', 'tuner']);
  });
});

describe('Tamaño de las zonas', () => {
  it('no deja una zona más estrecha de lo legible ni más ancha que la pantalla', () => {
    expect(resizeZone(DEFAULT_LAYOUT, 'left', 10).left.size).toBe(MIN_ZONE_SIZE);
    expect(resizeZone(DEFAULT_LAYOUT, 'left', 5000).left.size).toBe(MAX_ZONE_SIZE);
  });

  it('redondea a píxeles enteros', () => {
    expect(resizeZone(DEFAULT_LAYOUT, 'right', 301.6).right.size).toBe(302);
  });
});

describe('Leer lo guardado', () => {
  it('recupera una disposición válida', () => {
    const saved: Layout = {
      ...DEFAULT_LAYOUT,
      left: { panels: ['tuner', 'chord'], active: 'chord', size: 300 },
    };

    expect(parseLayout(JSON.parse(JSON.stringify(saved))).left).toEqual(saved.left);
  });

  it('descarta paneles que ya no existen', () => {
    const layout = parseLayout({ left: { panels: ['chord', 'metronomo'], active: 'metronomo' } });

    expect(layout.left.panels).toEqual(['chord']);
    expect(layout.left.active).toBe('chord');
  });

  it('un panel repetido se queda en la primera zona', () => {
    const layout = parseLayout({
      left: { panels: ['chord'], active: 'chord' },
      center: { panels: ['chord', 'next'], active: 'chord' },
    });

    expect(layout.left.panels).toEqual(['chord']);
    expect(layout.center.panels).toEqual(['next']);
    expect(layout.center.active).toBe('next');
  });

  it('vuelve a la disposición de fábrica si no queda nada en pie', () => {
    expect(parseLayout({ left: { panels: ['inventado'] } })).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout([1, 2, 3])).toEqual(DEFAULT_LAYOUT);
  });

  it('acepta zonas vacías mientras otra tenga paneles', () => {
    const layout = parseLayout({ center: { panels: ['next'], active: 'next' } });

    expect(layout.center.panels).toEqual(['next']);
    expect(layout.left.panels).toEqual([]);
  });

  it('recupera también el estilo y la escala', () => {
    expect(parsePreferences({ styleId: 'blues', scaleId: 'dorian' })).toMatchObject({
      styleId: 'blues',
      scaleId: 'dorian',
    });
  });

  it('con basura, se queda con lo de fábrica', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{}')).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('Catálogo de paneles', () => {
  it('no tiene identificadores repetidos', () => {
    expect(new Set(PANELS.map((panel) => panel.id)).size).toBe(PANELS.length);
  });

  it('la disposición de fábrica solo coloca paneles que existen', () => {
    const ids = new Set(PANELS.map((panel) => panel.id));
    for (const zone of ZONES) {
      for (const id of DEFAULT_LAYOUT[zone].panels) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });
});
