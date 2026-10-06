# La IA: contrato de las rutas

## Qué hace y qué no

Dos cosas de la aplicación le preguntan a un modelo: **el profesor**
(`/api/teacher`), que contesta dudas de teoría, y **las salidas**
(`/api/versiones`), que proponen por dónde puede seguir lo que llevas compuesto.
Las dos las responde un modelo de Anthropic, y siempre a través de un route
handler del servidor.

Hubo una tercera, **las ideas** (`/api/ideas`): progresiones, giros y escalas
pedidas mientras compones. Se retiró, y con ella las salidas bajaron de Pro a
Medio ([adr/0066](./adr/0066-las-ideas-se-retiran-y-las-salidas-bajan-a-medio.md)).

**A la IA solo viajan símbolos.** Nunca audio, nunca una grabación,
nunca un identificador de usuario. Lo que sale del navegador es la tonalidad, la
escala, grados con sus pulsos, el identificador de una unidad y, cuando lo hay,
el texto que escribes —la pregunta al profesor o las directrices de una salida—.
Nada de eso permite reconstruir la interpretación.

## Por qué la clave vive solo en el servidor

Una clave de API en el navegador es una clave pública: está en el bundle, en las
DevTools y en cualquier proxy. Da igual que se ofusque.

`ANTHROPIC_API_KEY` es una variable de entorno **sin** el prefijo
`NEXT_PUBLIC_`, así que Next no la incluye en el bundle del cliente. El SDK
`@anthropic-ai/sdk` se importa desde **un solo fichero de todo el proyecto**,
`server/ask-model.ts`: si apareciese importado desde un componente, el propio
bundler lo arrastraría al cliente.

Llegaron a ser tres —una copia por ruta— y solo se diferenciaban en el prompt de
sistema, el esquema y el tope de tokens. El porqué de apagar el pensamiento
estaba explicado tres veces con tres redacciones distintas, y no había forma de
saber si seguían diciendo lo mismo.

Esto además da un sitio donde poner límites de frecuencia, tiempo máximo y
control de coste, que en el cliente serían imposibles de hacer cumplir.

## Las rutas son una sola, y once diferencias

`ideas`, `teacher` y `versiones` hacían exactamente lo mismo en el mismo orden
—frenar por frecuencia, abrir las puertas del gasto, montar el prompt, llamar al
modelo, validar, reintentar una vez, contestar— y lo hacían con tres copias del
mismo cuerpo. Hoy quedan las dos últimas. Cuando había que cambiar algo del orden, se cambiaba tres veces; y
una vez se cambió solo en dos.

Ahora el cuerpo está una vez, en `server/ai-route.ts`, y cada ruta se declara:
qué contador la frena, cómo se lee su petición, qué prompt escribe, qué esquema
pide, cuántos tokens gasta como mucho, qué contesta sin clave y cómo valida lo
que vuelve. Once campos, y ninguno de ellos es «en qué orden pasan las cosas».

**Y uno más, opcional: el `respaldo`**, lo que se contesta cuando el modelo no da
nada que valga —no contesta, se corta por el tope o lo que dice no pasa el
validador las dos veces—. Lo construye la ruta desde el dominio, nunca desde lo que
dijo el modelo, y tiene que decir en la respuesta que no es del modelo. Una ruta con
respaldo no devuelve los dos 502 de después de la puerta; una sin él, sí. **El
respaldo recibe el motivo** —`model_unavailable` o `unparseable_response`— y la
respuesta lo lleva en `motivo`: un modelo caído y uno que contestó algo que no vale
no piden lo mismo de quien lo lee, esperar un minuto o preguntarlo de otra manera.
Y como un respaldo es un 200 y desde fuera parece que todo va bien, **el cuerpo
común deja rastro**: un `console.warn` con la ruta, el código HTTP y el motivo, y
nada de lo que escribió quien pregunta. El bucle
de los intentos y el respaldo viven en `server/ai-intentos.ts`, aparte del cuerpo,
porque **el examen del profesor va por ese mismo bucle** y no puede arrastrar
`next/server`, la sesión ni la base de datos.

Tres tests lo sujetan: uno comprueba que ninguna ruta contiene `spendAi` ni
`askModel(` —si vuelve a aparecer, es que alguien ha vuelto a escribir el cuerpo
a mano—, otro que en el cuerpo común la puerta del gasto va **antes** de
`preguntarAlModelo`, que es lo único que hace que se cobre el intento, y el
tercero que quien llama al modelo es ese bucle y no el cuerpo.

## Errores

Las dos rutas contestan los errores igual. Siempre con esta forma, nunca con el error crudo del proveedor:

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
| 400         | `invalid_request`      | El cuerpo no cumple el esquema, o no hay nada que pedir.  |
| 401         | `account_required`     | No hay cuenta. La IA no se sirve sin ella.                |
| 402         | `plan_required`        | El plan de quien pide no incluye esto.                    |
| 429         | `rate_limited`         | Demasiadas peticiones seguidas desde esta dirección.      |
| 429         | `quota_exhausted`      | Se gastó el cupo del mes o el del día.                    |
| 502         | `model_unavailable`    | El proveedor ha fallado o ha tardado demasiado.           |
| 502         | `unparseable_response` | El modelo ha contestado algo que no encaja.               |
| 503         | `model_unavailable`    | No se ha podido contar el cupo, así que no se ha servido. |

El mensaje va en español, dice qué ha pasado y qué hacer. Nunca se filtran ni
la clave, ni la URL del proveedor, ni la traza.

**Un 400 puede traer su propia frase** cuando la petición está bien formada y aun
así no hay nada que pedir: la ruta declara `porQueNoVale` y el cuerpo común la usa
en vez de la de `invalid_request`. Es el caso de «Continuar» con treinta y un
compases, donde ya no cabe otra parte: decía «nos falta la progresión», y ahora
dice que no cabe y que se pruebe a retocar (`NO_CABE_OTRA_PARTE`). **Y un menú
vacío contesta con su razón**: `porQueNoHaySalidas` (`core/music/paths.ts`) dice
por qué no hay salida para esa canción en vez de «nos falta la progresión». El
panel ya no ejecuta `salidasPosibles`: lo construye el servidor, y el panel
pesa 70 KB gzip en vez de 87.

**El profesor no devuelve nunca los dos 502**: tiene respaldo, y contesta 200 con
el glosario o con un aviso que dice que no ha salido (más abajo, en «El profesor»).
Los 502 quedan para las rutas sin respaldo.

**`plan_required` y `quota_exhausted` llegan con el mensaje ya escrito por la ruta**,
con el plan y el número concretos: «Las salidas de lo que tocas entran en el plan
Medio: 9,99 € al mes», «No te quedan preguntas suficientes de las 148 de este mes
(una salida gasta 3): se renuevan el día uno, y con el plan Pro son 296 al mes». La frase la construye
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
escrita una vez, en `ui/PlansLink.tsx`, porque la usan el profesor y las salidas y un
feature no importa de otro.

