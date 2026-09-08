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
          // Con relieve, como todo lo que se mira en esta aplicación: seis
          // rectángulos de un píxel sobre el fondo se leen como una tabla, y
          // esto es un juego de seis cuerdas.
          <li
            key={string.number}
            className="superficie flex grow basis-0 flex-col items-center gap-0.5 py-2.5"
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
