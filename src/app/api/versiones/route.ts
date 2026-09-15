import type { NextResponse } from 'next/server';

import { TOKEN_BUDGETS } from '@core/billing';
import {
  DEFAULT_ROLE,
  MOVES,
  PATHS,
  PATHS_BY_KIND,
  degreesFor,
  graphText,
  roleInfo,
  type PathKind,
  type SectionRole,
} from '@core/music';

import {
  parseVersionsRequest,
  validateVersions,
  versionsError,
  type VersionsRequest,
} from '@features/versions/contract';
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
function pathsText(kind: PathKind): string {
  return PATHS.filter((path) => PATHS_BY_KIND[kind].includes(path.id))
    .map((path) => `- ${path.id}: ${path.why}`)
    .join('\n');
}

function movesText(): string {
  return MOVES.map((move) => `- ${move.id}: ${move.why}`).join('\n');
}

/**
 * Qué es lo que le mandan, en una línea.
 *
 * La frase sale de `ROLES` y no se escribe aquí, por lo mismo que el catálogo de
 * salidas y el de movimientos: **lo que entiende quien compone y lo que entiende
 * el modelo tienen que salir del mismo sitio.** Escribirla otra vez aquí es
 * firmar que dentro de tres meses digan cosas distintas.
 *
 * Una idea se dice igual de claro que un estribillo. No decir nada haría que el
 * modelo diera por hecho que es una canción a medias, que es lo que venía
 * suponiendo y por lo que continuaba siempre por lo obvio.
 */
function queEs(role: SectionRole = DEFAULT_ROLE): string {
  const info = roleInfo(role);
  return `Lo que te mandan es ${info.name.toLowerCase()}: ${info.what}`;
}

function buildPrompt(request: VersionsRequest): string {
  const { mode } = request.key;
  const progresion = request.progression.map((step) => `${step.degree} x${step.beats}`).join(' | ');

  const lines = [
    ...cabeceraDePrompt(request.key, degreesFor(mode)),
    `Salidas que puedes declarar:\n${pathsText(request.kind)}`,
    `Movimientos, solo para rearmonizar:\n${movesText()}`,
    // El mapa de saltos es lo que convierte «inventa algo» en «elige por dónde».
    // Es el mismo truco que llevó las ideas de 0 de 4 a 4 de 4: enseñarle lo que
    // el validador va a comprobar, en vez de pedírselo en prosa.
    `Mapa de saltos (de cada grado, a dónde puedes ir):\n${graphText(mode, degreesFor(mode))}`,
    `Lo que lleva tocado (grado y pulsos): ${progresion}`,
    queEs(request.role),
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
  return responderConModelo(request, {
    limiter,
    error: versionsError,
    puerta: { feature: 'versiones', loQueEs: 'Las salidas de lo que tocas', plural: true },
    parse: parseVersionsRequest,
    prompt: buildPrompt,
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