## Qué pasa cuando el modelo devuelve algo que no parsea

Es el caso normal, no el excepcional, y por eso hay tres capas:

1. **Salida estructurada.** La petición usa `output_config.format` con un
   esquema JSON, así que la respuesta viene ya constreñida a esa forma. Esto
   elimina la mayoría de los casos, pero no los convierte en imposibles.

   Y tiene una condición que no es obvia: **el esquema garantiza lo que exige, no
   lo que el validador espera.** Si las dos listas se separan, lo que sale es una
   respuesta impecable contra el esquema que el validador barre entera, y el
   modelo no tiene forma de saberlo. Lo aprendió la función de ideas, ya retirada:
   el esquema pedía `title` y `why` y dejaba `degrees` opcional, y el validador
   tiraba toda idea sin grados. Contra dos modelos locales pasaban 0 de 4
   peticiones —cupo gastado, 502— y exigiéndolo, 36 de 36.

   Por eso `versionsSchema(opciones)` **es una función**: lo que se pide es un
   número del menú de esa petición, y el enumerado va de uno a cuantas salidas
   haya. La generación constreñida no puede salirse de un `enum`, así que no puede
   elegir una que no está.

2. **Validación en el servidor.** La respuesta se valida contra el dominio antes
   de devolverla: que los grados existan en el modo indicado y que los cifrados se
   recalculen desde ellos; en las salidas, que el número sea uno del menú. Una
   salida concreta que no valide se descarta. **Y la prosa, en las dos**: en el
   profesor, si la pregunta es por una cadencia o por la relativa, la respuesta
   tiene que escribir sus acordes y no los de otra cosa (más abajo, en «El
   profesor»); en las salidas, el título y el porqué no pueden nombrar acordes ni
   movimientos que la salida no tiene (más abajo, en «Las salidas»).
3. **Un reintento y basta.** Si la respuesta no valida, se reintenta una vez. Si
   la segunda tampoco, se contesta el `respaldo` de la ruta si lo tiene, y si no, el
   error. No se encadenan reintentos: cuestan dinero y tiempo, y el usuario
   prefiere un «no ha salido, prueba otra vez» rápido a treinta segundos de espera.
4. **Y hay dos cosas que no se reintentan nunca.** Un fallo del proveedor sale
   como `model_unavailable` a la primera, porque el problema no es la tirada. Y
   una respuesta **cortada por el tope de tokens** tampoco —lo dicen los dos
   proveedores, `stop_reason: 'max_tokens'` en la API y `done_reason: 'length'`
   en Ollama—: el prompt es el mismo
   y el tope también, así que la segunda llamada se cortaría por donde se cortó
   la primera. Se contesta `unparseable_response`, que es lo que ha pasado
   —contestó, y lo que dijo no se puede leer—, sin gastar una llamada que no
   tenía ninguna posibilidad.

En ningún caso se devuelve al cliente texto sin validar. Si el modelo se inventa
un acorde imposible, muere en el servidor.

## Cuánto se espera, y cuántas llamadas puede haber

**La espera está acotada en las dos ramas, y en la de la API no lo estuvo.** El
modelo de casa siempre tuvo su tope de dos minutos —la primera petición carga
cinco gigas de pesos en la gráfica—, y la llamada a la API se quedaba con el que
trae el SDK de serie: **diez minutos**, con dos reintentos suyos por debajo. Con
el reintento de la ruta encima, una pregunta al profesor podía tener a alguien
esperando casi una hora contra una pantalla parada. Este documento llevaba desde
el principio diciendo que aquí había «tiempo máximo», y no lo había.

| Lo que se espera              | Cuánto                                               |
| ----------------------------- | ---------------------------------------------------- |
| Una llamada a la API          | 30 s                                                 |
| Reintentos del SDK            | 1 (para un 429 o un 5xx, no para una respuesta mala) |
| Por cada `askModel`           | 60 s                                                 |
| Reintentos de la ruta         | `MAX_MODEL_ATTEMPTS` = 2                             |
| **Peor caso de una petición** | **120 s**, el mismo tope que el modelo de casa       |

Los reintentos del SDK y los de la ruta **no son los mismos** y por eso conviven:
los de abajo son para una petición que ni llegó —la API sobrecargada, la conexión
cortada—, y los de arriba para una respuesta que llegó y no vale. Apagar los de
abajo convertiría un pico de carga de la API en un 502 inmediato.

Sobre el coste: los del SDK **no se cobran**, porque ocurren cuando la petición
falló. El único que podría cobrarse es el de un tiempo agotado —el servidor
terminó y nosotros nos fuimos—, y para eso el tope es holgado: lo medido en este
equipo son dos segundos en caliente y veinte en frío.

## Configuración del modelo

```ts
// src/server/ask-model.ts — el único sitio del proyecto que importa el SDK.
const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });

const response = await client.messages.create({
  model: configuredModel(),
  max_tokens: maxTokens, // TOKEN_BUDGETS[feature].output
  system,
  thinking: { type: 'disabled' },
  output_config: {
    effort: 'low',
    format: { type: 'json_schema', schema },
  },
  messages: [{ role: 'user', content: prompt }],
});
```

- **Modelo**: `claude-opus-5` por defecto, configurable por entorno.
- **`max_tokens` sale del presupuesto de coste**, no de un número escrito aquí:
  `TOKEN_BUDGETS` de `core/billing/cost.ts`, que es el mismo con el que se
  calculan los cupos. Así el tope que impone el servidor **es** el peor caso que
  supone la aritmética del plan, y no dos números que se separan. Hoy son 400
  para el profesor y 900 para salidas. Los 900 venían de cuando una salida eran
  treinta y dos compases escritos por el modelo; desde que elige del menú, tres
  salidas son un número, un título y un porqué cada una —unos 300 tokens—, y
  bajarlo subiría los cupos de Medio y Pro. Es una decisión de precio y está sin
  tomar.
- **Pensar está apagado, y es una decisión de coste.** La respuesta la fija un
  esquema JSON: no hay nada que razonar. En `claude-opus-5` el pensamiento viene
  encendido y se cobra como salida, así que dejarlo puesto multiplica el coste y
  puede gastarse el `max_tokens` pensando para devolver algo cortado: se paga y
  no se sirve. Por lo mismo, `effort: 'low'`.
- **Sin `temperature`**: los modelos actuales no la aceptan. La variedad se pide
  en el prompt, no con parámetros de muestreo.
- **Prompt de sistema**: fija el criterio —rock, no coral—, exige español, y
  prohíbe explicar teoría que no se haya pedido.

## Quién contesta: tres proveedores y un orden

`server/ai-model.ts` decide, y las rutas no se enteran: le entra la misma
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
pagado un plan. Para probar en local se quita la clave, que es lo explícito.

