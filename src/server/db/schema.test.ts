import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { aiUsage, passwordResets, progress, songs, users } from './schema';

/**
 * Lo que se borra al borrar una cuenta.
 *
 * «No guardamos lo que no hace falta» solo vale si irse se lleva todo lo demás
 * por delante, y eso no lo decide ningún código de la aplicación: lo decide el
 * `on delete cascade` de cada tabla que cuelga de `users`. Si a una se le
 * olvidara, borrar la cuenta dejaría filas huérfanas con su avance, sus
 * canciones o su gasto dentro, y nadie se enteraría hasta que alguien mirase la
 * base.
 *
 * Se comprueba leyendo el esquema y no ejecutando SQL: lo que hay que vigilar es
 * lo que se va a crear, no lo que ya esté creado.
 */
const COLGADAS = [
  ['progress', progress],
  ['aiUsage', aiUsage],
  ['passwordResets', passwordResets],
  ['songs', songs],
] as const;

describe('lo que cuelga de una cuenta', () => {
  it('se borra con ella, tabla por tabla', () => {
    for (const [nombre, tabla] of COLGADAS) {
      const claves = getTableConfig(tabla).foreignKeys;
      expect(claves, `${nombre} no apunta a nadie`).toHaveLength(1);

      const clave = claves[0]!;
      expect(getTableConfig(clave.reference().foreignTable).name, nombre).toBe('users');
      expect(clave.onDelete, `${nombre} no se borra en cascada`).toBe('cascade');
    }
  });

  // Y el correo es único: dos cuentas con el mismo correo son una cuenta rota.
  it('el correo de una cuenta no se repite', () => {
    const columna = getTableConfig(users).columns.find((c) => c.name === 'email');

    expect(columna?.isUnique).toBe(true);
    expect(columna?.notNull).toBe(true);
  });
});
