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

/**
 * Cómo se cifra la conexión, según adónde vaya.
 *
 * **Hacia fuera, `verify-full`**: cifrada y comprobando que el certificado es de
 * quien dice ser, que es lo único que impide que alguien en medio se haga pasar
 * por la base y se quede con los hashes de todas las contraseñas. Es lo que
 * piden Neon, Supabase y compañía, cuyos certificados firma una autoridad
 * pública.
 *
 * **`sslmode=require` también se endurece**, y es a propósito: es lo que traen
 * pegado las cadenas de esos proveedores, y en postgres.js `require` cifra **sin
 * comprobar el certificado**. Quien de verdad quiera otra cosa la escribe —
 * `disable`, `prefer`, `verify-ca`— y se respeta tal cual.
 *
 * **Dentro del equipo o de la red de compose, nada**: `localhost`, `127.*`,
 * `::1` y los nombres sin punto —`db`, el servicio de compose— no salen de la
 * máquina, y el Postgres del contenedor no tiene certificado. Una IP privada de
 * otra máquina **no** cuenta como local: si de verdad va sin TLS, se dice con
 * `?sslmode=disable` (docs/DESPLIEGUE.md, docs/adr/0117).
 *
 * Devuelve nulo cuando no hay nada que imponer, para no pisar lo que diga la
 * cadena: en postgres.js una opción `ssl` puesta, aunque sea `undefined`, gana
 * a la cadena.
 */
export function tlsPara(url: string): 'verify-full' | null {
  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    // Varios servidores separados por comas no son una URL; que los lea
    // postgres.js con su `sslmode`, que para eso lo entiende.
    return null;
  }
  const servidor = direccion.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const local =
    servidor === '' ||
    servidor === 'localhost' ||
    servidor === '::1' ||
    servidor.startsWith('127.') ||
    !servidor.includes('.');
  if (local) {
    return null;
  }
  const modo = direccion.searchParams.get('sslmode');
  return modo === null || modo === 'require' ? 'verify-full' : null;
}

function databaseUrl(): string | null {
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
  /* v8 ignore next 7 -- abrir Postgres de verdad; en los tests la base en memoria ya deja la suya puesta */
  if (cache.db === undefined) {
    // `max: 1` porque cada función de Vercel atiende una petición a la vez:
    // un grupo de diez conexiones por instancia agota Postgres sin ganar nada.
    const tls = tlsPara(url);
    cache.sql = postgres(url, { max: 1, ...(tls === null ? {} : { ssl: tls }) });
    cache.db = drizzle(cache.sql, { schema });
  }
  return cache.db;
}