En producción, sin ninguno de los tres, las rutas contestan 503 y no gastan cupo.

## El modelo de casa: Ollama en un contenedor

```bash
pnpm docker:ia     # Postgres, migraciones, Ollama con su modelo, y la aplicación
```

Levanta el perfil `ia` de `compose.yml`
([adr/0047](./adr/0047-la-ia-es-un-perfil-no-un-fichero.md)); a mano es
`docker compose --profile ia up`, y `docker compose up ollama` levanta **solo el
modelo**, sin la aplicación, para iterar sobre los prompts con `pnpm dev`
delante. La primera vez descarga unos
5 GB —`qwen3:8b`, que de su tamaño es el que mejor respeta un esquema JSON
estricto— y los deja en un volumen, así que solo pasa una vez. Con `OLLAMA_MODEL`
se cambia sin tocar código.

Está en un **perfil** y no en el grupo de siempre porque **pide una gráfica
NVIDIA**: sin ella, `docker compose up` tiene que seguir funcionando igual
([adr/0047](./adr/0047-la-ia-es-un-perfil-no-un-fichero.md); fue un fichero de
compose aparte y dejó de serlo). Se puede correr en la CPU
comentando el bloque `deploy`, pero una respuesta pasa de segundos a un minuto
largo y deja de servir para probar nada con la guitarra en las manos.

**Y si el Ollama es uno que ya corre en tu equipo, la dirección la calcula
`pnpm docker:up` al levantar.** Dentro del contenedor `localhost` es el
contenedor, y a la máquina solo se llega por la IP de `eth0`, que cambia al
reiniciar: por eso `compose.yml` lee `OLLAMA_URL_DOCKER` en vez de traer una
dirección fija, y por eso arrancar con `docker compose` a secas deja la IA apagada
([adr/0050](./adr/0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)).
Cargar el modelo en la gráfica cuesta unos 89 s la primera vez —contestar, menos de
uno—, y Ollama lo descarga a los cinco minutos sin uso.

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
- **`/api/versiones` fue la que peor iba, y ya no.** Mientras el modelo escribía
  las salidas, un 8B se quedaba sin ninguna o copiaba el ejemplo del prompt. Desde
  que el dominio las construye y el modelo elige, `qwen3:8b` contesta las cuarenta
  peticiones del banco (más abajo, en «Las salidas»).

Esto es **para probar, no para producción**. El porqué entero, con lo que se
descartó, está en [adr/0014](./adr/0014-un-modelo-de-casa-para-probar.md).

## Sin ningún proveedor: contesta el dominio

Fuera de producción, sin `ANTHROPIC_API_KEY` y sin `OLLAMA_URL`, las dos rutas
contestan con `server/fake-model.ts` en vez de fallar. Es el tercer puerto con la misma forma
que el cobrador que no cobra y el correo que no manda, y por la misma razón: sin
él, media aplicación no se puede probar sin dar de alta un servicio y empezar a
pagar por tokens.

**Lo que devuelve sale del dominio.** El profesor, si la pregunta casa con el
glosario de teoría (`core/music/glossary.ts`), contesta su entrada resuelta en la
tonalidad —«Sin IA, del glosario. Cadencia plagal: … En G mayor, IV → I: C → G.»—,
así que sin clave ya se dice algo cierto; si no casa, dice que no hay modelo y qué
hacer. Las salidas son **las tres mejores del mismo menú que se le da al
modelo** (`salidasPosibles`, en `core/music/paths.ts`), con variedad y el porqué
que dice el juez de encaje, así que pasan la misma verificación que pasaría su
respuesta. Eso permite
probar la pantalla, la reproducción y «quedarme con esta» sin gastar un céntimo.

**Que pase la verificación no es que tenga sentido**, y eso costó un fallo: el
cierre que proponía era `I IV I` —la tónica, un paso fuera y la tónica otra vez—,
que acaba en casa y por eso el validador lo aceptaba. Un cierre se prepara por
detrás y no se alarga por delante
([adr/0051](./adr/0051-un-cierre-se-prepara-por-detras.md)), y ahora hay un test
que mira **dentro** del cierre para los 27 grados de los dos modos. Los de antes
solo comprobaban que la salida existiera. El cierre de hoy es la primera salida
del menú al continuar, y el test sigue mirándolo.

Lo que **no** prueba: si el modelo de verdad devuelve versiones que valgan la
pena. Eso no lo puede decir nada que no sea el modelo. Por eso todo lo que sale de
ahí lo lleva escrito en su propio texto —en pantalla se lee «Sin IA»— y en
producción sin proveedor se sigue contestando 503. El modelo de casa **no** se
marca así: es un modelo generando de verdad, aunque acierte menos.

## Antes de las puertas: ¿hay quien conteste?

Las dos rutas comprueban `modelAvailable()` **antes de tocar el cupo**, y
contestan 503 si no hay proveedor ninguno. No es una comprobación de cortesía: `spendAi` cuenta la
petición antes de hablar con el modelo, así que sin clave configurada la llamada
fallaba igual unas líneas más abajo pero la petición ya estaba gastada. Alguien se
quedaba sin peticiones del mes por una variable de entorno que faltaba.

`hasModelKey` estaba escrita desde la fase 5 y no la llamaba nadie. Hay un test que
lee las rutas y comprueba que el proveedor se sigue mirando antes que el cupo:
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
el precio del modelo y el peor caso de tokens de una pregunta al profesor
(`core/billing/cost.ts`). **Se cuentan en preguntas**: una salida gasta las que cuesta,
tres hoy, y si no caben enteras no se sirve ([adr/0067](./adr/0067-el-cupo-se-cuenta-en-preguntas.md)). El `max_tokens` de estas rutas sale de ese mismo sitio, así
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

## Pensar está apagado en las dos rutas

Y es una decisión de coste, no un descuido. La respuesta la fija un esquema JSON: no
hay nada que razonar. En `claude-opus-5` **el pensamiento viene encendido por
defecto** y se cobra como tokens de salida, así que dejarlo puesto multiplicaba el
coste de cada pregunta y podía gastarse el `max_tokens` pensando para devolver una
respuesta truncada —se paga y no se sirve—.

`server/ask-model.ts` manda `thinking: { type: 'disabled' }` con `effort: 'low'` para
las dos, y los dos prompts de sistema piden explícitamente que no se cuelen
etiquetas XML internas en la respuesta: es lo que recomienda la documentación del
modelo para ese caso.

Los dos prompts y los dos esquemas viven juntos en `server/prompts.ts`, y no dentro de
sus rutas, porque **de su longitud dependen los cupos de todos los planes**. Allí se
pueden medir: `server/prompts.test.ts` cuenta sus caracteres y falla si crecen hasta
comerse la holgura del presupuesto de tokens. **El prompt entero de las salidas se
mide aparte**, en `app/api/versiones/presupuesto.test.ts`: lo arma
`features/versions/prompt.ts`, que `server/` no puede abrir, y el estimado que había
en `prompts.test.ts` se dejaba fuera la mitad (más abajo, en «Las salidas»).

