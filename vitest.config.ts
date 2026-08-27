import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (segment: string) => fileURLToPath(new URL(`./src/${segment}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': src('core'),
      '@audio': src('audio'),
      '@media': src('media'),
      '@server': src('server'),
      '@state': src('state'),
      '@features': src('features'),
      '@ui': src('ui'),
      '@': src(''),
    },
  },
  test: {
    // El dominio se prueba en Node, sin DOM: si un test de core/ necesitase un
    // window, la pieza estaría en el sitio equivocado. Los tests de features/
    // pedirán jsdom con `// @vitest-environment jsdom` en su cabecera.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      // Todo `src/`, no solo el dominio. Medir solo `core/` daba un 97 % que no
      // decía nada: la mitad de lo que puede fallar está en las capas de fuera.
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        // Reexporta el manejador de Auth.js y no tiene lógica propia.
        'src/app/api/auth/**',
        // Los índices son listas de `export *`.
        '**/index.ts',
        // Definiciones de tipos y puertos sin implementación.
        'src/**/*.d.ts',
      ],
    },
  },
});
