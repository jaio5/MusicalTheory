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
    <div className="flex flex-col gap-3">
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

      <p className="text-text-muted text-sm">{tuning.summary}</p>

      {/* Las seis cuerdas, grandes: es lo que se mira mientras se afina, y se
          mira desde donde se está con la guitarra puesta. */}
      <ol aria-label="Cuerdas de la afinación" className="flex gap-2">
        {tuning.strings.map((string) => (
          <li
            key={string.number}
            className="border-border flex grow basis-0 flex-col items-center gap-0.5 border py-2"
          >
            <span className="text-text font-mono text-2xl">
              {noteName(midiToPitchClass(string.midi), tuning.accidental)}
            </span>
            <span className="text-text-muted font-mono text-xs">{string.number}.ª</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