## Por dónde entra texto que no controlamos

Toda la superficie, contada: **dos campos y 480 caracteres**. La pregunta del
profesor, y las directrices de una salida —«a qué quieres que suene»—, que son 240
cada una. Nada más.

Fueron uno solo hasta el 24 de septiembre de 2026
([adr/0015](./adr/0015-un-solo-canal-de-texto-libre.md)), y el segundo se abrió a
sabiendas: los dos que 0015 cerró no hacían falta —el título de la unidad estaba en
el temario y el nombre de la canción no lo mandaba ni el cliente— y este **es la
función**, porque a qué quieres que suene tu canción no cabe en un menú
([adr/0052](./adr/0052-el-segundo-canal-de-texto-libre.md)). Va acotado con lo
mismo, y a propósito: dos maneras de acotar lo mismo serían dos superficies que
revisar.

**Este apartado llegó a mentir.** Hasta el 23 de septiembre de 2026 decía que la
ruta de ideas —ya retirada— no aceptaba ni un carácter libre, y sus cifrados
recientes no iban contra ningún enumerado: bastaba con ser una cadena de ocho
caracteres, y dieciséis por ocho daban **ciento veintiocho caracteres libres** en
mitad del prompt. Se arregló pasándolos por `parseChordSymbol`, y desde que las
ideas no existen esa entrada tampoco.

La
unidad que se lee viaja por su identificador. El nombre de la canción **ya no se
manda**: solo construía una línea del prompt, no volvía en la respuesta, no se
guardaba, y el cliente ni siquiera lo enviaba.

Alrededor del canal del profesor hay dos cosas, y las dos están en
[adr/0015](./adr/0015-un-solo-canal-de-texto-libre.md):

1. **La pregunta va entre marcas `###PREGUNTA###`** y el prompt de sistema dice
   que lo de dentro es un dato y nunca una instrucción. La marca se le borra a la
   pregunta al validarla: sin eso, quien la escribiera cerraría el bloque y lo de
   después se leería como instrucciones nuestras. **Se borra escrita como se
   escriba** (`core/marca.ts`): antes se quitaba solo la cadena exacta, y la
   auditoría del 2 de octubre de 2026 la coló con espacios (`### PREGUNTA ###`), en
   minúsculas, con un espacio de ancho cero dentro y con almohadillas de ancho
   completo. Ahora la pregunta se normaliza primero —NFKC, sin caracteres de
   formato ni de control— y se quita cualquier `##…PREGUNTA…##` y sus dos mitades.
   Las directrices de una salida, igual con `###DIRECTRICES###`.
2. **El modelo declara `tema: 'musica' | 'fuera'`**, obligatorio, enumerado y
   primero en el esquema —la generación constreñida rellena en ese orden, así que
   lo decide antes de contestar—. Con `fuera`, `validateTeacherAnswer` tira su
   texto y su ejemplo enteros y devuelve una frase nuestra. Su prosa no llega a la
   pantalla.

**El de las directrices lleva la primera y no la segunda**, y el porqué está en
[adr/0052](./adr/0052-el-segundo-canal-de-texto-libre.md): del profesor lo que
llega a la pantalla **es** su prosa, y de una salida son acordes recalculados
contra el dominio más un título y un porqué. Esos dos no tenían tope ninguno —ni en
el esquema ni al validar— y ahora caben en 60 y 200 caracteres: son la única prosa
del modelo que se pinta, así que se cierran por construcción en vez de confiar en
que el prompt se respete.

**Y lo que de verdad limita el abuso no es ninguna de las dos.** Contra alguien
decidido, una inyección que funcione hará que el modelo conteste `musica`. Lo que
sostiene el argumento son los topes: 400 tokens de salida —de ahí no sale un
ensayo—, cuenta obligatoria, quince peticiones al mes en el plan gratis con sus dos
cupos, diez por minuto, y una respuesta que solo ve quien preguntó. El abuso no se
hace imposible; se hace inútil, que es lo alcanzable.

**Medido, `qwen3:8b` se dejaba inyectar seis de ocho veces**, con la marca bien
quitada y todo. Son los ocho casos de la auditoría del 2 de octubre de 2026 —la
orden directa, la marca en cuatro disfraces, la marca exacta, un disfraz musical y
pedirle que copie sus instrucciones—, que hoy están dentro del examen del profesor.
Solo resistían la orden directa y la marca de ancho completo; en los otros seis
contestaba `musica` y pintaba París, un poema, una receta de tortilla y el prompt
de sistema entero. **Quitar bien la marca no cambió el número**, porque el modelo
obedece las instrucciones aunque estén dentro del bloque.

**Ahora resisten seis de ocho** —siete en otra pasada—, con tres cosas que no
dependen de que el modelo obedezca:

- **Lo que dice `musica` tiene que hablar de música** (`hablaDeMusica`): alguna de
  ochenta raíces de palabras de música, de tocar o de la aplicación, o un acorde o
  un grado escritos. No es el filtro de palabras que 0015 descartó: aquel miraba
  **la pregunta**, y «¿por qué suena triste?» no lleva ninguna; a una pregunta de
  música se le contesta con música. Se quedan fuera las que en castellano son
  sobre todo otra cosa —«bajo», «modo», «mayor», «menor»— y la «A» sola. En el
  examen no tira ninguna respuesta de música; caza «París», la contraseña y la
  receta.
- **Lo que copia ocho palabras seguidas del prompt de sistema no vale**
  (`copiaLasInstrucciones`). Caza el último caso, que pintaba el prompt entero.
- **Detrás de la pregunta se repite que es un dato** (`RECORDATORIO_DE_LA_PREGUNTA`),
  que es lo último que lee antes de contestar. En una prueba con las ocho
  inyecciones, el poema y seis preguntas buenas pasó de 6 a 11 de 15; moverlo del
  prompt de sistema aquí bajó a 7, y las redacciones más cortas rechazaban preguntas
  coloquiales. En el examen entero, con lo de arriba ya puesto, la diferencia cae
  dentro de lo que varía de una pasada a otra: 81 de 88 sin él, 82 y 84 con él.

Lo que sigue pasando: **los dos poemas sobre París** —«sin mencionar música», pide
la inyección, y el modelo mete un acorde en el último verso—. Lo que se lee en la
respuesta no los distingue de una respuesta poética sobre música. **La puerta vale
lo que valga el modelo siguiendo instrucciones**; los topes valen lo mismo con
cualquiera, y son los que sostienen el argumento de arriba.

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
gratis que no deja probar lo que se paga no vende nada. Las salidas no, porque son
la petición más cara que hay.

