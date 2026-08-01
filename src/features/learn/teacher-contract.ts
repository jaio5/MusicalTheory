/**
 * Contrato del profesor: qué se le pregunta y qué puede contestar.
 *
 * Vale para los dos lados —el servidor valida, el cliente construye— y es
 * TypeScript puro, así que se prueba sin levantar nada.
 *
 * Lo que viaja son símbolos y la pregunta escrita: tonalidad, escala, grados y
 * la frase que se teclea. El audio y el vídeo no salen del equipo, y esto no
 * abre esa puerta porque el micro no aporta nada a esta petición.
 */

import {
  degreesFor,
  NOTE_NAMES,
  resolveProgression,
  SCALE_IDS,
  type DegreeSymbol,
  type KeyMode,
  type NoteName,
  type ScaleId,
} from '@core/music';
import { pitchClassFromName } from '@core/music';
import { MAX_QUESTION_LENGTH } from '@core/billing';

/**
 * Lo más larga que puede ser la pregunta. Se define en `core/billing/cost.ts` porque
 * es una palanca de gasto —son tokens de entrada, y de ahí salen los cupos— y se
 * reexporta aquí para que quien lea el contrato no tenga que saberlo.
 */
export { MAX_QUESTION_LENGTH };

/** Lo más larga que se acepta la respuesta. Se recorta al validarla. */
export const MAX_ANSWER_LENGTH = 900;

export interface TeacherRequest {
  readonly key: { readonly tonic: NoteName; readonly mode: KeyMode };
  readonly question: string;
  readonly scale?: ScaleId;
  /** La lección que se está leyendo, para que responda en ese contexto. */
  readonly topic?: string;
}

export interface TeacherAnswer {
  readonly answer: string;
  /** Un ejemplo tocable, si viene a cuento. */
  readonly example?: {
    readonly degrees: readonly DegreeSymbol[];
    readonly chords: readonly string[];
  };
}

export type TeacherErrorCode =
  | 'invalid_request'
  | 'rate_limited'
  | 'model_unavailable'
  | 'unparseable_response'
  /** Sin cuenta no hay a quién contarle el gasto de la IA. */
  | 'account_required'
  /** El plan no incluye preguntar. La ruta añade con cuál sí. */
  | 'plan_required'
  /** El plan lo incluye, pero hoy ya se gastó el cupo de llamadas al modelo. */
  | 'quota_exhausted';

export interface TeacherError {
  readonly error: { readonly code: TeacherErrorCode; readonly message: string };
}

export const TEACHER_ERROR_MESSAGES: Readonly<Record<TeacherErrorCode, string>> = {
  invalid_request:
    'Falta la tonalidad o la pregunta. Elige una tonalidad, escribe qué quieres saber y vuelve a probar.',
  rate_limited: 'Has preguntado muchas veces seguidas. Espera un momento y vuelve a intentarlo.',
  model_unavailable: 'No hemos podido contactar con el profesor. Vuelve a intentarlo en un minuto.',
  unparseable_response: 'La respuesta no ha venido bien formada. Vuelve a preguntar.',
  // Estos dos los reescribe la ruta con el plan y el número concretos. Lo que
  // queda aquí es lo que se lee si algún día alguien los emite sin detalle.
  account_required:
    'Entra con tu cuenta para preguntarle al profesor. La IA se cuenta por cuenta, no por navegador.',
  plan_required: 'Preguntarle al profesor no entra en tu plan.',
  quota_exhausted:
    'Se te han acabado las preguntas de hoy. Mañana se renuevan, o puedes subir de plan.',
};

export function teacherError(code: TeacherErrorCode, message?: string): TeacherError {
  return { error: { code, message: message ?? TEACHER_ERROR_MESSAGES[code] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valida la petición. Nada se reenvía tal cual: se reconstruye campo a campo, y
 * la pregunta se recorta, porque un texto largo es dinero y no es mejor
 * pregunta.
 */
export function parseTeacherRequest(body: unknown): TeacherRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const key = body['key'];
  if (!isRecord(key)) {
    return null;
  }
  const tonic = key['tonic'];
  const mode = key['mode'];
  if (
    typeof tonic !== 'string' ||
    !(NOTE_NAMES as readonly string[]).includes(tonic) ||
    (mode !== 'major' && mode !== 'minor')
  ) {
    return null;
  }

  const question = body['question'];
  if (typeof question !== 'string' || question.trim() === '') {
    return null;
  }

  const request: {
    key: { tonic: NoteName; mode: KeyMode };
    question: string;
    scale?: ScaleId;
    topic?: string;
  } = {
    key: { tonic: tonic as NoteName, mode },
    question: question.trim().slice(0, MAX_QUESTION_LENGTH),
  };

  const scale = body['scale'];
  if (typeof scale === 'string' && (SCALE_IDS as readonly string[]).includes(scale)) {
    request.scale = scale as ScaleId;
  }

  const topic = body['topic'];
  if (typeof topic === 'string' && topic !== '') {
    request.topic = topic.slice(0, 60);
  }

  return request;
}

/**
 * Valida la respuesta contra el dominio. Los cifrados del ejemplo no se creen:
 * se recalculan desde los grados, que es la única forma de que no aparezca en
 * pantalla un acorde que no existe en esa tonalidad.
 */
export function validateTeacherAnswer(
  payload: unknown,
  request: TeacherRequest,
): TeacherAnswer | null {
  if (!isRecord(payload)) {
    return null;
  }

  const answer = payload['answer'];
  if (typeof answer !== 'string' || answer.trim() === '') {
    return null;
  }

  const result: { answer: string; example?: TeacherAnswer['example'] } = {
    answer: answer.trim().slice(0, MAX_ANSWER_LENGTH),
  };

  const example = payload['example'];
  if (isRecord(example) && Array.isArray(example['degrees'])) {
    const valid = degreesFor(request.key.mode) as readonly string[];
    const degrees = example['degrees'];
    if (
      degrees.length > 0 &&
      degrees.every((degree) => typeof degree === 'string' && valid.includes(degree))
    ) {
      const chords = resolveProgression(
        pitchClassFromName(request.key.tonic),
        request.key.mode,
        degrees as readonly DegreeSymbol[],
      ).map((chord) => chord.symbol);
      result.example = { degrees: degrees as DegreeSymbol[], chords };
    }
  }

  return result;
}
