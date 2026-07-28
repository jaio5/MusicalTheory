import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { degreesFor } from '@core/music';
import {
  parseTeacherRequest,
  teacherError,
  validateTeacherAnswer,
  type TeacherRequest,
} from '@features/learn/teacher-contract';

import { requesterKey, SlidingWindowRateLimiter } from '../rate-limit';

/**
 * El profesor. Como el de ideas, es un route handler: el SDK de Anthropic y la
 * clave viven solo aquí, porque importarlos desde un componente los llevaría al
 * navegador.
 *
 * El contrato completo está en docs/AI.md.
 */

export const runtime = 'nodejs';

const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-5';
const MAX_TOKENS = 1024;

const limiter = new SlidingWindowRateLimiter();

const SYSTEM_PROMPT = `Eres un guitarrista con años de tablas que le explica teoría a otro
guitarrista. El que pregunta toca de oído y sabe hacer sonar cosas: no le
expliques qué es una cuerda, pero tampoco des por sabido el vocabulario.

Responde en español, en dos o tres frases, con verbos activos y sin
exclamaciones. Nada de listas ni de teoría que no te hayan pedido.

Explica siempre en la tonalidad que te den, con los acordes que esa tonalidad
tiene, no con un ejemplo en C mayor.

Si un ejemplo tocable ayuda, devuélvelo en example.degrees usando exactamente
los símbolos de grado válidos que te den. Si no ayuda, no lo incluyas.`;

const ANSWER_SCHEMA = {
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
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
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
