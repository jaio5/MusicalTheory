'use client';

import { useEffect, useRef, useState } from 'react';

import {
  keyName,
  NOTE_NAMES,
  pitchClassFromName,
  SCALE_IDS,
  SCALES,
  spanishNoteName,
  STYLE_IDS,
  STYLES,
  type ScaleId,
  type StyleId,
} from '@core/music';
import { useSessionStore, type SessionKey } from '@state/session-store';
import { useListening, type ListeningDeps } from '@state/use-listening';
import { PANELS, type PanelId } from '@state/workspace';
import { Field } from '@ui/Field';

const AUTOMATIC = 'auto';

function keyValue(key: SessionKey): string {
  return `${key.tonic}:${key.mode}`;
}

/**
 * La barra de arriba: tonalidad, estilo, escala y qué paneles se ven.
 *
 * Es lo único que está siempre. Todo lo demás sale porque lo has pedido.
 */
export type ToolbarProps = ListeningDeps;

export function Toolbar(deps: ToolbarProps = {}) {
  const pinnedKey = useSessionStore((state) => state.pinnedKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const styleId = useSessionStore((state) => state.styleId);
  const visible = useSessionStore((state) => state.visiblePanels);
  const actions = useSessionStore((state) => state.actions);
  const listening = useSessionStore((state) => state.listening);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  const { start, stop } = useListening(deps);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // La configuración guardada se recupera después de pintar: leerla durante el
  // render daría un HTML distinto en servidor y en cliente.
  useEffect(() => {
    actions.loadWorkspace();
  }, [actions]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const isListening = listening === 'listening';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void (isListening ? stop() : start())}
        aria-pressed={isListening}
        disabled={listening === 'requesting'}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
          isListening
            ? 'border-oxblood-bright text-oxblood-bright'
            : 'border-border text-text hover:border-brass-dim'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${
            isListening ? 'bg-oxblood-bright' : 'bg-text-muted'
          }`}
        />
        {listening === 'requesting' ? 'Permiso…' : isListening ? 'Escuchando' : 'Escuchar'}
      </button>

      {/* La nota que suena, siempre a la vista: es el dato que se mira sin
          parar y no tiene sentido que dependa de qué paneles estén abiertos. */}
      <span
        className={`font-mono text-sm tabular-nums ${hasSignal ? 'text-brass-bright' : 'text-text-muted'}`}
        aria-live="off"
      >
        {reading === null
          ? '—'
          : `${spanishNoteName(reading.pitchClass)}${reading.octave} ${
              reading.cents > 0 ? '+' : ''
            }${reading.cents.toFixed(0)}`}
      </span>

      <span aria-hidden="true" className="bg-border mx-1 h-6 w-px" />
      <Field
        label="Tonalidad"
        compact
        value={pinnedKey === null ? AUTOMATIC : keyValue(pinnedKey)}
        onChange={(event) => {
          const value = event.target.value;
          if (value === AUTOMATIC) {
            actions.followDetection();
            return;
          }
          const [tonic, mode] = value.split(':');
          actions.pinKey({
            tonic: Number(tonic) as SessionKey['tonic'],
            mode: mode === 'minor' ? 'minor' : 'major',
          });
        }}
      >
        <option value={AUTOMATIC}>Tonalidad: al oído</option>
        {NOTE_NAMES.map((name) => {
          const tonic = pitchClassFromName(name);
          return (
            <optgroup key={name} label={spanishNoteName(tonic)}>
              <option value={keyValue({ tonic, mode: 'major' })}>{keyName(tonic, 'major')}</option>
              <option value={keyValue({ tonic, mode: 'minor' })}>{keyName(tonic, 'minor')}</option>
            </optgroup>
          );
        })}
      </Field>

      <Field
        label="Estilo"
        compact
        value={styleId}
        onChange={(event) => actions.setStyle(event.target.value as StyleId)}
      >
        {STYLE_IDS.map((id) => (
          <option key={id} value={id}>
            {STYLES[id].name}
          </option>
        ))}
      </Field>

      <Field
        label="Escala"
        compact
        value={scaleId}
        onChange={(event) => actions.setScale(event.target.value as ScaleId)}
      >
        {SCALE_IDS.map((id) => (
          <option key={id} value={id}>
            {SCALES[id].name}
          </option>
        ))}
      </Field>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="border-border text-text hover:border-brass-dim rounded-md border px-3 py-1.5 text-sm"
        >
          Paneles ({visible.length})
        </button>

        {menuOpen && (
          <div
            role="group"
            aria-label="Paneles visibles"
            className="border-border bg-surface absolute right-0 z-20 mt-1 w-72 rounded-md border p-2 shadow-lg"
          >
            {PANELS.map((panel) => (
              <label
                key={panel.id}
                className="hover:bg-surface-raised flex cursor-pointer items-start gap-2 rounded-md p-2"
              >
                <input
                  type="checkbox"
                  className="accent-brass mt-1"
                  checked={visible.includes(panel.id as PanelId)}
                  onChange={() => actions.togglePanel(panel.id)}
                />
                <span>
                  <span className="text-text block text-sm">{panel.name}</span>
                  <span className="text-text-muted block text-xs">{panel.summary}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
