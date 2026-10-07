# ADR 0097 — Las salidas se juzgan por lo que encajan, y se miden con exámenes que no se ajustan

Fecha: 2026-10-04 · Estado: aceptada · **Sustituye en parte** a
[ADR 0089](./0089-las-salidas-las-construye-el-dominio-y-el-modelo-elige.md) ·
Amplía [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md),
[ADR 0016](./0016-salidas-en-vez-de-versiones.md),
[ADR 0086](./0086-retocar-devuelve-solo-lo-que-cambia.md) y
[ADR 0088](./0088-el-profesor-siempre-contesta-y-sabe-mas.md) ·
**Ampliado por** [0098](./0098-seis-estilos-mas-para-que-no-se-juzguen-como-otro.md)
(los estilos), [0099](./0099-formas-y-movimientos-nuevos.md) (las formas y los
movimientos) y [0100](./0100-hacer-sitio-en-el-prompt-sin-subir-el-presupuesto.md)
(el sitio en el prompt)

## Contexto

El 0089 dejó las salidas **válidas por construcción**: ninguna rompía una regla.
Pero válida no es que **encaje**. El dominio construía con el modo, el tipo de
petición y una lista de grados, y nada más: un blues en `I7 IV7 V7` llegaba como
`I IV V`, un riff de quintas como tríadas, y el estilo de la barra no llegaba, así
que el bVII valía lo mismo en un jazz que en un rock. El menú alternaba caminos sin
ordenarlos por nada, y salían frases de siete compases, finales que no llegaban a
la tónica y dominantes que volvían atrás, todo permitido.

## Decisión

**El dominio sabe qué lleva la canción, genera mucho más de lo que enseña, y un
juez ordena lo generado antes de que el modelo lo vea.**

- **Contexto** (`core/music/contexto-de-salidas.ts`, `ContextoDeSalidas`): estilo,
  pulsos por compás, papel real de la parte, especies, dudosos y melodía por
  compás. **Viaja validado en la petición** (`features/versions/contract.ts`,
  `lo-que-se-manda.ts`, `menu.ts` con `contextoDe`) y entra en
  `salidasPosibles(mode, kind, original, contexto)`; el menú se arma al escribir el
  prompt y otra vez al validar, y si el contexto se leyera de otro sitio una vez,
  el número elegido señalaría otra salida. Se manda **una parte**: la de «De qué
  parte», o la del bloque seleccionado, o la última con acordes. Solo símbolos; los
  nombres de las partes no viajan.
- **Juez de encaje** (`core/music/encaje.ts`): once criterios con peso —sintaxis,
  cadencia, frase, ritmo armónico, bajo, notas comunes, melodía, estilo, novedad,
  papel y forma—, `puntos` de 0 a 100 y motivos **verdaderos, dichos en grados**.
  Un criterio que no aplica (sin melodía, sin estilo) no cuenta en vez de valer
  cero. Dos maneras de rechazar: el **`descarte`** es absoluto —no entra nunca— y
  el **`reparo`** es relativo —baja de `ENCAJE_MINIMO` (50) pero no vacía el menú—.
- **Generador** (`paths.ts`, `progressions.ts`, `reharmonization.ts`):
  `candidatasDeSalida` genera muchas más que las nueve del menú y `salidasPosibles`
  las **ordena por encaje con variedad** (`ordenarConVariedad`), con una red de
  `MINIMO_DEL_MENU` (3). Frases a múltiplos de la forma, llegada a la tónica,
  dominantes secundarias con séptima, especies heredadas, préstamos según el
  estilo, el blues por su forma, el modal sin sensible, saltos nuevos en el grafo y
  `V/V → I` fuera. Ocho movimientos entonces, no cinco —hoy son doce, ADR 0099—: corregidos (cadencia rota en el
  sitio de la I, tritono con séptima y antes de su objetivo, préstamo del paralelo)
  y nuevos (`dominante`, «Su dominante delante»; `funcion`, «Misma función»;
  `modal`, «Sin sensible» o «Con sensible»: V↔bVII, y V↔VII en menor; en quintas se
  nombra «bVII en lugar de V»).
