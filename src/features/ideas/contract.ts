/**
 * Contrato del route handler de ideas: qué entra, qué sale y cómo se valida.
 *
 * Vive aquí y no dentro de `app/` porque lo usan los dos lados: el servidor
 * para validar, y el cliente para construir la petición y entender la
 * respuesta. Es TypeScript puro y se prueba sin levantar nada.
 *
 * El razonamiento del contrato está en docs/AI.md.
 */

import {
  degreesFor,
  NOTE_NAMES,
  resolveProgression,
  SCALE_IDS,
  type DegreeSymbol,
  type KeyMode,
  type NoteName,
  type PitchClass,
  type ScaleId,
} from '@core/music';
import { pitchClassFromName } from '@core/music';

export const IDEA_KINDS = ['progression', 'twist', 'scale'] as const;
export type IdeaKind = (typeof IDEA_KINDS)[number];

export const MAX_RECENT_NOTES = 32;
export const MAX_RECENT_CHORDS = 16;
export const MAX_IDEAS = 4;

export interface IdeasRequest {
  readonly kind: IdeaKind;
  readonly key: { readonly tonic: NoteName; readonly mode: KeyMode };
  readonly scale?: ScaleId;
  readonly currentDegree?: DegreeSymbol;
  readonly recentNotes?: readonly NoteName[];
  readonly recentChords?: readonly string[];
}

export interface Idea {
  readonly title: string;
  readonly why: string;
  readonly degrees?: readonly DegreeSymbol[];
  readonly chords?: readonly string[];
  readonly scale?: ScaleId;
}

export interface IdeasResponse {
  readonly ideas: readonly Idea[];
}

export type IdeasErrorCode =
  | 'invalid_request'
  | 'rate_limited'
  | 'model_unavailable'
  | 'unparseable_response';

export interface IdeasError {
  readonly error: { readonly code: IdeasErrorCode; readonly message: string };
}

/** Mensajes en español: qué ha pasado y qué hacer. */
export const ERROR_MESSAGES: Readonly<Record<IdeasErrorCode, string>> = {
  invalid_request:
    'Falta la tonalidad. Toca unos compases para que podamos detectarla y vuelve a pedirlo.',
  rate_limited: 'Has pedido muchas ideas seguidas. Espera un momento y vuelve a intentarlo.',
  model_unavailable: 'No hemos podido contactar con el modelo. Vuelve a intentarlo en un minuto.',
  unparseable_response: 'La respuesta no ha venido bien formada. Vuelve a pedirlo.',
};

export function ideasError(code: IdeasErrorCode, message?: string): IdeasError {
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

/**
 * Valida el cuerpo de la petición. No se reenvía nada tal cual al modelo: se
 * reconstruye a partir de los campos que pasan, y todo lo demás se ignora.
 */
export function parseIdeasRequest(body: unknown): IdeasRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const kind = body['kind'];
  if (typeof kind !== 'string' || !(IDEA_KINDS as readonly string[]).includes(kind)) {
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

  const request: {
    kind: IdeaKind;
    key: { tonic: NoteName; mode: KeyMode };
    scale?: ScaleId;
    currentDegree?: DegreeSymbol;
    recentNotes?: NoteName[];
    recentChords?: string[];
  } = { kind: kind as IdeaKind, key: { tonic, mode } };

  const scale = body['scale'];
  if (typeof scale === 'string' && (SCALE_IDS as readonly string[]).includes(scale)) {
    request.scale = scale as ScaleId;
  }

  const degree = body['currentDegree'];
  const validDegrees = degreesFor(mode) as readonly string[];
  if (typeof degree === 'string' && validDegrees.includes(degree)) {
    request.currentDegree = degree as DegreeSymbol;
  }

  const notes = body['recentNotes'];
  if (Array.isArray(notes)) {
    const clean = notes
      .map(asNoteName)
      .filter((note): note is NoteName => note !== null)
      .slice(-MAX_RECENT_NOTES);
    if (clean.length > 0) {
      request.recentNotes = clean;
    }
  }

  const chords = body['recentChords'];
  if (Array.isArray(chords)) {
    const clean = chords
      .filter((chord): chord is string => typeof chord === 'string' && chord.length <= 8)
      .slice(-MAX_RECENT_CHORDS);
    if (clean.length > 0) {
      request.recentChords = clean;
    }
  }

  return request;
}

/**
 * Valida lo que devuelve el modelo contra el dominio: que los grados existan en
 * ese modo y que los cifrados sean los que de verdad salen de esa tonalidad.
 * Una idea que no cuadre se descarta; si no queda ninguna, la respuesta entera
 * se considera mala.
 */
export function validateIdeas(payload: unknown, request: IdeasRequest): Idea[] {
  if (!isRecord(payload) || !Array.isArray(payload['ideas'])) {
    return [];
  }

  const tonic: PitchClass = pitchClassFromName(request.key.tonic);
  const validDegrees = degreesFor(request.key.mode) as readonly string[];

  const ideas: Idea[] = [];
  for (const raw of payload['ideas'].slice(0, MAX_IDEAS)) {
    if (!isRecord(raw)) {
      continue;
    }
    const title = raw['title'];
    const why = raw['why'];
    if (typeof title !== 'string' || typeof why !== 'string' || title === '' || why === '') {
      continue;
    }

    if (request.kind === 'scale') {
      const scale = raw['scale'];
      if (typeof scale !== 'string' || !(SCALE_IDS as readonly string[]).includes(scale)) {
        continue;
      }
      ideas.push({ title, why, scale: scale as ScaleId });
      continue;
    }

    const degrees = raw['degrees'];
    if (!Array.isArray(degrees) || degrees.length === 0) {
      continue;
    }
    if (!degrees.every((degree) => typeof degree === 'string' && validDegrees.includes(degree))) {
      continue;
    }

    // Los cifrados no se creen: se recalculan desde los grados, que es la
    // única forma de que no aparezca un acorde imposible en pantalla.
    const chords = resolveProgression(
      tonic,
      request.key.mode,
      degrees as readonly DegreeSymbol[],
    ).map((chord) => chord.symbol);

    ideas.push({ title, why, degrees: degrees as DegreeSymbol[], chords });
  }

  return ideas;
}
