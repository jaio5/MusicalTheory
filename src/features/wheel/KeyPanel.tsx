'use client';

import { keyName, SHARP_NAMES, pitchClassFromName, noteName } from '@core/music';
import { selectActiveKey, useSessionStore, type SessionKey } from '@state/session-store';
import { Button } from '@ui/Button';
import { Field } from '@ui/Field';
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
  return compact ? <Rueda /> : <PanelEntero />;
}

/**
 * Solo la rueda, suscrita solo a lo que pinta.
 *
 * Aparte del panel entero porque **compacta no mira los candidatos** y suscrita
 * a ellos se repintaba igual: la detección los rehace cada medio segundo
 * mientras suena algo, y componer lleva esta rueda montada en su columna y en el
 * panel de la tonalidad del teléfono.
 */
function Rueda() {
  const activeKey = useSessionStore(selectActiveKey);
  const actions = useSessionStore((state) => state.actions);
  return (
    <WheelOfFifths
      tonic={activeKey?.tonic ?? null}
      mode={activeKey?.mode ?? null}
      onPick={(tonic, mode) => actions.pinKey({ tonic, mode })}
    />
  );
}

function PanelEntero() {
  const activeKey = useSessionStore(selectActiveKey);
  const pinnedKey = useSessionStore((state) => state.pinnedKey);
  const candidates = useSessionStore((state) => state.keyCandidates);
  const actions = useSessionStore((state) => state.actions);

  return (
    <Panel id="tonalidad" title="Tonalidad">
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <Rueda />

        <div className="w-full">
          <p className="text-text-muted" aria-live="polite">
            {activeKey === null
              ? 'Toca unas notas sueltas y la detectamos sola.'
              : pinnedKey === null
                ? `Detectada: ${keyName(activeKey.tonic, activeKey.mode)}.`
                : `Fijada a mano: ${keyName(activeKey.tonic, activeKey.mode)}.`}
          </p>

          <div className="mt-4">
            <Field
              label="Tonalidad"
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
              {SHARP_NAMES.map((name) => {
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
            </Field>
          </div>

          {pinnedKey !== null && (
            <Button variant="quiet" className="mt-3" onClick={() => actions.followDetection()}>
              Volver a la detección
            </Button>
          )}

          {candidates.length > 0 && (
            <div className="mt-6">
              <p className="rotulo">Lo que mejor encaja</p>
              <ol className="mt-2 space-y-1">
                {candidates.map((candidate) => (
                  <li
                    key={`${candidate.tonic}:${candidate.mode}`}
                    className="text-text flex justify-between font-mono"
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
