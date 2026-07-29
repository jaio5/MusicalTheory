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
};

export default nextConfig;
