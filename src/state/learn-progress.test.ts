// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_PROGRESS } from '@core/music';

import { clearProgress, loadProgress, saveProgress, today } from './learn-progress';

// Interpretar lo guardado se prueba junto a su código, en
// `core/music/progress.test.ts`: la función se mudó al dominio cuando empezó a
// proteger también la puerta de la base de datos.

describe('el día de hoy', () => {
  it('se escribe como AAAA-MM-DD', () => {
    expect(today(new Date(2026, 6, 29))).toBe('2026-07-29');
  });

  it('rellena con cero el mes y el día', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  /**
   * En hora local y no en UTC: la racha la cuenta quien toca, y a las once de la
   * noche en Madrid el día es el suyo, no el de Greenwich.
   */
  it('usa la hora local, no UTC', () => {
    const casi = new Date(2026, 6, 29, 23, 30);

    expect(today(casi)).toBe('2026-07-29');
  });
});

describe('lo que llevas aprendido', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin nada guardado, se empieza de cero', () => {
    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });

  it('lo guardado vuelve tal cual', () => {
    const avance = { ...EMPTY_PROGRESS, done: ['e1-grados'] };

    saveProgress(avance);

    expect(loadProgress()).toMatchObject({ done: ['e1-grados'] });
  });

  it('un guardado corrupto no deja la escalera en blanco', () => {
    // Pasa al cambiar la forma de lo guardado entre versiones. Empezar de cero
    // es peor que nada, pero mucho mejor que una pantalla rota.
    localStorage.setItem('caos-ordenado:aprender', '{esto no es json');

    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });

  it('lo que no encaje con la forma se descarta sin reventar', () => {
    localStorage.setItem('caos-ordenado:aprender', '"una cadena"');

    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });

  it('borrarlo lo deja como el primer dia', () => {
    saveProgress({ ...EMPTY_PROGRESS, done: ['e1-grados'] });

    clearProgress();

    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  });

  it('sin permiso para guardar se pierde el avance, no la sesion', () => {
    // Modo privado o cuota llena. Lo que se está tocando ahora mismo sigue.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => saveProgress(EMPTY_PROGRESS)).not.toThrow();
  });

  it('ni para leerlo ni para borrarlo', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(loadProgress()).toEqual(EMPTY_PROGRESS);
    expect(() => clearProgress()).not.toThrow();
  });
});
