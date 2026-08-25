/**
 * Contrato de la ruta de versiones: qué entra, qué sale y cómo se valida.
 *
 * Vive aquí y no dentro de `app/` porque lo usan los dos lados —el servidor para
 * validar y el cliente para pedir y entender— y es TypeScript puro, así que se
 * prueba sin levantar nada. Es la misma forma que tiene `ideas/contract.ts`.
 *
 * **La diferencia con las ideas está en lo que se valida.** Allí se comprueba que
 * los grados existan y se recalculan los cifrados. Aquí se hace eso y además se
 * comprueba **el razonamiento**: cada versión declara qué movimiento ha aplicado
 * a cada compás, y `isMove` vuelve a aplicarlo para ver si es verdad. Una versión
 * que dice «sustitución tritonal» y no lo es se cae entera, porque el porqué es
 * la mitad de lo que se está vendiendo: sin él son cuatro acordes distintos.
 *
 * Ni audio ni vídeo. Lo que viaja son grados, un número de pulsos y una
 * tonalidad.
 */

import { MAX_VERSION_DEGREES, MAX_VERSIONS } from '@core/billing';
import {
  degreesFor,
  isMove,
  moveById,
  NOTE_NAMES,
  resolveProgression,
  type DegreeSymbol,
  type KeyMode,
  type MoveId,
  type NoteName,
  type PitchClass,
} from '@core/music';
import { pitchClassFromName } from '@core/music';

/**
 * Los dos topes de tamaño de esta petición.
 *
 * Se definen en `core/billing/cost.ts` y se reexportan aquí porque son palancas
 * de gasto antes que reglas del contrato: cada grado y cada versión son tokens, y
 * de los tokens salen los cupos.
 */
export { MAX_VERSION_DEGREES, MAX_VERSIONS };

/** Un compás de la progresión que se manda: el grado y lo que dura. */
export interface VersionStep {
  readonly degree: DegreeSymbol;
  /** Pulsos. Se manda para que la versión respete la forma de la canción. */
  readonly beats: number;
}

export interface VersionsRequest {
  readonly key: { readonly tonic: NoteName; readonly mode: KeyMode };
  readonly progression: readonly VersionStep[];
  /** Cómo se llama la canción, si tiene nombre. Solo para el rótulo. */
  readonly name?: string;
}

/** Un compás de una versión: qué grado va ahora y por qué. */
export interface VersionStepOut {
  readonly degree: DegreeSymbol;
  readonly beats: number;
  /** El cifrado, **recalculado** aquí y no creído al modelo. */
  readonly symbol: string;
  /** El grado que había antes, para poder enseñar el cambio al lado. */
  readonly from: DegreeSymbol;
  /** Qué movimiento se ha aplicado, o nulo si el compás se queda igual. */
  readonly move: MoveId | null;
}

export interface Version {
  readonly title: string;
  readonly why: string;
  readonly steps: readonly VersionStepOut[];
}

export interface VersionsResponse {
  readonly versions: readonly Version[];
}

export type VersionsErrorCode =
  | 'invalid_request'
  | 'rate_limited'
  | 'model_unavailable'
  | 'unparseable_response'
  | 'account_required'
  | 'plan_required'
  | 'quota_exhausted';

export interface VersionsError {
  readonly error: { readonly code: VersionsErrorCode; readonly message: string };
}

export const ERROR_MESSAGES: Readonly<Record<VersionsErrorCode, string>> = {
  invalid_request:
    'Nos falta la progresión. Toca unos compases o abre una canción guardada y vuelve a pedirlo.',
  rate_limited: 'Has pedido muchas versiones seguidas. Espera un momento y vuelve a intentarlo.',
  model_unavailable: 'No hemos podido contactar con el modelo. Vuelve a intentarlo en un minuto.',
  // Esta frase dice algo concreto a propósito: cuando el modelo devuelve
  // versiones que no se sostienen, lo que ha pasado es que se han caído todas al
  // comprobarlas, y «no ha venido bien formada» no lo cuenta.
  unparseable_response:
    'Las versiones que han salido no se sostienen con lo que estás tocando. Vuelve a pedirlo.',
  account_required:
    'Entra con tu cuenta para pedir versiones. La IA se cuenta por cuenta, no por navegador.',
  plan_required: 'Las versiones de tus canciones no entran en tu plan.',
  quota_exhausted:
    'Se te han acabado las peticiones de hoy. Mañana se renuevan, o puedes subir de plan.',
};

