/**
 * Contrato del profesor: qué se le pregunta y qué puede contestar.
 *
 * Vale para los dos lados —el servidor valida, el cliente construye— y es
 * TypeScript puro, así que se prueba sin levantar nada.
 *
 * Lo que viaja son símbolos y la pregunta escrita: tonalidad, escala, grados y
 * la frase que se teclea. El audio no sale del equipo, y esto no
 * abre esa puerta porque el micro no aporta nada a esta petición.
 */

import {
  degreesFor,
  parseKey,
  findUnit,
  resolveProgression,
  SCALE_IDS,
  type DegreeSymbol,
  type KeyMode,
  type NoteName,
  type ScaleId,
} from '@core/music';
import { aiError, type AiError, type AiErrorCode } from '@core/ai-errors';
import { isRecord } from '@core/parse';
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

/**
 * La marca que encierra la pregunta dentro del prompt.
 *
 * La pregunta es el **único** texto libre que queda entrando al modelo en toda la
 * aplicación, así que va delimitada y el prompt de sistema dice que lo de dentro
 * es un dato y no una instrucción. No es una defensa perfecta —ninguna lo es
 * contra una inyección decidida— pero convierte el caso habitual, el «ignora lo
 * anterior», en una frase más dentro de un bloque marcado.
 *
 * Y por eso `parseTeacherRequest` la borra de la pregunta: sin eso, quien la
 * escribiera cerraría el bloque antes de tiempo y lo de después se leería como
 * instrucciones nuestras, que es exactamente lo que se está evitando.
 */
export const MARCA_PREGUNTA = '###PREGUNTA###';

/**
 * Lo que contesta el profesor cuando lo que le preguntan no es de música.
 *
 * **La escribimos nosotros, no el modelo.** Cuando el modelo declara que la
 * pregunta se sale del tema, lo que haya escrito se tira entero y se pinta esto:
 * así, una inyección que consiga colarse tampoco consigue que la aplicación
 * enseñe su texto. Es la misma regla que los cifrados y los movimientos —no se
 * cree lo que dice, se sustituye por lo que sabemos—, llevada a la prosa.
 */
export const FUERA_DE_TEMA =
  'Aquí solo sé de música. Pregúntame por la tonalidad, los acordes o qué escala tocar.';

export interface TeacherRequest {
  readonly key: { readonly tonic: NoteName; readonly mode: KeyMode };
  readonly question: string;
  readonly scale?: ScaleId;
  /**
   * La unidad que se está leyendo, **por su identificador**.
   *
   * Antes viajaba el título, escrito por el cliente, y eso eran sesenta
   * caracteres de texto libre entrando al prompt sin que nadie los mirara: la
   * mitad de la superficie de inyección de toda la aplicación, en un campo que
   * no hacía ninguna falta. El título ya está en `core/music/curriculum.ts`, así
   * que el servidor lo resuelve él y el cliente manda el id y nada más.
   */
  readonly unitId?: string;
}

export interface TeacherAnswer {
  readonly answer: string;
  /** Un ejemplo tocable, si viene a cuento. */
  readonly example?: {
    readonly degrees: readonly DegreeSymbol[];
    readonly chords: readonly string[];
  };
}

/**
 * Los siete códigos, compartidos con las otras dos rutas de IA.
 *
 * Alias y no una copia: estaban declarados tres veces idénticos, y el día que
 * haga falta uno nuevo se añade en `core/ai-errors.ts` y lo tienen las tres.
 */
export type TeacherErrorCode = AiErrorCode;

export type TeacherError = AiError;

export const TEACHER_ERROR_MESSAGES: Readonly<Record<AiErrorCode, string>> = {
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
  return aiError(code, TEACHER_ERROR_MESSAGES, message);
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

  const key = parseKey(body['key']);
  if (key === null) {
    return null;
  }
  const { tonic, mode } = key;

  const question = body['question'];
  if (typeof question !== 'string' || question.trim() === '') {
    return null;
  }
  // Fuera la marca antes de nada: es lo que impide cerrar el bloque a mano y
  // escribir instrucciones fuera de él.
  const limpia = question.split(MARCA_PREGUNTA).join(' ').trim();
  if (limpia === '') {
    return null;
  }

  const request: {
    key: { tonic: NoteName; mode: KeyMode };
    question: string;
    scale?: ScaleId;
    unitId?: string;
  } = {
    key: { tonic: tonic as NoteName, mode },
    question: limpia.slice(0, MAX_QUESTION_LENGTH),
  };

  const scale = body['scale'];
  if (typeof scale === 'string' && (SCALE_IDS as readonly string[]).includes(scale)) {
    request.scale = scale as ScaleId;
  }

  // Un id que no esté en el temario se descarta en silencio, como los grados que
  // no existen: no es un error del que pregunta, es un cliente desactualizado.
  const unitId = body['unitId'];
  if (typeof unitId === 'string' && findUnit(unitId) !== null) {
    request.unitId = unitId;
  }

  return request;
}

/**
 * El título de la unidad que se está leyendo, si es que hay una.
 *
 * Sale del temario y no de lo que mande el cliente, que es toda la gracia. Vive
 * en el contrato porque es la traducción del campo que el contrato define, y así
 * la ruta no tiene que saber que detrás hay un temario.
 */
export function topicOf(request: TeacherRequest): string | undefined {
  return request.unitId === undefined ? undefined : findUnit(request.unitId)?.unit.title;
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

  // Lo primero, antes de mirar nada más: ¿ha dicho el modelo que esto es de
  // música? El esquema lo declara obligatorio y enumerado, así que si falta o
  // trae otra cosa es que quien ha contestado no es el que creemos.
  const tema = payload['tema'];
  if (tema !== 'musica' && tema !== 'fuera') {
    return null;
  }
  if (tema === 'fuera') {
    // Ni su texto ni su ejemplo. Lo que sale es nuestra frase.
    return { answer: FUERA_DE_TEMA };
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
