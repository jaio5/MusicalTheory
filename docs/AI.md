# Ideas de IA: contrato del route handler

## Qué hace y qué no

El modo componer puede pedir ideas: progresiones a partir de lo que estás
tocando, un giro para romper el bucle, qué escala meter encima. Eso lo responde
un modelo de Anthropic, y siempre a través de un route handler del servidor.

**A la IA solo viajan símbolos.** Nunca audio, nunca vídeo, nunca una grabación,
nunca un identificador de usuario. Lo que sale del navegador es: la tonalidad
detectada, la escala elegida, los nombres de las notas tocadas últimamente y el
grado actual. Nada de eso permite reconstruir la interpretación, y ninguna de
esas cosas es un dato personal.

## Por qué la clave vive solo en el servidor

Una clave de API en el navegador es una clave pública: está en el bundle, en las
DevTools y en cualquier proxy. Da igual que se ofusque.

`ANTHROPIC_API_KEY` es una variable de entorno **sin** el prefijo
`NEXT_PUBLIC_`, así que Next no la incluye en el bundle del cliente. Solo la lee
el route handler, que se ejecuta en el servidor. El SDK `@anthropic-ai/sdk` se
importa únicamente desde ese fichero: si apareciese importado desde un
componente, el propio bundler lo arrastraría al cliente.

Esto además da un sitio donde poner límites de frecuencia, tiempo máximo y
control de coste, que en el cliente serían imposibles de hacer cumplir.

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

## Qué pasa cuando el modelo devuelve algo que no parsea

Es el caso normal, no el excepcional, y por eso hay tres capas:

1. **Salida estructurada.** La petición usa `output_config.format` con un
   esquema JSON, así que la respuesta viene ya constreñida a esa forma. Esto
   elimina la mayoría de los casos, pero no los convierte en imposibles.
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
// src/app/api/ideas/route.ts — el único sitio del proyecto que importa el SDK.
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

## Pensar está apagado en las dos rutas

Y es una decisión de coste, no un descuido. La respuesta la fija un esquema JSON: no
hay nada que razonar. En `claude-opus-5` **el pensamiento viene encendido por
defecto** y se cobra como tokens de salida, así que dejarlo puesto multiplicaba el
coste de cada pregunta y podía gastarse el `max_tokens` pensando para devolver una
respuesta truncada —se paga y no se sirve—.

Las dos rutas mandan `thinking: { type: 'disabled' }` con `effort: 'low'`, y sus
prompts de sistema piden explícitamente que no se cuelen etiquetas XML internas en la
respuesta: es lo que recomienda la documentación del modelo para ese caso.

Los dos prompts y los dos esquemas viven juntos en `server/prompts.ts`, y no dentro de
sus rutas, porque **de su longitud dependen los cupos de todos los planes**. Allí se
pueden medir: `server/prompts.test.ts` cuenta sus caracteres y falla si crecen hasta
comerse la holgura del presupuesto de tokens.

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

Lo que viaja es la tonalidad, la escala, la lección que se está leyendo y la
pregunta escrita, recortada a 240 caracteres. El audio y el vídeo siguen sin
salir del equipo: esta petición no los toca.

De vuelta viene una respuesta corta y, si viene a cuento, un ejemplo tocable en
grados. Los cifrados del ejemplo no se creen: se recalculan desde los grados
contra la tonalidad real, igual que en ideas, que es la única forma de que no
aparezca en pantalla un acorde que no existe ahí.
