/**
 * La llamada al modelo, una sola vez.
 *
 * Las tres rutas de IA la tenían escrita entera —treinta líneas cada una— y solo
 * cambiaban en tres valores: el prompt de sistema, el esquema de salida y el
 * tope de tokens. Lo demás era idéntico, incluido el porqué de apagar el
 * pensamiento, que estaba explicado tres veces con tres redacciones distintas y
 * ninguna forma de saber si seguían diciendo lo mismo.
 *
 * **Este es el único sitio del proyecto que importa el SDK de Anthropic**, y por
 * tanto el único que puede leer la clave. Antes eran tres. Si esto se importara
 * desde un componente, el bundler se llevaría la clave al navegador.
 *
 * Y es donde se reparte entre los tres que pueden contestar —la API, el modelo de
 * casa y el dominio— porque las rutas no tienen por qué saber cuál hay puesto:
 * les entra la misma pregunta y les vuelve la misma forma, y la validación contra
 * el dominio que hacen después es la misma para los tres. Quién es quién lo decide
 * `ai-model.ts`.
 *
 * Vive en `server/` junto a los prompts, que es donde ya viven las otras dos
 * cosas de las que depende el modelo de coste.
 */

import Anthropic from '@anthropic-ai/sdk';

import { modeloDe, reservaParaPensar, type UsoDelModelo } from '@core/billing';

import { configuredModel, localModelUrl, modelProvider } from './ai-model';
import { askLocalModel } from './local-model';
import { RespuestaTruncada } from './respuesta-truncada';

export { RespuestaTruncada };

/**
 * Si se puede preguntar algo, aunque no haya proveedor.
 *
 * Sin proveedor y **fuera de producción** se contesta con el dominio
 * (`fake-model.ts`), que es lo que permite probar las pantallas de IA sin dar de
 * alta un servicio ni descargar nada. En producción sin proveedor no se puede: la
 * ruta contesta 503 y no gasta cupo.
 */
export function modelAvailable(): boolean {
  return modelProvider() !== 'ninguno' || process.env.NODE_ENV !== 'production';
}

/**
 * Lo que se espera como mucho a que conteste la API.
 *
 * **Sin esto no había ninguno.** El modelo de casa sí tenía tope —dos minutos,
 * porque la primera petición carga cinco gigas de pesos—, y la API se quedaba
 * con el del SDK, que son **diez minutos**. Multiplicado por los reintentos de
 * dentro y por el reintento de la ruta, una pregunta al profesor podía dejar a
 * alguien esperando casi una hora contra una pantalla parada. Y `docs/AI.md`
 * llevaba diciendo desde el principio que aquí había «tiempo máximo».
 *
 * Treinta segundos por llamada, y sesenta con el reintento de la ruta, que desde
 * que el SDK no reintenta por su cuenta es el único (`REINTENTOS_DEL_SDK`): por
 * debajo de los dos minutos del modelo de casa. Lo medido
 * en este equipo son dos segundos en caliente y veinte en frío, así que treinta
 * solo salta cuando algo va mal de verdad.
 */
const TIEMPO_MAXIMO_MS = 30_000;

/**
 * Cuántas veces reintenta el SDK por su cuenta, por debajo de la ruta: **ninguna**.
 *
 * El SDK trae dos y aquí hubo uno, que se sumaba a los dos intentos del bucle
 * (`MAX_MODEL_ATTEMPTS`): una pregunta podían ser tres o cuatro llamadas, y el
 * coste —el de los cupos y el techo de gasto— suponía dos. Se decía que estos no
 * se cobran porque solo saltan cuando la petición falla, y no es verdad entera:
 * un tiempo agotado reintentado es una llamada que la API pudo terminar y cobrar.
 *
 * Ahora reintenta solo el bucle, que ya sabe contar: un 429 o un 5xx de la API
 * gastan su segundo intento allí, y coste y realidad son el mismo número
 * (adr/0114).
 */
const REINTENTOS_DEL_SDK = 0;

