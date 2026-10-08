'use client';

import { useState } from 'react';

import { noteName, midiToPitchClass } from '@core/music';
import { nearestString, semitonesFromString, TUNING_IDS, TUNINGS } from '@core/instrument';
import { useSessionStore, type SessionState } from '@state/session-store';
import { Field } from '@ui/Field';
import { Marca } from '@ui/Marca';

import { tuningStatus, type TuningStatus } from './tuning';

/**
 * Con qué afinación se compara lo que suena.
 *
 * El nombre y lo que cambia; las seis cuerdas van aparte, en
 * `CuerdasDeLaAfinacion`, porque se ven también mientras se afina y esto no.
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

      <p className="text-text-muted">{tuning.summary}</p>
    </div>
  );
}

/**
 * Qué cuerda suena y cómo, en una cadena: `"3:afinada"`.
 *
 * Una cadena y no la lectura: la lectura cambia veinte veces por segundo y
 * repintaría las seis cuerdas; esto, al cambiar de cuerda o de estado.
 *
 * El estado se mide **contra la cuerda**, no contra la nota más cercana: una
 * sexta dos semitonos baja suena «afinada» como Re, y no lo está como Mi.
 */
function cuerdaQueSuena(state: SessionState): string | null {
  if (state.listening !== 'listening' || state.reading === null || !state.hasSignal) {
    return null;
  }
  const cuerda = nearestString(state.reading.midi, TUNINGS[state.tuningId].strings);
  const distancia = semitonesFromString(state.reading.midi, cuerda);
  const estado: TuningStatus =
    distancia === 0 ? tuningStatus(state.reading.cents) : distancia > 0 ? 'alta' : 'baja';
  return `${cuerda.number}:${estado}`;
}

/**
 * Las seis cuerdas, grandes, con **cómo quedó cada una**.
 *
 * Es lo que se mira mientras se afina, y se mira desde donde se está con la
 * guitarra puesta. Estaba dentro del selector de afinación, y al escuchar el
 * selector se plegaba con las cuerdas dentro: justo mientras se afinaba no se
 * veía cuáles iban ya y cuáles faltaban. Ahora se queda a la vista, y cada
 * cuerda recuerda cómo sonó la última vez —afinada, alta o baja— hasta que
 * cambie la afinación, que las deja sin marcar.
 *
 * **Cada una es una pieza, y hundida** (`.hueco`): un hueco no se pulsa, y estas
 * no hacen nada al pulsarlas. **La que suena se enciende** con su piloto.
 */
export function CuerdasDeLaAfinacion() {
  const tuningId = useSessionStore((state) => state.tuningId);
  const tuning = TUNINGS[tuningId];
  const sonando = useSessionStore(cuerdaQueSuena);

  /*
    Cómo quedó cada cuerda, apuntado **mientras se pinta** y no en un efecto:
    deriva de lo que suena, y con un efecto se pintaba una vez con la cuerda
    encendida y sin su marca. Otra afinación empieza sin marcas: las cuerdas son
    otras.
  */
  const [visto, setVisto] = useState<{
    readonly afinacion: string;
    readonly ultimo: string | null;
    readonly estados: Readonly<Record<number, TuningStatus>>;
  }>({ afinacion: tuningId, ultimo: null, estados: {} });
  if (visto.afinacion !== tuningId || sonando !== visto.ultimo) {
    const previos = visto.afinacion === tuningId ? visto.estados : {};
    const [numero, estado] = (sonando ?? ':').split(':');
    setVisto({
      afinacion: tuningId,
      ultimo: sonando,
      estados:
        sonando === null ? previos : { ...previos, [Number(numero)]: estado as TuningStatus },
    });
  }
  const suenaAhora = sonando === null ? null : Number(sonando.split(':')[0]);

  return (
    <ol aria-label="Cuerdas de la afinación" className="flex gap-2">
      {tuning.strings.map((string) => {
        const suena = suenaAhora === string.number;
        const estado = visto.afinacion === tuningId ? visto.estados[string.number] : undefined;
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
            {/* El hueco está siempre, para que la fila no crezca con la primera
                marca. La marca lleva forma además de color, como todas. */}
            <span
              className={`flex min-h-4 items-center gap-1 text-xs ${
                estado === 'afinada' ? 'text-tube-bright' : 'text-text-muted'
              }`}
            >
              {estado === 'afinada' && <Marca tono="entra" />}
              {estado}
            </span>
            {suena && <span className="sr-only">, sonando</span>}
          </li>
        );
      })}
    </ol>
  );
}
