import type { NextResponse } from 'next/server';

import { TOKEN_BUDGETS } from '@core/billing';
import { degreesFor } from '@core/music';
import {
  MARCA_PREGUNTA,
  parseTeacherRequest,
  teacherError,
  topicOf,
  validateTeacherAnswer,
  type TeacherRequest,
} from '@features/learn/teacher-contract';
import { responderConModelo } from '@server/ai-route';
import { respuestaSinIA } from '@server/fake-model';
import { ANSWER_SCHEMA, cabeceraDePrompt, TEACHER_SYSTEM_PROMPT } from '@server/prompts';
import { SlidingWindowRateLimiter } from '@server/rate-limit';

/**
 * El profesor. Como el de ideas, es un route handler: el SDK de Anthropic y la
 * clave viven solo aquí, porque importarlos desde un componente los llevaría al
 * navegador.
 *
 * El cuerpo —las puertas, el reintento y qué contestar en cada final— lo pone
 * `server/ai-route.ts`, que es el mismo para las tres rutas. Aquí solo queda lo
 * que distingue al profesor: cómo se lee su petición, cómo se escribe su prompt
 * y qué esquema se le exige a la respuesta.
 *
 * `max_tokens` sale de `TOKEN_BUDGETS`, en el dominio, y no de un número escrito
 * aquí. Es el mismo número con el que se calculan los cupos, así que el peor caso
 * que supone la aritmética **es** el tope que impone el servidor. Escritos por
 * separado se separarían, y entonces los cupos dejarían de cuadrar con el gasto.
 *
 * El contrato completo está en docs/AI.md.
 */

export const runtime = 'nodejs';

const MAX_TOKENS = TOKEN_BUDGETS.profesor.output;

const limiter = new SlidingWindowRateLimiter();

function buildPrompt(request: TeacherRequest, validDegrees: readonly string[]): string {
  const lines = cabeceraDePrompt(request.key, validDegrees);

  if (request.scale !== undefined) {
    lines.push(`Escala que está usando: ${request.scale}.`);
  }
  // El título sale del temario, no de lo que mande el cliente.
  const topic = topicOf(request);
  if (topic !== undefined) {
    lines.push(`Está leyendo sobre: ${topic}.`);
  }

  // La pregunta va marcada y al final: es el único texto libre que entra al
  // modelo en toda la aplicación, y el prompt de sistema dice que lo de dentro
  // de las marcas es un dato. La marca ya se le ha quitado a la pregunta al
  // validarla, así que nadie puede cerrar el bloque antes de tiempo.
  lines.push(`${MARCA_PREGUNTA}\n${request.question}\n${MARCA_PREGUNTA}`);
  return lines.join('\n');
}

export async function POST(request: Request): Promise<NextResponse> {
  return responderConModelo(request, {
    limiter,
    error: teacherError,
    puerta: { feature: 'profesor', loQueEs: 'Preguntarle al profesor', plural: false },
    parse: parseTeacherRequest,
    prompt: (peticion) => buildPrompt(peticion, degreesFor(peticion.key.mode)),
    system: TEACHER_SYSTEM_PROMPT,
    schema: () => ANSWER_SCHEMA,
    maxTokens: MAX_TOKENS,
    sinClave: respuestaSinIA,
    validar: validateTeacherAnswer,
  });
}