- **Los saltos nuevos viven aparte del grafo compartido**:
  `MAS_SALTOS_DE_LAS_SALIDAS` y `saltosDeSalidas` (`progressions.ts`) suman las
  aristas de las salidas al de siempre. `nextDegrees` es el de antes y lo siguen
  usando el reanálisis de lo grabado (`audio/offline-chords.ts`) y las propuestas
  del lienzo; lo fija `progressions.test.ts`.
- **Menú vacío**: `porQueNoHaySalidas` dice por qué en vez de «no hay progresión».
- **Aplicar una salida** (`features/versions/aplicar-salida.ts`) cambia solo la
  parte a la que se refiere y conserva especie, duda, papel, vueltas, nombre y
  punteo; es un paso de deshacer, y probar otra **sustituye** a la anterior. El
  compás que suena arreglado se resalta. **El panel ya no ejecuta
  `salidasPosibles`**: su peso baja de 87 a 70 KB gzip.
- **Modelo y prompt** (`features/versions/prompt.ts`, `menu.ts`, `server/prompts.ts`,
  `app/api/versiones/salidas.ts`, `server/fake-model.ts`): el menú que ve el modelo
  es de **seis**, no nueve, con los motivos del juez dichos en acordes y un tope de
  caracteres del prompt (el menú ocupa lo que deja el resto). **Sin directrices el
  modelo explica las tres mejores**; con directrices, elige entre las seis. El
  respaldo sin IA son esas tres mejores con variedad y el porqué del juez. Las
  canciones de un acorde se aceptan.
- **Se mide con cinco exámenes del dominio** —`corpus-de-salidas` (71 de 72),
  `corpus-de-verificacion` (93 de 96), `corpus-ciego` (98 de 98), `corpus-final`
  (53 de 54) y `corpus-quinto` (27 de 50)—, cada uno con su trinquete y su lista
  `YA_NO_PUEDEN_FALLAR`, y con **`pnpm examen:salidas`**
  (`scripts/examen-de-las-salidas.ts`) contra el modelo de verdad.

### Por qué las tres mejores sin directrices

Medido con `qwen3:8b` sobre 513 salidas: cuando elegía él entre seis, 504 eran
buenas; la misma medida dio 506 con el menú, y **explicando las tres mejores,
508** (el 513 es el respaldo). Elegir no añadía criterio, solo ruido; donde sí
hace falta es leyendo la directriz («más triste»), y ahí sigue eligiendo.

### La historia que obliga a medir así

El primer corpus (38 casos) se usó **para ajustar**, y el acierto subió de 68 % a
98,6 %. Una verificación independiente con 48 casos nuevos dio **48 % bien y 14 %
mal**: el juez había aprendido el corpus. Tras arreglar las causas, una prueba
ciega con 61 casos (85 menús) dio 66 % bien y 3,5 % mal; con dos arreglos a medias,
52 de 85 menús enteros pasaban su examen estricto, y tras arreglar por sus causas
lo que encontró pasaron los 85.

**Y aquí hay que decir lo que no se hizo según la regla.** Esa última ronda también
**corrigió siete expectativas del propio ciego** que contradecían a otras, es decir:
se ajustó contra él, y desde ahí deja de medir. Lo mismo pasó con los otros dos.
Por eso se escribió un cuarto, `corpus-final` (50 casos corrientes, escritos sin
mirar el generador ni los otros tres). Su **medida ciega, antes de tocar nada**
(5 de octubre, 00:59): **36 de 50 menús enteros**, y **8 de 50** con las cinco
frases falsas que se añadieron a `diceAlgoFalso`; el arreglista lo juzgó 72 % bien,
18 % aceptable y 10 % mal. Las tres medidas ciegas sucesivas, en % bien / aceptable
/ mal: 48 / 39 / 14, 66 / 31 / 3,5 y 72 / 18 / 10. **Esa es la cifra honesta de
generalización**; el 46 de 50 de hoy es tras arreglar (y de corregir cuatro
expectativas), y no la sustituye. Con `qwen3:8b`: contesta 72/72, los porqués son
verdad 216/216, **508/513** sin directrices y **7/8** sigue las directrices.

