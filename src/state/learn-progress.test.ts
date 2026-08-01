import { describe, expect, it } from 'vitest';

import { today } from './learn-progress';

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
