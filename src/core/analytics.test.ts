import { describe, expect, it } from 'vitest';

import {
  computeRetention,
  normalizeRoute,
  parseBrowserReport,
  shiftDay,
  utcDay,
  type VisitorDays,
} from './analytics';

/**
 * Lo que se cuenta y cómo se lee si alguien vuelve.
 *
 * Lo que importa de la primera mitad es lo que **no** pasa: que una dirección
 * escrita a mano, un evento inventado o un identificador con forma de correo no
 * lleguen nunca a una fila.
 */

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('las rutas que se guardan', () => {
  it('las conocidas se quedan como están, sin la barra final ni la consulta', () => {
    expect(normalizeRoute('/')).toBe('/');
    expect(normalizeRoute('')).toBe('/');
    expect(normalizeRoute('/componer/')).toBe('/componer');
    expect(normalizeRoute('/afinar?x=1#y')).toBe('/afinar');
    expect(normalizeRoute('/aprender/repaso')).toBe('/aprender/repaso');
  });

  it('las que llevan un trozo variable se guardan con el hueco, no con lo de dentro', () => {
    expect(normalizeRoute('/aprender/escala-mayor')).toBe('/aprender/[unidad]');
    expect(normalizeRoute('/planes/pro')).toBe('/planes/[plan]');
  });

  it('cualquier otra cosa es «otra», que no es texto libre', () => {
    expect(normalizeRoute('/mi-correo@ejemplo.com')).toBe('otra');
    expect(normalizeRoute('/aprender/a/b')).toBe('otra');
  });
});

describe('lo que manda el navegador', () => {
  it('una visita lleva su ruta normalizada', () => {
    expect(parseBrowserReport({ evento: 'visita', ruta: '/planes/medio', visitante: ID })).toEqual({
      event: 'visita',
      route: '/planes/[plan]',
      deviceId: ID,
    });
  });

  it('lo demás no lleva ruta aunque la mande', () => {
    expect(parseBrowserReport({ evento: 'toma-grabada', ruta: '/componer' })).toEqual({
      event: 'toma-grabada',
      route: '',
      deviceId: null,
    });
  });

  it('una visita sin ruta se guarda sin ruta', () => {
    expect(parseBrowserReport({ evento: 'visita' })?.route).toBe('');
  });

  it('un identificador que no es un UUID se tira, no se guarda', () => {
    expect(parseBrowserReport({ evento: 'visita', visitante: 'yo@ejemplo.com' })?.deviceId).toBe(
      null,
    );
    expect(parseBrowserReport({ evento: 'visita', visitante: 42 })?.deviceId).toBe(null);
  });

  it('lo que cuenta el servidor no lo puede mandar el navegador', () => {
    expect(parseBrowserReport({ evento: 'cancion-guardada' })).toBeNull();
    expect(parseBrowserReport({ evento: 'primera-vez' })).toBeNull();
    expect(parseBrowserReport({ evento: 'lo-que-sea' })).toBeNull();
    expect(parseBrowserReport('visita')).toBeNull();
    expect(parseBrowserReport(null)).toBeNull();
  });
});

describe('los días', () => {
  it('se cuentan en UTC y cruzan meses', () => {
    expect(utcDay(Date.UTC(2026, 9, 7, 23, 59))).toBe('2026-10-07');
    expect(shiftDay('2026-10-30', 3)).toBe('2026-11-02');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('si alguien vuelve', () => {
  const HOY = '2026-10-07';
  const hace = (dias: number) => shiftDay(HOY, -dias);
  const visitante = (primero: number, ...otros: number[]): VisitorDays => ({
    firstDay: hace(primero),
    days: [primero, ...otros].map(hace),
  });

  it('sin nadie, todo a cero', () => {
    expect(computeRetention([], HOY)).toEqual({
      activeLast7: 0,
      newLast7: 0,
      day7: { cohort: 0, returned: 0 },
      day30: { cohort: 0, returned: 0 },
      weekly: { cohort: 0, returned: 0 },
    });
  });

  it('los de esta semana, y cuántos son nuevos', () => {
    const r = computeRetention([visitante(2), visitante(40, 3), visitante(40)], HOY);
    expect(r.activeLast7).toBe(2);
    expect(r.newLast7).toBe(1);
  });

  it('la segunda semana solo cuenta a quien ha tenido tiempo de volver', () => {
    const r = computeRetention(
      [
        visitante(20, 20 - 8), // volvió el día 8
        visitante(20, 20 - 1), // volvió al día siguiente, no en la segunda semana
        visitante(5, 4), // no ha tenido tiempo: fuera de la cuenta
      ],
      HOY,
    );
    expect(r.day7).toEqual({ cohort: 2, returned: 1 });
  });

  it('a los treinta, igual', () => {
    const r = computeRetention([visitante(50, 50 - 31), visitante(50), visitante(10, 0)], HOY);
    expect(r.day30).toEqual({ cohort: 2, returned: 1 });
  });

  it('cada semana es cada una de las cuatro, no tres de cuatro', () => {
    const r = computeRetention(
      [
        visitante(60, 25, 18, 10, 1), // las cuatro
        visitante(60, 25, 10, 1), // falta una
        visitante(60, 40), // no ha estado en las últimas cuatro: fuera
        visitante(10, 1), // llegó hace menos de cuatro semanas: fuera
      ],
      HOY,
    );
    expect(r.weekly).toEqual({ cohort: 2, returned: 1 });
  });
});