**El quinto corpus**, `corpus-quinto` (50 canciones a medias escritas por un
arreglista antes de ver ningún menú ni los cuatro corpus de antes), es la cuarta
medida ciega sucesiva. Antes de tocar nada (5 de octubre, 12:14): **714 de 768
expectativas y 22 de 50 menús enteros** con el examen estricto; el arreglista los
juzgó 74 % bien, 24 % aceptable y 2 % mal. Tras arreglar por sus causas —las del
[ADR 0101](./0101-lo-que-dice-una-salida-es-verdad-sitio-por-sitio.md) y las de
`docs/DOMAIN-MUSIC.md`—: **732 de 768 y 27 de 50**, con trinquete en 0,95.
**El juicio del arreglista y el examen estricto no miden lo mismo.** Él mira «las
tres que se enseñan» y decide si le valen; el examen exige, además de una buena entre
las tres primeras, ningún error en todo el menú y la calidad de cada una de las tres,
y por eso es más severo. La serie ciega, en % bien / aceptable / mal, queda en
48 / 39 / 14, 66 / 31 / 3,5, 72 / 18 / 10 y 74 / 24 / 2. Los cinco exámenes de hoy
son salidas 71/72, verificación 93/96, ciego 98/98, final 53/54 y quinto 27/50, y
las cuatro últimas cifras son **tras arreglar**.

## Consecuencias

- **Un corpus que se usa para ajustar deja de medir.** Los cinco se han usado
  ya —el ciego, el final y el quinto también—, así que **la próxima medida honesta necesita un
  corpus nuevo**. Lo que sale de uno se arregla por su causa, no por su caso.
- **Lo canónico encaja; el resto, menos.** Los idiomas fuera de los seis estilos
  —cine, country, reggae, funk— fallaban más, y **no existía estilo** para bolero,
  flamenco o cine (hoy sí: ADR 0098). El juez no inventa lo que el dominio no
  tiene.
- **El 0089 deja de decir que son cinco movimientos y nueve salidas al modelo.**
  Nueve es el tope del dominio; el modelo ve seis.
- **El panel no vuelve a construir salidas**: lo que se aplica llega con lo que
  hace el servidor, y el peso de la ruta baja.
- El juez mide con criterios escritos por quien lo ajustó: una regla mal pensada
  se aplica con la misma seguridad que una buena. Los trinquetes la hacen visible,
  no correcta.

## Alternativas descartadas

**Seguir con el menú alternando caminos, sin juez.** Es lo que había: válido y
sin orden, con frases de siete compases y cierres que no llegan.

**Dejar que el modelo elija entre seis siempre.** Medido: 504, contra 508
explicando las tres mejores.

**Subir `TOKEN_BUDGETS`.** Era decisión de precio —baja los cupos— y no hacía
falta: el menú cabe con su tope.

**Un solo corpus.** Se sobreajusta, y lo demostró la verificación: 98,6 % contra
48 %.

**Ampliar el grafo compartido (`nextDegrees`) con los saltos nuevos.** Era lo más
corto, pero cambiaba el reconocimiento de lo grabado y las propuestas del lienzo
sin medirlo: un Mi mayor detrás del I en Do dejaba de costar. Por eso las aristas
de las salidas van aparte.

**Pedir al modelo «una frase tuya» o «las primeras» en prosa.** Medido: no cambia
lo que hace, igual que el «no copies» del 0086.

**Descartar todo lo que el juez reprocha.** Vaciaba menús; por eso el reparo es
relativo y baja los puntos sin quitar la salida.
