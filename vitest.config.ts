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
    /*
      Que los tests sepan si se está midiendo la cobertura.

      Lo necesita `audio/main-thread-cost.test.ts`, que es el único que mide
      **tiempos**: el instrumentado de V8 envuelve cada función y multiplica por
      tres lo que tarda el análisis —24 ms medidos contra un tope de 8—, así que
      ese fichero fallaba siempre con `--coverage`. Y como Vitest no emite
      informe cuando algo falla, la consecuencia era peor que cuatro rojos: la
      cobertura **no se podía mirar**.

      Vitest no expone ninguna variable que lo diga, así que se pone aquí.
    */
    env: { COBERTURA: process.argv.includes('--coverage') ? '1' : '' },
    // El dominio se prueba en Node, sin DOM: si un test de core/ necesitase un
    // window, la pieza estaría en el sitio equivocado. Los tests de features/
    // pedirán jsdom con `// @vitest-environment jsdom` en su cabecera.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      /*
        El informe se emite aunque algún test falle.

        Por defecto no: un solo rojo y no hay informe, que es justo cuando más
        falta hace saber qué parte del código no estaba mirando nadie.
      */
      reportOnFailure: true,
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
