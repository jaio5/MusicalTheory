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

import { configuredModel, localModelUrl, modelProvider } from './ai-model';
import { askLocalModel } from './local-model';

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
 * Treinta segundos con un reintento dan sesenta por llamada y ciento veinte con
 * el reintento de la ruta: **el mismo tope de dos minutos que el modelo de
 * casa**, que es lo que hace que las dos ramas se puedan razonar igual. Lo medido
 * en este equipo son dos segundos en caliente y veinte en frío, así que treinta
 * solo salta cuando algo va mal de verdad.
 */
const TIEMPO_MAXIMO_MS = 30_000;

/**
 * Cuántas veces reintenta el SDK por su cuenta, por debajo de la ruta.
 *
 * El SDK trae dos y **no son los mismos reintentos** que los de `ai-route.ts`:
 * aquellos son para una respuesta que no valida, y estos para una petición que
 * ni llegó —un 429 de la API, un 5xx, una conexión cortada—. Los dos hacen falta
 * y por eso no se apagan: sin estos, un pico de carga de la API sale como 502 a
 * la primera en vez de esperar un momento y volver a intentarlo.
 *
 * Uno y no dos, que es lo que trae de serie, para que el peor caso quepa en el
 * tope de arriba. **Y ninguno de estos se cobra**, porque suceden cuando la
 * petición falló; el único que podría cobrarse es el de un tiempo agotado, con
 * el servidor habiendo terminado y nosotros habiéndonos ido, y para eso está que
 * el tope sea holgado.
 */
const REINTENTOS_DEL_SDK = 1;

/**
 * La respuesta se cortó por llegar al tope de tokens.
 *
 * Va aparte de los demás fallos porque **reintentarla no puede salir bien**: el
 * prompt es el mismo y el tope también, así que la segunda llamada se corta por
 * donde se cortó la primera. Sin distinguirla, el reintento de `ai-route.ts` —que
 * está para una respuesta que no valida, donde otra tirada sí puede cambiar las
 * cosas— gastaba una llamada a la API que no tenía ninguna posibilidad.
 *
 * El JSON cortado no se puede leer, así que lo que sale es `unparseable_response`,
 * que es literalmente lo que ha pasado: contestó y lo que dijo no vale.
 */
export class RespuestaTruncada extends Error {
  constructor() {
    super('truncated');
    this.name = 'RespuestaTruncada';
  }
}

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
   * que impone el servidor.
   */
  readonly maxTokens: number;
  /**
   * Qué contestar cuando no hay clave. Lo escribe quien llama, porque cada ruta
   * sabe qué forma tiene su respuesta y solo ella puede construirla desde el
   * dominio.
   */
  readonly sinClave: () => unknown;
}

/**
 * Le pregunta al modelo y devuelve lo que conteste, ya interpretado.
 *
 * Nulo cuando la respuesta no trae texto o no es JSON. Lanza solo cuando el
 * modelo se niega a contestar o cuando falla la red, que son las dos cosas que
 * quien llama tiene que distinguir de «ha contestado algo que no vale».
 *
 * **Pensar está apagado, y es una decisión de coste.** La respuesta la fija un
 * esquema JSON: no hay nada que razonar. En `claude-opus-5` el pensamiento viene
 * encendido por defecto y se cobra como tokens de salida, así que dejarlo puesto
 * multiplicaba el coste de cada petición y podía gastarse el `max_tokens`
 * pensando para devolver una respuesta truncada: se paga y no se sirve. Por lo
 * mismo, `effort: 'low'`.
 */
export async function askModel({
  prompt,
  system,
  schema,
  maxTokens,
  sinClave,
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
    return askLocalModel(
      { prompt, system, schema, maxTokens, model: configuredModel() },
      /* v8 ignore next -- la URL esta, porque es lo que hace que el proveedor sea «local» */
      localModelUrl() ?? '',
    );
  }

  const client = new Anthropic({ timeout: TIEMPO_MAXIMO_MS, maxRetries: REINTENTOS_DEL_SDK });

  const response = await client.messages.create({
    model: configuredModel(),
    max_tokens: maxTokens,
    system,
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema },
    },
    messages: [{ role: 'user', content: prompt }],
  });

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
