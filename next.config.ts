import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  /**
   * Salida autocontenida: `.next/standalone` trae solo lo que hace falta para
   * arrancar, sin node_modules entero ni el código fuente. Es lo que hace que
   * la imagen del contenedor sea pequeña, y no estorba a quien despliegue en
   * Vercel, que ignora esta carpeta.
   */
  output: 'standalone',

  /**
   * Sin `X-Powered-By: Next.js`. Decir con qué está hecho no sirve a quien usa la
   * aplicación y sí a quien busca qué versión tiene un fallo conocido.
   */
  poweredByHeader: false,

  /**
   * Sin optimizador de imágenes, porque no se usa `next/image`: las capas de la
   * portada se importan y se pintan con su `src`, que ya llevan huella. Apagado,
   * `/_next/image` no redimensiona nada a petición de nadie, y `sharp` —que es
   * quien lo haría y quien ha tenido los avisos de seguridad— no recibe entrada
   * de fuera (docs/adr/0117).
   */
  images: { unoptimized: true },

  experimental: {
    /**
     * El tope del cuerpo que el proxy (`src/proxy.ts`) guarda en memoria: 128 KB,
     * el mismo que `MAX_CUERPO` de `server/request-body.ts`.
     *
     * **Es el único tope que tiene la entrada.** `/api/auth/callback/credentials`
     * no la lee nuestro código sino Auth.js, sin `readJsonBody`, y el de serie de
     * Next es de 10 MB: veinte entradas con un correo de 8 MB llevaron el proceso
     * de 46 a 687 MB. Como el proxy cubre todas las rutas, todo cuerpo pasa por
     * aquí. **No rechaza: recorta** —lo de más no llega a la ruta, y Next deja un
     * aviso en el registro—, y por eso es igual a `MAX_CUERPO` y no más pequeño:
     * un cuerpo que `readJsonBody` aceptaría no puede llegarle partido. Lo
     * comprueba `server/tope-del-cuerpo.test.ts`
     * ([adr/0113](./docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
     *
     * Experimental en esta versión: el nombre y lo que hace están en
     * `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md`.
     */
    proxyClientMaxBodySize: 128 * 1024,
  },

  /**
   * `next dev` deja de escribir en el `CLAUDE.md` de este repositorio.
   *
   * Desde la 16.3 añade solo un bloque en inglés al final del fichero —y lo
   * vuelve a añadir en cada arranque, así que el árbol nunca está limpio—. Ese
   * fichero es el mapa del proyecto, está escrito en español y tiene presupuesto
   * de líneas: lo que se mete ahí se decide, no se genera.
   *
   * Lo que el bloque venía a decir —que esta versión de Next no es la que
   * cualquiera tiene aprendida y que la documentación está en
   * `node_modules/next/dist/docs/`— queda dicho aquí, que es donde se mira
   * cuando algo de Next no cuadra.
   */
  agentRules: false,
};

export default nextConfig;
