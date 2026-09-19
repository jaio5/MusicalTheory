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
