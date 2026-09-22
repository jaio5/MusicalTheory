import type { NextResponse } from 'next/server';

import { TOKEN_BUDGETS } from '@core/billing';
import { degreesFor } from '@core/music';

import { parseVersionsRequest, validateVersions, versionsError } from '@features/versions/contract';
import { promptDeSalidas } from '@features/versions/prompt';
import { responderConModelo } from '@server/ai-route';
import { versionesSinIA } from '@server/fake-model';
import { cabeceraDePrompt, versionsSchema, VERSIONS_SYSTEM_PROMPT } from '@server/prompts';
import { SlidingWindowRateLimiter } from '@server/rate-limit';

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

export async function POST(request: Request): Promise<NextResponse> {
  return responderConModelo(request, {
    limiter,
    error: versionsError,
    puerta: { feature: 'versiones', loQueEs: 'Las salidas de lo que tocas', plural: true },
    parse: parseVersionsRequest,
    prompt: (peticion) =>
      promptDeSalidas(peticion, cabeceraDePrompt(peticion.key, degreesFor(peticion.key.mode))),
    system: VERSIONS_SYSTEM_PROMPT,
    // El esquema depende del modo: los grados válidos no son los mismos en mayor
    // que en menor, y el enumerado es lo que impide que escriba uno que no
    // existe.
    schema: (peticion) => versionsSchema(peticion.key.mode, peticion.kind),
    maxTokens: MAX_TOKENS,
    sinClave: (peticion) =>
      versionesSinIA({
        tonic: peticion.key.tonic,
        mode: peticion.key.mode,
        progression: peticion.progression,
      }),
    validar: (payload, peticion) => {
      const versions = validateVersions(payload, peticion);
      return versions.length > 0 ? { versions } : null;
    },
  });
}
