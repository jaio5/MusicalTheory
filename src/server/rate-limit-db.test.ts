import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * El guardián de una sentencia que estuvo mal una fase entera sin que se notara.
 *
 * Dentro de una plantilla `sql`, Drizzle no sabe de qué columna es cada valor,
 * así que un `Date` viaja como lo que devuelve su `toString()` —«Tue Aug 25 2026
 * 18:17:18 GMT+0200 (Central European Summer Time)»— y Postgres no sabe leer
 * eso. La sentencia fallaba entera, el `catch` se lo tragaba y el límite caía al
 * de memoria: **funcionaba desde fuera y no compartía nada**.
 *
 * Esto no se puede probar sin Postgres, así que se prueba lo que sí se puede: la
 * forma de la sentencia. Es el mismo truco que `coherencia.test.ts`.
 */
const CODIGO = readFileSync(fileURLToPath(new URL('./rate-limit-db.ts', import.meta.url)), 'utf8');

describe('la sentencia del límite compartido', () => {
  it('no mete un Date dentro de una plantilla sql', () => {
    // Lo que se interpola en `sql` va en ISO y casteado a mano.
    const interpolaciones = [...CODIGO.matchAll(/sql`[^`]*`/g)].flatMap((m) =>
      [...m[0].matchAll(/\$\{([^}]+)\}/g)].map((i) => i[1]!.trim()),
    );
    const fechas = interpolaciones.filter((valor) => /^(now|before|windowStart)$/.test(valor));

    expect(fechas).toEqual([]);
  });

  it('castea las fechas que interpola', () => {
    for (const nombre of ['ahora', 'desde']) {
      const usos = [...CODIGO.matchAll(new RegExp(`\\$\\{${nombre}\\}(::timestamptz)?`, 'g'))];
      expect(usos.length, `${nombre} no se usa`).toBeGreaterThan(0);
      for (const uso of usos) {
        expect(uso[1], `${nombre} sin castear en «${uso[0]}»`).toBe('::timestamptz');
      }
    }
  });

  it('un fallo de la base de datos deja rastro en desarrollo', () => {
    // El `catch` mudo es lo que escondió el fallo durante una fase entera.
    expect(CODIGO).toContain('límite de frecuencia');
    expect(CODIGO).toContain("process.env.NODE_ENV !== 'production'");
  });
});
