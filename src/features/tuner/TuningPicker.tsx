'use client';

import { noteName, midiToPitchClass } from '@core/music';
import { nearestString, TUNING_IDS, TUNINGS } from '@core/instrument';
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
  // Solo el número de la cuerda que suena, y no la lectura: la lectura cambia
  // veinte veces por segundo y repintaría las seis; el número, al cambiar de cuerda.
  const sonando = useSessionStore((state) =>
    state.listening === 'listening' && state.reading !== null
      ? nearestString(state.reading.midi, tuning.strings).number
      : null,
  );

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
          mira desde donde se está con la guitarra puesta.

          **Cada una es una pieza, y hundida.** Fueron cajas con relieve —la pinta
          de un botón, y no hacen nada al pulsarlas— y después seis letras sueltas
          que a 1280 dejaban la columna medio vacía. `.hueco` es lo que dice una
          lectura (`docs/ESTILO.md`: «cada cuerda del afinador una pieza»): un
          hueco no se pulsa. **La que suena se enciende** con su piloto, para
          saber de un vistazo qué cuerda ha enganchado el micro. */}
      <ol aria-label="Cuerdas de la afinación" className="flex gap-2">
        {tuning.strings.map((string) => {
          const suena = sonando === string.number;
          return (
            <li
              key={string.number}
              aria-current={suena ? 'true' : undefined}
              className={`hueco flex grow basis-0 flex-col items-center gap-0.5 px-1 pt-2 pb-3 ${
                suena ? 'piloto text-brass-bright' : 'text-text'
              }`}
            >
              <span className="font-mono text-2xl">
                {noteName(midiToPitchClass(string.midi), tuning.accidental)}
              </span>
              <span className="text-text-muted font-mono text-xs">{string.number}.ª</span>
              {suena && <span className="sr-only">, sonando</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
