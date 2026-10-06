# ADR 0100 — Hacer sitio en el prompt de las salidas sin subir el presupuesto

Fecha: 2026-10-05 · Estado: aceptada · Amplía el
[ADR 0097](./0097-las-salidas-se-juzgan-por-lo-que-encajan.md)

## Contexto

El prompt de las salidas cabía en los 1.400 tokens de `TOKEN_BUDGETS.versiones.input`
por **3 o 4 tokens**: el peor caso real daba 1.396 y el tope de caracteres, 1.397.
Los estilos y los movimientos nuevos
([ADR 0098](./0098-seis-estilos-mas-para-que-no-se-juzguen-como-otro.md),
[0099](./0099-formas-y-movimientos-nuevos.md)) piden más motivos en cada salida, y no
había dónde ponerlos sin subir un presupuesto que es decisión de precio: baja los
cupos.

## Decisión

**Quitar lo que el modelo no usa ni para elegir ni para explicar, y exigir que el
sitio no se vuelva a gastar sin querer.**

- **La tabla de acordes solo lleva los grados que salen** (`acordesPorGrado`, en
  `features/versions/prompt.ts`): los tuyos, los de cada salida del menú y los que
  nombra lo que hace cada una. Llevaba todos los de la tonalidad. Un grado fuera del
  menú no se podía usar —el validador tapa el porqué que nombra un acorde de fuera—.
- **El papel de la parte va solo por nombre**: `Parte: estribillo.` Lo que el papel
  cambia en las salidas ya lo dice el juez en sus motivos.
- **El prompt de sistema pierde tres frases** (`server/prompts.ts`): que el menú va
  de más a menos encaje, que sin directrices se cuentan todas y que con ellas se
  eligen hasta tres. Las tres las repite la última línea del prompt de la petición,
  que es lo último que lee, y las obliga el esquema con su `minItems` y su
  `maxItems`: son 44 tokens menos en cada petición.
- **`MAX_CARACTERES_DEL_PROMPT` baja de 3.190 a 2.950.** El peor resto pasó de 1.848
  caracteres a 1.510, y con 2.950 el peor menú tiene más sitio que antes (1.440
  contra 1.342).
- **Una holgura exigida de 120 tokens** en `app/api/versiones/presupuesto.test.ts`:
  el peor prompt tiene que dejar libres 120 de los 1.400. Pasó a **1.277/1.278** (el
  peor real y la suma por tope), contra 1.396/1.397. Quien gaste esos 120 tiene que
  venir al test a decidirlo, no enterarse cuando falle.

## Qué costó, medido

Con `qwen3:8b`, del informe del agente que lo pasó:

- **Sin directrices, todo igual**: 513/514 antes y después, con los 216 porqués
  verdad. Lo que cambia es **«la 1 primero»**, que baja de 72/72 a 66/72: sin la
  frase, el modelo abre con la segunda en 6 de cada 72. Con directrices no hay orden
  que guardar; sin ellas el orden de contar es suyo (`soloExplica`). Es un coste, no
  una mejora.
- **Con directrices sube**: sigue lo pedido en 33 de 40 frente a 30 de 40, con una
  nota de 256/275 frente a 264/275. Más seguimiento y algo menos de nota.

No se ha pasado contra la API, así que no se sabe si un modelo grande lo nota.

## Consecuencias

- Los cupos no cambian: `TOKEN_BUDGETS` queda como estaba.
- El menú tiene más sitio, y los motivos se callan más tarde en una canción larga.
- «La 1 primero» sin directrices queda como pendiente en el ROADMAP.

## Alternativas descartadas

**Subir `TOKEN_BUDGETS`.** Es decisión de precio —baja los cupos— y no hacía falta:
lo que se quitó no lo leía nadie.

**Bajar el tope de caracteres sin recortar nada.** Dejaba sin sitio los motivos, que
es lo que el modelo necesita para explicar con verdad.

**Volver a poner «de más a menos encaje» en el prompt de sistema.** Devolvía «la 1
primero» a 70/72, pero se perdía lo ganado con las directrices: sigue lo pedido en
30 de 40, frente a 33 sin la frase.
