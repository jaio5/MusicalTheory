import { describe, expect, it } from 'vitest';

import { daysBetween, isDay } from './days';

describe('isDay', () => {
  it('acepta solo AAAA-MM-DD', () => {
    expect(isDay('2026-08-25')).toBe(true);
    expect(isDay('2026-8-25')).toBe(false);
    expect(isDay('25/08/2026')).toBe(false);
    expect(isDay('2026-08-25T10:00:00Z')).toBe(false);
    expect(isDay('')).toBe(false);
    expect(isDay(null)).toBe(false);
    expect(isDay(20260825)).toBe(false);
  });
});

describe('daysBetween', () => {
  it('cuenta los días que hay entre dos fechas', () => {
    expect(daysBetween('2026-08-25', '2026-08-26')).toBe(1);
    expect(daysBetween('2026-08-25', '2026-08-25')).toBe(0);
    expect(daysBetween('2026-08-26', '2026-08-25')).toBe(-1);
  });

  it('cruza el cambio de mes y el de año', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('cuenta bien el 29 de febrero de un bisiesto', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
  });

  /**
   * La razón de ser de esta función.
   *
   * En la madrugada del último domingo de marzo, media Europa adelanta el reloj.
   * Interpretando las fechas a medianoche, esa hora movía la diferencia lo
   * bastante como para que alguien que estudió el sábado viera su racha rota el
   * domingo. Al mediodía sobran doce horas por cada lado.
   */
  it('el cambio de hora no descuadra un día', () => {
    // Cambio de horario de verano en la UE de 2027: madrugada del 28 de marzo.
    expect(daysBetween('2027-03-27', '2027-03-28')).toBe(1);
    expect(daysBetween('2027-03-28', '2027-03-29')).toBe(1);
    // Y el de otoño, que va al revés.
    expect(daysBetween('2027-10-30', '2027-10-31')).toBe(1);
  });

  it('una fecha que no lo es da NaN, y no un número que engañe', () => {
    expect(daysBetween('ayer', '2026-08-25')).toBeNaN();
    expect(daysBetween('2026-08-25', '')).toBeNaN();
  });
});
