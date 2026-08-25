import { describe, expect, it } from 'vitest';

import { createResetToken, hashResetToken, RESET_TTL_MS } from './password-reset';

/**
 * Lo que se puede probar sin Postgres: el vale en sí.
 *
 * Lo que hace con la base de datos —invalidar los anteriores, gastarlo, subir la
 * versión de sesión— está escrito y **sin ejecutar**, como el resto de las
 * cuentas. Está dicho en el ROADMAP.
 */
describe('el vale de recuperación', () => {
  it('es azar de sobra: dos seguidos nunca coinciden', () => {
    const vales = new Set(Array.from({ length: 200 }, () => createResetToken()));

    expect(vales.size).toBe(200);
  });

  it('viaja dentro de un enlace, así que no lleva caracteres que se rompan', () => {
    // Un `+`, un `/` o un `=` dentro de una dirección se rompen por el camino.
    for (let i = 0; i < 50; i += 1) {
      expect(createResetToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('es lo bastante largo como para no adivinarse probando', () => {
    // Treinta y dos bytes en base64url son 43 caracteres.
    expect(createResetToken().length).toBeGreaterThanOrEqual(43);
  });

  it('lo que se guarda es la huella, no el vale', () => {
    const vale = createResetToken();
    const huella = hashResetToken(vale);

    expect(huella).not.toBe(vale);
    expect(huella).toMatch(/^[0-9a-f]{64}$/);
  });

  it('la misma huella para el mismo vale, y distinta para otro', () => {
    const vale = createResetToken();

    expect(hashResetToken(vale)).toBe(hashResetToken(vale));
    expect(hashResetToken(vale)).not.toBe(hashResetToken(createResetToken()));
  });

  it('dura una hora: ni para siempre, ni tan poco que no dé tiempo a abrir el correo', () => {
    expect(RESET_TTL_MS).toBe(60 * 60 * 1000);
  });
});
