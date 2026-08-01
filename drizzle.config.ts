import { defineConfig } from 'drizzle-kit';

/**
 * Configuración de las migraciones.
 *
 * Las migraciones se generan a mano —`pnpm db:generate`— y se guardan en
 * `drizzle/`, dentro del repositorio. No se aplican solas al arrancar: una
 * aplicación que migra la base de datos al levantarse funciona muy bien hasta el
 * día en que se despliegan dos instancias a la vez.
 *
 * Sin `DATABASE_URL` esto no se puede usar, y no pasa nada: la aplicación arranca
 * igual, sin cuentas, y estos comandos son los únicos que la piden.
 */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  // En español como el resto: los avisos de este comando los lee una persona.
  verbose: true,
  strict: true,
});
