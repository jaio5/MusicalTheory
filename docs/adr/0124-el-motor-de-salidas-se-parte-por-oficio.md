# ADR 0124 — El motor de salidas se parte por oficio, `versions` pasa a llamarse `salidas` y `ui/` tiene tres piezas conectadas

Fecha: 2026-10-08 · Estado: aceptada · Reordena lo que decidieron
[ADR 0089](./0089-las-salidas-las-construye-el-dominio-y-el-modelo-elige.md),
[0097](./0097-las-salidas-se-juzgan-por-lo-que-encajan.md),
[0099](./0099-formas-y-movimientos-nuevos.md) y
[0101](./0101-lo-que-dice-una-salida-es-verdad-sitio-por-sitio.md) sin cambiar
ninguna · Aplica el [ADR 0045](./0045-un-barril-por-pantalla-no.md) a los índices
de los features

## Contexto

Es una decisión de orden, no de comportamiento: **ninguna salida, ningún motivo
y ninguna cifra cambian**. Lo que cambia es dónde vive cada cosa.

- **Dos ficheros de 9.329 líneas.** `core/music/paths.ts` (5.059) validaba los
  caminos y construía el menú, con una familia de funciones por camino;
  `core/music/encaje.ts` (4.270) era el juez, con once criterios dentro. Medido con
  la regla `complexity` de ESLint: la función más enrevesada valía **71**
  (`juzgarPapel`), seis pasaban de 40 y siete medían más de 150 líneas
  (`rearmonizaciones`, 238).
- **Un ciclo de importaciones entre los dos**: el juez nombraba los caminos
  (`PathId`, `PathStep`) y quien construye guardaba el veredicto (`Encaje`). Y otro
  en el feature: `contract.ts` usaba el menú para validar y `menu.ts` leía la forma
  de la petición del contrato. Los dos eran de solo tipos —`import/no-cycle` no los
  ve—, pero dicen que algo está en el sitio equivocado.
- **El nombre viejo.** El [ADR 0016](./0016-salidas-en-vez-de-versiones.md) cambió
  «versiones» por «salidas» en la pantalla y en el dominio, y el feature, la ruta,
  los tipos y la capacidad del plan siguieron llamándose `versions`, `/api/versiones`
  y `'versiones'`. Quien buscaba «salidas» encontraba la mitad.
- **El prompt de las salidas vivía en `features/`**, que es lo que baja al
  navegador, aunque solo lo abre la ruta; el del profesor vive junto a su ruta
  (`app/api/teacher/prompt.ts`).
- **Cinco índices de feature que nadie importa** (`arrange`, `fretboard`,
  `sessions`, `songs`, `versions`): el ADR 0045 ya dijo que un barril que no se usa
  se borra.
- **`ui/` importaba de `state/` en tres sitios**, y la regla de capas dice que `ui/`
  solo mira a `core/`: `EmpezarPorTonalidad` abre el micro, `CupoDeIA` lee la cuenta
  y `ThemeToggle` el tema.

## Decisión

**1. El motor de salidas vive en `core/music/salidas/`, un fichero por oficio.**

```
salidas/
  index.ts        lo que el resto del proyecto ve, con nombre y sin `export *`
  tipos.ts        qué es una salida: lo usan quien valida, quien construye y el juez
  contexto.ts     lo que se sabe además de los grados (era contexto-de-salidas.ts)
  validar.ts      pathProblem, songProblem, el grafo de saltos
  idioma.ts       lo que se lee de tu canción antes de construir
  valor.ts        lo que vale cada grado y cada salto
  busqueda.ts     buscar caminos por el grafo
  especies.ts     con qué especie suena lo nuevo
  borrador.ts     lo que comparten los caminos al escribir una salida
  colores.ts      oscurece, aclara, tensa…
  seguir.ts       el camino `seguir`          coros.ts  seguir un blues
  contraste.ts    el camino `contraste`       estirar.ts, otro-final.ts, rearmonizar.ts
  menu.ts         salidasPosibles: llama a cada camino, juzga y ordena
  juez/           encaje.ts (el juez), juicio.ts (su vocabulario), enlace.ts y un
                  fichero por criterio: sintaxis, cadencia, frase, ritmo-armonico,
                  bajo, notas-comunes, melodia, estilo, novedad, papel, forma
  movimientos.ts  era reharmonization.ts       partir.ts, formas.ts, lo-que-dice.ts
  tonica.ts       la tónica del modo, que estaba escrita cinco veces
  corpus/         los cinco corpus y sus exámenes: datos de prueba
```

