import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

import { CON_BASE } from './vitest.con-base';

const src = (segment: string) => fileURLToPath(new URL(`./src/${segment}`, import.meta.url));

/** Si esta pasada mide cobertura, que cambia los tiempos de todo. */
const midiendoCobertura = process.argv.includes('--coverage');

/**
 * Si esta pasada es un trozo de la suite (`--shard`), como en la integración
 * continua. Un trozo solo ve su parte del código, así que el tope del cien por
 * cien se mira al juntar los trozos (`vitest --merge-reports`) y no en cada uno.
 */
const unTrozo = process.argv.some((argumento) => argumento.startsWith('--shard'));

/**
 * Los tests que miden **tiempo de reloj**: que algo tarde menos de tantos
 * milisegundos, o que dos caminos tarden lo mismo.
 *
 * Van en su propio proyecto, que corre **después** del resto y **un fichero cada
 * vez**. Mezclados con los demás medían la carga de la máquina y no la función:
 * con dieciséis procesos montando pantallas al lado, un tope de 50 ms se pasaba
 * sin que el código hubiera cambiado (adr/0121). Y no entran en la cobertura: el
 * instrumentado de V8 multiplica por tres lo que tarda todo, y medir tiempos con
 * él encima no mide nada.
 */
const DE_RELOJ = 'src/**/*.reloj.test.ts';

/**
 * Si los tests con base van contra un Postgres de verdad (`BASE_DE_PRUEBA_URL`).
 *
 * Entonces salen de `unidad` y de `reloj` y corren en el proyecto `postgres`, uno
 * cada vez: comparten la base. Sin él son PGlite, una base por fichero, y corren
 * con los demás; el proyecto `postgres` no existe y `pnpm test` no los pasa dos
 * veces.
 */
const contraPostgres = process.env['BASE_DE_PRUEBA_URL'] !== undefined;
const sinLosDeBase = contraPostgres ? CON_BASE : [];

/**
 * Lo que no entra en la cobertura **por su nombre**: los ayudantes que solo
 * existen para las pruebas se llaman `*-para-tests*.ts` y se van solos. Antes
 * había que apuntarlos aquí uno a uno.
 */
const PARA_TESTS = '**/*-para-tests*.ts';

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
    // `TRUSTED_PROXY_HOPS`: los tests de las rutas mandan `X-Forwarded-For` como
    // lo pondría un proxy delante, y sin proxy de confianza esa cabecera ya no se
    // cree (`server/rate-limit.ts`): todos compartirían un tope y los de frecuencia
    // fallarían por ruido. Uno es lo que hay en el despliegue típico.
    env: { TRUSTED_PROXY_HOPS: '1' },
    /*
      Con la cobertura puesta se espera más a cada test, porque **el
      instrumentado de V8 multiplica por tres lo que tarda todo.**

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
    /*
      Y se abren menos procesos a la vez, por lo mismo.

      Vitest usa por defecto tantos como núcleos —aquí dieciséis—, y cada uno de
      los pesados levanta su propio jsdom. Sin instrumentar eso va sobrado; con
      ella, dieciséis pantallas montándose en paralelo se pisan entre sí, cada
      test tarda más de lo que tardaría solo y **los que ya iban justos se caen
      por tiempo**. Subir la espera lo redujo y no lo quitó: el fallo no era el
      número, era la competencia.

      La mitad de los núcleos es lo que hace que la medición sea repetible, que
      es lo único que se le pide a una medición. Tarda algo más, y da igual:
      `pnpm coverage` no es el comando que se ejecuta cada dos minutos.
    */
    ...(midiendoCobertura ? { maxWorkers: '50%' as const } : {}),
    // El dominio se prueba en Node, sin DOM: si un test de core/ necesitase un
    // window, la pieza estaría en el sitio equivocado. Los tests de features/
    // pedirán jsdom con `// @vitest-environment jsdom` en su cabecera.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // La base de los tests se migra una vez por pasada, no una por fichero.
    globalSetup: ['./vitest.base-de-prueba.ts'],
    // Cada proyecto dice sus ficheros: con `extends`, un `include` de aquí arriba
    // se sumaría al del proyecto de reloj y este correría la suite entera.
    projects: [
      {
        extends: true,
        test: {
          name: 'unidad',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: [...configDefaults.exclude, DE_RELOJ, ...sinLosDeBase],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'reloj',
          include: [DE_RELOJ],
          exclude: [...configDefaults.exclude, ...sinLosDeBase],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
      ...(contraPostgres
        ? [
            {
              extends: true as const,
              test: {
                name: 'postgres',
                include: [...CON_BASE],
                fileParallelism: false,
                sequence: { groupOrder: 2 },
              },
            },
          ]
        : []),
    ],
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
        // Los ayudantes de las pruebas: el cronómetro solo lo usan las de reloj,
        // que no corren con la cobertura, y el Postgres de verdad solo el trabajo
        // de Postgres de la integración continua.
        PARA_TESTS,
      ],
      /*
        El cien por cien, y no como aspiración.

        Se llegó a él línea a línea, y una cobertura que baja sola vuelve al 97 %
        en un mes sin que nadie lo decida. Lo que de verdad no se puede ejecutar
        va marcado con `v8 ignore` **y su razón** (`docs/ESTILO.md`), así que
        bajar de aquí significa una de dos cosas: falta una prueba, o falta
        explicar por qué esa rama no puede darse.
      */
      thresholds: unTrozo ? {} : { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
