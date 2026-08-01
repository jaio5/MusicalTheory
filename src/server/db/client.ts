/**
 * La conexión, y el hecho de que puede no haberla.
 *
 * **Sin `DATABASE_URL` la aplicación entera sigue funcionando**, igual que sigue
 * funcionando sin `ANTHROPIC_API_KEY`. Sin base de datos no hay cuentas: todo el
 * mundo es anónimo, con plan gratis y el avance guardado en su navegador, que es
 * exactamente cómo funcionaba esto antes de que existieran las cuentas. Esa es
 * la razón de que `db()` devuelva nulo en vez de reventar: un `pnpm dev` recién
 * clonado tiene que arrancar y dejarte tocar la guitarra.
 *
 * La conexión se abre la primera vez que alguien la pide y se guarda en el
 * módulo. En desarrollo Next recarga los módulos a cada cambio, así que además
 * se cuelga del objeto global: si no, cada guardado abriría un grupo de
 * conexiones nuevo y Postgres acabaría echando a la aplicación por pasarse del
 * máximo.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

interface Cache {
  sql?: ReturnType<typeof postgres>;
  db?: Database;
}

const cache: Cache = ((globalThis as { __caosDb?: Cache }).__caosDb ??= {});

export function databaseUrl(): string | null {
  const url = process.env['DATABASE_URL'];
  return url === undefined || url === '' ? null : url;
}

/** Si hay cuentas en esta copia de la aplicación. */
export function hasDatabase(): boolean {
  return databaseUrl() !== null;
}

/** La base de datos, o nulo si esta copia no tiene ninguna configurada. */
export function db(): Database | null {
  const url = databaseUrl();
  if (url === null) {
    return null;
  }
  if (cache.db === undefined) {
    // `max: 1` porque cada función de Vercel atiende una petición a la vez:
    // un grupo de diez conexiones por instancia agota Postgres sin ganar nada.
    cache.sql = postgres(url, { max: 1 });
    cache.db = drizzle(cache.sql, { schema });
  }
  return cache.db;
}
