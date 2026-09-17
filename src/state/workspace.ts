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
 *
 * **Y hay un reparto por espacio de trabajo, no uno solo.** Las tres maneras de
 * escribir no necesitan lo mismo delante: tocando hace falta la rueda y poco
 * más; escribiendo, la canción y a dónde seguir; ensayando, solo la canción. Con
 * un reparto único, cada modo enseñaba las cinco áreas y la pantalla se leía
 * como un panel de control. Es la idea de los espacios de trabajo de siempre:
 * **vienen repartidos de fábrica** para quien no quiere montarse nada, y quien
 * quiera los mueve y se le recuerdan.
 */
export type EspacioDeTrabajo = 'tocando' | 'escribir' | 'ensayar';

/** Las áreas que se pueden plegar a su tira. La de abajo se cierra, no se pliega. */
export type AreaPlegable = 'izquierda' | 'derecha' | 'camino';

export interface RepartoDeAreas {
  readonly izquierda: number;
  readonly derecha: number;
  readonly alto: number;
  /** Qué editor hay abierto abajo, o nulo si está cerrada. */
  readonly abajo: string | null;
  /** Las que están plegadas a su tira de icono. */
  readonly plegadas: readonly AreaPlegable[];
}

export interface BancoLayout {
  readonly espacio: EspacioDeTrabajo;
  readonly repartos: Readonly<Record<EspacioDeTrabajo, RepartoDeAreas>>;
}

/** Las medidas, que son las mismas en los tres espacios. */
const MEDIDAS = { izquierda: 20, derecha: 23, alto: 16 } as const;

/**
 * Los tres repartos de fábrica, y por qué cada uno enseña lo que enseña.
 *
 * El área de abajo empieza **cerrada** en los tres: en un portátil de 768 de
 * alto son doscientos y pico píxeles que no ha pedido nadie, y abrirla cuesta un
 * clic. Lo que no cuesta un clic es entender por qué la canción se ve a la mitad
 * la primera vez que entras.
 */
export const REPARTOS_DE_FABRICA: Readonly<Record<EspacioDeTrabajo, RepartoDeAreas>> = {
  // Tocando solo hace falta saber en qué tonalidad estás y darle al botón. El
  // acorde y a dónde ir son para cuando ya hay algo escrito.
  tocando: { ...MEDIDAS, abajo: null, plegadas: ['derecha', 'camino'] },
  // Escribiendo manda la canción, y al lado lo que se mira mientras se escribe:
  // el acorde y a dónde seguir. La rueda ya cumplió: el tono se elige una vez.
  escribir: { ...MEDIDAS, abajo: null, plegadas: ['izquierda'] },
  // Ensayando no se decide nada: se toca lo que hay. Todo lo demás estorba.
  ensayar: { ...MEDIDAS, abajo: null, plegadas: ['izquierda', 'derecha', 'camino'] },
};

export const DEFAULT_BANCO: BancoLayout = {
  // Se entra por tocar: es por donde se empieza una canción, y es la manera que
  // este proyecto tenía construida y escondida detrás de dos pasos.
  espacio: 'tocando',
  repartos: REPARTOS_DE_FABRICA,
};

/** Lo que puede medir cada área, en rem. Fuera de esto no se guarda. */
export const TOPES_DEL_BANCO = {
  izquierda: { min: 13, max: 34 },
  derecha: { min: 15, max: 38 },
  alto: { min: 9, max: 32 },
} as const;

export interface WorkspacePreferences {
  readonly styleId: StyleId;
  readonly scaleId: ScaleId;
  readonly tuningId: TuningId;
  readonly pinnedKey: PinnedKey | null;
  readonly banco: BancoLayout;
}

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
  const guardados = record['repartos'];
  const repartos =
    typeof guardados === 'object' && guardados !== null && !Array.isArray(guardados)
      ? (guardados as Record<string, unknown>)
      : {};

  return {
    espacio: esEspacio(espacio) ? espacio : DEFAULT_BANCO.espacio,
    repartos: {
      tocando: parseReparto(repartos['tocando'], REPARTOS_DE_FABRICA.tocando),
      escribir: parseReparto(repartos['escribir'], REPARTOS_DE_FABRICA.escribir),
      ensayar: parseReparto(repartos['ensayar'], REPARTOS_DE_FABRICA.ensayar),
    },
  };
}

function esEspacio(raw: unknown): raw is EspacioDeTrabajo {
  return raw === 'tocando' || raw === 'escribir' || raw === 'ensayar';
}

const PLEGABLES: readonly AreaPlegable[] = ['izquierda', 'derecha', 'camino'];

/**
 * Un reparto guardado, medida a medida.
 *
 * Cada una se comprueba y se acota por separado en vez de descartar el objeto
 * entero: si un día se añade un área más, lo guardado por la versión anterior
 * **sigue valiendo para las que ya había**. Descartarlo entero convertiría cada
 * campo nuevo en un reparto perdido para todo el mundo.
 *
 * Y se acota al leer, no solo al escribir: un ancho de nueve mil deja un área
 * que tapa la pantalla y ningún divisor a mano para arreglarlo.
 */
function parseReparto(raw: unknown, porDefecto: RepartoDeAreas): RepartoDeAreas {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return porDefecto;
  }
  const record = raw as Record<string, unknown>;
  const abajo = record['abajo'];
  const plegadas = record['plegadas'];

  return {
    izquierda: medida(record['izquierda'], TOPES_DEL_BANCO.izquierda, porDefecto.izquierda),
    derecha: medida(record['derecha'], TOPES_DEL_BANCO.derecha, porDefecto.derecha),
    alto: medida(record['alto'], TOPES_DEL_BANCO.alto, porDefecto.alto),
    abajo: typeof abajo === 'string' && abajo !== '' ? abajo : null,
    // Lo que no se reconozca se cae, y lo que se repita cuenta una vez: un área
    // plegada dos veces no es nada, pero un nombre inventado dejaría una tira
    // sin nada que desplegar.
    plegadas: Array.isArray(plegadas)
      ? PLEGABLES.filter((area) => plegadas.includes(area))
      : porDefecto.plegadas,
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
