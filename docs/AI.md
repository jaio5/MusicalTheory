# Ideas de IA: contrato del route handler

## Qué hace y qué no

El modo componer puede pedir ideas: progresiones a partir de lo que estás
tocando, un giro para romper el bucle, qué escala meter encima. Eso lo responde
un modelo de Anthropic, y siempre a través de un route handler del servidor.

**A la IA solo viajan símbolos.** Nunca audio, nunca una grabación,
nunca un identificador de usuario. Lo que sale del navegador es: la tonalidad
detectada, la escala elegida, los nombres de las notas tocadas últimamente y el
grado actual. Nada de eso permite reconstruir la interpretación, y ninguna de
esas cosas es un dato personal.

## Por qué la clave vive solo en el servidor

Una clave de API en el navegador es una clave pública: está en el bundle, en las
DevTools y en cualquier proxy. Da igual que se ofusque.

`ANTHROPIC_API_KEY` es una variable de entorno **sin** el prefijo
`NEXT_PUBLIC_`, así que Next no la incluye en el bundle del cliente. El SDK
`@anthropic-ai/sdk` se importa desde **un solo fichero de todo el proyecto**,
`server/ask-model.ts`: si apareciese importado desde un componente, el propio
bundler lo arrastraría al cliente.

Fueron tres —una copia por ruta— y solo se diferenciaban en el prompt de
sistema, el esquema y el tope de tokens. El porqué de apagar el pensamiento
estaba explicado tres veces con tres redacciones distintas, y no había forma de
saber si seguían diciendo lo mismo.

Esto además da un sitio donde poner límites de frecuencia, tiempo máximo y
control de coste, que en el cliente serían imposibles de hacer cumplir.

## Las tres rutas son una sola, y once diferencias

`ideas`, `teacher` y `versiones` hacían exactamente lo mismo en el mismo orden
—frenar por frecuencia, abrir las puertas del gasto, montar el prompt, llamar al
modelo, validar, reintentar una vez, contestar— y lo hacían con tres copias del
mismo cuerpo. Cuando había que cambiar algo del orden, se cambiaba tres veces; y
una vez se cambió solo en dos.

Ahora el cuerpo está una vez, en `server/ai-route.ts`, y cada ruta se declara:
qué contador la frena, cómo se lee su petición, qué prompt escribe, qué esquema
pide, cuántos tokens gasta como mucho, qué contesta sin clave y cómo valida lo
que vuelve. Once campos, y ninguno de ellos es «en qué orden pasan las cosas».

Dos tests lo sujetan: uno comprueba que ninguna ruta contiene `spendAi` ni
`askModel(` —si vuelve a aparecer, es que alguien ha vuelto a escribir el cuerpo
a mano— y otro que en el cuerpo común la puerta del gasto va **antes** de la
llamada al modelo, que es lo único que hace que se cobre el intento.

## Endpoint

```
POST /api/ideas
Content-Type: application/json
```

### Entrada

```jsonc
{
  "kind": "progression" | "twist" | "scale",
  "key": { "tonic": "A", "mode": "minor" },
  "scale": "minorPentatonic",          // opcional: la escala activa
  "currentDegree": "i",                // opcional: el grado que suena ahora
  "recentNotes": ["A", "C", "E", "G"], // opcional, máximo 32
  "recentChords": ["Am", "G", "F"]     // opcional, máximo 16
}
```

Reglas de validación, todas comprobadas en el servidor antes de llamar al
modelo:

- `kind` es obligatorio y solo admite esos tres valores.
- `key.tonic` es uno de los doce nombres de nota; `key.mode` es `major` o
  `minor`.
- `scale` es uno de los identificadores de `core/music/scales`.
- Las listas se recortan a su máximo; los nombres que no sean notas o cifrados
  válidos se descartan en silencio.
- Cualquier campo que no esté en el esquema se ignora. El cuerpo no se
  reenvía tal cual al modelo: se reconstruye a partir de los campos validados.

### Salida