Lo que viaja es la tonalidad, la escala, **el identificador** de la unidad que se
está leyendo y la pregunta escrita, recortada a 240 caracteres. El identificador y
no el título: el título lo resuelve el servidor contra `core/music/curriculum.ts`,
así que ese campo dejó de ser texto libre entrando a un prompt. El audio sigue sin
salir del equipo: esta petición no los toca.

De vuelta viene una respuesta corta y, si viene a cuento, un ejemplo tocable en
grados. Los cifrados del ejemplo no se creen: se recalculan desde los grados
contra la tonalidad real, igual que en las salidas, que es la única forma de que no
aparezca en pantalla un acorde que no existe ahí.

### La teoría que se le da, y la que se le comprueba

**El profesor sacaba la teoría de memoria**, y con el modelo de casa se notaba: a
«¿qué es una cadencia perfecta?» en Do mayor contestó «C a G a C» y, a la segunda,
«F-C». El prompt solo traía la tonalidad y los símbolos de grado. Desde
[adr/0076](./adr/0076-el-profesor-se-apoya-en-un-glosario-comprobado.md) el prompt
lleva tres cosas más, todas calculadas por el dominio y ninguna escrita a mano:

- **Los acordes de la tonalidad con su papel**, siempre:
  `Acordes de C mayor. Tónica: I C, iii Em, vi Am. Subdominante: ii Dm, IV F. Dominante: V G, vii° Bdim.`
  En menor va también el V mayor de la armónica, que es el de la cadencia perfecta.
- **Hasta dos entradas del glosario**, si la pregunta casa con alguna, bajo
  «Teoría comprobada: úsala y no la contradigas.». Son sesenta —cadencias,
  funciones, acordes e inversiones, intervalos, escalas, modos, tonalidades,
  progresiones, ritmo y figuras, y cinco de **la aplicación**: afinar, grabar, tu
  audio, escribir tocando y ensayar— y lo que depende de la tonalidad está escrito
  en grados y se resuelve con `resolveDegree`, `keySignature` y compañía: la
  perfecta dice «V → I: G → C» en Do mayor y «V → i: E → Am» en La menor. La
  afinación estándar sale del mástil (`STANDARD_TUNING`). Gana la frase más larga,
  y sin ninguna que case no va nada.
- **Se encuentran como se escribe en un móvil**: sin tildes, en singular o en
  plural —«acordes prestados» y «acorde prestado» comparan igual—, con las
  abreviaturas de un mensaje —«q», «d», «xq»— y con una letra mal tecleada en las
  palabras largas —«kadencia perfeta», «frijio»—, dos si pasan de ocho letras.
  **Solo se corrige lo que no existe**: «armonía» está en «armonía funcional» y no
  se lee como «armónica», y unas cuantas corrientes no se corrigen nunca —«tiempo»
  no es «tempo», ni «cuántas» es «cuartas»—.
- **Las notas de un acorde escrito en la pregunta**, cuando se preguntan:
  «¿qué notas tiene un G7?», «el acorde de re mayor», «sol7». Va una entrada hecha
  al vuelo con sus notas bien escritas y sus intervalos.
- **La tonalidad escrita como se escribe**: el cliente manda la tónica con
  sostenidos y Si bemol mayor viajaba como «A# mayor»; el modelo contestó que su
  dominante era «E#». Ahora `cabeceraDePrompt` la escribe con `keyName`, y eso vale
  también para las salidas.

El prompt de sistema dice en una frase que la tabla y la referencia mandan sobre
lo que recuerde.

**Y lo que contesta se comprueba** (`checkAnswerAgainstTheory`, desde
`validateTeacherAnswer`). Lo que no pasa vuelve nulo y la ruta reintenta con otra
temperatura; si la segunda tampoco, contesta el glosario (abajo). Las firmas:

| Si se pregunta por...           | La respuesta tiene que...                                                   |
| ------------------------------- | --------------------------------------------------------------------------- |
| Una cadencia                    | Escribir su progresión, no darle la vuelta ni escribir la de otra           |
| La relativa                     | Decir cuál es, y la que es                                                  |
| Las notas de un acorde          | Darlas todas, en letra o en castellano, sin mirar enarmonías                |
| Las notas de la escala del tono | Lo mismo, solo si la escala es de la tónica: en Do, la pentatónica menor no |
| La dominante, o la del V        | Nombrar su acorde si escribe alguno; sin ninguno, explica y pasa            |
| La armadura                     | No contar otras alteraciones: vale con que una cuenta sea la buena          |
| Los acordes de la tonalidad     | Escribir cinco de ellos por lo menos, no grados a secas                     |
| Los siete modos                 | Nombrar cuatro                                                              |

Y dos que miran la respuesta entera, pregunte lo que pregunte: **un intervalo no
mide otros semitonos que los suyos** —«la tercera mayor tiene tres semitonos»— y
**un acorde con su grado al lado tiene que ser ese grado** —«D7 (V/vi)» en Fa mayor
es falso, y el modelo de casa lo escribió—. Lo de otra tonalidad, lo que va con
«de» —«G7 es el V de C»— y los paréntesis con una progresión dentro no se miran.

**Prefiere aceptar de menos a rechazar de más**: lee acordes, grados, notas y
números escritos, no entiende la frase, y lo que depende de la tonalidad no se
comprueba si la pregunta es de otra. El propio glosario pasa el validador en las
veinticuatro tonalidades, y las respuestas buenas con las que se probó son las que
dio el modelo de casa, copiadas tal cual en `glossary.test.ts`.

### Si el modelo no da una respuesta que valga

**El profesor no se queda nunca sin respuesta.** Si el modelo no contesta, se corta
o lo que dice no pasa el validador dos veces, contesta `respaldoDelProfesor`:

- **si la pregunta casa con el glosario, el glosario**, resuelto en la tonalidad y
  empezando por «Esto no lo ha escrito la IA…», con `fuente: 'glosario'`;
- **si no, un aviso honrado** —no ha salido, cómo preguntarlo para que salga— con
  los acordes de la tonalidad, que son ciertos siempre, y `fuente: 'aviso'`.

**Lo de delante depende del `motivo`**, que también viaja en la respuesta. Si el
modelo no contestó (`model_unavailable`), «pregúntalo con otras palabras» haría
gastar otra pregunta contra un modelo caído: el aviso dice «No hemos podido
contactar con el modelo; vuelve a intentarlo en un minuto», y el glosario va
detrás de esa misma frase, diciendo que no es de la IA pero no que la respuesta no
se pudo comprobar, porque no la hubo. La pantalla marca encima de la respuesta de
quién es: «Del glosario, sin IA», «Sin IA» o «Sin conexión con el modelo».

