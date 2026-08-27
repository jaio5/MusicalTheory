import { describe, expect, it } from 'vitest';

import { EMPTY_PROGRESS } from '@core/music';

import { clearProgress, loadProgress, saveProgress } from './learn-progress';
import { createSessionStorage, MemorySessionStorage } from './session-storage';
import { elegirTema, temaElegido, temaEnServidor } from './theme';
import { sitioDelTutor, sitioDelTutorEnServidor, SITIO_POR_DEFECTO } from './tutor-spot';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './workspace';

import { prefersReducedMotion } from '@ui/motion';

/**
 * Lo que pasa donde no hay navegador.
 *
 * **Este fichero corre en el entorno `node` a propósito**, sin jsdom: no hay
 * `localStorage`, ni `document`, ni `window`, que es exactamente lo que ve el
 * servidor al pintar el HTML de la primera carga.
 *
 * Importa porque en esta aplicación **el marco se renderiza en el servidor** —el
 * layout lee la cuenta— así que todas estas funciones se ejecutan allí antes de
 * llegar a nadie. Una que reviente por leer `localStorage` no deja media
 * pantalla en blanco: deja la aplicación sin arrancar.
 *
 * Y el otro lado de lo mismo: cada una tiene que devolver **lo de casa**, no
 * nulo. Un tema nulo pinta sin colores; unas preferencias nulas dejan el mástil
 * sin afinación.
 */

describe('el avance del temario', () => {
  it('se lee vacío y guardarlo no revienta', () => {
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
    expect(() => saveProgress(EMPTY_PROGRESS)).not.toThrow();
    expect(() => clearProgress()).not.toThrow();
  });
});

describe('las preferencias del taller', () => {
  it('salen las de casa, no vacías', () => {
    // Vacías dejarían el mástil sin afinación y la rueda sin estilo.
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(() => savePreferences(DEFAULT_PREFERENCES)).not.toThrow();
  });
});

describe('el tema', () => {
  it('el de casa es el oscuro, y elegirlo sin documento no falla', () => {
    expect(temaElegido()).toBe('oscuro');
    expect(temaEnServidor()).toBe('oscuro');
    expect(() => elegirTema('claro')).not.toThrow();
  });
});

describe('el sitio del muñeco', () => {
  it('el de siempre, y el mismo en servidor y en cliente', () => {
    // Si fueran distintos, el muñeco saltaría de sitio al hidratar.
    expect(sitioDelTutor()).toEqual(SITIO_POR_DEFECTO);
    expect(sitioDelTutorEnServidor()).toEqual(SITIO_POR_DEFECTO);
  });
});

describe('las sesiones guardadas', () => {
  it('sin IndexedDB se usa la de memoria', () => {
    // Es lo que hace que una pantalla que lea sesiones se pueda renderizar en el
    // servidor sin reventar antes de llegar al navegador.
    expect(createSessionStorage()).toBeInstanceOf(MemorySessionStorage);
  });
});

describe('el movimiento reducido', () => {
  it('sin ventana se supone que no se ha pedido nada', () => {
    // En el servidor no hay a quién preguntar, y suponer «reducido» dejaría la
    // aplicación sin ninguna animación para todo el mundo en la primera carga.
    expect(prefersReducedMotion()).toBe(false);
  });
});
