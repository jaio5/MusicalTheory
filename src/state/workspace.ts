/**
 * Los ajustes que se recuerdan de una vez para otra.
 *
 * En qué pantalla estás no está aquí: eso lo dice la dirección, que es la que
 * manda desde que cada pantalla tiene su página. Aquí solo vive lo que eliges
 * —estilo, escala, afinación— y que quieres encontrarte igual al volver.
 */

import type { ScaleId, StyleId } from '@core/music';
import type { TuningId } from '@core/instrument';

export interface WorkspacePreferences {
  readonly styleId: StyleId;
  readonly scaleId: ScaleId;
  readonly tuningId: TuningId;
}

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
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

  const styleId = record['styleId'];
  const scaleId = record['scaleId'];
  const tuningId = record['tuningId'];

  return {
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
