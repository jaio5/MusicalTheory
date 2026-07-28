/**
 * Cómo tiene montada la pantalla cada uno.
 *
 * El modelo es el de un editor de código o el de Unity: hay cuatro zonas y cada
 * panel vive en una de ellas, apilado en pestañas con los que compartan sitio.
 * Se mueven de zona, se cierran y se abren, y el tamaño de las zonas se ajusta
 * a mano. Todo se guarda en el equipo para que al volver esté como lo dejaste.
 *
 * Va aparte del estado de sesión porque no es lo que está pasando ahora, sino
 * cómo está puesta la mesa.
 */

import type { ScaleId, StyleId } from '@core/music';

export type ZoneId = 'left' | 'center' | 'right' | 'bottom';

export const ZONES: readonly ZoneId[] = ['left', 'center', 'right', 'bottom'];

export const ZONE_NAMES: Readonly<Record<ZoneId, string>> = {
  left: 'Izquierda',
  center: 'Centro',
  right: 'Derecha',
  bottom: 'Abajo',
};

export type PanelId =
  | 'chord'
  | 'next'
  | 'key'
  | 'tuner'
  | 'fretboard'
  | 'suggest'
  | 'compose'
  | 'learn'
  | 'ideas'
  | 'recorder'
  | 'sessions';

export interface PanelDefinition {
  readonly id: PanelId;
  readonly name: string;
  /** Qué hace, en una frase corta para el menú de abrir. */
  readonly summary: string;
}

export const PANELS: readonly PanelDefinition[] = [
  { id: 'chord', name: 'Acorde', summary: 'El acorde en el que estás y cómo se hace.' },
  { id: 'next', name: 'Siguientes', summary: 'A dónde puedes ir, y buscar acordes.' },
  { id: 'key', name: 'Rueda', summary: 'La rueda de quintas, el estilo y la escala.' },
  { id: 'fretboard', name: 'Mástil', summary: 'La escala sobre quince trastes.' },
  { id: 'tuner', name: 'Afinador', summary: 'Nota, desviación y nivel de entrada.' },
  { id: 'suggest', name: 'Sugerencias', summary: 'Acordes que pegan con lo que tocas.' },
  { id: 'compose', name: 'Componer', summary: 'Acordes de la tonalidad y a dónde ir.' },
  { id: 'learn', name: 'Aprender', summary: 'La escala nota a nota, validada al tocarla.' },
  { id: 'ideas', name: 'Ideas', summary: 'Preguntar a un modelo.' },
  { id: 'recorder', name: 'Grabar', summary: 'Vídeo con los datos quemados.' },
  { id: 'sessions', name: 'Sesiones', summary: 'Guardar y retomar.' },
];

const PANEL_IDS = new Set<string>(PANELS.map((panel) => panel.id));

export interface ZoneLayout {
  readonly panels: readonly PanelId[];
  /** La pestaña que se ve. Null solo cuando la zona está vacía. */
  readonly active: PanelId | null;
  /** Ancho de las laterales y alto de la de abajo, en píxeles. */
  readonly size: number;
}

export type Layout = Readonly<Record<ZoneId, ZoneLayout>>;

/** Por debajo la zona no enseña nada útil; por encima se come la pantalla. */
export const MIN_ZONE_SIZE = 140;
export const MAX_ZONE_SIZE = 720;

/**
 * Lo que hay al abrir por primera vez: el acorde a la izquierda, los siguientes
 * en el centro, la rueda a la derecha y el mástil abajo. El resto se abre desde
 * el menú cuando hace falta.
 */
export const DEFAULT_LAYOUT: Layout = {
  left: { panels: ['chord'], active: 'chord', size: 232 },
  center: { panels: ['next'], active: 'next', size: 0 },
  right: { panels: ['key'], active: 'key', size: 288 },
  bottom: { panels: ['fretboard'], active: 'fretboard', size: 208 },
};

export interface WorkspacePreferences {
  readonly layout: Layout;
  readonly styleId: StyleId;
  readonly scaleId: ScaleId;
}

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  layout: DEFAULT_LAYOUT,
  styleId: 'rock',
  scaleId: 'minorPentatonic',
};

const STORAGE_KEY = 'caos-ordenado:workspace';

export function zoneOf(layout: Layout, panel: PanelId): ZoneId | null {
  return ZONES.find((zone) => layout[zone].panels.includes(panel)) ?? null;
}

export function isOpen(layout: Layout, panel: PanelId): boolean {
  return zoneOf(layout, panel) !== null;
}

