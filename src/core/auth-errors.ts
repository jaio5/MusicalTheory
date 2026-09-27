/**
 * Cómo dice el servidor que no se puede entrar todavía.
 *
 * Existe por la regla de capas: quien lo lanza es `server/auth.ts` y quien lo
 * traduce a una frase es `state/account.ts`, y `state/` no puede abrir `server/`
 * —un `@server/` en el navegador se lleva Postgres al paquete del cliente—. Así
 * que el código vive aquí, que es lo que las dos pueden importar. Es la misma
 * razón por la que `core/ai-errors.ts` guarda los de las rutas de IA.
 *
 * **Y hace falta distinguirlo de «esa no es tu contraseña».** Las dos cosas llegan
 * al cliente por el mismo sitio, y decirle «el correo o la contraseña no son
 * correctos» a quien la tiene bien y se ha pasado de intentos es mandarle a
 * cambiar una contraseña que funciona
 * ([adr/0054](../../docs/adr/0054-entrar-tiene-tope-de-intentos.md)).
 */

/** Se ha probado a entrar demasiadas veces seguidas. */
export const DEMASIADOS_INTENTOS = 'demasiados-intentos';
