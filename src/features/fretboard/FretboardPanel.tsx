'use client';

import { accidentalForScale, SCALES, scaleNotes, noteName } from '@core/music';
import { useAcordeElegido } from '@state/acorde-elegido';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { Fretboard, PROPORCION } from './Fretboard';

/** Escala que se propone según el modo detectado, si no se ha elegido otra. */
export function FretboardPanel() {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const reading = useSessionStore((state) => state.reading);
  const hasSignal = useSessionStore((state) => state.hasSignal);
  /**
   * El acorde que marcar en el mástil: **el bloque que tienes elegido**.
   *
   * Y no el que se está oyendo: el mástil se mira **antes** de tocar, para ver
   * dónde caen las notas del acorde que se va a hacer.
   *
   * Era el último del camino, que es la segunda canción paralela a la de verdad
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)):
   * elegías un acorde de tu canción y el mástil seguía marcando otro. El camino
   * queda de respaldo mientras haya algo que solo sepa llenarlo a él.
   */
  const delMontaje = useAcordeElegido();
  const delCamino = useSessionStore((state) => state.path.at(-1) ?? null);
  const elegido = delMontaje ?? delCamino;

  return (
    // `grow`, para que el hueco del área llegue hasta el dibujo: el mástil se
    // acota con `max-h-full`, y un porcentaje no resuelve contra un padre de
    // alto automático —se quedaba en catorce píxeles—.
    <div className="flex min-h-0 grow flex-col">
      {activeKey === null ? (
        <p className="text-text-muted mt-6 shrink-0">
          Toca unas notas sueltas o elige una tonalidad arriba, y aquí sale la escala sobre el
          mástil.
        </p>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-text-muted text-sm">
              {SCALES[scaleId].name} de{' '}
              {noteName(activeKey.tonic, accidentalForScale(activeKey.tonic, scaleId))}:{' '}
              <span className="text-text font-mono">
                {scaleNotes(activeKey.tonic, scaleId)
                  .map((pitchClass) =>
                    noteName(pitchClass, accidentalForScale(activeKey.tonic, scaleId)),
                  )
                  .join(' · ')}
              </span>
            </p>
            {/* Con un acorde elegido, lo que dice el mástil ya no es la escala:
                es qué notas de la escala caen de pie sobre ese acorde. Se dice,
                porque el relleno solo no lo explica. */}
            <p className="text-text-muted text-sm">
              {elegido === null
                ? SCALES[scaleId].character
                : `Rellenas, las notas de ${elegido.symbol}: caen de pie. Las huecas entran de paso.`}
            </p>
          </div>

          {/* **El hueco pide el alto que llena el ancho, y nunca más del que
              hay.** Antes el hueco se quedaba con lo que sobrara y el dibujo se
              encogía dentro: a mil cuatrocientos de ancho se pintaba a
              seiscientos cincuenta, centrado entre dos franjas muertas.

              Los dos términos van en unidades de ventana a propósito. Con
              `aspect-ratio` y `max-h-full` el tope no topaba nada —un
              porcentaje no resuelve contra un padre de alto automático, y el
              área ya no lo tiene—, así que el dibujo se imponía y empujaba al
              arreglo por debajo de su suelo hasta cortarle lo de dentro.
              Medido: aparecían recortes a 1280 y a 1024 donde no los había.

              El ancho lo pone la proporción, que no hay que adivinarlo; el
              tope va en unidades de ventana porque **un porcentaje no resuelve
              contra un padre de alto automático**, y el área ya no lo tiene.
              Con `max-h-full` el tope no topaba nada y el dibujo empujaba al
              arreglo por debajo de su suelo hasta cortarle lo de dentro.

              Cuando el tope muerde, el ancho se queda y el alto no: el dibujo
              vuelve a encogerse centrado, que es lo menos malo cuando no hay
              alto que darle. */}
          <div
            // **Pide el alto que llena su ancho, y no más del que sobra.**
            // `aspect-ratio` pone lo primero sin números; el tope pone lo
            // segundo, y hace falta porque el bloque de abajo es `shrink-0`:
            // sin él el mástil se queda con su alto natural y deja la fila de
            // arriba once píxeles corta, que es suficiente para que la tira
            // plegada de «A dónde ir» quede fuera de alcance y no haya manera
            // de devolver ese panel.
            //
            // El tope son cinco cosas sumadas, **medidas, no estimadas**: la
            // barra de navegación (61), la de herramientas, el suelo de verdad
            // del arreglo, la barra de abajo (61) y la cabecera y los rótulos
            // de esta misma área (85).
            //
            // Al suelo del arreglo hay que sumarle los 44 px de la tira de un
            // área plegada: **va debajo de él, en la misma columna**, y es lo
            // único que queda en pantalla de ese panel. Cortándola no hay
            // manera de devolverlo.
            //
            // Y son dos topes porque por debajo de 1280 cambian dos de los
            // cinco sumandos: la barra de herramientas se parte en dos filas
            // —85 en vez de 57— y el arreglo necesita 224 en vez de 176, que
            // también es por partirse en más filas.
            // 61+85+(224+44)+61+85 = 560 px, y 61+57+(176+44)+61+85 = 484.
            className="mt-3 min-h-0 w-full shrink lg:max-h-[calc(100dvh-35rem)] xl:max-h-[calc(100dvh-30.25rem)]"
            style={{ aspectRatio: PROPORCION }}
          >
            <Fretboard
              tonic={activeKey.tonic}
              accidental={accidentalForScale(activeKey.tonic, scaleId)}
              scaleId={scaleId}
              /* v8 ignore next -- con señal siempre hay lectura: las dos las pone el mismo `setPitch` */
              soundingMidi={hasSignal ? (reading?.midi ?? null) : null}
              chordNotes={elegido?.notes}
            />
          </div>
        </>
      )}
    </div>
  );
}
