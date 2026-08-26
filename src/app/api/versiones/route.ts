import { NextResponse } from 'next/server';

import {
  MAX_MODEL_ATTEMPTS,
  needsPlanMessage,
  planOf,
  quotaMessage,
  TOKEN_BUDGETS,
} from '@core/billing';
import {
  degreesFor,
  MOVES,
  PATHS,
  PATHS_BY_KIND,
  textoDelGrafo,
  type SalidaKind,
} from '@core/music';

import {
  parseVersionsRequest,
  validateVersions,
  versionsError,
  type VersionsRequest,
} from '@features/versions/contract';
import { askModel, modelAvailable } from '@server/ask-model';
import { versionesSinIA } from '@server/fake-model';
import { spendAi } from '@server/entitlements';
import { versionsSchema, VERSIONS_SYSTEM_PROMPT } from '@server/prompts';
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
/**
 * El catálogo de salidas, generado desde `PATHS`.
 *
 * No se escribe a mano por lo mismo que el de movimientos: si el prompt ofreciera
 * una salida que el validador no sabe comprobar, todas las que la usaran caerían
 * sin que nadie entendiera por qué.
 */
function pathsText(kind: SalidaKind): string {
  return PATHS.filter((path) => PATHS_BY_KIND[kind].includes(path.id))
    .map((path) => `- ${path.id}: ${path.why}`)
    .join('\n');
}

function movesText(): string {
  return MOVES.map((move) => `- ${move.id}: ${move.why}`).join('\n');
}

function buildPrompt(request: VersionsRequest): string {
  const { tonic, mode } = request.key;
  const progresion = request.progression.map((step) => `${step.degree} x${step.beats}`).join(' | ');

  const lines = [
    `Tonalidad: ${tonic} ${mode === 'major' ? 'mayor' : 'menor'}.`,
    `Grados válidos: ${degreesFor(mode).join(', ')}.`,
    `Salidas que puedes declarar:\n${pathsText(request.kind)}`,
    `Movimientos, solo para rearmonizar:\n${movesText()}`,
    // El mapa de saltos es lo que convierte «inventa algo» en «elige por dónde».
    // Es el mismo truco que llevó las ideas de 0 de 4 a 4 de 4: enseñarle lo que
    // el validador va a comprobar, en vez de pedírselo en prosa.
    `Mapa de saltos (de cada grado, a dónde puedes ir):\n${textoDelGrafo(mode, degreesFor(mode))}`,
    `Lo que lleva tocado (grado y pulsos): ${progresion}`,
  ];

  lines.push(
    request.kind === 'continuar'
      ? `Continúa esos ${request.progression.length} compases: hasta tres canciones ` +
          'distintas. De cada una devuelve solo las partes que añades, no las suyas, y ' +
          'que digan algo que no estuviera ya.'
      : `Devuelve hasta tres salidas distintas para esos ${request.progression.length} compases.`,
  );

  return lines.join('\n');
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

  // Sin clave, antes de gastar cupo. `askModel` fallaría igual unas líneas
  // más abajo, pero para entonces la petición ya está contada: alguien se
  // quedaría sin peticiones del mes por una variable de entorno que falta.
  if (!modelAvailable()) {
    return NextResponse.json(versionsError('model_unavailable'), { status: 503 });
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
  for (let attempt = 0; attempt < MAX_MODEL_ATTEMPTS; attempt += 1) {
    let payload: unknown;
    try {
      payload = await askModel({
        prompt,
        system: VERSIONS_SYSTEM_PROMPT,
        // El esquema depende del modo: los grados válidos no son los mismos
        // en mayor que en menor, y el enumerado es lo que impide que escriba uno
        // que no existe.
        schema: versionsSchema(parsed.key.mode, parsed.kind),
        maxTokens: MAX_TOKENS,
        sinClave: () =>
          versionesSinIA({
            tonic: parsed.key.tonic,
            mode: parsed.key.mode,
            progression: parsed.progression,
          }),
      });
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
