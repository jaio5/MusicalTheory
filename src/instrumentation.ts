/**
 * Lo que se hace una vez, al arrancar el servidor.
 *
 * Next llama a `register` antes de servir la primera petición, también en la
 * salida `standalone` del contenedor, que no vuelve a leer `next.config.ts`. Es
 * el único sitio donde «al arrancar» quiere decir eso
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
 *
 * Avisa si `AUTH_SECRET` es demasiado corto para valer (`server/secreto.ts`), y
 * si se sirve en producción sin decir cuántos proxies hay delante, que deja a todo el mundo con un solo contador de frecuencia
 * ([adr/0113](../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 * Importado dentro de la función y solo en Node: este fichero también se carga
 * para el runtime de borde, y ahí no hay nada que avisar.
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { avisarSiFaltaElProxy } = await import('./server/rate-limit');
    avisarSiFaltaElProxy();
    const { avisoDeSecreto } = await import('./server/secreto');
    const aviso = avisoDeSecreto();
    if (aviso !== null) {
      console.error(aviso);
    }
  }
}
