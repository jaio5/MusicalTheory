'use client';

import { keyName, NOTE_NAMES, pitchClassFromName, noteName } from '@core/music';
import { selectActiveKey, useSessionStore, type SessionKey } from '@state/session-store';
import { Button } from '@ui/Button';
import { Panel } from '@ui/Panel';

import { WheelOfFifths } from './WheelOfFifths';

/** Valor del desplegable cuando manda la detección. */
const AUTOMATIC = 'auto';

function keyValue(key: SessionKey): string {
  return `${key.tonic}:${key.mode}`;
}

function parseKeyValue(value: string): SessionKey | null {
  if (value === AUTOMATIC) {
    return null;
  }
  const [tonic, mode] = value.split(':');
  return {
    tonic: Number(tonic) as SessionKey['tonic'],
    mode: mode === 'minor' ? 'minor' : 'major',
  };
}

export interface KeyPanelProps {
  /** Solo la rueda, sin los controles: la barra ya los lleva. */
  readonly compact?: boolean;
}

export function KeyPanel({ compact = false }: KeyPanelProps = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const pinnedKey = useSessionStore((state) => state.pinnedKey);
  const candidates = useSessionStore((state) => state.keyCandidates);
  const actions = useSessionStore((state) => state.actions);

  const wheel = (
    <WheelOfFifths
      tonic={activeKey?.tonic ?? null}
      mode={activeKey?.mode ?? null}
      onPick={(tonic, mode) => actions.pinKey({ tonic, mode })}
    />
  );

  if (compact) {
    return wheel;
  }

  return (
    <Panel id="tonalidad" title="Tonalidad">
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <WheelOfFifths
          tonic={activeKey?.tonic ?? null}
          mode={activeKey?.mode ?? null}
          onPick={(tonic, mode) => actions.pinKey({ tonic, mode })}
        />

        <div className="w-full">
          <p className="text-text-muted text-sm" aria-live="polite">
            {activeKey === null
              ? 'Toca unos compases y la detectamos sola.'
              : pinnedKey === null
                ? `Detectada: ${keyName(activeKey.tonic, activeKey.mode)}.`
                : `Fijada a mano: ${keyName(activeKey.tonic, activeKey.mode)}.`}
          </p>

          <label className="mt-4 block">
            <span className="text-text-muted text-sm">Tonalidad</span>
            <select
              className="border-border bg-background text-text mt-1 w-full rounded-md border px-3 py-2"
              value={pinnedKey === null ? AUTOMATIC : keyValue(pinnedKey)}
              onChange={(event) => {
                const parsed = parseKeyValue(event.target.value);
                if (parsed === null) {
                  actions.followDetection();
                } else {
                  actions.pinKey(parsed);
                }
              }}
            >
              <option value={AUTOMATIC}>Seguir la detección</option>
              {NOTE_NAMES.map((name) => {
                const tonic = pitchClassFromName(name);
                return (
                  <optgroup key={name} label={noteName(tonic)}>
                    <option value={keyValue({ tonic, mode: 'major' })}>
                      {keyName(tonic, 'major')}
                    </option>
                    <option value={keyValue({ tonic, mode: 'minor' })}>
                      {keyName(tonic, 'minor')}
                    </option>
                  </optgroup>
                );
              })}
            </select>
          </label>

          {pinnedKey !== null && (
            <Button variant="quiet" className="mt-3" onClick={() => actions.followDetection()}>
              Volver a la detección
            </Button>
          )}

          {candidates.length > 0 && (
            <div className="mt-6">
              <p className="text-text-muted text-xs tracking-widest uppercase">
                Lo que mejor encaja
              </p>
              <ol className="mt-2 space-y-1">
                {candidates.map((candidate) => (
                  <li
                    key={`${candidate.tonic}:${candidate.mode}`}
                    className="text-text flex justify-between font-mono text-sm"
                  >
                    <span>{candidate.name}</span>
                    <span className="text-text-muted">{candidate.score.toFixed(2)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
