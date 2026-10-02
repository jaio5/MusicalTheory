# ADR 0086 — Retocar devuelve solo lo que cambia

Fecha: 2026-10-02 · Estado: aceptada · Amplía
[ADR 0016](./0016-salidas-en-vez-de-versiones.md), que pedía la canción entera, y
sigue la línea de [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md):
el modelo propone, el dominio verifica

## Contexto

Pedir «Retocar estos compases» devolvía siempre «Las versiones que han salido no
se sostienen con lo que estás tocando», sin una sola salida. Reproducido contra
`qwen3:8b` en el Ollama de casa, por el mismo camino que la ruta: **1 de 6**
llamadas —tres progresiones, dos intentos cada una— sacaba algo.

La causa no era el modelo equivocándose de acordes: **devolvía solo el trozo que
cambiaba**, aunque el esquema y el prompt le pedían la canción entera. Para
`I V vi IV` en Do mayor:

| Salida        | Lo que contestaba | Lo que leía `pathProblem`                    |
| ------------- | ----------------- | -------------------------------------------- |
| `rearmonizar` | `IV/4 V/4`        | «rearmonizar no cambia el largo»             |
| `otro-final`  | `bVII/4 I/4`      | «otro final no deja en pie la primera mitad» |
| `estirar`     | `V/8 I/4`         | «estirar no cambia los acordes»              |

Las tres respuestas tienen sentido como retoque; leídas como canción entera, no.
Es la misma lección que [ADR 0016](./0016-salidas-en-vez-de-versiones.md) aprendió
al continuar —«tus compases no se le piden: los pone el servidor»—, que se quedó
sin aplicar al retocar.

Medido antes de tocar nada, con ocho progresiones —de dos a ocho compases, mayores
y menores, con pulsos de 2 y de 8— y dos intentos cada una, como la ruta:

| Antes                        | Resultado                                          |
| ---------------------------- | -------------------------------------------------- |
| Peticiones con alguna salida | 7 de 8                                             |
| Salidas válidas              | 7 de 33                                            |
| Por camino                   | `estirar` 7 de 11, `rearmonizar` 0, `otro-final` 0 |

Y las siete de `estirar` eran casi todas lo mismo: **la canción entera con todos
los pulsos al doble**, que es lo único que sale bien copiando tus compases.

## Decisión

**Al retocar, el modelo dice desde qué compás cambia y devuelve solo ese trozo, y
el servidor monta la canción.**

- **El esquema** (`versionsSchema(mode, 'retocar')`) pide en cada salida un entero
  obligatorio `desde`, de 1 al tope de compases, detrás del camino y delante de los
  compases: se decide dónde empieza antes de escribirlo. Un trozo de un compás
  vale —cambiar un acorde es lo normal—, así que la parte pide uno y no dos.
- **El montaje** lo hace el dominio, `cancionRetocada` en `core/music/paths.ts`, y
  lo único que decide es qué tapa el trozo:
  - `rearmonizar` y `estirar` cambian compases sin moverlos de sitio: el trozo tapa
    **tantos compases como mide**, y lo demás se queda.
  - `otro-final` cambia lo que viene después: el trozo sustituye **todo** desde ese
    compás, y puede medir menos, que es acabar antes.
  - Un `desde` que no es uno de tus compases, o un trozo de los dos primeros que
    se pasa del final, no se puede montar y la salida se cae.
- **Las reglas no cambian.** `pathProblem` y `songProblem` juzgan la canción montada
  igual que juzgaban la entera; siguen siendo la red. La canción entera con
  `desde: 1` también vale, porque es un trozo que lo tapa todo.
- **El prompt** numera tus compases —`1: I x4 | 2: V x4 | …`—, porque es lo que
  cuenta `desde`; enseña **un ejemplo de cada salida hecho con tus compases** por
  el dominio, con el trozo y lo que queda rotulados; y termina diciendo, con tus
  números, qué no puede cambiar cada una: rearmonizar los pulsos, estirar los
  grados, otro final la primera mitad.
- **El `from` y el `move`** de cada compás se calculan sobre la canción montada, y
  el cliente recibe las salidas enteras como antes: ni `VersionsPanel` ni el tipo
  `Version` cambian.
- **El modo sin clave** devuelve también solo el trozo, con su `desde`: lo que se
  prueba sin pagar es el montaje de verdad.

A la IA siguen viajando solo símbolos: grados, pulsos y un número de compás.

## Consecuencias

Medido después, con las mismas ocho progresiones y el prompt de producción:

| Después                      | Resultado                                         |
| ---------------------------- | ------------------------------------------------- |
| Peticiones con alguna salida | **8 de 8, todas a la primera**                    |
| Salidas válidas              | **22 de 24**                                      |
| Por camino                   | `rearmonizar` 6 de 8, `estirar` 8, `otro-final` 8 |
| Tiempo medio por llamada     | 5,6 s, contra unos 7 antes                        |