```jsonc
{
  "ideas": [
    {
      "title": "Bajar por tonos y volver",
      "degrees": ["i", "VII", "VI", "VII"],
      "chords": ["Am", "G", "F", "G"],
      "why": "Mantiene el centro en A menor y evita la sensible.",
    },
  ],
}
```

Entre una y cuatro ideas. `degrees` usa los mismos símbolos que
`core/music/progressions` (`i`, `VII`, `bVII`, `V`...), de modo que la interfaz
puede resolverlos a acordes concretos con `resolveProgression` y comprobar que
existen. `why` es una frase corta, en español, en el mismo tono que el resto de
la aplicación.

Para `kind: "scale"` la forma cambia: en vez de `degrees` y `chords`, cada idea
trae `scale` (un identificador de escala) y `tonic`.

### Errores

Siempre con esta forma, nunca con el error crudo del proveedor:

```jsonc
{
  "error": {
    "code": "invalid_request",
    "message": "Falta la tonalidad. Toca unos compases para que podamos detectarla.",
  },
}
```

| Código HTTP | `code`                 | Cuándo                                                    |
| ----------- | ---------------------- | --------------------------------------------------------- |
| 400         | `invalid_request`      | El cuerpo no cumple el esquema.                           |
| 401         | `account_required`     | No hay cuenta. La IA no se sirve sin ella.                |
| 402         | `plan_required`        | El plan de quien pide no incluye esto.                    |
| 429         | `rate_limited`         | Demasiadas peticiones seguidas desde esta dirección.      |
| 429         | `quota_exhausted`      | Se gastó el cupo del mes o el del día.                    |
| 502         | `model_unavailable`    | El proveedor ha fallado o ha tardado demasiado.           |
| 502         | `unparseable_response` | El modelo ha contestado algo que no encaja.               |
| 503         | `model_unavailable`    | No se ha podido contar el cupo, así que no se ha servido. |

El mensaje va en español, dice qué ha pasado y qué hacer. Nunca se filtran ni
la clave, ni la URL del proveedor, ni la traza.

**`plan_required` y `quota_exhausted` llegan con el mensaje ya escrito por la ruta**,
con el plan y el número concretos: «Las ideas de la IA entran en el plan Medio:
9,99 € al mes», «Se te han acabado las 181 peticiones a la IA de este mes: se renuevan
el día uno, y con el plan Pro son 363 al mes». La frase la construye
`core/billing/messages.ts`, que es la misma que usa la pantalla para pintar el
candado, y por eso el cliente **prefiere el mensaje del servidor** al genérico de su
contrato cuando viene uno.

El 402 no es un código de moda: es literalmente «hace falta pagar», y distinguirlo
del 429 importa porque uno se arregla cambiando de plan y el otro esperando a mañana.

Por eso el cliente **guarda el código y no solo la frase**: de él depende si debajo
del aviso aparece el enlace a `/planes`. Sale con `plan_required` siempre, y con
`quota_exhausted` solo si queda plan por encima —a quien ya está en Pro no hay nada
que ofrecerle—. Con el modelo caído no sale: mandar a la lista de precios a quien
tiene un problema que no se arregla pagando es hacerle perder el viaje. La regla está
escrita una vez, en `ui/PlansLink.tsx`, porque la usan el profesor y las ideas y un
feature no importa de otro.

## Qué pasa cuando el modelo devuelve algo que no parsea

Es el caso normal, no el excepcional, y por eso hay tres capas:

