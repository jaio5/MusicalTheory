import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { needsPlanMessage, planOf, quotaMessage, TOKEN_BUDGETS } from '@core/billing';
import { degreesFor } from '@core/music';
import {
  parseTeacherRequest,
  teacherError,
  validateTeacherAnswer,
  type TeacherRequest,
} from '@features/learn/teacher-contract';
import { configuredModel } from '@server/ai-model';
import { ANSWER_SCHEMA, TEACHER_SYSTEM_PROMPT } from '@server/prompts';
import { spendAi } from '@server/entitlements';
import { requesterKey, SlidingWindowRateLimiter } from '@server/rate-limit';

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
  if (request.topic !== undefined) {
    lines.push(`Está leyendo sobre: ${request.topic}.`);
  }

  lines.push(`Pregunta: ${request.question}`);
  return lines.join('\n');
}

async function askModel(prompt: string): Promise<unknown> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: configuredModel(),
    max_tokens: MAX_TOKENS,
    system: TEACHER_SYSTEM_PROMPT,
    // Sin pensar y con esfuerzo bajo. La respuesta son tres frases con una forma
    // fijada por el esquema: no hay nada que razonar, y en Opus 5 pensar está
    // encendido por defecto y se cobra como salida. Dejarlo puesto multiplicaba el
    // coste de cada pregunta y podía comerse el `max_tokens` antes de contestar,
    // que es la peor combinación: se paga y no se sirve.
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: ANSWER_SCHEMA },
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

export async function POST(request: Request): Promise<NextResponse> {
  const now = Date.now();
  limiter.prune(now);

  const { allowed, retryAfterSeconds } = limiter.check(requesterKey(request.headers), now);
  if (!allowed) {
    return NextResponse.json(teacherError('rate_limited'), {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
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

  // El cupo del plan. Se gasta aquí, antes de llamar al modelo, y por eso el
  // reintento de abajo no vuelve a pasar por esta puerta: se cobra un intento,
  // no dos.
  const permiso = await spendAi('profesor');
  if (permiso.kind === 'sin-cuenta') {
    return NextResponse.json(teacherError('account_required'), { status: 401 });
  }
  if (permiso.kind === 'plan') {
    return NextResponse.json(
      teacherError('plan_required', needsPlanMessage(permiso.needed, 'Preguntarle al profesor')),
      { status: 402 },
    );
  }
  if (permiso.kind === 'cupo') {
    return NextResponse.json(
      teacherError(
        'quota_exhausted',
        quotaMessage(planOf(permiso.account.plan), permiso.account.aiModel, permiso.scope),
      ),
      { status: 429 },
    );
  }
  if (permiso.kind === 'sin-contador') {
    return NextResponse.json(teacherError('model_unavailable'), { status: 503 });
  }

  const prompt = buildPrompt(parsed, degreesFor(parsed.key.mode));

  // Un reintento y basta, por lo mismo que en ideas: un «no ha salido» rápido
  // vale más que treinta segundos de espera.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let payload: unknown;
    try {
      payload = await askModel(prompt);
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