Las dos que caen son de `rearmonizar` y no se repiten igual: un movimiento
declarado en un compás que no cambia, y un `V` puesto donde iba un `VI` diciendo
que es el tritono. Es el validador haciendo su trabajo.

**Y lo que no aguanta, dicho sin rodeos: 21 de esas 22 son el ejemplo copiado.**
`qwen3:8b` a temperatura cero devuelve el ejemplo del prompt tal cual, y lo que
pone de suyo es el título y el porqué. Por eso los ejemplos se construyen con tus
compases y con los mismos movimientos y el mismo grafo que los juzgan: un ejemplo
que se copia tiene que ser uno que valga, y `prompt.test.ts` comprueba que pasan el
validador. Lo que sale es correcto y modesto —un acorde cambiado por su relativo,
el primer compás al doble, un final de un compás en la tónica—. Si un modelo de
verdad propone algo suyo, solo lo puede decir la medición contra la API, que sigue
en el [ROADMAP](../ROADMAP.md).

Por el camino se midieron cinco versiones del prompt, siempre con las mismas ocho
progresiones:

| Prompt                                        | Peticiones | Válidas      | Qué pasaba                                      |
| --------------------------------------------- | ---------- | ------------ | ----------------------------------------------- |
| Ejemplos sobre una vuelta fija, `I V vi IV`   | 5 de 8     | 8 de 33      | Copiaba `desde 2: bII x4` en cualquier canción  |
| Con tus compases, `trozo → queda` sin rotular | 8 de 8     | 13 de 24     | Devolvía lo de la derecha: la canción, alargada |
| Vuelta fija, rotulados «trozo» y «queda»      | 8 de 8     | 15 de 27     | `rearmonizar` 2 de 9                            |
| **Con tus compases, rotulados**               | **8 de 8** | **22 de 24** | Copia el ejemplo                                |

Una quinta, añadiendo «estos ejemplos solo enseñan la forma: propón otros», bajó a
19 de 24 y siguió copiando 17: pedírselo en prosa no cambia lo que hace.

**El presupuesto de entrada crece.** Al retocar se añaden los números de tus
compases y los tres ejemplos: unos 300 tokens en el peor caso de treinta y dos
compases —lo que queda de cada ejemplo se corta a los ocho compases—, vigilado en
`features/versions/prompt.test.ts`. Y al medirlo salió algo que ya estaba: el
estimado de `server/prompts.test.ts` no cuenta el mapa de saltos, las cadencias ni
las directrices, y con ellos el peor prompt de verdad ya pasaba de los 1.400 tokens
de `TOKEN_BUDGETS.versiones` antes de este cambio —unos 1.660 a 3,2 caracteres por
token—; ahora el peor es el de retocar, con unos 1.950. Subir el presupuesto baja
los cupos de Medio y Pro, y eso es una decisión de precio que no va aquí: queda
anotado en el [ROADMAP](../ROADMAP.md).

## Alternativas descartadas

**Exigir los N compases con `minItems` y `maxItems`**, para que el esquema
obligue a devolver la canción entera. Es lo más directo: el esquema exige lo que
el validador espera, que es la regla de siempre. Se descarta porque el largo no es
el mismo para todas las salidas: **`otro-final` puede acabar antes**, y con el largo
fijado esa mitad de la salida desaparece. Y no se puede fijar solo para las otras
dos sin un esquema por salida, que es la tercera descartada. Además pediría
copiar tus compases, que es justo lo que el modelo no hacía.

**Arreglar a mano lo que llegue**: adivinar desde dónde iba el trozo mirando dónde
encaja en tu canción. Funcionaría con los tres casos de arriba y fallaría con el
primero que encajara en dos sitios, o en ninguno. Y es fiarse del modelo por la
puerta de atrás: el servidor inventaría la declaración que el modelo no hizo, y
luego el validador la comprobaría contra lo que el servidor se inventó. La línea
de [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md) es que el modelo
declara y el dominio comprueba; aquí el modelo declara `desde`.

**Un esquema distinto por salida, con `anyOf`**: `rearmonizar` y `estirar` con N
compases exactos, `otro-final` con su propio rango. Es lo más preciso sobre el
papel. Se descarta por lo que ya enseñaron las ideas y [ADR
0016](./0016-salidas-en-vez-de-versiones.md): cuando el esquema deja elegir forma,
el modelo elige la que no toca —con `steps` y `sections` opcionales se caían 4 de
4—, y con un `anyOf` la rama la elige el propio modelo al empezar a escribir, que
es lo mismo que dejarle elegir forma. Además triplica el esquema, que viaja en cada
petición y se paga como entrada.

**Ejemplos sobre una progresión fija**, que no se pueden copiar a tu canción.
Medido arriba: el modelo los copia igual, y copiados sobre otra canción no valen.