function withZone(layout: Layout, zone: ZoneId, patch: Partial<ZoneLayout>): Layout {
  return { ...layout, [zone]: { ...layout[zone], ...patch } };
}

/**
 * Saca un panel de donde esté. Si era el que se veía, pasa a verse el vecino:
 * una zona en blanco con pestañas dentro sería un estado imposible de entender.
 */
function detach(layout: Layout, panel: PanelId): Layout {
  const zone = zoneOf(layout, panel);
  if (zone === null) {
    return layout;
  }
  const panels = layout[zone].panels.filter((id) => id !== panel);
  const active = layout[zone].active === panel ? (panels[0] ?? null) : layout[zone].active;
  return withZone(layout, zone, { panels, active });
}

/** Mueve un panel a una zona, en la posición que se le diga. */
export function movePanel(layout: Layout, panel: PanelId, to: ZoneId, index?: number): Layout {
  const detached = detach(layout, panel);
  const panels = [...detached[to].panels];
  const at = index === undefined ? panels.length : Math.max(0, Math.min(index, panels.length));
  panels.splice(at, 0, panel);
  return withZone(detached, to, { panels, active: panel });
}

export function activatePanel(layout: Layout, panel: PanelId): Layout {
  const zone = zoneOf(layout, panel);
  return zone === null ? layout : withZone(layout, zone, { active: panel });
}

export function closePanel(layout: Layout, panel: PanelId): Layout {
  return detach(layout, panel);
}

/** Abre un panel cerrado. Si ya estaba abierto, lo trae al frente. */
export function openPanel(layout: Layout, panel: PanelId, zone: ZoneId = 'center'): Layout {
  return isOpen(layout, panel) ? activatePanel(layout, panel) : movePanel(layout, panel, zone);
}

export function resizeZone(layout: Layout, zone: ZoneId, size: number): Layout {
  return withZone(layout, zone, {
    size: Math.max(MIN_ZONE_SIZE, Math.min(Math.round(size), MAX_ZONE_SIZE)),
  });
}

function parseZone(raw: unknown, fallback: ZoneLayout, taken: Set<PanelId>): ZoneLayout {
  if (typeof raw !== 'object' || raw === null) {
    return { panels: [], active: null, size: fallback.size };
  }
  const record = raw as Record<string, unknown>;

  const panels = Array.isArray(record['panels'])
    ? record['panels'].filter((id): id is PanelId => {
        if (typeof id !== 'string' || !PANEL_IDS.has(id) || taken.has(id as PanelId)) {
          return false;
        }
        taken.add(id as PanelId);
        return true;
      })
    : [];

  const active = record['active'];
  const size = record['size'];

  return {
    panels,
    active:
      typeof active === 'string' && panels.includes(active as PanelId)
        ? (active as PanelId)
        : (panels[0] ?? null),
    size:
      typeof size === 'number' && Number.isFinite(size)
        ? Math.max(MIN_ZONE_SIZE, Math.min(Math.round(size), MAX_ZONE_SIZE))
        : fallback.size,
  };
}

/**
 * Interpreta lo guardado. Lo que no reconoce se descarta —un panel que ya no
 * existe, una zona inventada, basura de otra cosa en la misma clave— y un panel
 * repetido se queda en la primera zona donde aparece: estar en dos sitios a la
 * vez rompería todo lo demás.
 */
export function parseLayout(raw: unknown): Layout {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_LAYOUT;
  }
  const record = raw as Record<string, unknown>;
  const taken = new Set<PanelId>();
  const layout = Object.fromEntries(
    ZONES.map((zone) => [zone, parseZone(record[zone], DEFAULT_LAYOUT[zone], taken)]),
  ) as Layout;

  const empty = ZONES.every((zone) => layout[zone].panels.length === 0);
  return empty ? DEFAULT_LAYOUT : layout;
}

export function parsePreferences(raw: unknown): WorkspacePreferences {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_PREFERENCES;
  }
  const record = raw as Record<string, unknown>;
  const styleId = record['styleId'];
  const scaleId = record['scaleId'];

  return {
    layout: parseLayout(record['layout']),
    styleId: typeof styleId === 'string' ? (styleId as StyleId) : DEFAULT_PREFERENCES.styleId,
    scaleId: typeof scaleId === 'string' ? (scaleId as ScaleId) : DEFAULT_PREFERENCES.scaleId,
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
    // Modo privado o cuota llena: se pierde la disposición, no la sesión.
  }
}
