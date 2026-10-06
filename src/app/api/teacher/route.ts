import type { NextResponse } from 'next/server';

import { parseTeacherRequest, teacherError } from '@features/learn/teacher-contract';
import { responderConModelo } from '@server/ai-route';
import { SlidingWindowRateLimiter } from '@server/rate-limit';

import { PROFESOR } from './prompt';

/**
 * El profesor. Como el de salidas, es un route handler: el SDK de Anthropic y la
 * clave viven solo aquí, porque importarlos desde un componente los llevaría al
 * navegador.
 *
 * El cuerpo —las puertas, el reintento y qué contestar en cada final— lo pone
 * `server/ai-route.ts`, que es el mismo para las dos rutas. Aquí solo queda lo
 * que distingue al profesor: cómo se lee su petición, qué esquema se le exige a
 * la respuesta, cómo se valida y qué se contesta si el modelo no da nada que
 * valga. Eso se escribe en `prompt.ts`, al lado, porque el examen del profesor lo
 * usa tal cual.
 *
 * El contrato completo está en docs/AI.md.
 */

export const runtime = 'nodejs';

const limiter = new SlidingWindowRateLimiter();

export async function POST(request: Request): Promise<NextResponse> {
  return responderConModelo(request, {
    limiter,
    error: teacherError,
    puerta: { feature: 'profesor', loQueEs: 'Preguntarle al profesor', plural: false },
    parse: parseTeacherRequest,
    ...PROFESOR,
  });
}
