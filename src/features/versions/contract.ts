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
  parseKey,
  kindOfPath,
  moveById,
  songProblem,
  pathById,
  pitchClassFromName,
  resolveProgression,
  type DegreeSymbol,
  type KeyMode,
  type MoveId,
  type NoteName,
  type PathId,
  type PitchClass,
  type ProposedSection,
  type PathKind,
  type ProposedStep,
} from '@core/music';
import { aiError, type AiError, type AiErrorCode } from '@core/ai-errors';
import { isRecord } from '@core/parse';

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
  /**
   * Qué se le pide: continuar la canción o retocar estos compases.
   *
   * Se elige antes de pedirlo y no lo decide el modelo, y el motivo es técnico
   * antes que de interfaz: continuar exige al menos dos partes y retocar
   * exactamente una, y un esquema JSON no puede condicionar eso a un campo que el
   * propio modelo rellena. Eligiéndolo antes, el esquema exige lo que el
   * validador comprueba —que es la regla que ya costó una vez, con las ideas—.
   */
  readonly kind: PathKind;
}

/** Un compás de una salida: qué grado va ahora y de dónde sale. */
export interface VersionStepOut {
  readonly degree: DegreeSymbol;
  readonly beats: number;
  /** El cifrado, **recalculado** aquí y no creído al modelo. */
  readonly symbol: string;
  /**
   * El grado que había en ese compás, o **nulo si el compás es nuevo**.
   *
   * El nulo es lo que la pantalla usa para separar lo que tocaste de lo que se
   * te propone, que en una salida que alarga es la mitad de la información.
   */
  readonly from: DegreeSymbol | null;
  /** Qué movimiento se ha aplicado. Solo lo llevan las rearmonizaciones. */
  readonly move: MoveId | null;
}

/** Una parte de la canción propuesta: cómo se llama y qué suena en ella. */
export interface VersionSection {
  readonly name: string;
  /** Si es, tal cual, lo que tocaste. */
  readonly yours: boolean;
  readonly steps: readonly VersionStepOut[];
}

export interface Version {
  readonly title: string;
  readonly why: string;
  /** Cuál de las cinco salidas ha tomado. Comprobado contra el dominio. */
  readonly path: PathId;
  /**
   * La canción por partes.
   *
   * Las dos salidas que continúan lo que llevas —`seguir` y `contraste`— traen
   * varias: la yours primero y lo que sigue después, con su nombre. Las tres que
   * retocan tus compases traen una sola, porque no hay canción que montar.
   */
  readonly sections: readonly VersionSection[];
  /** Todas las partes seguidas, que es lo que se toca y lo que se guarda. */
  readonly steps: readonly VersionStepOut[];
}

export interface VersionsResponse {
  readonly versions: readonly Version[];
}

/**
 * Los siete códigos, compartidos con las otras dos rutas de IA.
 *
 * Alias y no una copia: estaban declarados tres veces idénticos, y el día que
 * haga falta uno nuevo se añade en `core/ai-errors.ts` y lo tienen las tres.
 */
export type VersionsErrorCode = AiErrorCode;

export type VersionsError = AiError;

export const ERROR_MESSAGES: Readonly<Record<AiErrorCode, string>> = {
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
  return aiError(code, ERROR_MESSAGES, message);
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

  const key = parseKey(body['key']);
  if (key === null) {
    return null;
  }
  const { tonic, mode } = key;

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

  // Sin clase no hay petición: es lo que decide qué esquema se le manda.
  const kind = body['kind'];
  if (kind !== 'continuar' && kind !== 'retocar') {
    return null;
  }

  const request: {
    key: { tonic: NoteName; mode: KeyMode };
    progression: VersionStep[];
    kind: PathKind;
  } = { key: { tonic, mode }, progression, kind };

  return request;
}

interface SeccionCruda {
  readonly name: string;
  readonly yours: boolean;
  readonly steps: readonly unknown[];
}

/**
 * Las partes que trae una salida.
 *
 * Siempre `sections`, también cuando es una sola: estuvo aceptando `steps` para
 * las que retocan y `sections` para las que continúan, y el modelo elegía la que
 * no tocaba —se descartaban todas—.
 *
 * **Y nunca trae la yours.** Cuando se continúa, lo que vuelve son solo las partes
 * añadidas; tus compases los pone el contrato, porque ya los tiene. Pedírselos
 * era la causa de que se cayera todo: «tu parte no es la que tocaste», 3 de 3.
 */
function leerSecciones(raw: Record<string, unknown>): SeccionCruda[] | null {
  const sections = raw['sections'];
  if (!Array.isArray(sections)) {
    return null;
  }

  const salida: SeccionCruda[] = [];
  for (const seccion of sections) {
    if (!isRecord(seccion)) {
      return null;
    }
    const name = seccion['name'];
    const steps = seccion['steps'];
    if (typeof name !== 'string' || !Array.isArray(steps)) {
      return null;
    }
    salida.push({ name, yours: false, steps });
  }
  return salida;
}