1. **Salida estructurada.** La petición usa `output_config.format` con un
   esquema JSON, así que la respuesta viene ya constreñida a esa forma. Esto
   elimina la mayoría de los casos, pero no los convierte en imposibles.

   Y tiene una condición que no es obvia: **el esquema garantiza lo que exige, no
   lo que el validador espera.** Si las dos listas se separan, lo que sale es una
   respuesta impecable contra el esquema que el validador barre entera, y el
   modelo no tiene forma de saberlo. Pasó con las ideas: el esquema pedía `title`
   y `why` y dejaba `degrees` opcional, y `validateIdeas` tira toda idea sin
   grados. Contra dos modelos locales pasaban 0 de 4 peticiones —cupo gastado,
   502— y exigiéndolo, 36 de 36.

   Por eso `ideasSchema(kind, mode)` **es una función**: lo que hace falta depende
   de lo que se pida, y los grados válidos no son los mismos en mayor que en
   menor. Los enumerados van con ello: la generación constreñida no puede salirse
   de un `enum`, y `naturalMinor` o `minorPentatonic` no se adivinan —pidiéndolos
   en prosa salía «Escala natural», que no es ningún identificador—. Lo vigila
   `app/api/esquema-ideas.test.ts`, que vive en `app/` porque es la única capa que
   ve el esquema de `server/` y el validador de `features/` a la vez.

2. **Validación en el servidor.** La respuesta se valida contra el mismo
   esquema antes de devolverla: que los grados existan en el modo indicado, que
   los cifrados sean acordes reales, que haya entre una y cuatro ideas. Una
   idea concreta que no valide se descarta; si no queda ninguna, se responde
   `unparseable_response`.
3. **Un reintento y basta.** Si la respuesta no valida, se reintenta una vez. Si
   la segunda tampoco, se devuelve el error. No se encadenan reintentos: cuestan
   dinero y tiempo, y el usuario prefiere un «no ha salido, prueba otra vez»
   rápido a treinta segundos de espera.

En ningún caso se devuelve al cliente texto sin validar. Si el modelo se inventa
un acorde imposible, muere en el servidor.

## Configuración del modelo

```ts
// src/server/ask-model.ts — el único sitio del proyecto que importa el SDK.
const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

const response = await client.messages.create({
  model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
  max_tokens: 2048,
  system: SYSTEM_PROMPT,
  output_config: { format: { type: 'json_schema', schema: IDEAS_SCHEMA } },
  messages: [{ role: 'user', content: buildPrompt(input) }],
});
```

- **Modelo**: `claude-opus-5` por defecto, configurable por entorno.
- **`max_tokens`**: 2048. Las ideas son cortas; un tope bajo acota el coste y
  evita respuestas que se van por las ramas.
- **Sin `temperature`**: los modelos actuales no la aceptan. La variedad se pide
  en el prompt, no con parámetros de muestreo.
- **Prompt de sistema**: fija el criterio —rock, no coral—, exige español, y
  prohíbe explicar teoría que no se haya pedido.

## Quién contesta: tres proveedores y un orden

`server/ai-model.ts` decide, y las tres rutas no se enteran: le entra la misma
pregunta a `askModel` y les vuelve la misma forma. El orden es este, y no es
casual:

| Si hay...                 | Contesta                     | Sirve para                                         |
| ------------------------- | ---------------------------- | -------------------------------------------------- |
| `ANTHROPIC_API_KEY`       | La API de Anthropic          | Producción, y probar de verdad la calidad          |
| `OLLAMA_URL` (y no clave) | El modelo de casa, en Docker | Iterar sobre los prompts sin factura               |
| Ninguna de las dos        | El dominio (`fake-model.ts`) | Probar pantallas sin descargar ni dar de alta nada |

**La clave gana al modelo local**, y a propósito: `OLLAMA_URL` es una variable que
se pone para probar y se olvida puesta. Si ganara ella, un despliegue con las dos
configuradas serviría en silencio respuestas de un modelo pequeño a quien ha
pagado el plan Pro. Para probar en local se quita la clave, que es lo explícito.

En producción, sin ninguno de los tres, las rutas contestan 503 y no gastan cupo.

## El modelo de casa: Ollama en un contenedor

```bash
pnpm docker:ia     # Postgres, migraciones, Ollama con su modelo, y la aplicación
```

Levanta `compose.ia.yml` encima de `compose.yml`. La primera vez descarga unos
5 GB —`qwen3:8b`, que de su tamaño es el que mejor respeta un esquema JSON
estricto— y los deja en un volumen, así que solo pasa una vez. Con `OLLAMA_MODEL`
se cambia sin tocar código.