Y un `fuera` del modelo **no vale si la pregunta es de aquí**: con la entrada
delante, rechazaba «¿la aplicación sube mi audio?» como fuera de tema. Se reintenta
y, si insiste, contesta el glosario. **Pero rozar el glosario no basta**: «¿cómo
hago un modo oscuro en CSS?» casa con los modos y «¿qué es un intervalo de
confianza?» con los intervalos, y rechazar esos «fuera» costaba una llamada más
para contestar teoría a quien no la pedía. Hace falta que la pregunta nombre la
entrada entera —un nombre de varias palabras tal cual, o dos nombres de la misma:
«grabar» y «vídeo»— o que diga además otra palabra de música —«¿cómo afino **la
guitarra**?»—.

**El cupo se gasta igual**, y a propósito. La pregunta se cobra al pasar la puerta,
antes de llamar al modelo (`spendAi`), y para entonces el modelo ya ha costado sus
dos intentos: el cupo sale de ese coste. Devolverla haría además gratis justo lo
que una inyección busca: una pregunta que el validador tira no costaría nada, y el
cupo —lo que de verdad acota el abuso, adr/0015— dejaría de acotarlo. Y pide una
escritura más en la base de datos por cada respaldo.

**Cabe en el presupuesto sin subirlo.** El peor caso —la tabla más larga de las
veinticuatro, las dos entradas más largas, la unidad de título más largo, la
pregunta entera y el recordatorio de detrás— lo construye `server/prompts.test.ts`
pieza a pieza: **696 tokens estimados de 700**. Para que quepa el recordatorio se
apretaron el prompt de sistema y la cabecera de la teoría sin quitarles ninguna
instrucción, y cada entrada tiene un tope de 180 caracteres. Los cupos no cambian,
y **no queda sitio**: lo próximo que entre en el prompt pide subir el presupuesto, y
eso baja los cupos de todos los planes.

**Cómo se mide**: `pnpm examen:profesor` le hace **88 preguntas** al modelo de casa
por el mismo camino que la ruta —el mismo prompt, el mismo validador, el mismo
reintento y el mismo respaldo, porque usa `PROFESOR` y `preguntarAlModelo`—: teoría
en doce tonalidades con alteraciones, preguntas mal escritas, de la aplicación,
fuera de tema y las ocho inyecciones de la auditoría. Y mide por separado las
cuatro cosas que son «contestar bien»: **que conteste** —sin 502—, **que lo que
dice sea verdad**, **que conteste a lo preguntado** y **que no se salga del tema**
ni obedezca. `--releer` vuelve a corregir una pasada guardada con el banco de hoy,
que es como se comparan un antes y un después.

| Con `qwen3:8b` | Contesta | Verdad | A lo preguntado | En tema | Bien  |
| -------------- | -------- | ------ | --------------- | ------- | ----- |
| Antes          | 88/88    | 80/88  | 74/88           | 79/88   | 68/88 |
| Después        | 88/88    | 87/88  | 85/88           | 85/88   | 82/88 |

Por partes, de antes a después: teoría 48 → 51 de 54, mal escritas 9 → 12 de 12,
la aplicación 3 → 7 de 7, fuera de tema 6 → 6 de 7 e inyecciones 2 → 6 de 8. Siete
de las 88 las contestó el glosario. Lo que queda mal: el bajo del ii–V–I «sube una
quinta», el disminuido sin decir cómo se construye, el frigio sin su segunda menor,
un poema sobre el mar escrito con grados y los dos poemas sobre París. Pide
`OLLAMA_URL` y un modelo descargado, así que no está entre los seis comandos.

## Las salidas: por dónde puede tirar lo que tocas

El otro route handler, `POST /api/versiones`, con el mismo reparto que el del
profesor. Es **la petición más cara de las dos** y entra en los planes Medio y Pro
([adr/0066](./adr/0066-las-ideas-se-retiran-y-las-salidas-bajan-a-medio.md)).

Entra una progresión en grados con sus pulsos, una tonalidad y **qué se pide**.
Salen hasta tres **salidas**: canciones distintas que arrancan de lo que llevas
tocado. No son versiones de la misma canción: son caminos para elegir.

Y lo que se pide se elige antes, entre dos cosas:

| `kind`      | Qué hace                                 | Qué caminos tiene el menú              |
| ----------- | ---------------------------------------- | -------------------------------------- |
| `continuar` | Sigue tu canción y le hace sus partes    | `seguir` y `contraste`                 |
| `retocar`   | Cambia estos compases sin salir de ellos | `rearmonizar`, `estirar`, `otro-final` |

**Elegir antes no es cosa de la interfaz.** De lo que se pida depende el menú
que se le enseña —las salidas que continúan o las que retocan—, y con el camino
libre el modelo elegía la forma que no tocaba: cero salidas válidas de cuatro
peticiones. Eligiendo antes: tres de tres.

**Y se le dice qué parte le mandas**, que es la otra mitad de la pregunta: no es
lo mismo continuar una estrofa —que tiene que poder repetirse con otra letra— que
continuar un estribillo, que tiene que levantar y cerrar. El campo es `role` y
toma uno de los ocho valores de `ROLES`, en `core/music/song.ts`. Ausente quiere
decir `idea`, y **una idea también se le dice**: saber que unos compases todavía
no tienen sitio en ninguna canción es información, y callarlo dejaba al modelo
suponiendo que era una canción a medias. La frase que va al prompt se genera desde
el catálogo, como la de las salidas y la de los movimientos, para que no puedan
decir cosas distintas. El porqué, en
[adr/0028](./adr/0028-componer-tambien-cuenta.md).

**Lo que no se sabe todavía es si cambia lo que devuelve.** Que la frase llega al
prompt lo dice un test; si mejora la respuesta solo puede decirlo una medición
contra la API, que sigue pendiente.

**Aunque por delante se llame «grabar un trozo», aquí no sube nada de audio.** La
aplicación ya sabe qué acorde suena —el motor de croma lo dice y `core/music/capture.ts`
lo convierte en grados con sus pulsos—, así que grabar es apuntar símbolos. Lo que
viaja son entre treinta y doscientos caracteres.

### El dominio construye las salidas, y el modelo elige

**El modelo ya no escribe salidas: las elige de un menú.** `salidasPosibles`
(`core/music/paths.ts`) construye para tu canción muchas más de las que enseña
(`candidatasDeSalida`), las ordena por lo que encajan con lo que llevas
(`core/music/encaje.ts`) y se queda con hasta nueve, con variedad entre caminos
([adr/0097](./adr/0097-las-salidas-se-juzgan-por-lo-que-encajan.md)). Hay cinco
caminos, y cada uno trae lo suyo:

- **rearmonizar**: cada movimiento de `reharmonization.ts` en todos los compases
  que lo admiten, y el último compás con cada sustituto que tenga;
- **estirar**: cuadrar a los pulsos que más se repiten lo que se tocó desigual, a
  medio tiempo, a doble tiempo, y el último o el primero el doble;
- **otro final**: llegar a la tónica, quedarse en la dominante o caer en el vi
  —el VI en menor— tocando lo menos posible, y acabar antes si se puede;