/**
 * Valida lo que devuelve el modelo contra el dominio.
 *
 * **La declaración subió del compás al camino**, y esa es toda la diferencia con
 * lo que había. Antes cada compás cambiado declaraba su movimiento y `isMove` lo
 * volvía a aplicar; eso funcionaba porque una versión era la misma canción con
 * otros acordes. Ahora una salida puede alargar, acortar o repartir de otra
 * manera, así que lo que se declara es **cuál de las cinco salidas ha tomado**, y
 * `isValidPath` lo comprueba contra el dominio: que un `seguir` mantenga de
 * verdad tus compases y cierre, que un `estirar` no toque un solo acorde, que un
 * `contraste` sepa volver al principio.
 *
 * Debajo, la comprobación nueva: **cada salto que no estaba en tu canción tiene
 * que existir en `nextDegrees`**, el grafo armónico que ya estaba escrito. Y la
 * vieja sigue viva donde tiene sentido: una salida `rearmonizar` declara su
 * movimiento compás a compás, exactamente como antes.
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
    if (typeof title !== 'string' || title === '' || typeof why !== 'string' || why === '') {
      continue;
    }

    // Una salida que no dice cuál es no se puede comprobar, así que no vale.
    const path = pathById(raw['path']);
    // Y de la clase que se pidió: una salida que retoca cuando se pedía continuar
    // no es lo que se ha pedido, aunque en sí misma sea válida.
    if (path === null || kindOfPath(path.id) !== request.kind) {
      continue;
    }

    // Siempre por partes, aunque sea una sola: dos formas distintas eran dos
    // sitios donde el modelo podía equivocarse, y se equivocaba en todos.
    const crudas = leerSecciones(raw);
    if (crudas === null) {
      continue;
    }

    const propuesta: ProposedSection[] = [];
    let rota = false;
    for (const cruda of crudas) {
      const pasos: ProposedStep[] = [];
      for (const step of cruda.steps) {
        if (!isRecord(step)) {
          rota = true;
          break;
        }
        const degree = step['degree'];
        const beats = step['beats'];
        if (
          typeof degree !== 'string' ||
          !validDegrees.includes(degree) ||
          typeof beats !== 'number'
        ) {
          rota = true;
          break;
        }
        // Se reconstruye tal cual lo dijo: los pulsos no se redondean ni el
        // movimiento se normaliza, porque quien juzga es el dominio y taparle lo
        // que ha dicho es dejar pasar lo que se quería atrapar.
        pasos.push({ degree: degree as DegreeSymbol, beats, move: step['move'] });
      }
      if (rota) {
        break;
      }
      propuesta.push({ name: cruda.name, yours: cruda.yours, steps: pasos });
    }

    // Tu parte, delante y puesta por nosotros. Así no hay forma de que llegue
    // cambiada, y el validador la comprueba igual: la regla sigue escrita.
    const conLaTuya: ProposedSection[] =
      kindOfPath(path.id) === 'continuar'
        ? [{ name: 'Lo que llevas', yours: true, steps: [...original] }, ...propuesta]
        : propuesta;

    if (rota || songProblem(mode, path.id, original, conLaTuya) !== null) {
      continue;
    }

    const planos = conLaTuya.flatMap((seccion) => seccion.steps);
    const symbols = resolveProgression(
      tonic,
      mode,
      planos.map((step) => step.degree),
    ).map((chord) => chord.symbol);

    let cursor = 0;
    const sections: VersionSection[] = conLaTuya.map((seccion) => ({
      name: seccion.name.trim(),
      yours: seccion.yours,
      steps: seccion.steps.map((step) => {
        const index = cursor;
        cursor += 1;
        return {
          degree: step.degree,
          beats: step.beats,
          symbol: symbols[index]!,
          from: original[index]?.degree ?? null,
          // **El movimiento solo significa algo en una rearmonización**, que es la
          // única salida que sustituye acordes; en las otras lo que cambia es la
          // forma. Y el esquema obliga a que el campo venga en todos los compases,
          // así que el modelo lo rellena igualmente: se ha visto un `estirar` —que
          // no toca un solo acorde— declarando «interrumpida» en los cuatro.
          // Pintarlo sería enseñar una explicación falsa de un compás que no ha
          // cambiado. No se descarta la salida por eso: el campo es un artefacto
          // de haberlo hecho obligatorio, y su camino sí se ha comprobado.
          move: path.id === 'rearmonizar' ? (moveById(step.move)?.id ?? null) : null,
        };
      }),
    }));

    versions.push({
      title,
      why,
      path: path.id,
      sections,
      steps: sections.flatMap((seccion) => seccion.steps),
    });
  }

  return versions;
}
