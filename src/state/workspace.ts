/**
 * Qué se ve en pantalla y con qué ajustes.
 *
 * Va aparte del estado de sesión porque no es lo que está pasando ahora, sino
 * cómo tiene montado cada uno su banco de trabajo. Se guarda en el equipo para
 * que al volver esté como lo dejaste.
 */

import type { StyleId } from '@core/music';

export type PanelId =
  | 'tuner'
  | 'key'
  | 'fretboard'
  | 'suggest'
  | 'learn'
  | 'compose'
  | 'ideas'
  | 'recorder'
  | 'sessions';

export interface PanelDefinition {
  readonly id: PanelId;
  readonly name: string;
  /** Qué hace, en una frase corta para el menú. */
  readonly summary: string;
  /** Si ocupa dos columnas en la rejilla. */
  readonly wide?: boolean;
}

export const PANELS: readonly PanelDefinition[] = [
  { id: 'tuner', name: 'Afinador', summary: 'Nota, desviación y nivel de entrada.' },
  { id: 'key', name: 'Tonalidad', summary: 'Rueda de quintas y candidatas.' },
  { id: 'suggest', name: 'Sugerencias', summary: 'Acordes que pegan con lo que tocas.' },
  { id: 'fretboard', name: 'Mástil', summary: 'La escala sobre quince trastes.', wide: true },
  { id: 'compose', name: 'Componer', summary: 'Acordes de la tonalidad y a dónde ir.' },
  { id: 'learn', name: 'Aprender', summary: 'La escala nota a nota, validada al tocarla.' },
  { id: 'ideas', name: 'Ideas', summary: 'Preguntar a un modelo.' },
  { id: 'recorder', name: 'Grabar', summary: 'Vídeo con los datos quemados.' },
  { id: 'sessions', name: 'Sesiones', summary: 'Guardar y retomar.' },
];

/** Lo que se ve al abrir por primera vez: afinador, tonalidad y sugerencias. */
export const DEFAULT_VISIBLE: readonly PanelId[] = ['tuner', 'key', 'suggest', 'fretboard'];

export interface WorkspacePreferences {
  readonly visible: readonly PanelId[];
  readonly styleId: StyleId;
}

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  visible: DEFAULT_VISIBLE,
  styleId: 'rock',
};

const STORAGE_KEY = 'caos-ordenado:workspace';
const PANEL_IDS = new Set<string>(PANELS.map((panel) => panel.id));

/**
 * Interpreta lo guardado. Todo lo que no reconozca se descarta: un panel que ya
 * no existe, o basura que haya escrito otra cosa en la misma clave.
 */
export function parsePreferences(raw: unknown): WorkspacePreferences {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_PREFERENCES;
  }
  const record = raw as Record<string, unknown>;

  const visible = Array.isArray(record['visible'])
    ? record['visible'].filter((id): id is PanelId => typeof id === 'string' && PANEL_IDS.has(id))
    : [];

  const styleId = record['styleId'];

  return {
    visible: visible.length > 0 ? visible : DEFAULT_VISIBLE,
    styleId: typeof styleId === 'string' ? (styleId as StyleId) : DEFAULT_PREFERENCES.styleId,
  };
}

/** Enciende o apaga un panel, respetando el orden del catálogo. */
export function togglePanel(visible: readonly PanelId[], id: PanelId): PanelId[] {
  const next = new Set(visible);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return PANELS.filter((panel) => next.has(panel.id)).map((panel) => panel.id);
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
