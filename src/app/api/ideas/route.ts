import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { needsPlanMessage, planOf, quotaMessage, TOKEN_BUDGETS } from '@core/billing';
import { degreesFor } from '@core/music';

import {
  ideasError,
  parseIdeasRequest,
  validateIdeas,
  type IdeasRequest,
} from '@features/ideas/contract';
import { configuredModel } from '@server/ai-model';
import { IDEAS_SCHEMA, IDEAS_SYSTEM_PROMPT } from '@server/prompts';
import { spendAi } from '@server/entitlements';
import { requesterKey, SlidingWindowRateLimiter } from '@server/rate-limit';

/**
 * Route handler de ideas. Es el único sitio del proyecto que importa el SDK de
 * Anthropic y el único que lee la clave: si esto se importara desde un
 * componente, el bundler se llevaría la clave al navegador.
 *
 * Las ideas no entran en el plan gratis: son la parte más cara de la aplicación
 * —cada pulsación son entre dos y cuatro progresiones razonadas— y es la única
 * que se puede pedir en cadena sin leer lo anterior.
 *
 * El contrato completo está en docs/AI.md.
 */

export const runtime = 'nodejs';

/**
 * En memoria y por instancia: si esto llega a correr en varias, cada una tendrá
 * su cuenta. Para lo que defiende —pulsar el botón veinte veces seguidas— es
 * suficiente; para un abuso de verdad haría falta un contador compartido.
 */
const limiter = new SlidingWindowRateLimiter();

/**
 * El tope de salida sale del dominio, no de aquí: es el mismo número con el que
 * `core/billing/cost.ts` calcula los cupos, así que el peor caso que supone la
 * aritmética es el que impone el servidor.
 */
const MAX_TOKENS = TOKEN_BUDGETS.ideas.output;

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
    model: configuredModel(),
    max_tokens: MAX_TOKENS,
    system: IDEAS_SYSTEM_PROMPT,
    // Sin pensar y con esfuerzo bajo, por lo mismo que en el profesor: la salida
    // la fija un esquema, pensar se cobra como salida y en Opus 5 viene encendido.
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: IDEAS_SCHEMA },
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

  // El cupo del plan, después del límite por minuto: comprobar memoria es
  // gratis y escribir en la base de datos no.
  const permiso = await spendAi('ideas');
  if (permiso.kind === 'sin-cuenta') {
    return NextResponse.json(ideasError('account_required'), { status: 401 });
  }
  if (permiso.kind === 'plan') {
    return NextResponse.json(
      ideasError('plan_required', needsPlanMessage(permiso.needed, 'Las ideas de la IA')),
      { status: 402 },
    );
  }
  if (permiso.kind === 'cupo') {
    return NextResponse.json(
      ideasError(
        'quota_exhausted',
        quotaMessage(planOf(permiso.account.plan), permiso.account.aiModel, permiso.scope),
      ),
      { status: 429 },
    );
  }
  if (permiso.kind === 'sin-contador') {
    return NextResponse.json(ideasError('model_unavailable'), { status: 503 });
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
