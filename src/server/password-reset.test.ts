import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import { createResetToken, hashResetToken, RESET_TTL_MS, resetPassword } from './password-reset';

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

/**
 * **La contraseña nueva tiene tope de largo**, como al crearla y al cambiarla
 * (adr/0113). Se mira antes de buscar el vale: una de megas no llega a `scrypt`.
 * Lo demás de restablecer —gastar el vale, echar a las demás sesiones— lo prueba
 * `repos.test.ts` contra la base.
 */
describe('la contraseña nueva', () => {
  let base: BaseDePrueba;
  beforeAll(async () => {
    base = await levantarBaseDePrueba();
  });
  afterAll(async () => {
    await base.cerrar();
  });

  it('de más de mil caracteres no se acepta, ni con un vale cualquiera', async () => {
    expect(await resetPassword(createResetToken(), 'x'.repeat(1025), new Date())).toBe(
      'contrasena-corta',
    );
    // Y una de medida con un vale inventado es el vale lo que no vale.
    expect(await resetPassword(createResetToken(), 'x'.repeat(1024), new Date())).toBe(
      'vale-no-vale',
    );
  });
});
