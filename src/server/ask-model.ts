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
 * Vive en `server/` junto a los prompts, que es donde ya viven las otras dos
 * cosas de las que depende el modelo de coste.
 */

import Anthropic from '@anthropic-ai/sdk';

import { configuredModel, hasModelKey } from './ai-model';

/**
 * Si se puede preguntar algo, aunque no haya clave.
 *
 * Sin clave y **fuera de producción** se contesta con el dominio
 * (`fake-model.ts`), que es lo que permite probar las pantallas de IA sin dar de
 * alta un servicio. En producción sin clave no se puede: la ruta contesta 503 y
 * no gasta cupo.
 */
export function modelAvailable(): boolean {
  return hasModelKey() || process.env.NODE_ENV !== 'production';
}

/** Si lo que contesta lo ha escrito un modelo de verdad. */
export function modelIsReal(): boolean {
  return hasModelKey();
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
  if (!hasModelKey()) {
    // Sin clave, el dominio contesta por él. Solo se llega aquí fuera de
    // producción: la ruta ya ha comprobado `modelAvailable`.
    return sinClave();
  }

  const client = new Anthropic();

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