export interface AskModelInput {
  readonly prompt: string;
  readonly system: string;
  /**
   * El esquema JSON de la respuesta. Sale de `prompts.ts`.
   *
   * Un objeto de claves y no `unknown`: es la forma que pide el SDK, y dejarlo
   * abierto obligaría a un `as` aquí dentro que taparía un esquema mal escrito
   * hasta que el modelo contestara cualquier cosa.
   */
  readonly schema: Record<string, unknown>;
  /**
   * El tope de salida.
   *
   * Sale de `core/billing/cost.ts` y no de aquí: es el mismo número con el que
   * se calculan los cupos, así que el peor caso que supone la aritmética es el
   * que impone el servidor. Es el de la respuesta: la reserva para pensar de los
   * modelos que no lo apagan la suma esta función (`reservaParaPensar`).
   */
  readonly maxTokens: number;
  /**
   * Qué contestar cuando no hay clave. Lo escribe quien llama, porque cada ruta
   * sabe qué forma tiene su respuesta y solo ella puede construirla desde el
   * dominio.
   */
  readonly sinClave: () => unknown;
  /**
   * Qué intento es, empezando en cero.
   *
   * Lo pasa la ruta, que es quien reintenta. Solo lo usa el modelo de casa, para
   * subir la temperatura en el segundo: con la misma petición a temperatura cero
   * la respuesta es la misma, así que reintentar era esperar el doble para el
   * mismo «no». La API de Anthropic ya contesta distinto por su cuenta.
   */
  readonly intento?: number;
  /**
   * Lo que ha gastado la llamada, **una vez por llamada a la API**: los tokens que
   * dice su `usage`, o nulo si no ha vuelto respuesta —un tiempo agotado, una
   * conexión cortada—, que quien cuenta cobra como el peor caso.
   *
   * Solo lo llama la rama de la API: el modelo de casa y el dominio no cuestan.
   */
  readonly alUsar?: (uso: UsoDelModelo | null) => void;
}

/**
 * `{type: 'between_tools'}`, que es como se apaga el pensamiento en Sonnet 5.5.
 *
 * **El `as` es por el SDK, no por la API**: la versión instalada (0.115) solo
 * conoce `enabled`, `disabled` y `adaptive`, y el cliente manda el cuerpo tal
 * cual sin validarlo. La forma sale de la documentación de la API («Effort»,
 * Sonnet 5.5): sin más campos, y solo con esfuerzo `high` o menos. Cuando el SDK
 * lo conozca, el `as` sobra.
 */
const ENTRE_HERRAMIENTAS = { type: 'between_tools' } as unknown as Anthropic.ThinkingConfigParam;

/**
 * Lo que se le manda a cada modelo para que piense lo menos posible, **y nada que
 * rechace**.
 *
 * Mandaba `thinking: {type: 'disabled'}` y `effort: 'low'` a todos, y eso es un
 * 400 en tres de los modelos vigentes: Opus 5.5 y Fable no dejan apagar el
 * pensamiento, Sonnet 5.5 lo apaga con otro nombre y Haiku 4.5 no acepta
 * `effort`. Con uno de ellos puesto, **ninguna pregunta llegaba a contestarse**:
 * la ruta reintentaba, volvía el 400 y tiraba del respaldo, cobrando el cupo.
 *
 * Qué acepta cada uno lo dice la tabla de `core/billing/cost.ts`, que es la misma
 * de la que salen los cupos: un modelo que piensa siempre lleva la reserva en el
 * tope y en el coste a la vez (adr/0103).
 */
export function opcionesDelModelo(modelId: string): {
  readonly thinking?: Anthropic.ThinkingConfigParam;
  readonly effort?: 'low';
} {
  const modelo = modeloDe(modelId);
  // Bajo y no apagado: el esfuerzo modera también lo que piensa quien no puede
  // dejar de hacerlo, y la respuesta la fija un esquema JSON.
  const esfuerzo = modelo.esfuerzo ? { effort: 'low' as const } : {};
  switch (modelo.pensamiento) {
    case 'se-apaga':
      return { thinking: { type: 'disabled' }, ...esfuerzo };
    case 'entre-herramientas':
      return { thinking: ENTRE_HERRAMIENTAS, ...esfuerzo };
    case 'siempre':
    case 'no-piensa':
      // Sin `thinking`: en los primeros es lo único que aceptan, y en Haiku sin
      // `thinking` no se piensa.
      return esfuerzo;
  }
}

/** Lo que gasta una llamada que la API ha rechazado sin generar nada. */
const CERO: UsoDelModelo = { entrada: 0, salida: 0 };

/**
 * Los tokens de una respuesta, con la caché contada como entrada (`costeDeUso`).
 *
 * Los campos de caché pueden venir nulos o no venir: aquí no se usa, y el SDK
 * los declara opcionales.
 */
function usoDe(usage: Anthropic.Usage | undefined): UsoDelModelo | null {
  // Sin `usage` no se sabe cuánto ha sido, y lo que no se sabe se cuenta como el
  // peor caso: nulo.
  if (usage === undefined) {
    return null;
  }
  return {
    entrada:
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
    salida: usage.output_tokens,
  };
}