Está en un fichero de compose aparte porque **pide una gráfica NVIDIA**: sin ella,
`docker compose up` tiene que seguir funcionando igual. Se puede correr en la CPU
comentando el bloque `deploy`, pero una respuesta pasa de segundos a un minuto
largo y deja de servir para probar nada con la guitarra en las manos.

Quien hable con él es `server/local-model.ts`, **sin SDK**: Ollama habla JSON por
HTTP y `fetch` está en el runtime. Las tres decisiones de coste de la API se
traducen, no se reinventan:

| En la API                        | En Ollama             | Por qué                                           |
| -------------------------------- | --------------------- | ------------------------------------------------- |
| `thinking: { type: 'disabled' }` | `think: false`        | La respuesta la fija un esquema: nada que razonar |
| `max_tokens`                     | `options.num_predict` | El mismo número del presupuesto de `cost.ts`      |
| `output_config.format`           | `format`              | El esquema constriñe la generación                |

Tres cosas que conviene saber antes de que muerdan:

- **La primera petición tarda.** Cargar cinco gigas de pesos en la gráfica va
  antes de generar el primer token. El tope de espera son dos minutos por eso; las
  siguientes tardan segundos.
- **Los cupos salen pequeños.** El modelo local no está en la tabla de precios, así
  que se cobra al precio del más caro conocido. Es incómodo y es lo correcto: el
  cupo defiende de un gasto, y suponer coste cero sería dividir entre cero.
- **`/api/versiones` es la que peor va**, y con motivo: es la única que verifica el
  razonamiento movimiento a movimiento contra el dominio, así que un modelo pequeño
  que declare mal lo que hizo se queda sin versión. Eso no es un fallo del montaje;
  es la primera vez que esa verificación tiene algo que rechazar.

Esto es **para probar, no para producción**. El porqué entero, con lo que se
descartó, está en [adr/0014](./adr/0014-un-modelo-de-casa-para-probar.md).

## Sin ningún proveedor: contesta el dominio

Fuera de producción, sin `ANTHROPIC_API_KEY` y sin `OLLAMA_URL`, las tres rutas
contestan con `server/fake-model.ts` en vez de fallar. Es el tercer puerto con la misma forma
que el cobrador que no cobra y el correo que no manda, y por la misma razón: sin
él, media aplicación no se puede probar sin dar de alta un servicio y empezar a
pagar por tokens.

**Lo que devuelve sale del dominio.** Las versiones se construyen aplicando
movimientos de verdad de `core/music/reharmonization.ts` a la progresión que se
manda, así que pasan la misma verificación que pasaría una respuesta del modelo.
Eso permite probar la pantalla, la reproducción y «ponerla en el camino» sin
gastar un céntimo.

Lo que **no** prueba: si el modelo de verdad devuelve versiones que valgan la
pena. Eso no lo puede decir nada que no sea el modelo. Por eso todo lo que sale de
ahí lo lleva escrito en su propio texto —en pantalla se lee «Sin IA»— y en
producción sin proveedor se sigue contestando 503. El modelo de casa **no** se
marca así: es un modelo generando de verdad, aunque acierte menos.

## Antes de las puertas: ¿hay quien conteste?

Las tres rutas comprueban `modelAvailable()` **antes de tocar el cupo**, y
contestan 503 si no hay proveedor ninguno. No es una comprobación de cortesía: `spendAi` cuenta la
petición antes de hablar con el modelo, así que sin clave configurada la llamada
fallaba igual unas líneas más abajo pero la petición ya estaba gastada. Alguien se
quedaba sin peticiones del mes por una variable de entorno que faltaba.

`hasModelKey` estaba escrita desde la fase 5 y no la llamaba nadie. Hay un test que
lee las tres rutas y comprueba que el proveedor se sigue mirando antes que el cupo:
el orden de dos líneas es justo lo que se pierde al refactorizar.

## Las tres puertas: frecuencia, cuenta y cupo

Tres cosas distintas, y las tres hacen falta.

