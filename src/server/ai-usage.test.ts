import { describe, expect, it } from 'vitest';

import { serverDay, serverMonth } from './ai-usage';

/**
 * Los dos contadores viven en Postgres y su corrección la sostiene una sentencia
 * —el `where` del `on conflict` con los dos topes dentro—, así que no se pueden
 * probar sin base de datos. Lo que sí se puede probar es de qué mes y de qué día
 * hablamos, que es la otra mitad de la corrección: un cupo que se renueva cuando
 * no debe es un cupo que no existe.
 *
 * El resto de la aritmética del cupo —cuántas peticiones da cada plan y que
 * ninguno pierde dinero— está en `core/billing/cost.test.ts`, que es puro.
 */
describe('el día y el mes del cupo', () => {
  /**
   * En UTC y no en la hora de quien pregunta: el que paga la factura es el
   * servidor. Creerse la zona horaria del navegador permitiría renovar el cupo
   * cambiando la hora del ordenador.
   */
  it('van en UTC, no en la hora de quien pide', () => {
    expect(serverDay(new Date('2026-07-30T23:30:00Z'))).toBe('2026-07-30');
    expect(serverDay(new Date('2026-07-31T00:30:00Z'))).toBe('2026-07-31');
    expect(serverMonth(new Date('2026-07-31T23:59:59Z'))).toBe('2026-07');
    expect(serverMonth(new Date('2026-08-01T00:00:00Z'))).toBe('2026-08');
  });

  it('se escriben como AAAA-MM-DD y AAAA-MM', () => {
    const momento = new Date('2026-01-05T12:00:00Z');

    expect(serverDay(momento)).toBe('2026-01-05');
    expect(serverMonth(momento)).toBe('2026-01');
  });

  // El mes es el prefijo del día: la fila del mes y el contador del día no pueden
  // acabar hablando de meses distintos.
  it('el mes es siempre el principio del día', () => {
    for (const iso of ['2026-02-28T10:00:00Z', '2026-12-31T22:00:00Z', '2027-03-01T00:00:01Z']) {
      const momento = new Date(iso);
      expect(serverDay(momento).startsWith(serverMonth(momento))).toBe(true);
    }
  });
});