/**
 * Si el error lo ha contestado la API —trae su estado HTTP— o es que no ha
 * contestado: un tiempo agotado o una conexión cortada no traen estado.
 *
 * Por el campo y no con `instanceof APIError`: así es como lo distingue el propio
 * SDK (`APIConnectionError` es un `APIError` sin estado), y no ata esto a la
 * clase de una versión concreta.
 */
function contestoConError(error: unknown): boolean {
  return typeof (error as { status?: unknown } | null)?.status === 'number';
}

/** La llamada a la API, con lo que se manda a cada modelo. */
function crear(
  client: Anthropic,
  modelo: string,
  pregunta: Pick<AskModelInput, 'prompt' | 'system' | 'schema' | 'maxTokens'> &
    ReturnType<typeof opcionesDelModelo>,
): Promise<Anthropic.Message> {
  const { prompt, system, schema, maxTokens, thinking, effort } = pregunta;
  return client.messages.create({
    model: modelo,
    // El tope de la respuesta más lo que se deja pensar a quien no puede dejar de
    // hacerlo: el mismo número con el que `cost.ts` calcula el peor caso.
    max_tokens: maxTokens + reservaParaPensar(modelo),
    system,
    ...(thinking === undefined ? {} : { thinking }),
    output_config: {
      ...(effort === undefined ? {} : { effort }),
      format: { type: 'json_schema', schema },
    },
    messages: [{ role: 'user', content: prompt }],
  });
}

/**
 * Le pregunta al modelo y devuelve lo que conteste, ya interpretado.
 *
 * Nulo cuando la respuesta no trae texto o no es JSON. Lanza solo cuando el
 * modelo se niega a contestar o cuando falla la red, que son las dos cosas que
 * quien llama tiene que distinguir de «ha contestado algo que no vale».
 *
 * **Pensar se apaga donde se puede, y es una decisión de coste.** La respuesta la
 * fija un esquema JSON: no hay nada que razonar. El pensamiento se cobra como
 * tokens de salida y cuenta dentro de `max_tokens`, así que dejarlo puesto
 * multiplicaba el coste de cada petición y podía gastarse el tope pensando para
 * devolver una respuesta truncada: se paga y no se sirve. Donde no se puede
 * apagar, el esfuerzo va en `low` y el tope lleva una reserva para pensar
 * (`reservaParaPensar`), que el coste cuenta (`opcionesDelModelo`).
 */
export async function askModel({
  prompt,
  system,
  schema,
  maxTokens,
  sinClave,
  intento,
  alUsar,
}: AskModelInput): Promise<unknown> {
  const proveedor = modelProvider();

  if (proveedor === 'ninguno') {
    // Sin proveedor, el dominio contesta por él. Solo se llega aquí fuera de
    // producción: la ruta ya ha comprobado `modelAvailable`.
    return sinClave();
  }

  if (proveedor === 'local') {
    // La URL está, porque es justo lo que mira `modelProvider` para decir
    // «local». El `?? ''` es para el compilador, no para nadie más.
    // Modelo local no cuesta dinero: le damos más tokens para evitar truncamiento.
    const maxTokensLocal = maxTokens * 3;
    return askLocalModel(
      {
        prompt,
        system,
        schema,
        maxTokens: maxTokensLocal,
        model: configuredModel(),
        intento: intento ?? 0,
      },
      /* v8 ignore next -- la URL esta, porque es lo que hace que el proveedor sea «local» */
      localModelUrl() ?? '',
    );
  }

  const client = new Anthropic({ timeout: TIEMPO_MAXIMO_MS, maxRetries: REINTENTOS_DEL_SDK });
  const modelo = configuredModel();
  const { thinking, effort } = opcionesDelModelo(modelo);

  let response: Anthropic.Message;
  try {
    response = await crear(client, modelo, { prompt, system, schema, maxTokens, thinking, effort });
  } catch (error) {
    // La API ha contestado con un error —un 400, un 429, un 529—: no ha generado
    // nada y no cobra. Sin estado es que no ha contestado, y entonces pudo haber
    // trabajado: se cuenta como el peor caso.
    alUsar?.(contestoConError(error) ? CERO : null);
    throw error;
  }

  // **Antes de mirar cómo ha acabado**: una negativa o una respuesta cortada
  // también se cobran, y son justo las que lanzan.
  alUsar?.(usoDe(response.usage));

  if (response.stop_reason === 'refusal') {
    throw new Error('refusal');
  }

  if (response.stop_reason === 'max_tokens') {
    throw new RespuestaTruncada();
  }

  const text = response.content.find((block) => block.type === 'text');
  if (text === undefined || text.type !== 'text') {
    return null;
  }

  try {
    return JSON.parse(text.text) as unknown;
  } catch {
    return null;
  }
}
