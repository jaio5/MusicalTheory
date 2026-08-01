/**
 * Lo que se le dice al modelo, y la forma en la que tiene que contestar.
 *
 * Los dos prompts de sistema y los dos esquemas de salida, juntos y en la capa de
 * servidor. Estaban dentro de sus rutas, y salieron de ahí por una razón concreta:
 * **de su longitud dependen los cupos de todos los planes.** El presupuesto de
 * tokens de `core/billing/cost.ts` supone un tamaño de entrada, y si un prompt
 * crece, los cupos empiezan a prometer más de lo que hay dinero para pagar.
 *
 * Aquí se pueden medir sin arrastrar media aplicación: `prompts.test.ts` cuenta sus
 * caracteres y falla si se pasan del presupuesto. Dentro de un route handler eso no
 * se podía hacer, porque importarlo trae la sesión, la base de datos y el SDK.
 *
 * Los dos comparten una instrucción que no estaba antes: que no metan etiquetas XML
 * internas en la respuesta. Es lo que recomienda la documentación del modelo cuando
 * se apaga el pensamiento, y en estas dos rutas está apagado porque la respuesta la
 * fija un esquema y pensar se cobra como salida.
 */

import { MAX_IDEAS } from '@core/billing';

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

export const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_IDEAS,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          degrees: { type: 'array', items: { type: 'string' } },
          scale: { type: 'string' },
        },
        required: ['title', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
} as const;
