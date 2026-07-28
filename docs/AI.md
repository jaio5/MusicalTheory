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

| Código HTTP | `code`                 | Cuándo                                          |
| ----------- | ---------------------- | ----------------------------------------------- |
| 400         | `invalid_request`      | El cuerpo no cumple el esquema.                 |
| 429         | `rate_limited`         | Demasiadas peticiones desde esta sesión.        |
| 502         | `model_unavailable`    | El proveedor ha fallado o ha tardado demasiado. |
| 502         | `unparseable_response` | El modelo ha contestado algo que no encaja.     |

El mensaje va en español, dice qué ha pasado y qué hacer. Nunca se filtran ni
la clave, ni la URL del proveedor, ni la traza.

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

## Límite de frecuencia

Diez peticiones por minuto y dirección, en una ventana deslizante. Cada petición
cuesta dinero y la interfaz tiene tres botones que invitan a pulsarlos seguidos.

El contador vive **en memoria y por instancia**: si esto llega a correr en
varias, cada una llevará su cuenta. Para lo que defiende —pulsar el botón veinte
veces seguidas— es suficiente; para un abuso deliberado haría falta un contador
compartido, y eso es otra decisión con su ADR.

## Privacidad, en una línea

Lo que sale del equipo son entre diez y cincuenta caracteres de símbolos
musicales. Ni una muestra de audio.
