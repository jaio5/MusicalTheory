import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (segment: string) => fileURLToPath(new URL(`./src/${segment}`, import.meta.url));

/** Si esta pasada mide cobertura, que cambia los tiempos de todo. */
const midiendoCobertura = process.argv.includes('--coverage');

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
    env: { COBERTURA: midiendoCobertura ? '1' : '' },
    /*
      Con la cobertura puesta se espera más a cada test, y por lo mismo de
      arriba: **el instrumentado de V8 multiplica por tres lo que tarda todo.**

      Los cinco segundos de serie sobran para `pnpm test` y se quedan cortos para
      `pnpm coverage` en los ficheros más pesados —montar la pantalla de componer
      entera tarda 700 ms suelta y pasa de cinco segundos con el instrumentador y
      el resto de ficheros en paralelo—. Y lo que salía de ahí no parecía un test
      lento: al caerse el fichero se perdía **la cobertura de todo él**, y el
      informe decía 96 % con cuatro errores de umbral, que se lee como «te has
      dejado código sin probar». Dos veces se buscó en el sitio equivocado.

      El número no afloja ninguna comprobación: sigue acotando un cuelgue, solo
      que con la holgura que la propia medición se come. `pnpm test` se queda con
      los cinco de siempre, que es donde un test lento sí es una señal.

      **Y sigue dependiendo de lo ocupada que esté la máquina.** Las dos veces
      que se cayó había un navegador y un servidor de producción corriendo al
      lado. Si vuelve a pasar en una pasada limpia, lo que hay que mirar no es
      este número: es por qué montar esa pantalla tarda lo que tarda.
    */
    testTimeout: midiendoCobertura ? 20_000 : 5_000,
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
      /*
        El cien por cien, y no como aspiración.

        Se llegó a él línea a línea, y una cobertura que baja sola vuelve al 97 %
        en un mes sin que nadie lo decida. Lo que de verdad no se puede ejecutar
        va marcado con `v8 ignore` **y su razón** (`docs/ESTILO.md`), así que
        bajar de aquí significa una de dos cosas: falta una prueba, o falta
        explicar por qué esa rama no puede darse.
      */
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
