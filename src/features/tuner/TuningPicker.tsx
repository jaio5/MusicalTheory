'use client';

import { noteName, midiToPitchClass } from '@core/music';
import { TUNING_IDS, TUNINGS } from '@core/instrument';
import { useSessionStore } from '@state/session-store';
import { Field } from '@ui/Field';

/**
 * Con qué afinación se compara lo que suena.
 *
 * Enseña las seis cuerdas al lado, porque el nombre de una afinación no dice
 * nada si no has tocado en ella: «DADGAD» es información solo cuando ves qué
 * cuerdas cambian.
 */
export function TuningPicker() {
  const tuningId = useSessionStore((state) => state.tuningId);
  const actions = useSessionStore((state) => state.actions);
  const tuning = TUNINGS[tuningId];

  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Afinación"
        value={tuningId}
        onChange={(event) => actions.setTuning(event.target.value as typeof tuningId)}
      >
        {TUNING_IDS.map((id) => (
          <option key={id} value={id}>
            {TUNINGS[id].name}
          </option>
        ))}
      </Field>

      <p className="text-text-muted text-xs">{tuning.summary}</p>

      <ol aria-label="Cuerdas de la afinación" className="flex gap-2">
        {tuning.strings.map((string) => (
          <li key={string.number} className="flex flex-col items-center">
            <span className="text-text font-mono text-sm">
              {noteName(midiToPitchClass(string.midi))}
            </span>
            <span className="text-text-muted font-mono text-[10px]">{string.number}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