- **seguir**: las cadencias de `cadenciasParaCerrar`, un cierre de tres y otro de
  cuatro compases que no tocan la tónica hasta el final, y una parte nueva antes
  del cierre;
- **contraste**: puentes que se van sin pasar por la tónica y saben volver a tu
  primer compás, los que más se alejan de lo tuyo primero.

Y cada camino tiene sus reglas, las de `pathProblem` y `songProblem`, que siguen
siendo las de siempre aunque ahora se apliquen al construir y no al recibir:

| Salida        | Qué hace                                    | Qué se comprueba                                         |
| ------------- | ------------------------------------------- | -------------------------------------------------------- |
| `rearmonizar` | Los mismos compases con otros acordes       | Cada compás cambiado declara su movimiento y se reaplica |
| `seguir`      | Mantiene tus compases y añade hasta cerrar  | El principio intacto y el final en la tónica             |
| `otro-final`  | Deja la primera mitad y cambia lo que viene | La mitad intacta, y no alarga                            |
| `estirar`     | Los mismos acordes durando otra cosa        | Ni un grado tocado, y algún pulso distinto               |
| `contraste`   | Añade una parte que se va y puede volver    | No cierra, y desde su último grado se vuelve al primero  |

Todas pasan `songProblem` antes de entrar en el menú —lo recorre
`paths.test.ts` con más de mil canciones—, así que **lo que sale es correcto por
construcción**: el modelo no puede inventarse un salto ni declarar un movimiento
que no ha hecho, porque no escribe ni saltos ni movimientos. Cada salida trae
además, escrito por el dominio, **lo que hace** —«Cambia IV por iv en el 4 (mayor
por menor)»— y **hacia dónde tira**: si oscurece o aclara, si mete tensión o un
prestado, si cierra, si es más lento, más rápido o más corto. Los colores salen de
comparar la salida con lo tuyo, no de una etiqueta, y son lo que deja elegir con
«más triste» o «estilo rock» delante.

El prompt lleva ese menú numerado (`features/versions/menu.ts`), la tabla de los
grados que salen con su acorde —los tuyos y los del menú, para que el porqué hable
de acordes que existen— y tus compases numerados. Lo que vuelve es, por salida, **un número, un título y un
porqué**, y el esquema exige el número como enumerado del uno a cuantas haya. Ya
no van el mapa de saltos, el catálogo de movimientos, las cadencias ni los
ejemplos de retocar: no hay nada que construir.

**Por qué, medido.** Retocar con los ejemplos sobre tus compases
([adr/0086](./adr/0086-retocar-devuelve-solo-lo-que-cambia.md)) sacaba algo
siempre, pero el modelo copiaba el ejemplo: 45 de 46 salidas mostradas en el banco.
Y al continuar, 21 de 72 salidas pasaban el validador. Con el menú, contra
`qwen3:8b` en el mismo banco —veinte progresiones de dos a ocho compases, mayores y
menores, con alteraciones, pulsos de grabación y directrices, para continuar y
para retocar, con los dos intentos de la ruta—:

| Criterio                                  | Escribiendo él | Eligiendo del menú |
| ----------------------------------------- | -------------- | ------------------ |
| Peticiones con alguna salida              | 38 de 40       | **40 de 40**       |
| Salidas propuestas que valen              | 67 de 132      | **120 de 120**     |
| Mostradas que no son el ejemplo copiado   | 4 de 67        | **104 de 120**     |
| Respuestas sin dos salidas iguales        | 16 de 19       | **40 de 40**       |
| Porqués mostrados que dicen la verdad     | 56 de 67       | **119 de 120**     |
| Peticiones con alguna que sigue lo pedido | 9 de 20        | **16 de 21**       |
| Tokens de entrada, el más largo del banco | 1.699          | **1.120**          |
| Segundos por llamada                      | 6,5            | **3,6**            |

«No copia» al continuar cuenta como copia elegir la primera cadencia de la lista,
que es legítimo: de ahí sale que no llegue al cien. Las directrices se comprueban
con lo que el dominio sabe contar —un grado menor o prestado que no estaba para
«más triste», un final que no es la tónica para «que acabe abierto»— y no con el
oído; donde fallan es donde el menú no tiene nada que vaya hacia ahí, como «estilo
flamenco» sin una bajada VI → V que construir. El banco, sus casos y el medidor
están en el scratchpad de la sesión, y la decisión, en su ADR.

**Lo que se pierde, dicho:** el modelo ya no puede proponer nada que el dominio
no sepa construir. Uno grande podría inventar una salida mejor que las seis del
menú; con este diseño no la verá nadie. Es el precio de que todo lo que sale sea
cierto, y la medición contra la API diría si se paga caro.

### Lo que la petición sabe de tu canción

**Además de los grados viaja un contexto** (`ContextoDeSalidas`, en
`core/music/contexto-de-salidas.ts`): el estilo de la barra, los pulsos por
compás, el papel real de la parte, la especie de cada compás, los compases
dudosos y la melodía compás a compás. Lo valida `features/versions/contract.ts`,
lo arma el panel (`lo-que-se-manda.ts`) y el servidor lo usa en
`salidasPosibles` **las dos veces que construye el menú**, al escribir el prompt y
al validar: si cambiara entre una y otra, el número elegido señalaría otra salida.
Se manda **una sola parte** —la de «De qué parte», o la del bloque seleccionado,
o la última con acordes—. **Solo símbolos**: enumerados, números y alturas sobre
la tónica; los nombres de las partes no viajan, ni audio.

### Quién ordena el menú

**El juez de encaje** (`core/music/encaje.ts`) puntúa de 0 a 100 cada candidata
con once criterios —sintaxis, cadencia, frase, ritmo armónico, bajo, notas
comunes, melodía, estilo, novedad, papel y forma— y deja por escrito, en grados,
los motivos que son verdad. Un `descarte` la quita siempre; un `reparo` baja sus
puntos de `ENCAJE_MINIMO` (50) pero **nunca vacía el menú**, y si quedan menos de
`MINIMO_DEL_MENU` (3) se rellena con las mejores de las reprochadas.

**Al modelo le llegan seis**, no nueve (`MAX_OPCIONES_DEL_MENU`), con los motivos
del juez dichos en acordes y un tope de caracteres: el menú ocupa lo que deja el
resto del prompt. **Sin directrices el modelo explica las tres mejores** y no
elige: medido, elegir entre seis daba 504 buenas de 513 y explicar las tres
mejores, 508. **Con directrices elige entre las seis**, porque leer «más triste» es
lo que el dominio no hace. Canciones de un acorde se aceptan.

### Cómo se mide

