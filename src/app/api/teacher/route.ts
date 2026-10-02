import type { NextResponse } from 'next/server';

import { TOKEN_BUDGETS } from '@core/billing';
import {
  parseTeacherRequest,
  teacherError,
  validateTeacherAnswer,
} from '@features/learn/teacher-contract';
import { responderConModelo } from '@server/ai-route';
import { respuestaSinIA } from '@server/fake-model';
import { ANSWER_SCHEMA, TEACHER_SYSTEM_PROMPT } from '@server/prompts';
import { SlidingWindowRateLimiter } from '@server/rate-limit';

import { promptDelProfesor } from './prompt';

/**
 * El profesor. Como el de salidas, es un route handler: el SDK de Anthropic y la
 * clave viven solo aquí, porque importarlos desde un componente los llevaría al
 * navegador.
 *
 * El cuerpo —las puertas, el reintento y qué contestar en cada final— lo pone
 * `server/ai-route.ts`, que es el mismo para las dos rutas. Aquí solo queda lo
 * que distingue al profesor: cómo se lee su petición, qué esquema se le exige a
 * la respuesta y cómo se valida. El prompt se escribe en `prompt.ts`, al lado.
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

export async function POST(request: Request): Promise<NextResponse> {
  return responderConModelo(request, {
    limiter,
    error: teacherError,
    puerta: { feature: 'profesor', loQueEs: 'Preguntarle al profesor', plural: false },
    parse: parseTeacherRequest,
    prompt: promptDelProfesor,
    system: TEACHER_SYSTEM_PROMPT,
    schema: () => ANSWER_SCHEMA,
    maxTokens: MAX_TOKENS,
    sinClave: respuestaSinIA,
    validar: validateTeacherAnswer,
  });
}
