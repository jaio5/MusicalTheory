'use client';

import { useState } from 'react';

import { useSessionStore } from '@state/session-store';
import { isOpen, PANELS, type PanelId } from '@state/workspace';

/**
 * Abrir un panel que no está en pantalla.
 *
 * Enseña qué hace cada uno, porque la gracia de poder montarse la pantalla es
 * saber qué se está montando. Los que ya están abiertos aparecen apagados y
 * llevan al suyo en vez de duplicarlo.
 */
export function AddPanel() {
  const layout = useSessionStore((state) => state.layout);
  const actions = useSessionStore((state) => state.actions);
  const [open, setOpen] = useState(false);

  function pick(id: PanelId): void {
    actions.addPanel(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="border-border text-text-muted hover:text-text rounded border px-2 py-1 font-mono text-[11px]"
      >
        Paneles
      </button>

      {open && (
        <ul className="border-border bg-surface absolute top-full right-0 z-40 mt-1 w-64 border shadow-2xl">
          {PANELS.map((panel) => {
            const visible = isOpen(layout, panel.id);
            return (
              <li key={panel.id}>
                <button
                  type="button"
                  onClick={() => pick(panel.id)}
                  className="hover:bg-surface-raised block w-full px-3 py-2 text-left"
                >
                  <span
                    className={`font-mono text-[11px] ${visible ? 'text-text-muted' : 'text-text'}`}
                  >
                    {panel.name}
                    {visible && ' · abierto'}
                  </span>
                  <span className="text-text-muted block text-[11px]">{panel.summary}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
