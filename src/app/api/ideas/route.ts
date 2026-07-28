import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { degreesFor } from '@core/music';

import {
  ideasError,
  MAX_IDEAS,
  parseIdeasRequest,
  validateIdeas,
  type IdeasRequest,
} from '@features/ideas/contract';
import { requesterKey, SlidingWindowRateLimiter } from '@features/ideas/rate-limit';

/**
 * Route handler de ideas. Es el único sitio del proyecto que importa el SDK de
 * Anthropic y el único que lee la clave: si esto se importara desde un
 * componente, el bundler se llevaría la clave al navegador.
 *
 * El contrato completo está en docs/AI.md.
 */

export const runtime = 'nodejs';

const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-5';

/**
 * En memoria y por instancia: si esto llega a correr en varias, cada una tendrá
 * su cuenta. Para lo que defiende —pulsar el botón veinte veces seguidas— es
 * suficiente; para un abuso de verdad haría falta un contador compartido.
 */
const limiter = new SlidingWindowRateLimiter();
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `Eres un guitarrista de rock que ayuda a otro a componer.

Criterio: rock, no coral a cuatro voces. El bVII es un grado normal, la
dominante menor vale tanto como la mayor, y V-IV existe. No expliques teoría
que no te hayan pedido.

Responde siempre en español, en frases cortas y con verbos activos. Nada de
exclamaciones. Cada idea lleva un título de menos de sesenta caracteres y una
sola frase de porqué.

Usa exactamente los símbolos de grado que te den como válidos.`;

const IDEAS_SCHEMA = {
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

function buildPrompt(request: IdeasRequest, validDegrees: readonly string[]): string {
  const lines = [
    `Tonalidad: ${request.key.tonic} ${request.key.mode === 'major' ? 'mayor' : 'menor'}.`,
    `Grados válidos: ${validDegrees.join(', ')}.`,
  ];

  if (request.scale !== undefined) {
    lines.push(`Escala que está usando: ${request.scale}.`);
  }
  if (request.currentDegree !== undefined) {
    lines.push(`Grado que suena ahora: ${request.currentDegree}.`);
  }
  if (request.recentNotes !== undefined) {
    lines.push(`Notas recientes: ${request.recentNotes.join(' ')}.`);
  }
  if (request.recentChords !== undefined) {
    lines.push(`Acordes recientes: ${request.recentChords.join(' ')}.`);
  }

  switch (request.kind) {
    case 'progression':
      lines.push('Propón entre dos y cuatro progresiones que encajen, con sus grados.');
      break;
    case 'twist':
      lines.push(
        'Propón entre dos y cuatro giros para romper el bucle: algo que sorprenda sin salirse del tono.',
      );
      break;
    case 'scale':
      lines.push(
        'Propón entre dos y cuatro escalas para tocar encima. Devuelve el identificador de escala en el campo scale.',
      );
      break;
  }

  return lines.join('\n');
}

async function askModel(prompt: string): Promise<unknown> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: IDEAS_SCHEMA } },
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
    return NextResponse.json(ideasError('rate_limited'), {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(ideasError('invalid_request'), { status: 400 });
  }

  const parsed = parseIdeasRequest(body);
  if (parsed === null) {
    return NextResponse.json(ideasError('invalid_request'), { status: 400 });
  }

  const prompt = buildPrompt(parsed, degreesFor(parsed.key.mode));

  // Un reintento y basta. Encadenar más cuesta dinero y tiempo, y el usuario
  // prefiere un «no ha salido» rápido a treinta segundos de espera.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let payload: unknown;
    try {
      payload = await askModel(prompt);
    } catch {
      return NextResponse.json(ideasError('model_unavailable'), { status: 502 });
    }

    const ideas = validateIdeas(payload, parsed);
    if (ideas.length > 0) {
      return NextResponse.json({ ideas });
    }
  }

  return NextResponse.json(ideasError('unparseable_response'), { status: 502 });
}
