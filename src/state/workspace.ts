/**
 * En qué pantalla estás y con qué ajustes.
 *
 * Son tres pantallas hechas para tres cosas distintas, no un banco de trabajo
 * que se monta a mano: quien viene a afinar no quiere decidir dónde va nada.
 * Lo que se elige —tonalidad, estilo, escala, afinación— se guarda en el equipo
 * para que al volver esté como lo dejaste.
 */

import type { ScaleId, StyleId } from '@core/music';
import type { TuningId } from '@core/instrument';

export type ScreenId = 'learn' | 'compose' | 'tune';

export interface ScreenDefinition {
  readonly id: ScreenId;
  readonly name: string;
  /** Para qué es, en una frase. */
  readonly summary: string;
}

export const SCREENS: readonly ScreenDefinition[] = [
  { id: 'learn', name: 'Aprender', summary: 'Teoría a base de preguntas, y un profesor al lado.' },
  {
    id: 'compose',
    name: 'Componer',
    summary: 'Tonalidad, progresión, acordes y grabarte tocando.',
  },
  { id: 'tune', name: 'Afinar', summary: 'La afinación que elijas, cuerda a cuerda.' },
];

const SCREEN_IDS = new Set<string>(SCREENS.map((screen) => screen.id));

export interface WorkspacePreferences {
  readonly screen: ScreenId;
  readonly styleId: StyleId;
  readonly scaleId: ScaleId;
  readonly tuningId: TuningId;
}

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  screen: 'compose',
  styleId: 'rock',
  scaleId: 'minorPentatonic',
  tuningId: 'standard',
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

  const screen = record['screen'];
  const styleId = record['styleId'];
  const scaleId = record['scaleId'];
  const tuningId = record['tuningId'];

  return {
    screen:
      typeof screen === 'string' && SCREEN_IDS.has(screen)
        ? (screen as ScreenId)
        : DEFAULT_PREFERENCES.screen,
    styleId: typeof styleId === 'string' ? (styleId as StyleId) : DEFAULT_PREFERENCES.styleId,
    scaleId: typeof scaleId === 'string' ? (scaleId as ScaleId) : DEFAULT_PREFERENCES.scaleId,
    tuningId: typeof tuningId === 'string' ? (tuningId as TuningId) : DEFAULT_PREFERENCES.tuningId,
  };
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