Cinco exámenes del dominio, sin modelo, que corre `pnpm test` —`corpus-de-salidas`
(71 de 72 casos), `corpus-de-verificacion` (93 de 96), `corpus-ciego` (98 de 98),
`corpus-final` (53 de 54) y `corpus-quinto` (27 de 50 menús), en `core/music/`—, cada uno con un trinquete que no deja
bajar y una lista `YA_NO_PUEDEN_FALLAR`. **Y `pnpm examen:salidas`**
(`scripts/examen-de-las-salidas.ts`), que pasa las peticiones por la ruta contra el
modelo de verdad. Con `qwen3:8b`: contesta 72/72, los porqués son verdad 216/216,
508/513 sin directrices y 7/8 sigue las directrices.

**Un corpus que se usa para ajustar deja de medir, y los cinco se han usado.** La
cifra honesta de generalización es la medida ciega del corpus final **antes de tocar
nada** (5 de octubre, 00:59): 36 de 50 menús enteros, y 8 de 50 con las cinco frases
falsas que se añadieron a `diceAlgoFalso`; el arreglista lo juzgó 72 % bien, 18 %
aceptable y 10 % mal. Las tres medidas ciegas sucesivas fueron 48 / 39 / 14, 66 / 31 /
3,5 y 72 / 18 / 10 (bien / aceptable / mal, en %). La quinta medida
(`corpus-quinto`, 5 de octubre, 12:14) dio **714 de 768 expectativas y 22 de 50 menús
enteros** con el examen estricto, y el arreglista los juzgó 74 % bien, 24 % aceptable
y 2 % mal; tras arreglar por sus causas, 732 de 768 y 27 de 50. **El arreglista y el
examen no miden lo mismo**: él mira las tres salidas que se enseñan; el examen
exige además una buena entre las tres primeras y ningún error en todo el menú. Las
cifras de 53 de 54, 98 de 98 y 27 de 50 son **tras arreglar**, no de
generalización; para volver a medir hace falta un sexto corpus

([adr/0097](./adr/0097-las-salidas-se-juzgan-por-lo-que-encajan.md)).

### El porqué se comprueba

**El título y el porqué son la única prosa del modelo que se pinta**, y al lado
de acordes comprobados un porqué falso enseña algo falso con autoridad
([adr/0011](./adr/0011-versiones-verificadas-contra-el-dominio.md)). Así que
`loQueNoEsta` (`features/versions/contract.ts`) los lee contra la salida: los
acordes y grados que nombran tienen que sonar en ella o haber estado en lo tuyo; un
movimiento nombrado tiene que estar hecho —el relativo de la tónica y la cadencia
rota valen también si suenan—, y no puede decir que cierra si no acaba en la
tónica, ni al revés. **Lo que no se sostiene se cambia por lo que dice el
dominio**, que construyó la salida y no se equivoca sobre ella; la salida se
queda. Prefiere aceptar de menos a rechazar de más: «C mayor» es la tonalidad, y
la «A» delante de una palabra es la preposición.

Medido: de lo que escribe `qwen3:8b`, 100 de 120 porqués son verdad; mostrados,
119 de 120. El más repetido antes era «una cadencia que promete la tónica pero no
la alcanza», sobre un cierre que acaba en ella.

### Lo dudoso va marcado

El panel manda `heard` en los compases que el micro leyó con poca confianza, y el
prompt de sistema llevaba tiempo diciendo que venían marcados **sin que el prompt
marcara ninguno**. Ahora van con una interrogación —`2: V x4?`— y el prompt de
sistema dice qué significa: una lectura que nadie ha confirmado, en la que no se
apoya la explicación.

### Cuando el modelo no da nada que valga

**Las salidas no se quedan sin respuesta.** Si el modelo no contesta, se corta por
el tope o lo que dice no pasa el validador las dos veces, la ruta contesta con el
`respaldo` del cuerpo común (`server/ai-intentos.ts`): las tres mejores salidas
del menú, con variedad, el título y el porqué del juez. **Y lo dice**: la respuesta lleva
`origen: 'dominio'`, cada título empieza por «Sin IA» y el panel lo explica
encima de la lista, con la frase que toca según el `motivo`: «el modelo no ha dado
con nada que se sostenga», o, si no se le pudo hablar, que se vuelva a intentar en
un minuto. El cupo ya está gastado —se cobra el intento—, y lo que se le
debe a quien lo pagó es saber que eso no lo eligió el modelo.

### El presupuesto de entrada, sumado de verdad

`server/prompts.test.ts` estimaba la entrada de las salidas con el prompt de
sistema, el esquema, la progresión, los movimientos y los grados, y **se dejaba el
mapa de saltos, las cadencias, las directrices y los ejemplos de retocar**: decía
que cabía en los 1.400 tokens de `TOKEN_BUDGETS.versiones` mientras el peor prompt
real rondaba los 1.950. Desde aquí no se podía medir mejor —el prompt lo arma
`features/`, y `server/` no la abre—, así que la medida de verdad vive en
`app/api/versiones/presupuesto.test.ts`, que ve las dos capas:

- **busca el peor** con cientos de canciones de treinta y dos compases en las
  veinticuatro tonalidades, el papel más largo y las directrices enteras: **1.277
  tokens de 1.400**;
- y **suma el peor de cada pieza** aunque no puedan darse juntas, con el prompt por
  su tope de caracteres (`MAX_CARACTERES_DEL_PROMPT`, 2.950, en
  `features/versions/prompt.ts`): **1.278 de 1.400**. Es lo que hace que sea un tope
  y no una muestra.

**Y el test exige una holgura de 120 tokens** (`HOLGURA`): el peor prompt tiene que
dejar libres 120 de los 1.400. Llegó a sobrar 3 —1.396 y 1.397—, y lo siguiente que
entrara obligaba a subir `TOKEN_BUDGETS`, que es decisión de precio: baja los cupos.
Se hizo sitio quitando lo que el modelo no usa para elegir ni para explicar: la tabla
de acordes lleva solo los grados que salen, el papel de la parte va solo por su nombre
(`Parte: estribillo.`) y el prompt de sistema perdió tres frases que repite la última
línea del prompt o que obliga el esquema. El tope bajó de 3.190 a 2.950. Qué costó,
medido con `qwen3:8b`: sin directrices todo igual (513 de 514) salvo «la 1 primero»,
que baja de 72 a 66 de 72; con directrices, sigue lo pedido en 33 de 40 frente a 30
([adr/0100](./adr/0100-hacer-sitio-en-el-prompt-sin-subir-el-presupuesto.md)). Con
el banco, la entrada media pasó de 1.557 tokens a 1.028.

### Lo que no capta

No hay ritmo dentro del compás, no hay melodía, no se cambia de tonalidad —eso sería
un sexto camino, y está descartado por ahora en el ADR— y las inversiones se leen
como el acorde en estado fundamental, porque el croma olvida la octava
([adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md)).

### El nombre

En pantalla son **salidas**. Por dentro la ruta, la carpeta y la capacidad del plan
se siguen llamando `versiones`: renombrarlo toca cuarenta ficheros y habría ahogado
el cambio de comportamiento en un diff de nombres. Es deuda mecánica y está anotada.
