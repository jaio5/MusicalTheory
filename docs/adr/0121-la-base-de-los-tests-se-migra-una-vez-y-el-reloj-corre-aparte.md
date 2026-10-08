# ADR 0121 — La base de los tests se migra una vez, el reloj corre aparte y la integración continua se reparte

Fecha: 2026-10-08 · Estado: aceptada · Completa a
[ADR 0117](./0117-lo-que-se-levanta-escucha-solo-en-el-equipo.md)

## Contexto

La auditoría de pruebas del 8 de octubre de 2026 pasó la suite tres veces con la
máquina ocupada y **dos de las tres se cayó por tiempo**, sin que el código
estuviera mal:

| Qué                                                                   | Lo que pasaba                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Siete ficheros con PGlite arrancaban el WebAssembly y migraban        | El `beforeAll` pasaba de 10 s y 163 tests no llegaban a correr                                    |
| Seis pruebas miden tiempo de reloj (50 ms, 500 ms, «tarda lo mismo»)  | Al lado de dieciséis procesos montando pantallas medían la carga, no la función                   |
| «Una de oído terminada suma su XP» recorría la unidad con pausas      | 1,9 s suelta, más de 5 con carga; y solo miraba un enlace, no el XP                               |
| La integración continua pasaba la suite dos veces, en un solo trabajo | Once minutos por empujón                                                                          |
| PGlite corre como superusuario                                        | Un `grant` que faltase al rol de la aplicación (adr/0117) pasaba los tests y rompía en producción |

Medido aquí: de lo que tarda levantar PGlite, **el `initdb` son 1,7 s y las ocho
migraciones 30 ms**. Cargar un directorio de datos ya migrado, 0,3 s.

## Decisión

**La base se migra una vez por pasada.** `vitest.base-de-prueba.ts`, como
`globalSetup`, levanta un PGlite, aplica las migraciones de `drizzle/` y vuelca el
directorio de datos (`dumpDataDir`) a `node_modules/.cache/caos-ordenado/`, con la
huella de las migraciones y de la versión de PGlite en el nombre. Cada fichero lo
carga con `loadDataDir` (`server/db/para-tests.ts`): **sigue teniendo su base**,
solo que ya migrada.

**Las pruebas de reloj van en `*.reloj.test.ts`**, en un proyecto de Vitest aparte
(`reloj`) que corre **después** del resto (`groupOrder`) y **un fichero cada vez**.
No entran en la cobertura, así que sus topes son los de verdad: el triple que se
les daba con la cobertura midiendo desaparece, y con él la variable `COBERTURA`.
`pnpm test` corre los dos proyectos; `pnpm coverage`, solo `unidad`.

**La integración continua se reparte en trabajos que corren a la vez**: lo
barato y las pruebas de reloj; la cobertura en tres trozos (`--shard`) que dejan
su informe `blob` y un trabajo que los junta (`--merge-reports`) y exige ahí el
cien por cien —en cada trozo no se mira el tope, porque un trozo solo ve su
parte—; los tests con base contra **Postgres 17 de verdad con el rol
`caos_app`**; y un humo con Playwright (`scripts/humo.mjs`) sobre la compilación
de producción. La máquina, `ubuntu-24.04`; las acciones, en versiones de Node 24.

En el trabajo de Postgres la aplicación entra con `caos_app` y los tests vacían y
rompen tablas con el superusuario (`server/db/postgres-para-tests.ts`): lo que se
prueba es que el rol basta para lo que hace la aplicación. Los ficheros que levantan
base están en una lista explícita, `vitest.con-base.ts`, y forman el proyecto
`postgres`, que solo existe con `BASE_DE_PRUEBA_URL`; un guardián
(`server/db/para-tests.test.ts`) falla si un test con base no está en la lista. Así
entra también `auth.reloj.test.ts`, que la búsqueda con `grep` de antes dejaba fuera.

Los cinco trabajos comparten la preparación en una acción compuesta
(`.github/actions/preparar`), y guardan en caché el volcado de PGlite, `.next/cache`
y el navegador de Playwright. El humo recorre los tres anchos a la vez.

## Consecuencias

- La suite deja de depender de cuántos procesos haya al lado para los ficheros con
  base: 0,3 s por fichero en vez de 1,7 s, y el `initdb` una sola vez.
- Una prueba nueva que mida tiempo **va en un `*.reloj.test.ts`**. Si se queda en
  un `.test.ts` normal, volverá a fallar con la máquina ocupada.
- El volcado ocupa 40 MB en `node_modules/.cache`. Se rehace solo si cambian las
  migraciones o PGlite.
- Lo que se llama `*-para-tests*.ts` (`postgres-para-tests.ts`,
  `cronometro-para-tests.ts`) no cuenta en la cobertura: solo lo usan el trabajo de
  Postgres y las pruebas de reloj, que no la miden. Es una convención de nombre, no una
  lista que crezca.
- El trabajo de Postgres corre un fichero cada vez: comparten la base.

## Alternativas descartadas

- **Subir el `hookTimeout` de los ficheros con base.** Esconde el síntoma y deja
  el coste: siete `initdb` a la vez siguen siendo lo más pesado de la suite.
- **Una sola base compartida por todos los ficheros**, servida por un socket.
  Obliga a correr los ficheros con base en serie o a separarlos por esquema, y
  `pnpm test` dejaría de ser un comando sin nada levantado.
- **Reintentar las pruebas de reloj** (`retry`). Un tope que se pasa a veces y se
  da por bueno a la segunda no vigila nada.
- **Etiquetas de Vitest en vez de ficheros aparte.** Separan la prueba pero no el
  momento: siguen corriendo al lado de todo lo demás.
- **Comprobar el tope de cobertura en cada trozo.** Cada uno ve un tercio del
  código y fallaría siempre; quitar el tope de la integración tampoco: es lo que
  convierte «esto no puede pasar» en algo escrito.
- **Probar los permisos con PGlite.** Corre con un solo usuario, superusuario: no
  hay rol al que quitarle nada.
