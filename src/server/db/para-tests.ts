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
 *
 * **Lo que PGlite no ve son los permisos**: corre como superusuario, así que un
 * `grant` que falte pasaría aquí y reventaría en producción, donde la aplicación
 * entra con un rol que solo lee y escribe filas (adr/0117). Por eso la
 * integración continua pasa además estos mismos tests contra un Postgres de
 * verdad y con ese rol (`postgres-para-tests.ts`, adr/0121).
 */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync } from 'node:fs';
import { inject } from 'vitest';

import * as schema from './schema';

declare module 'vitest' {
  export interface ProvidedContext {
    /** El directorio de datos ya migrado, volcado por `vitest.base-de-prueba.ts`. */
    baseMigrada: string;
  }
}

/** Lo mismo que guarda `db/client.ts`, para poder ponerlo desde aquí. */
export interface CacheDeLaBase {
  sql?: unknown;
  db?: unknown;
}

export interface BaseDePrueba {
  /** Deja las tablas vacías sin volver a crearlas. Va en un `beforeEach`. */
  readonly limpiar: () => Promise<void>;
  readonly cerrar: () => Promise<void>;
  /**
   * Ejecuta SQL a pelo.
   *
   * Existe para lo que no se puede provocar de otra forma: **que la base
   * conteste con un error**. Casi todas las funciones de `server/` tienen un
   * `catch` que decide qué se le enseña a quien está mirando —«no hemos podido
   * leer tus canciones» en vez de una lista vacía, que sería mentira— y esa
   * rama no la recorre ningún camino normal. Se rompe una tabla a propósito y
   * se mira qué contesta.
   */
  readonly ejecutar: (sql: string) => Promise<void>;
}

/**
 * Levanta la base con las migraciones ya aplicadas y la deja puesta.
 *
 * **No migra**: carga el directorio de datos que `vitest.base-de-prueba.ts`
 * migró una vez para toda la pasada (adr/0121). Cada fichero tiene su base, así
 * que los ficheros no se pisan las filas aunque corran a la vez.
 *
 * Con `BASE_DE_PRUEBA_URL` la base es un Postgres de verdad y la aplicación
 * entra con el rol sin privilegios (`postgres-para-tests.ts`).
 */
export async function levantarBaseDePrueba(): Promise<BaseDePrueba> {
  /* v8 ignore next 4 -- solo en el trabajo de Postgres de la integracion continua, que no mide cobertura */
  if (process.env['BASE_DE_PRUEBA_URL']) {
    const { levantarPostgresDeVerdad } = await import('./postgres-para-tests');
    return levantarPostgresDeVerdad(process.env['BASE_DE_PRUEBA_URL']);
  }

  const volcado = readFileSync(inject('baseMigrada'));
  const cliente = new PGlite({ loadDataDir: new Blob([volcado]) });
  const base = drizzle(cliente, { schema });

  const cache = ((globalThis as { __caosDb?: CacheDeLaBase }).__caosDb ??= {});
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
      await cliente.exec(`truncate table ${tablas.join(', ')} cascade`);
    },
    ejecutar: async (sql: string) => {
      await cliente.exec(sql);
    },
    cerrar: async () => {
      delete (globalThis as { __caosDb?: CacheDeLaBase }).__caosDb;
      delete process.env['DATABASE_URL'];
      await cliente.close();
    },
  };
}