El texto se movió **tal cual**, declaración por declaración, con los imports
recalculados por el comprobador de tipos. Los ciclos se rompen en el sitio: los
tipos que comparten el juez y quien construye van a `tipos.ts`, y la forma de la
petición a `features/salidas/peticion.ts`. No queda ciclo ni de tipos.

**Las funciones más enrevesadas se parten sin cambiar lo que devuelven**:
`juzgarPapel` en una función por papel (`POR_PAPEL`), `rearmonizaciones` en el plan,
los cambios de un compás y lo que vale cada uno, `cadencia` en lo que cierra, el
reposo frigio y lo abierto, `forma` en el blues, el vamp, la sensible, la andaluza y
el periodo, `pathProblem` en una comprobación por camino, y `otrosFinales` y
`continuaciones` en sus pasos.

**2. `salidas/index.ts` dice lo que sale, y sale solo lo que alguien usa.** Antes
`@core/music` reexportaba los siete ficheros enteros; ahora reexporta el índice, que
nombra cada export. Se quitaron **67 nombres que nadie fuera de `core/music` usaba**
(`encaje`, `MOVES`, `pathProblem`, los tipos de las formas…); siguen exportados
entre los ficheros de `salidas/`, que es quien los usa. Un import nuevo desde arriba
pasa por añadirlo al índice, a la vista.

**3. `versions` pasa a llamarse `salidas` en todo lo que es código**:
`features/salidas/`, `/api/salidas`, `SalidasPanel`, `SalidasRequest`,
`SalidaPropuesta` (la que vuelve del modelo; `Salida` ya era el componente que la
pinta), `parseSalidasRequest`, `validateSalidas`, `SALIDAS_SYSTEM_PROMPT`,
`salidasSchema`, `MAX_SALIDAS`, `MAX_SALIDAS_DEGREES`, y **la capacidad del plan y la
función de la IA pasan de `'versiones'` a `'salidas'`**. No hay migración: ni la
capacidad ni la función se guardan en la base —el uso de la IA va por cuenta y mes,
sin columna de función, y `planOf` traduce planes, no capacidades—.

Se quedan como estaban, a propósito:

- **La clave `versions` del JSON** que devuelve el modelo y que la ruta manda a la
  pantalla. Es lo que el modelo lee en su esquema y cuenta en el presupuesto del
  prompt (adr/0100); cambiarla es cambiar lo que se le pide.
- ~~Los textos que lee la persona~~. **Se cambiaron después** (8 de octubre): los
  mensajes de error dicen «salidas», como el panel, y un test comprueba que ninguno
  dice «versión».

**4. El prompt de las salidas va junto a su ruta**: `app/api/salidas/prompt.ts`, como
el del profesor. Solo lo abre el servidor; en `features/` estaba en la capa que baja
al navegador. Los dos prompts de sistema siguen juntos en `server/prompts.ts`.

**5. `ui/` admite tres piezas conectadas, con nombre, y ESLint cierra el resto.**
`EmpezarPorTonalidad`, `CupoDeIA` y `ThemeToggle` pueden leer `@state`; cualquier
otro fichero de `ui/` que importe un valor de `@state`, `@audio` o `@media` no pasa
el lint (`no-restricted-syntax`, en un bloque propio de `eslint.config.mjs`). Los
tipos pasan, porque no conectan nada. Lo comprueba `src/capas.test.ts`.

