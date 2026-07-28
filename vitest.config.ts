import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (segment: string) => fileURLToPath(new URL(`./src/${segment}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': src('core'),
      '@audio': src('audio'),
      '@media': src('media'),
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
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
    },
  },
});
