/**
 * Los ajustes que se recuerdan de una vez para otra.
 *
 * En qué pantalla estás no está aquí: eso lo dice la dirección, que es la que
 * manda desde que cada pantalla tiene su página. Aquí solo vive lo que eliges
 * —tonalidad, estilo, escala, afinación— y que quieres encontrarte igual al
 * volver.
 *
 * **La tonalidad llegó tarde y era la que más falta hacía.** Se recordaban el
 * estilo y la escala, y no el tono: es decir, la aplicación se acordaba de que
 * te gusta el rock y se olvidaba de en qué estabas tocando. Y no es un ajuste
 * más: sin tonalidad no hay acordes, ni escala que enseñar, ni preguntas que
 * generar, así que **las cinco pantallas empezaban pidiendo lo mismo** cada vez
 * que se recargaba. Elegirla es la primera decisión que se toma aquí, y volver
 * a pedirla mañana es no haber escuchado la primera vez.
 */

import type { KeyMode, PitchClass, ScaleId, StyleId } from '@core/music';
import type { TuningId } from '@core/instrument';

/** La tonalidad fijada a mano. Nula significa «sigue a la detección». */
export interface PinnedKey {
  readonly tonic: PitchClass;
  readonly mode: KeyMode;
}

/**
 * Cómo está repartido el banco de trabajo de componer.
 *
 * Es preferencia y no sesión: quien se ha montado su sitio no quiere volver a
 * montárselo mañana ([adr/0031](../../docs/adr/0031-componer-es-un-banco-de-trabajo.md)).
 * Los anchos van en **rem y no en píxeles** porque lo que hay dentro se mide en
 * rem: guardando píxeles, quien sube el tamaño de letra del navegador se
 * encuentra las columnas donde estaban y el contenido sin caber.
 */
export interface BancoLayout {
  readonly espacio: 'escribir' | 'ensayar';
  readonly izquierda: number;
  readonly derecha: number;
  /** Qué editor hay abierto abajo, o nulo si está cerrada. */
  readonly abajo: string | null;
  readonly alto: number;
}

export interface WorkspacePreferences {
  readonly styleId: StyleId;
  readonly scaleId: ScaleId;
  readonly tuningId: TuningId;
  readonly pinnedKey: PinnedKey | null;
  readonly banco: BancoLayout;
}

/**
 * El reparto de fábrica.
 *
 * El área de abajo empieza **cerrada** y no con el mástil puesto: en un portátil
 * de 768 de alto son doscientos y pico píxeles que no ha pedido nadie, y abrirla
 * cuesta un clic. Lo que no cuesta un clic es entender por qué la canción se ve
 * a la mitad la primera vez que entras.
 */
export const DEFAULT_BANCO: BancoLayout = {
  espacio: 'escribir',
  izquierda: 20,
  derecha: 23,
  abajo: null,
  alto: 16,
};

/** Lo que puede medir cada área, en rem. Fuera de esto no se guarda. */
export const TOPES_DEL_BANCO = {
  izquierda: { min: 13, max: 34 },
  derecha: { min: 15, max: 38 },
  alto: { min: 9, max: 32 },
} as const;

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  styleId: 'rock',
  scaleId: 'minorPentatonic',
  tuningId: 'standard',
  pinnedKey: null,
  banco: DEFAULT_BANCO,
};

const STORAGE_KEY = 'caos-ordenado:workspace';

/**
 * Interpreta lo guardado. Lo que no reconoce se descarta —una pantalla que ya
 * no existe, basura de otra cosa en la misma clave— y se queda con lo de
 * fábrica, que siempre es algo que funciona.
 */
export function parsePreferences(raw: unknown): WorkspacePreferences {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_PREFERENCES;
  }
  const record = raw as Record<string, unknown>;

  const styleId = record['styleId'];
  const scaleId = record['scaleId'];
  const tuningId = record['tuningId'];

  return {
    styleId: typeof styleId === 'string' ? (styleId as StyleId) : DEFAULT_PREFERENCES.styleId,
    scaleId: typeof scaleId === 'string' ? (scaleId as ScaleId) : DEFAULT_PREFERENCES.scaleId,
    tuningId: typeof tuningId === 'string' ? (tuningId as TuningId) : DEFAULT_PREFERENCES.tuningId,
    pinnedKey: parsePinnedKey(record['pinnedKey']),
    banco: parseBanco(record['banco']),
  };
}

/**
 * El reparto guardado, medida a medida.
 *
 * Cada una se comprueba y se acota por separado en vez de descartar el objeto
 * entero: si un día se añade un área más, lo guardado por la versión anterior
 * **sigue valiendo para las que ya había**. Descartarlo entero convertiría cada
 * campo nuevo en un reparto perdido para todo el mundo.
 *
 * Y se acota al leer, no solo al escribir: un ancho de nueve mil deja un área
 * que tapa la pantalla y ningún divisor a mano para arreglarlo.
 */
function parseBanco(raw: unknown): BancoLayout {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_BANCO;
  }
  const record = raw as Record<string, unknown>;
  const espacio = record['espacio'];
  const abajo = record['abajo'];

  return {
    espacio: espacio === 'ensayar' ? 'ensayar' : DEFAULT_BANCO.espacio,
    izquierda: medida(record['izquierda'], TOPES_DEL_BANCO.izquierda, DEFAULT_BANCO.izquierda),
    derecha: medida(record['derecha'], TOPES_DEL_BANCO.derecha, DEFAULT_BANCO.derecha),
    abajo: typeof abajo === 'string' && abajo !== '' ? abajo : null,
    alto: medida(record['alto'], TOPES_DEL_BANCO.alto, DEFAULT_BANCO.alto),
  };
}

function medida(
  raw: unknown,
  topes: { readonly min: number; readonly max: number },
  porDefecto: number,
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return porDefecto;
  }
  return Math.min(topes.max, Math.max(topes.min, Math.round(raw * 10) / 10));
}

/**
 * La tonalidad guardada, si vale.
 *
 * Se comprueba de verdad y no se confía en el tipo, a diferencia del estilo o la
 * escala: esos son cadenas que, si están mal, dejan un desplegable sin
 * seleccionar y poco más. Una tónica fuera de 0-11 se cuela en `scaleNotes`, en
 * la rueda y en el generador de preguntas, y de ahí sale una pantalla rota con
 * un `NaN` en medio. Cualquier cosa que no cuadre se descarta y se vuelve a
 * seguir la detección, que es lo que hace la aplicación recién abierta.
 */
function parsePinnedKey(raw: unknown): PinnedKey | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const tonic = record['tonic'];
  const mode = record['mode'];

  if (typeof tonic !== 'number' || !Number.isInteger(tonic) || tonic < 0 || tonic > 11) {
    return null;
  }
  if (mode !== 'major' && mode !== 'minor') {
    return null;
  }

  return { tonic: tonic as PitchClass, mode };
}

/**
 * Lee y escribe en localStorage, sin reventar donde no lo hay —el servidor, o
 * un navegador en modo privado con el almacenamiento bloqueado—.
 */
export function loadPreferences(): WorkspacePreferences {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_PREFERENCES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_PREFERENCES : parsePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: WorkspacePreferences): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Modo privado o cuota llena: se pierde la preferencia, no la sesión.
  }
}
