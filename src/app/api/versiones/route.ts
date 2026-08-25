import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { needsPlanMessage, planOf, quotaMessage, TOKEN_BUDGETS } from '@core/billing';
import { degreesFor, MOVES } from '@core/music';

import {
  parseVersionsRequest,
  validateVersions,
  versionsError,
  type VersionsRequest,
} from '@features/versions/contract';
import { configuredModel } from '@server/ai-model';
import { spendAi } from '@server/entitlements';
import { VERSIONS_SCHEMA, VERSIONS_SYSTEM_PROMPT } from '@server/prompts';
import { limitRequest } from '@server/rate-limit-db';
import { requesterKey, SlidingWindowRateLimiter } from '@server/rate-limit';

/**
 * Route handler de versiones. Como el de ideas: el SDK y la clave solo se
 * importan aquí, porque desde un componente el bundler se los llevaría al
 * navegador.
 *
 * **Lo que sube son grados y pulsos.** Ni una muestra de audio, aunque lo que hay
 * detrás se llame «grabar un trozo»: la aplicación ya sabe qué acorde suena, así
 * que grabar es apuntar símbolos. Es lo que mantiene en pie la regla 4 de la
 * arquitectura y lo que hace que esto cueste céntimos en vez de euros.
 *
 * Es la petición más cara de las tres, y entra en el plan Pro. El contrato
 * completo está en docs/AI.md.
 */

export const runtime = 'nodejs';

/** En memoria y por instancia, con la misma limitación que las otras dos rutas. */
const limiter = new SlidingWindowRateLimiter();

/**
 * El tope de salida sale del dominio: es el mismo número con el que
 * `core/billing/cost.ts` calcula el cupo del plan Pro.
 */
const MAX_TOKENS = TOKEN_BUDGETS.versiones.output;

/**
 * El catálogo de movimientos, escrito para el modelo.
 *
 * Se genera desde `MOVES` y no se escribe a mano aquí: si mañana se añade un
 * movimiento al dominio, el modelo se entera solo, y sobre todo **no puede pasar
 * que el prompt ofrezca un movimiento que el validador no sepa comprobar**. Ese
 * desajuste haría que todas las versiones que lo usaran se cayeran sin que nadie
 * entendiera por qué.
 */
function movesText(): string {
  return MOVES.map((move) => `- ${move.id}: ${move.why}`).join('\n');
}

function buildPrompt(request: VersionsRequest): string {
  const { tonic, mode } = request.key;
  const progresion = request.progression.map((step) => `${step.degree} x${step.beats}`).join(' | ');

  const lines = [
    `Tonalidad: ${tonic} ${mode === 'major' ? 'mayor' : 'menor'}.`,
    `Grados válidos: ${degreesFor(mode).join(', ')}.`,
    `Movimientos que puedes declarar:\n${movesText()}`,
    `Progresión (grado y pulsos): ${progresion}`,
  ];

  if (request.name !== undefined) {
    lines.push(`La canción se llama «${request.name}».`);
  }
  lines.push(
    `Devuelve hasta tres versiones de esos ${request.progression.length} compases, en el mismo orden.`,
  );

  return lines.join('\n');
}

async function askModel(prompt: string): Promise<unknown> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: configuredModel(),
    max_tokens: MAX_TOKENS,
    system: VERSIONS_SYSTEM_PROMPT,
    // Apagado, como en las otras dos: la salida la fija un esquema, pensar se
    // cobra como salida y en Opus 5 viene encendido por defecto.
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: VERSIONS_SCHEMA },
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
  // Compartido entre instancias cuando hay base de datos; en memoria cuando no.
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: limiter,
    key: requesterKey(request.headers),
    now,
  });
  if (!allowed) {
    return NextResponse.json(versionsError('rate_limited'), {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(versionsError('invalid_request'), { status: 400 });
  }

  const parsed = parseVersionsRequest(body);
  if (parsed === null) {
    return NextResponse.json(versionsError('invalid_request'), { status: 400 });
  }

  // El cupo del plan después del límite por minuto: comprobar memoria es gratis
  // y escribir en la base de datos no.
  const permiso = await spendAi('versiones');
  if (permiso.kind === 'sin-cuenta') {
    return NextResponse.json(versionsError('account_required'), { status: 401 });
  }
  if (permiso.kind === 'plan') {
    return NextResponse.json(
      versionsError(
        'plan_required',
        needsPlanMessage(permiso.needed, 'Las versiones de tus canciones', true),
      ),
      { status: 402 },
    );
  }
  if (permiso.kind === 'cupo') {
    return NextResponse.json(
      versionsError(
        'quota_exhausted',
        quotaMessage(planOf(permiso.account.plan), permiso.account.aiModel, permiso.scope),
      ),
      { status: 429 },
    );
  }
  if (permiso.kind === 'sin-contador') {
    return NextResponse.json(versionsError('model_unavailable'), { status: 503 });
  }

  const prompt = buildPrompt(parsed);

  // Un reintento y basta, como en las ideas: encadenar más cuesta dinero y
  // tiempo, y aquí además cada intento es la petición más cara que hay.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let payload: unknown;
    try {
      payload = await askModel(prompt);
    } catch {
      return NextResponse.json(versionsError('model_unavailable'), { status: 502 });
    }

    const versions = validateVersions(payload, parsed);
    if (versions.length > 0) {
      return NextResponse.json({ versions });
    }
  }

  return NextResponse.json(versionsError('unparseable_response'), { status: 502 });
}