**Diez peticiones por minuto y dirección**, en una ventana deslizante
(`server/rate-limit.ts`). No sabe de planes a propósito: aunque pagues, no hay razón
para hacer diez peticiones en un segundo. El contador vive **en memoria y por
instancia**: si esto corre en varias, cada una lleva su cuenta. Para lo que defiende
—pulsar el botón veinte veces seguidas— es suficiente.

**Cuenta.** Sin cuenta se contesta `401` y no se llama al modelo. Es lo que hace que el
límite sea de verdad por cliente: una dirección IP se cambia con el móvil en la mano.
Antes había un contador anónimo por dirección y en memoria; se ha borrado, no
arreglado.

**Los dos cupos del plan** (`server/ai-usage.ts`) —el del mes y el del día—, que son
los que acotan el gasto. Van al final porque son una escritura en la base de datos y
comprobar memoria es gratis.

Los cupos **no están escritos en ninguna parte: se calculan** desde el precio del plan,
el precio del modelo y el peor caso de tokens de la petición
(`core/billing/cost.ts`). El `max_tokens` de estas rutas sale de ese mismo sitio, así
que el peor caso que supone la aritmética es el tope que impone el servidor. La tabla
de números y el porqué están en [CUENTAS-Y-PLANES.md](./CUENTAS-Y-PLANES.md) y en
[adr/0008](./adr/0008-los-cupos-salen-del-precio.md).

Cuatro detalles del cupo que conviene no olvidar aquí:

- **Se descuenta antes de llamar al modelo**, no después: se cobra el intento. Por eso
  el reintento de la ruta no vuelve a pasar por esta puerta.
- **Los dos topes se comprueban en la misma sentencia**, para que dos peticiones a la
  vez no gasten las dos la última que quedaba.
- **El mes y el día son los del servidor, en UTC.** El que paga la factura es el
  servidor. Creerse la zona horaria del navegador permitiría renovar el cupo cambiando
  la hora del ordenador.
- **El mensaje dice cuál de los dos se agotó**, porque no se arreglan igual: uno se
  espera a mañana y el otro se arregla subiendo de plan.

## Pensar está apagado en las tres rutas

Y es una decisión de coste, no un descuido. La respuesta la fija un esquema JSON: no
hay nada que razonar. En `claude-opus-5` **el pensamiento viene encendido por
defecto** y se cobra como tokens de salida, así que dejarlo puesto multiplicaba el
coste de cada pregunta y podía gastarse el `max_tokens` pensando para devolver una
respuesta truncada —se paga y no se sirve—.

`server/ask-model.ts` manda `thinking: { type: 'disabled' }` con `effort: 'low'` para
las tres, y los tres prompts de sistema piden explícitamente que no se cuelen
etiquetas XML internas en la respuesta: es lo que recomienda la documentación del
modelo para ese caso.

Los tres prompts y los tres esquemas viven juntos en `server/prompts.ts`, y no dentro de
sus rutas, porque **de su longitud dependen los cupos de todos los planes**. Allí se
pueden medir: `server/prompts.test.ts` cuenta sus caracteres y falla si crecen hasta
comerse la holgura del presupuesto de tokens.

## Por dónde entra texto que no controlamos

Toda la superficie, contada: **un campo y 240 caracteres**, la pregunta del
profesor. Nada más.

`/api/ideas` no acepta ni un carácter libre —tónica, modo, escala, grados y
cifrados van contra enumerados, y lo que no encaja se descarta en silencio—. La
unidad que se lee viaja por su identificador. El nombre de la canción **ya no se
manda**: solo construía una línea del prompt, no volvía en la respuesta, no se
guardaba, y el cliente ni siquiera lo enviaba.

Alrededor de ese único canal hay dos cosas, y las dos están en
[adr/0015](./adr/0015-un-solo-canal-de-texto-libre.md):

1. **La pregunta va entre marcas `###PREGUNTA###`** y el prompt de sistema dice
   que lo de dentro es un dato y nunca una instrucción. La marca se le borra a la
   pregunta al validarla: sin eso, quien la escribiera cerraría el bloque y lo de
   después se leería como instrucciones nuestras.
