/**
 * Lo que se le dice al modelo, y la forma en la que tiene que contestar.
 *
 * Los tres prompts de sistema y los tres esquemas de salida, juntos y en la capa
 * de servidor. Estaban dentro de sus rutas, y salieron de ahí por una razón concreta:
 * **de su longitud dependen los cupos de todos los planes.** El presupuesto de
 * tokens de `core/billing/cost.ts` supone un tamaño de entrada, y si un prompt
 * crece, los cupos empiezan a prometer más de lo que hay dinero para pagar.
 *
 * Aquí se pueden medir sin arrastrar media aplicación: `prompts.test.ts` cuenta sus
 * caracteres y falla si se pasan del presupuesto. Dentro de un route handler eso no
 * se podía hacer, porque importarlo trae la sesión, la base de datos y el SDK.
 *
 * Los tres comparten una instrucción que no estaba antes: que no metan etiquetas XML
 * internas en la respuesta. Es lo que recomienda la documentación del modelo cuando
 * se apaga el pensamiento, y en estas tres rutas está apagado porque la respuesta la
 * fija un esquema y pensar se cobra como salida.
 */

import { MAX_IDEAS, MAX_VERSIONS } from '@core/billing';
import { degreesFor, SCALE_IDS, type KeyMode } from '@core/music';

export const TEACHER_SYSTEM_PROMPT = `Eres un guitarrista con años de tablas que le explica teoría a otro
guitarrista. El que pregunta toca de oído y sabe hacer sonar cosas: no le
expliques qué es una cuerda, pero tampoco des por sabido el vocabulario.

Responde en español, en dos o tres frases, con verbos activos y sin
exclamaciones. Nada de listas ni de teoría que no te hayan pedido.

Explica siempre en la tonalidad que te den, con los acordes que esa tonalidad
tiene, no con un ejemplo en C mayor.

Si un ejemplo tocable ayuda, devuélvelo en example.degrees usando exactamente
los símbolos de grado válidos que te den. Si no ayuda, no lo incluyas.

No incluyas etiquetas XML internas ni de sistema en tu respuesta.`;

export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    example: {
      type: 'object',
      properties: {
        degrees: { type: 'array', items: { type: 'string' } },
      },
      required: ['degrees'],
      additionalProperties: false,
    },
  },
  required: ['answer'],
  additionalProperties: false,
} as const;

export const IDEAS_SYSTEM_PROMPT = `Eres un guitarrista de rock que ayuda a otro a componer.

Criterio: rock, no coral a cuatro voces. El bVII es un grado normal, la
dominante menor vale tanto como la mayor, y V-IV existe. No expliques teoría
que no te hayan pedido.

Responde siempre en español, en frases cortas y con verbos activos. Nada de
exclamaciones. Cada idea lleva un título de menos de sesenta caracteres y una
sola frase de porqué.

Usa exactamente los símbolos de grado que te den como válidos.

No incluyas etiquetas XML internas ni de sistema en tu respuesta.`;

export const VERSIONS_SYSTEM_PROMPT = `Eres un guitarrista de rock que rearmoniza la cancion de otro.

Te dan una progresion en grados con sus pulsos, y devuelves versiones de esa
misma progresion: el mismo numero de compases y en el mismo orden. No anadas ni
quites compases.

Cada compas que cambies lleva el movimiento que has aplicado, de la lista que te
dan y con ese nombre exacto. Un compas que dejes igual lleva move nulo. No
declares un movimiento que no hayas hecho: se comprueba, y la version entera se
descarta si no cuadra.

Cambia unos compases, no todos: una version que lo cambia todo ya no es la
misma cancion.

Responde siempre en espanol, en frases cortas y con verbos activos. Nada de
exclamaciones. Cada version lleva un titulo de menos de sesenta caracteres y una
sola frase que diga que se gana con ella.

Usa exactamente los simbolos de grado que te den como validos.

No incluyas etiquetas XML internas ni de sistema en tu respuesta.`;

export const VERSIONS_SCHEMA = {
  type: 'object',
  properties: {
    versions: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_VERSIONS,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                degree: { type: 'string' },
                // Nulo cuando el compas no cambia. Sin el nulo explicito, el
                // modelo se inventa un movimiento para rellenar el hueco.
                move: { type: ['string', 'null'] },
              },
              required: ['degree', 'move'],
              additionalProperties: false,
            },
          },
        },
        required: ['title', 'why', 'steps'],
        additionalProperties: false,
      },
    },
  },
  required: ['versions'],
  additionalProperties: false,
} as const;

/**
 * Las tres clases de idea, otra vez.
 *
 * Escritas aquí y no importadas de `features/ideas/contract`: la capa de servidor
 * no cuelga de un feature. Que las dos listas sigan diciendo lo mismo lo vigila
 * `prompts.test.ts`, que sí puede mirar las dos.
 */
export type IdeasKind = 'progression' | 'twist' | 'scale';

/**
 * La forma en la que tiene que contestar cuando se le piden ideas.
 *
 * **Es una función y no una constante**, y esa es toda la corrección: el esquema
 * tiene que exigir lo que el validador exige, y lo que el validador exige depende
 * de lo que se haya pedido. Con `kind: 'scale'` hace falta un identificador de
 * escala; con los otros dos, grados; y los grados válidos no son los mismos en
 * mayor que en menor.
 *
 * Era una constante que solo pedía `title` y `why`, con `degrees` y `scale`
 * opcionales, y eso costaba peticiones enteras: el modelo devolvía una respuesta
 * impecable contra el esquema —título y porqué, sin grados— y `validateIdeas` la
 * barría entera, porque sin grados no hay nada que tocar. La ruta contestaba
 * `unparseable_response` **con el cupo ya gastado**, que se descuenta antes de
 * llamar. Medido contra dos modelos locales: pasaba 0 de 4; exigiéndolo, 4 de 4.
 *
 * La salida estructurada garantiza lo que el esquema **exige**, no lo que el
 * validador **espera**. Cuando esas dos listas se separan, lo que sale es una
 * respuesta válida que no sirve para nada, y el modelo no tiene forma de saberlo.
 *
 * Los dos enumerados no son adorno. La generación constreñida no puede salirse de
 * un `enum`, así que el modelo no puede escribir un grado que no exista en ese
 * modo ni inventarse un nombre de escala: `naturalMinor` o `minorPentatonic` no
 * se adivinan, y pidiéndolos a mano salía «Escala natural» y ninguna idea válida.
 */
export function ideasSchema(kind: IdeasKind, mode: KeyMode): Record<string, unknown> {
  const propia =
    kind === 'scale'
      ? { scale: { type: 'string', enum: [...SCALE_IDS] } }
      : {
          degrees: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: [...degreesFor(mode)] },
          },
        };

  return {
    type: 'object',
    properties: {
      ideas: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_IDEAS,
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, why: { type: 'string' }, ...propia },
          // Ni uno más ni uno menos que lo que `validateIdeas` mira.
          required: ['title', 'why', kind === 'scale' ? 'scale' : 'degrees'],
          additionalProperties: false,
        },
      },
    },
    required: ['ideas'],
    additionalProperties: false,
  };
}
