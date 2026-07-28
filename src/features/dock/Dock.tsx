'use client';

import { useState } from 'react';

import { useSessionStore } from '@state/session-store';
import { MAX_ZONE_SIZE, MIN_ZONE_SIZE, type PanelId, type ZoneId } from '@state/workspace';

import { DockZone, type DockPanel } from './DockZone';
import { Splitter } from './Splitter';

/** Lo que se abre una zona vacía mientras hay un panel viajando. */
const DROP_HINT_SIZE = 96;

export interface DockProps {
  /** Qué panel corresponde a cada identificador. Lo decide quien compone. */
  readonly panels: readonly DockPanel[];
}

/**
 * El banco de trabajo: cuatro zonas con pestañas que se arrastran entre ellas.
 *
 * El dock no sabe qué hay dentro de cada panel —los recibe ya construidos— y
 * así no tiene que importar de ningún otro feature, que es la regla. Lo único
 * que le importa es dónde va cada uno y cuánto sitio ocupa.
 */
export function Dock({ panels }: DockProps) {
  const layout = useSessionStore((state) => state.layout);
  const actions = useSessionStore((state) => state.actions);
  const [dragging, setDragging] = useState<PanelId | null>(null);

  function zoneProps(zone: ZoneId) {
    return {
      zone,
      layout: layout[zone],
      panels,
      dragging,
      onDragPanel: setDragging,
      onDrop: (panel: PanelId, index: number) => {
        setDragging(null);
        actions.dockPanel(panel, zone, index);
      },
      onActivate: actions.showPanel,
      onMove: actions.dockPanel,
      onClose: actions.hidePanel,
    };
  }

  function sizeOf(zone: 'left' | 'right' | 'bottom'): number | null {
    if (layout[zone].panels.length > 0) {
      return layout[zone].size;
    }
    return dragging === null ? null : DROP_HINT_SIZE;
  }

  const left = sizeOf('left');
  const right = sizeOf('right');
  const bottom = sizeOf('bottom');

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="flex min-h-0 grow">
        {left !== null && (
          <>
            <div style={{ width: left }} className="flex min-w-0 shrink-0">
              <DockZone {...zoneProps('left')} />
            </div>
            <Splitter
              orientation="vertical"
              size={layout.left.size}
              min={MIN_ZONE_SIZE}
              max={MAX_ZONE_SIZE}
              direction={1}
              label="Ancho de la zona izquierda"
              onResize={(size) => actions.resizeZone('left', size)}
            />
          </>
        )}

        <div className="flex min-w-0 grow">
          <DockZone {...zoneProps('center')} />
        </div>

        {right !== null && (
          <>
            <Splitter
              orientation="vertical"
              size={layout.right.size}
              min={MIN_ZONE_SIZE}
              max={MAX_ZONE_SIZE}
              direction={-1}
              label="Ancho de la zona derecha"
              onResize={(size) => actions.resizeZone('right', size)}
            />
            <div style={{ width: right }} className="flex min-w-0 shrink-0">
              <DockZone {...zoneProps('right')} />
            </div>
          </>
        )}
      </div>

      {bottom !== null && (
        <>
          <Splitter
            orientation="horizontal"
            size={layout.bottom.size}
            min={MIN_ZONE_SIZE}
            max={MAX_ZONE_SIZE}
            direction={-1}
            label="Alto de la zona de abajo"
            onResize={(size) => actions.resizeZone('bottom', size)}
          />
          <div style={{ height: bottom }} className="flex min-h-0 shrink-0">
            <DockZone {...zoneProps('bottom')} />
          </div>
        </>
      )}
    </div>
  );
}
