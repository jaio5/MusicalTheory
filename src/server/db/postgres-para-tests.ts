/**
 * Los tests con base, contra un Postgres de verdad y **con el rol de la
 * aplicación**.
 *
 * Solo lo usa el trabajo de Postgres de la integración continua
 * (`.github/workflows/ci.yml`), que antes migra con el superusuario y da de alta
 * el rol con `scripts/rol-de-la-aplicacion.mjs`, como el contenedor de las
 * migraciones. Así se prueba lo que PGlite no puede: que ese rol, que solo lee y
 * escribe filas, basta para todo lo que hace la aplicación (adr/0117, adr/0121).
 *
 * Son dos conexiones a propósito. La de la aplicación es la que usa el código de
 * `server/`. La del dueño es la del test: vacía las tablas entre test y test y
 * las rompe cuando un test quiere ver qué pasa si la base falla, y ninguna de las
 * dos cosas la podría hacer el rol de la aplicación, que es justo lo que se
 * quiere comprobar.
 *
 * Los ficheros comparten base, así que van en el proyecto `postgres` de Vitest,
 * que corre **un fichero cada vez** (`vitest.con-base.ts`): con dos a la vez, el
 * `truncate` de uno vaciaría las filas del otro.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { BaseDePrueba, CacheDeLaBase } from './para-tests';
import * as schema from './schema';

export async function levantarPostgresDeVerdad(urlDelDueno: string): Promise<BaseDePrueba> {
  const urlDeLaAplicacion = process.env['BASE_DE_PRUEBA_URL_APP'];
  if (!urlDeLaAplicacion) {
    throw new Error(
      'Con BASE_DE_PRUEBA_URL hace falta BASE_DE_PRUEBA_URL_APP: el rol de la aplicación.',
    );
  }
  const dueno = postgres(urlDelDueno, { max: 1, onnotice: () => {} });
  // `max: 1`, como en producción (`db/client.ts`): las peticiones a la vez de los
  // tests de concurrencia se ponen en cola igual que allí.
  const aplicacion = postgres(urlDeLaAplicacion, { max: 1, onnotice: () => {} });

  const cache = ((globalThis as { __caosDb?: CacheDeLaBase }).__caosDb ??= {});
  cache.sql = aplicacion;
  cache.db = drizzle(aplicacion, { schema });
  process.env['DATABASE_URL'] = urlDeLaAplicacion;

  // Las de control de Drizzle viven en su propio esquema, `drizzle`, y no salen.
  const filas = await dueno<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `;
  const tablas = filas.map((f) => f.tablename);

  return {
    limpiar: async () => {
      await dueno.unsafe(`truncate table ${tablas.join(', ')} cascade`);
    },
    // `simple()`: algunos tests mandan varias sentencias de una vez, y eso solo
    // lo admite el protocolo simple.
    ejecutar: async (sql: string) => {
      await dueno.unsafe(sql).simple();
    },
    cerrar: async () => {
      delete (globalThis as { __caosDb?: CacheDeLaBase }).__caosDb;
      delete process.env['DATABASE_URL'];
      await Promise.all([dueno.end(), aplicacion.end()]);
    },
  };
}
