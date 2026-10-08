/**
 * Los tests que levantan base (`levantarBaseDePrueba`), por su nombre.
 *
 * Con PGlite corren con los demás; con `BASE_DE_PRUEBA_URL` —un Postgres de
 * verdad y el rol de la aplicación, en la integración continua— van en su propio
 * proyecto, `postgres`, y un fichero cada vez: comparten la base, y el `truncate`
 * de uno vaciaría las filas de otro (`server/db/postgres-para-tests.ts`).
 *
 * **Una lista y no un `grep`**: el trabajo de Postgres los elegía buscando la
 * palabra y pasándoselos al proyecto `unidad`, que no tiene los de reloj, así que
 * `auth.reloj.test.ts` no corrió nunca contra Postgres. Que la lista no se quede
 * atrás lo vigila `server/db/para-tests.test.ts`.
 */
export const CON_BASE: readonly string[] = [
  'src/app/api/cuenta/route.borrar.test.ts',
  'src/app/api/metricas/route.con-base.test.ts',
  'src/app/api/pago/webhook/route.con-base.test.ts',
  'src/app/api/progreso/route.con-base.test.ts',
  'src/server/ai-gasto.test.ts',
  'src/server/ai-route.ataques.test.ts',
  'src/server/auth.reloj.test.ts',
  'src/server/auth.test.ts',
  'src/server/entitlements.test.ts',
  'src/server/metricas.test.ts',
  'src/server/password-reset.test.ts',
  'src/server/progress-repo.test.ts',
  'src/server/rate-limit-real.test.ts',
  'src/server/repos.test.ts',
  'src/server/users.test.ts',
];
