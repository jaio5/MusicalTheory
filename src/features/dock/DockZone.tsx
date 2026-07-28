'use client';

import type { ReactNode } from 'react';

import { ZONE_NAMES, ZONES, type PanelId, type ZoneId, type ZoneLayout } from '@state/workspace';
import { PanelChrome } from '@ui/panel-chrome';

export interface DockPanel {
  readonly id: PanelId;
  readonly name: string;
  readonly render: () => ReactNode;
}

export interface DockZoneProps {
  readonly zone: ZoneId;
  readonly layout: ZoneLayout;
  readonly panels: readonly DockPanel[];
  /** Si hay un panel viajando ahora mismo, para enseñar dónde se puede soltar. */
  readonly dragging: PanelId | null;
  readonly onDragPanel: (panel: PanelId | null) => void;
  readonly onDrop: (panel: PanelId, index: number) => void;
  readonly onActivate: (panel: PanelId) => void;
  readonly onMove: (panel: PanelId, zone: ZoneId) => void;
  readonly onClose: (panel: PanelId) => void;
}

function readPanelId(event: React.DragEvent): PanelId | null {
  const id = event.dataTransfer.getData('text/plain');
  return id === '' ? null : (id as PanelId);
}

/**
 * Una zona del dock: la barra de pestañas y el panel que esté al frente.
 *
 * Las pestañas se arrastran de una zona a otra, y para quien no arrastra están
 * el desplegable «Mover» y el botón de cerrar, que hacen exactamente lo mismo.
 */
export function DockZone({
  zone,
  layout,
  panels,
  dragging,
  onDragPanel,
  onDrop,
  onActivate,
  onMove,
  onClose,
}: DockZoneProps) {
  const active = panels.find((panel) => panel.id === layout.active) ?? null;

  return (
    <section
      aria-label={`Zona ${ZONE_NAMES[zone].toLowerCase()}`}
      className="bg-surface flex min-h-0 min-w-0 grow basis-0 flex-col"
    >
      <div
        role="tablist"
        aria-label={`Paneles de la zona ${ZONE_NAMES[zone].toLowerCase()}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const id = readPanelId(event);
          if (id !== null) {
            onDrop(id, layout.panels.length);
          }
        }}
        className={`border-border flex min-h-8 shrink-0 items-stretch gap-px overflow-x-auto border-b ${
          dragging === null ? '' : 'bg-surface-raised'
        }`}
      >
        {layout.panels.map((id, index) => {
          const panel = panels.find((candidate) => candidate.id === id);
          if (panel === undefined) {
            return null;
          }
          const selected = id === layout.active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', id);
                event.dataTransfer.effectAllowed = 'move';
                onDragPanel(id);
              }}
              onDragEnd={() => onDragPanel(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const dropped = readPanelId(event);
                if (dropped !== null) {
                  onDrop(dropped, index);
                }
              }}
              onClick={() => onActivate(id)}
              className={`shrink-0 cursor-grab px-3 font-mono text-[11px] tracking-wide whitespace-nowrap transition-colors ${
                selected
                  ? 'text-brass-bright border-brass-bright border-b'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {panel.name}
            </button>
          );
        })}

        {active !== null && (
          <span className="ml-auto flex shrink-0 items-center gap-1 pr-1 pl-2">
            <label className="flex items-center">
              <span className="sr-only">Mover {active.name} a otra zona</span>
              <select
                value=""
                onChange={(event) => onMove(active.id, event.target.value as ZoneId)}
                className="text-text-muted hover:text-text bg-transparent font-mono text-[10px]"
              >
                <option value="" disabled>
                  Mover
                </option>
                {ZONES.filter((candidate) => candidate !== zone).map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {ZONE_NAMES[candidate]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => onClose(active.id)}
              aria-label={`Cerrar ${active.name}`}
              title="Cerrar"
              className="text-text-muted hover:text-oxblood-bright px-1 text-xs"
            >
              ×
            </button>
          </span>
        )}
      </div>

      <div role="tabpanel" className="min-h-0 grow overflow-hidden">
        {active === null ? (
          <p className="text-text-muted p-3 text-xs">
            Zona vacía. Arrastra aquí una pestaña o ciérrala desde el menú.
          </p>
        ) : (
          <PanelChrome enabled={false}>{active.render()}</PanelChrome>
        )}
      </div>
    </section>
  );
}
