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
  // Desde que se pide el micro, y no desde que llega. El permiso tarda más de
  // medio segundo, y lo que se recoloca pasado ese plazo ya no cuenta como
  // respuesta al clic: plegar la afinación y dejar de centrar al llegar el micro
  // medía hasta 0,24 de CLS en un teléfono. Recolocándolo al pulsar, el salto es
  // el que se ha pedido (adr/0061).
  const estado = useSessionStore((state) => state.listening);
  const escuchando = estado === 'listening' || estado === 'requesting';
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

        **Escuchando, se queda arriba** ([adr/0061](../../../docs/adr/0061-el-afinador-no-se-mueve-mientras-escucha.md)).
        Centrado, cualquier cosa que creciera dentro —la primera nota, un aviso,
        el selector de entrada— empujaba el bloque entero la mitad hacia arriba
        y la otra mitad hacia abajo: la nota que se mira desde tres metros se
        movía sola, y eso medía entre 0,19 y 0,31 de CLS. Anclado arriba, lo que
        crece solo empuja lo que tiene debajo.
      */}
      {/*
        **El afinador es el instrumento, y la afinación va a su lado.**

        Era una columna de 768 px en medio: a 1920 la pantalla usaba el 38 % del
        ancho, con la nota —lo que se mira desde tres metros— del mismo tamaño que
        en un portátil. Desde `md` la afinación pasa a una columna estrecha a la
        izquierda y el afinador se queda con todo lo demás, a lo alto y a lo ancho;
        en un teléfono se apilan como antes, con la afinación encima.

        **Escuchando, la columna se pliega con ella** y el afinador se queda con el
        ancho entero, con la afinación en una línea encima, igual que en el
        teléfono. Plegada al lado dejaba una columna de 400 px con un solo renglón
        y el resto vacío. El cambio de reparto cae justo al pulsar «Escuchar», que
        es cuando se ha pedido (adr/0061); mientras se escucha ya no se mueve.
      */}
      <div className="px-margen flex grow flex-col overflow-y-auto py-6">
        <div
          className={`grid w-full gap-6 md:gap-x-[clamp(1.5rem,4vw,5rem)] ${
            escuchando
              ? ''
              : 'my-auto md:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]'
          }`}
        >
          <div className="min-w-0 md:self-start" data-tour="afinar-afinacion">
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
          </div>
          <div className="min-w-0" data-tour="afinar-afinador">
            <Tuner />
          </div>
        </div>
      </div>
    </div>
  );
}