2. **El modelo declara `tema: 'musica' | 'fuera'`**, obligatorio, enumerado y
   primero en el esquema —la generación constreñida rellena en ese orden, así que
   lo decide antes de contestar—. Con `fuera`, `validateTeacherAnswer` tira su
   texto y su ejemplo enteros y devuelve una frase nuestra. Su prosa no llega a la
   pantalla.

**Y lo que de verdad limita el abuso no es ninguna de las dos.** Contra alguien
decidido, una inyección que funcione hará que el modelo conteste `musica`. Lo que
sostiene el argumento son los topes: 400 tokens de salida —de ahí no sale un
ensayo—, cuenta obligatoria, quince peticiones al mes en el plan gratis con sus dos
cupos, diez por minuto, y una respuesta que solo ve quien preguntó. El abuso no se
hace imposible; se hace inútil, que es lo alcanzable.

Medido con ocho casos y dos modelos locales: `qwen3:8b` acierta los ocho,
`gemma4:e4b` tres de ocho. **La puerta vale lo que valga el modelo siguiendo
instrucciones**; los topes valen lo mismo con cualquiera.

Dos cosas más que ya estaban y conviene no perder: el texto del modelo se pinta
con `{answer.answer}` dentro de un `<p>`, así que React lo escapa y no hay
inyección de HTML; y todo lo guardado filtra por `userId`, así que nada de lo que
escribe el modelo llega a otra persona.

## Privacidad, en una línea

Lo que sale del equipo son entre diez y cincuenta caracteres de símbolos
musicales. Ni una muestra de audio.

## El profesor

Un segundo route handler, `/api/teacher`, con el mismo reparto: el SDK y la
clave viven solo en el servidor, el contrato en `features/learn` para que lo
usen los dos lados, y las dos puertas —frecuencia y cupo— compartidas en
`src/server/`.

El profesor **sí entra en el plan gratis**, con tres preguntas al día: un plan
gratis que no deja probar lo que se paga no vende nada. Las ideas no, porque son la
parte más cara y la única que se puede pedir en cadena sin leer lo anterior.

Lo que viaja es la tonalidad, la escala, **el identificador** de la unidad que se
está leyendo y la pregunta escrita, recortada a 240 caracteres. El identificador y
no el título: el título lo resuelve el servidor contra `core/music/curriculum.ts`,
así que ese campo dejó de ser texto libre entrando a un prompt. El audio sigue sin
salir del equipo: esta petición no los toca.

De vuelta viene una respuesta corta y, si viene a cuento, un ejemplo tocable en
grados. Los cifrados del ejemplo no se creen: se recalculan desde los grados
contra la tonalidad real, igual que en ideas, que es la única forma de que no
aparezca en pantalla un acorde que no existe ahí.

## Las salidas: por dónde puede tirar lo que tocas

Un tercer route handler, `POST /api/versiones`, con el mismo reparto que los otros
dos. Es **la petición más cara de las tres** y entra solo en el plan Pro.

Entra una progresión en grados con sus pulsos, una tonalidad y **qué se pide**.
Salen hasta tres **salidas**: canciones distintas que arrancan de lo que llevas
tocado. No son versiones de la misma canción: son caminos para elegir.

Y lo que se pide se elige antes, entre dos cosas:

| `kind`      | Qué hace                                 | Qué devuelve el modelo                    |
| ----------- | ---------------------------------------- | ----------------------------------------- |
| `continuar` | Sigue tu canción y le hace sus partes    | **Solo las partes que añade**, con nombre |
| `retocar`   | Cambia estos compases sin salir de ellos | Una sola parte con la progresión entera   |

**Elegir antes no es cosa de la interfaz.** Es lo que hace que el esquema pueda
exigir lo que el validador comprueba —continuar necesita al menos una parte nueva
y retocar exactamente una— y eso un esquema JSON no lo puede condicionar a un
campo que el propio modelo rellena. Con el camino libre: cero salidas válidas de
cuatro peticiones. Eligiendo antes: tres de tres.

