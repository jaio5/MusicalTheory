'use client';

import { useEffect } from 'react';

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
import { Field } from '@ui/Field';

const AUTOMATIC = 'auto';

function keyValue(key: SessionKey): string {
  return `${key.tonic}:${key.mode}`;
}

/**
 * Tonalidad, estilo y escala.
 *
 * Son los tres ajustes que cambian lo que propone toda la aplicación, así que
 * están siempre a la vista y en el mismo sitio. El resto de la barra lo llevan
 * el botón del micro y el cajón de extras.
 */
export function Toolbar() {
  const pinnedKey = useSessionStore((state) => state.pinnedKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const styleId = useSessionStore((state) => state.styleId);
  const actions = useSessionStore((state) => state.actions);

  // La configuración guardada se recupera después de pintar: leerla durante el
  // render daría un HTML distinto en servidor y en cliente.
  useEffect(() => {
    actions.loadWorkspace();
  }, [actions]);

  return (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