**6. Muerte**: los cinco índices de feature, `src/app/banco-de-ia.test.ts` con su
`pnpm banco:ia` (lo mide entero `pnpm examen:salidas`), la reexportación de los topes
en `contract.ts` que nadie leía, `FALLBACK_PRICE` (un segundo nombre de
`MODELO_DESCONOCIDO`), el `export` de 38 nombres que solo usaba su propio fichero y
cuatro reexportaciones de `server/billing` y `server/mail` que nadie leía: lo que dijo
`knip`, comprobado uno a uno, en ficheros que nadie más estaba tocando.

## Cómo se comprobó que no cambia nada

- **Los cinco corpus dan las mismas cifras**, y el informe entero de cada uno es
  idéntico línea a línea: de las salidas 513/514 y 71/72; ciego 1.407/1.407 y
  98/98; verificación 1.017/1.020 y 93/96; final 783/784 y 53/54; quinto 732/768 y
  27/50.
- **Una foto del motor**: `salidasPosibles`, `candidatasDeSalida`,
  `porQueNoHaySalidas` y `pathProblem` sobre los cinco corpus y 900 canciones al
  azar con estilo, papel, compás, especies, dudas y punteo, en las dos peticiones
  —1.191 casos, 44 MB de JSON—, sacada del árbol de antes y del de después y
  comparada byte a byte después de cada paso.
- **La API de `@core/music`** comparada nombre a nombre: igual tras partir, y tras
  podar con 77 de menos y ninguno nuevo —los 67 de `salidas/` y diez tipos de otros
  ficheros de `core/music` que solo usaba el suyo—.
- El cien por cien de cobertura de `salidas/`, `features/salidas/` y
  `app/api/salidas/` se mantiene.

| Medido con `complexity` de ESLint | Antes        | Ahora                               |
| --------------------------------- | ------------ | ----------------------------------- |
| Fichero más largo del motor       | 5.059 líneas | 807 (movimientos.ts, que no cambia) |
| Función más enrevesada            | 71           | 39 (`notasComunes`)                 |
| Funciones de 40 o más             | 6            | 0                                   |
| Funciones de más de 150 líneas    | 7            | 0                                   |

## Consecuencias

- **Para tocar un criterio del juez se abre su fichero**, y lo que comparte con los
  demás está en `juicio.ts`. Para tocar un camino, el suyo.
- **Quien construye y quien juzga siguen usando la misma vara** —`formaDeBlues`,
  `esUnaBajada`, `cadenciaPropia`, `pulsosHabituales`—, ahora importada del criterio
  donde vive. La flecha va siempre del constructor al juez, nunca al revés.
- Un export nuevo de `salidas/` hacia arriba **se añade a mano al índice**. Es el
  precio de que el índice diga la verdad.
- Los textos de error que dicen «versiones» siguen ahí: es lo que queda del nombre
  viejo, y es de producto.
- Los informes y documentos que nombran `paths.ts`, `encaje.ts`,
  `features/versions/` o `/api/versiones` tienen que decir el sitio nuevo.

## Alternativas descartadas

**Dejar los dos ficheros y partir solo las funciones largas.** Bajaba la
complejidad sin tocar lo que más cuesta: encontrar dónde vive un criterio en 4.270
líneas, y el ciclo de tipos.

**Un `export *` por fichero en el índice de `salidas/`**, como el de `@core/music`.
Habría sacado hacia arriba todo lo que los ficheros se exportan entre sí para poder
partirse: más de cien nombres que no son de nadie de fuera.

**Mover las tres piezas conectadas fuera de `ui/`.** `ThemeToggle` y `CupoDeIA`
podrían ir a `app/`, pero `EmpezarPorTonalidad` la montan dos features —componer y
aprender— y un feature no importa de otro; tendría que partirse en una pieza que
recibe el micro por props y dos envoltorios, y la están tocando otros cambios a la
vez. Una lista con nombre y una regla que cierra el resto cuesta menos y para lo que
importa: que no crezca.

**Renombrar también la clave `versions` del JSON y los textos.** La clave la lee el
modelo y la cuenta el presupuesto; los textos son de producto. Ninguno de los dos es
orden.

**Una regla `no-restricted-imports` más para `ui/`.** No se acumula entre bloques: la
última que se configura para un fichero gana, y habría apagado la de las capas 3 y 5
en `ui/`.