**Tus compases no se le piden.** Al continuar, el modelo devuelve solo lo que
añade y el contrato pone tu parte delante. Pedirle que la copiara era la causa de
que se cayera todo, y repetirla solo gastaba tokens.

**Aunque por delante se llame «grabar un trozo», aquí no sube nada de audio.** La
aplicación ya sabe qué acorde suena —el motor de croma lo dice y `core/music/capture.ts`
lo convierte en grados con sus pulsos—, así que grabar es apuntar símbolos. Lo que
viaja son entre treinta y doscientos caracteres.

### Las cinco salidas, y cómo se comprueba cada una

El catálogo vive en `core/music/paths.ts` y se le enseña al modelo generado desde
ahí, nunca escrito a mano en el prompt.

| Salida        | Qué hace                                    | Qué se comprueba                                         |
| ------------- | ------------------------------------------- | -------------------------------------------------------- |
| `rearmonizar` | Los mismos compases con otros acordes       | Cada compás cambiado declara su movimiento y se reaplica |
| `seguir`      | Mantiene tus compases y añade hasta cerrar  | El principio intacto y el final en la tónica             |
| `otro-final`  | Deja la primera mitad y cambia lo que viene | La mitad intacta, y no alarga                            |
| `estirar`     | Los mismos acordes durando otra cosa        | Ni un grado tocado, y algún pulso distinto               |
| `contraste`   | Añade una parte que se va y puede volver    | No cierra, y desde su último grado se vuelve al primero  |

### Se verifica el razonamiento, no solo el resultado

Es la diferencia con las ideas, y lo que sostiene la función entera. Antes cada
compás declaraba su movimiento; ahora **la declaración sube al camino**: cada salida
dice cuál ha tomado y el dominio vuelve a comprobarlo. Un `contraste` que cierra en
la tónica se descarta —eso es un `seguir`—, y un `estirar` que toca un acorde
también.

Debajo hay una segunda comprobación: **cada salto que no estaba en tu canción tiene
que existir en `nextDegrees`**, el grafo armónico del dominio. Son unas tres salidas
por grado, así que una parte nueva de cuatro compases tiene del orden de ochenta
caminos posibles. **El mapa entero va en el prompt**, generado desde el dominio: es
lo mismo que hacen los grados enumerados de las ideas, y por la misma razón.

Una salida se descarta entera cuando declara un camino y toma otro, cuando el
camino no es de la clase que se pidió, cuando usa un grado que no existe en ese
modo, cuando encadena un salto que el dominio no conoce, cuando se pasa de 32
compases, cuando devuelve tu canción tal cual, o cuando **las partes que añade son
tu parte otra vez** —visto con un modelo de verdad: un «puente» que era tu
progresión copiada—.

Medido con modelos locales de 8B: **continuar sale 4 de 4 con `gemma4:e4b`**, todas
con partes de verdad —`Lo que llevas(Am F C G) | verso(Am F C G Am)`—, contra 0 de 4
con las reglas anteriores. Con `qwen3:8b`, 0 de 4: su «parte nueva» es siempre tu
progresión copiada, y eso se rechaza. Retocar no lo pasa ninguno de los dos. `rearmonizar` sigue siendo
la que peor se les da —devuelven la canción intacta—, lo que explica aquel 0 de 4
mejor que ninguna otra cosa. El porqué entero está en
[adr/0016](./adr/0016-salidas-en-vez-de-versiones.md).

### Lo que no capta

No hay ritmo dentro del compás, no hay melodía, no se cambia de tonalidad —eso sería
un sexto camino, y está descartado por ahora en el ADR— y las inversiones se leen
como el acorde en estado fundamental, porque el croma olvida la octava
([adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md)).

### El nombre

En pantalla son **salidas**. Por dentro la ruta, la carpeta y la capacidad del plan
se siguen llamando `versiones`: renombrarlo toca cuarenta ficheros y habría ahogado
el cambio de comportamiento en un diff de nombres. Es deuda mecánica y está anotada.
