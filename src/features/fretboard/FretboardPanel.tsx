'use client';

import { accidentalForScale, SCALES, scaleNotes, noteName } from '@core/music';
import { useAcordeElegido } from '@state/acorde-elegido';
import { selectActiveKey, useSessionStore } from '@state/session-store';

import { Fretboard } from './Fretboard';

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

          {/* El alto lo pone el propio dibujo a partir de su proporción, y el
              hueco solo pone el techo. Estirándolo hasta el hueco, el mástil
              —casi cuatro veces más ancho que alto— se quedaba centrado con
              franjas muertas arriba y abajo; sin techo, en un área ancha y baja
              se salía por debajo. */}
          <div className="mt-3 flex min-h-0 grow flex-col">
            <Fretboard
              tonic={activeKey.tonic}
              accidental={accidentalForScale(activeKey.tonic, scaleId)}
              scaleId={scaleId}
              soundingMidi={hasSignal ? (reading?.midi ?? null) : null}
              chordNotes={elegido?.notes}
            />
          </div>
        </>
      )}
    </div>
  );
}