export function versionsError(code: VersionsErrorCode, message?: string): VersionsError {
  return { error: { code, message: message ?? ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNoteName(value: unknown): NoteName | null {
  return typeof value === 'string' && (NOTE_NAMES as readonly string[]).includes(value)
    ? (value as NoteName)
    : null;
}

/** Pulsos: entero, al menos uno y con un tope, porque también son tokens. */
function asBeats(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(16, Math.max(1, Math.round(value)));
}

/**
 * Valida el cuerpo de la petición.
 *
 * Nada se reenvía tal cual: la petición se reconstruye desde los campos que
 * pasan y todo lo demás se ignora, igual que en las ideas.
 */
export function parseVersionsRequest(body: unknown): VersionsRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const key = body['key'];
  if (!isRecord(key)) {
    return null;
  }
  const tonic = asNoteName(key['tonic']);
  const mode = key['mode'];
  if (tonic === null || (mode !== 'major' && mode !== 'minor')) {
    return null;
  }

  const raw = body['progression'];
  if (!Array.isArray(raw)) {
    return null;
  }
  const validDegrees = degreesFor(mode) as readonly string[];

  const progression: VersionStep[] = [];
  for (const step of raw.slice(0, MAX_VERSION_DEGREES)) {
    if (!isRecord(step)) {
      continue;
    }
    const degree = step['degree'];
    if (typeof degree !== 'string' || !validDegrees.includes(degree)) {
      continue;
    }
    progression.push({ degree: degree as DegreeSymbol, beats: asBeats(step['beats']) });
  }

  // Con un solo acorde no hay nada que rearmonizar: la versión sería el mismo
  // acorde otra vez, y eso es gastar una petición para no decir nada.
  if (progression.length < 2) {
    return null;
  }

  const request: {
    key: { tonic: NoteName; mode: KeyMode };
    progression: VersionStep[];
    name?: string;
  } = { key: { tonic, mode }, progression };

  const name = body['name'];
  if (typeof name === 'string' && name.trim() !== '') {
    request.name = name.trim().slice(0, 60);
  }

  return request;
}

/**
 * Valida lo que devuelve el modelo contra el dominio.
 *
 * Tres comprobaciones, y las tres tienen que pasar para que una versión llegue a
 * la pantalla:
 *
 * 1. **Misma forma**: tantos compases como tenía la canción y con los mismos
 *    pulsos. Una versión que cambie la duración no es una versión de esa canción,
 *    es otra canción.
 * 2. **Grados que existen** en ese modo. Es lo mismo que hacen las ideas.
 * 3. **El movimiento declarado es cierto**: se vuelve a aplicar al grado que
 *    había y tiene que dar el que propone. Un compás que no cambia lleva `null`,
 *    y eso también se comprueba —decir que no se ha tocado algo que sí cambió es
 *    tan falso como lo otro—.
 *
 * Los cifrados no se creen: se recalculan desde los grados.
 */
export function validateVersions(payload: unknown, request: VersionsRequest): Version[] {
  if (!isRecord(payload) || !Array.isArray(payload['versions'])) {
    return [];
  }

  const { mode } = request.key;
  const tonic: PitchClass = pitchClassFromName(request.key.tonic);
  const validDegrees = degreesFor(mode) as readonly string[];
  const original = request.progression;

  const versions: Version[] = [];

  for (const raw of payload['versions'].slice(0, MAX_VERSIONS)) {
    if (!isRecord(raw)) {
      continue;
    }
    const title = raw['title'];
    const why = raw['why'];
    const steps = raw['steps'];
    if (typeof title !== 'string' || title === '' || typeof why !== 'string' || why === '') {
      continue;
    }
    if (!Array.isArray(steps) || steps.length !== original.length) {
      continue;
    }

    const salida: VersionStepOut[] = [];
    let cambiaAlgo = false;

    for (const [index, step] of steps.entries()) {
      if (!isRecord(step)) {
        break;
      }
      const from = original[index]!;
      const degree = step['degree'];
      if (typeof degree !== 'string' || !validDegrees.includes(degree)) {
        break;
      }

      const move = step['move'];
      const igual = degree === from.degree;

      if (igual) {
        // Un compás que no cambia no lleva movimiento. Si el modelo declara uno,
        // está describiendo algo que no ha hecho.
        if (move !== null && move !== undefined) {
          break;
        }
      } else {
        if (moveById(move) === null || !isMove(mode, from.degree, degree as DegreeSymbol, move)) {
          break;
        }
        cambiaAlgo = true;
      }

      salida.push({
        degree: degree as DegreeSymbol,
        beats: from.beats,
        symbol: '',
        from: from.degree,
        move: igual ? null : (move as MoveId),
      });
    }

    // Una versión que no cambia ni un compás no es una versión: es la canción.
    if (salida.length !== original.length || !cambiaAlgo) {
      continue;
    }

    const symbols = resolveProgression(
      tonic,
      mode,
      salida.map((step) => step.degree),
    ).map((chord) => chord.symbol);

    versions.push({
      title,
      why,
      steps: salida.map((step, index) => ({ ...step, symbol: symbols[index]! })),
    });
  }

  return versions;
}
