import { NextResponse } from 'next/server';

import { MAX_MODEL_ATTEMPTS, TOKEN_BUDGETS } from '@core/billing';
import { degreesFor } from '@core/music';
import {
  MARCA_PREGUNTA,
  parseTeacherRequest,
  teacherError,
  topicOf,
  validateTeacherAnswer,
  type TeacherRequest,
} from '@features/learn/teacher-contract';
import { abrirPuertaDeIa, frenarPorFrecuencia } from '@server/ai-gate';
import { askModel } from '@server/ask-model';
import { respuestaSinIA } from '@server/fake-model';
import { ANSWER_SCHEMA, TEACHER_SYSTEM_PROMPT } from '@server/prompts';
import { SlidingWindowRateLimiter } from '@server/rate-limit';

/**
 * El profesor. Como el de ideas, es un route handler: el SDK de Anthropic y la
 * clave viven solo aquí, porque importarlos desde un componente los llevaría al
 * navegador.
 *
 * Tres puertas antes de gastar dinero, y en este orden: el límite por minuto
 * —memoria, gratis de comprobar—, tener cuenta, y el cupo del plan, que es una
 * escritura en la base de datos. Al revés se pagaría una consulta por cada
 * pulsación de más.
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
  const lines = [
    `Tonalidad: ${request.key.tonic} ${request.key.mode === 'major' ? 'mayor' : 'menor'}.`,
    `Grados válidos: ${validDegrees.join(', ')}.`,
  ];

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
  const now = Date.now();
  // Compartido entre instancias cuando hay base de datos; en memoria cuando no.
  const frenada = await frenarPorFrecuencia(request, limiter, teacherError, now);
  if (frenada !== null) {
    return frenada;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(teacherError('invalid_request'), { status: 400 });
  }

  const parsed = parseTeacherRequest(body);
  if (parsed === null) {
    return NextResponse.json(teacherError('invalid_request'), { status: 400 });
  }

  const cerrada = await abrirPuertaDeIa({
    feature: 'profesor',
    error: teacherError,
    loQueEs: 'Preguntarle al profesor',
    plural: false,
  });
  if (cerrada !== null) {
    return cerrada;
  }

  const prompt = buildPrompt(parsed, degreesFor(parsed.key.mode));

  // Un reintento y basta, por lo mismo que en ideas: un «no ha salido» rápido
  // vale más que treinta segundos de espera.
  for (let attempt = 0; attempt < MAX_MODEL_ATTEMPTS; attempt += 1) {
    let payload: unknown;
    try {
      payload = await askModel({
        prompt,
        system: TEACHER_SYSTEM_PROMPT,
        schema: ANSWER_SCHEMA,
        maxTokens: MAX_TOKENS,
        sinClave: respuestaSinIA,
      });
    } catch {
      return NextResponse.json(teacherError('model_unavailable'), { status: 502 });
    }

    const answer = validateTeacherAnswer(payload, parsed);
    if (answer !== null) {
      return NextResponse.json(answer);
    }
  }

  return NextResponse.json(teacherError('unparseable_response'), { status: 502 });
}
