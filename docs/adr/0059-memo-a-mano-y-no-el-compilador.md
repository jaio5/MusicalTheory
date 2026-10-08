# ADR 0059 — `memo` a mano donde se mide, y no el compilador de React

> **Nota del 8 de octubre de 2026:** «ningún test lo vigila» ya no vale. `ArrangeCanvas.pintados.test.tsx` cuenta con `<Profiler>` los pintados de cada fila y falla si una flecha nueva anula el `memo` ([ADR 0119](./0119-la-partitura-llena-su-hueco-y-el-lienzo-se-parte.md)). Y el `useEstable` del lienzo es hoy `useFuncionEstable`, en `src/ui/use-funcion-estable.ts`.

Fecha: 2026-09-30 · Estado: aceptada

## Contexto

Arrastrar en el lienzo de componer iba a saltos. Con la CPU a un sexto, cada
movimiento del puntero costaba 27 ms —fotograma y medio—, y la causa no era una
cuenta cara: era **pintar de nuevo el lienzo entero para mover un fantasma**.

- `use-block-drag.ts` guardaba la posición del puntero en el estado, y el
  arrastre de propuestas hacía lo mismo con `setSoltando`. Cada movimiento era un
  pintado del lienzo —mil cuatrocientas líneas de componente— con todas sus filas
  y sus pentagramas.
- Las filas no podían saltarse ese pintado aunque nada suyo cambiara: `PartRow`
  no iba con `memo`, y aunque fuera, le llegaban flechas nuevas en cada pintado
  —`onPlay={() => player.toggle(part.id)}`—. Lo mismo bajaba hasta el pentagrama
  y el carril del punteo.
- Y el lienzo se suscribía a lo capturado y al historial de notas **enteros**
  para sacar un booleano, así que con el micro abierto se repintaba al ritmo del
  motor.

Hay dos maneras de arreglar lo segundo: escribir `memo` y funciones estables a
mano, o encender el compilador de React (`reactCompiler` en `next.config.ts`), que
memoriza solo.

## Decisión

**A mano, y solo donde se ha medido que hace falta.**

- **Lo que se mueve con el puntero no pasa por React.** El fantasma se coloca
  escribiéndole el `transform` (`colocar` en `arrange/arrastrar.ts`); el estado
  solo cambia cuando cambia **el hueco** donde caería, que es lo único que cambia
  lo que se ve.
- **`memo` en `PartRow`**, y en `ArrangeCanvas` y `Ensayo`, que no reciben props y
  se enteran de lo suyo por los almacenes: la pantalla de componer se repinta con
  cada cambio del banco y ellos no tienen por qué. `Staff` y `MelodyLane` ya iban
  con `memo`.
- **Las acciones de las filas reciben la parte**, y el lienzo pasa las mismas
  funciones a todas; cada fila las ata a la suya con `useCallback`. Donde una
  acción lee algo que cambia a cada rato —el montaje, el pulso, el reproductor—
  se usa `useEstable`, en el propio lienzo: una función de identidad fija que
  llama a la última versión, que es lo que hay en pantalla cuando llega el evento.
- **A cada fila solo le llega lo suyo**: el bloque elegido, el que suena y el que
  se arrastra se pasan a la fila donde están, y `null` a las demás. Pasar el mismo
  identificador a todas las repintaba todas en cada paso de la reproducción.
- **Selectores que devuelven lo que se usa**, no la lista de la que se saca.

## Consecuencias

Hay que acordarse. Una flecha nueva escrita en el lienzo hacia una fila vuelve a
anular el `memo` sin que falle ningún test, y ningún test lo vigila; lo que lo
caza es mirar el perfilador arrastrando. Por eso `PartRow` lo dice en su
interfaz: sus acciones reciben la parte y ninguna la trae puesta.

**Lo que cuesta ahora no está medido con la misma vara que los 27 ms.** Se midió
antes, en el navegador y con la CPU ralentizada; el después se tiene que medir
igual con el skill `arrancar`.

## Alternativas descartadas

**El compilador de React.** Hace lo mismo sin tener que acordarse, y es lo que
recomienda React para lo nuevo. Se descarta ahora por tres cosas:

- **Es una dependencia más y un paso de Babel** en un proyecto que compila con
  Turbopack: cada fichero pasa además por Babel, y el precio lo paga cada `pnpm
dev` y cada `pnpm build`.
- **Se retira en silencio de lo que no entiende.** Un componente que lee un `ref`
  mientras pinta, o que muta algo, se queda sin memorizar y no avisa: se cree
  arreglado lo que no lo está. El lienzo tiene justo esa clase de piezas —las
  medidas del DOM para el arrastre—.
- **No arregla lo que más costaba**, que era el estado del puntero: memorizar un
  componente cuyo estado cambia sesenta veces por segundo no evita que se pinte.
  Eso se arregla sacándolo de React, con compilador o sin él.

Se reconsidera si aparecen más pantallas con el mismo problema: tres sitios con
`memo` escrito a mano se mantienen; quince, no.

**`memo` en todo el árbol de componer.** Se descarta por lo mismo que se
descartaría un índice más: cada `memo` es una comparación en cada pintado y una
cosa más que puede romperse con una flecha. Va donde se ha medido que el pintado
es caro y frecuente, y en ningún sitio más.
