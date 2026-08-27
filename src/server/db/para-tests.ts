/**
 * Un Postgres de verdad para los tests, sin instalar nada.
 *
 * **La deuda más vieja del proyecto era esta**: nada de las cuentas se probaba
 * contra una base de datos. Lo puro sí —planes, permisos, fusión de avances,
 * cifrado— pero las consultas no, y las dos veces que se ejecutaron a mano
 * salieron fallos que ningún test veía.
 *
 * No se probaban porque la alternativa parecía ser una de estas dos, y ninguna
 * vale:
 *
 * - **Levantar Postgres** para pasar los tests. Rompería que los cinco comandos
 *   funcionen en un clon recién bajado, que es lo que hace que cualquiera pueda
 *   tocar esto en cinco minutos.
 * - **Fingir el cliente de Drizzle**. Sería escribir un ORM falso y comprobar que
 *   mi falso hace lo que yo mismo he dicho: no prueba nada de las consultas de
 *   verdad, que es justo lo que falla.
 *
 * PGlite es Postgres compilado a WebAssembly: corre dentro del proceso, sin
 * servicio, sin puerto y sin Docker, y ejecuta **el mismo SQL** —con sus tipos,
 * sus índices únicos y sus `on conflict`—. Así que las consultas se prueban de
 * verdad y `pnpm test` sigue sin necesitar nada.
 *
 * La costura para meterlo ya existía: `db/client.ts` guarda la conexión en
 * `globalThis` porque Next recarga los módulos a cada cambio en desarrollo. Aquí
 * se aprovecha ese mismo hueco.
 */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as schema from './schema';

/** Lo mismo que guarda `db/client.ts`, para poder ponerlo desde aquí. */
interface Cache {
  sql?: unknown;
  db?: unknown;
}

export interface BaseDePrueba {
  /** Deja las tablas vacías sin volver a crearlas. Va en un `beforeEach`. */
  readonly limpiar: () => Promise<void>;
  readonly cerrar: () => Promise<void>;
}

/**
 * Levanta la base, le aplica las migraciones de verdad y la deja puesta.
 *
 * **Las migraciones son las del repositorio**, leídas de `drizzle/`, no un
 * esquema escrito a mano en el test: si fueran dos cosas, una migración mal
 * escrita pasaría los tests y reventaría al desplegar, que es exactamente el
 * fallo que esto viene a cazar.
 */
export async function levantarBaseDePrueba(): Promise<BaseDePrueba> {
  const cliente = new PGlite();
  const base = drizzle(cliente, { schema });

  const carpeta = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  for (const fichero of readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(`${carpeta}/${fichero}`, 'utf8');
    // Drizzle separa las sentencias de una migración con esta marca.
    for (const sentencia of sql.split('--> statement-breakpoint')) {
      const limpia = sentencia.trim();
      if (limpia !== '') {
        await cliente.exec(limpia);
      }
    }
  }

  const cache = ((globalThis as { __caosDb?: Cache }).__caosDb ??= {});
  cache.db = base;
  // `db()` mira `DATABASE_URL` antes de devolver nada: sin ella contesta nulo y
  // ni llega a mirar lo que hay guardado.
  process.env['DATABASE_URL'] = 'postgres://pglite/en-memoria';

  // Qué tablas hay se le pregunta a Postgres en vez de escribirlas aquí: una
  // lista a mano se queda vieja en cuanto alguien añade una migración, y el
  // síntoma sería un test que falla por datos de otro test.
  const { rows } = await cliente.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public'`,
  );
  const tablas = rows.map((r) => r.tablename).filter((t) => !t.startsWith('__drizzle'));

  return {
    limpiar: async () => {
      if (tablas.length > 0) {
        await cliente.exec(`truncate table ${tablas.join(', ')} cascade`);
      }
    },
    cerrar: async () => {
      delete (globalThis as { __caosDb?: Cache }).__caosDb;
      delete process.env['DATABASE_URL'];
      await cliente.close();
    },
  };
}
