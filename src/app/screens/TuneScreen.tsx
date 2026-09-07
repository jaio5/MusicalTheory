'use client';

import { Tuner, TuningPicker } from '@features/tuner';
import { useSessionStore } from '@state/session-store';
import { Disclosure } from '@ui/Disclosure';
import { WorkHeader } from '@ui/Screen';
import { TUNINGS } from '@core/instrument';

/**
 * Afinar y nada más: eliges la afinación y afinas cuerda a cuerda.
 *
 * Aquí no hay tonalidad, ni acordes, ni sugerencias. Quien viene a afinar viene
 * a eso, y cada cosa de más es una cosa que estorba.
 */
export function TuneScreen() {
  const escuchando = useSessionStore((state) => state.listening) === 'listening';
  const tuningId = useSessionStore((state) => state.tuningId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkHeader title="Afinar" lead="Cuerda a cuerda, con la afinación que elijas." />
      {/*
        Mientras se afina, la afinación se pliega.

        El selector y las seis cuerdas se tocan **una vez**, al empezar: se elige
        drop D y ya no se vuelve. Con el micro abierto se comían los primeros
        doscientos ochenta píxeles de un teléfono, que es justo donde tiene que
        estar la nota. Es el mismo patrón que usa componer con la rueda, y por lo
        mismo.

        Plegada dice en una línea en qué afinación estás, que es lo único que hay
        que saber mientras tanto.
      */}
      <div className="mx-auto flex w-full max-w-4xl grow flex-col gap-6 overflow-y-auto p-6">
        {escuchando ? (
          <Disclosure
            summary={
              <>
                Afinación: <span className="text-brass-bright">{TUNINGS[tuningId].name}</span>
              </>
            }
          >
            <div className="pt-3 pb-1">
              <TuningPicker />
            </div>
          </Disclosure>
        ) : (
          <TuningPicker />
        )}
        <Tuner />
      </div>
    </div>
  );
}
