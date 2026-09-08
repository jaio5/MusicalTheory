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
      {/*
        Centrado **de verdad**, y no solo a lo ancho.

        El afinador ocupaba el tercio de arriba de la pantalla y dejaba dos
        tercios de negro debajo: en un monitor de portátil, seiscientos píxeles de
        nada bajo una nota que se mira desde tres metros.

        Se centra con `my-auto` **en el hijo**, no con `justify-center` en la caja
        que se desplaza. Es la trampa clásica de flexbox y aquí mordió: con
        `justify-content: center`, cuando el contenido no cabe se sale por los dos
        lados y el desplazamiento no llega a lo que sobra —el navegador ni siquiera
        lo cuenta en el `scrollHeight`—. En un portátil de 640 px de alto, con el
        micro abierto, el medidor de señal y los dos avisos quedaban debajo del
        borde y **no había forma de bajar hasta ellos**. Con el margen automático,
        se centra cuando sobra sitio y se desplaza cuando falta.
      */}
      <div className="mx-auto flex w-full max-w-3xl grow flex-col overflow-y-auto p-6">
        <div className="my-auto flex w-full flex-col gap-6">
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
    </div>
  );
}
