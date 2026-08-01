/**
 * Las rutas de Auth.js: entrar, salir, la sesión y el testigo contra CSRF.
 *
 * No hay nada que escribir aquí. Toda la configuración está en
 * `src/server/auth.ts`, que es también quien decide si esta copia de la
 * aplicación tiene cuentas.
 */

import { handlers } from '@server/auth';

export const runtime = 'nodejs';

export const { GET, POST } = handlers;
