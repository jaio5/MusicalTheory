import type { NextResponse } from 'next/server';

import { TOKEN_BUDGETS } from '@core/billing';
import { degreesFor } from '@core/music';

import {
  ideasError,
  parseIdeasRequest,
  validateIdeas,
  type IdeasRequest,
} from '@features/ideas/contract';
import { responderConModelo } from '@server/ai-route';
import { ideasSinIA } from '@server/fake-model';
import { cabeceraDePrompt, ideasSchema, IDEAS_SYSTEM_PROMPT } from '@server/prompts';
import { SlidingWindowRateLimiter } from '@server/rate-limit';

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
  const lines = cabeceraDePrompt(request.key, validDegrees);

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

export async function POST(request: Request): Promise<NextResponse> {
  return responderConModelo(request, {
    limiter,
    error: ideasError,
    puerta: { feature: 'ideas', loQueEs: 'Las ideas de la IA', plural: true },
    parse: parseIdeasRequest,
    prompt: (peticion) => buildPrompt(peticion, degreesFor(peticion.key.mode)),
    system: IDEAS_SYSTEM_PROMPT,
    // El esquema depende de lo que se haya pedido: con `scale` hace falta un
    // identificador de escala y con los otros dos, grados del modo. Es lo mismo
    // que `validateIdeas` mira después.
    schema: (peticion) => ideasSchema(peticion.kind, peticion.key.mode),
    maxTokens: MAX_TOKENS,
    sinClave: (peticion) => ideasSinIA(peticion.key.tonic, peticion.key.mode),
    validar: (payload, peticion) => {
      const ideas = validateIdeas(payload, peticion);
      return ideas.length > 0 ? { ideas } : null;
    },
  });
}
