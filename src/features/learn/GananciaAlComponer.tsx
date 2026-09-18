'use client';

import { useEffect } from 'react';

import { badgesOf, type ComposeDeed } from '@core/music';

import type { ComposeGain } from './use-progress';

/**
 * El aviso de que lo que acabas de hacer componiendo ha contado.
 *
 * **Un aviso y no una pantalla**, que es toda la diferencia con `UnitDone`. Una
 * unidad tiene final: se termina, se celebra y se sale. Componer no termina
 * nunca, así que cualquier cosa que tape el lienzo o pida un clic para
 * quitarse está interrumpiendo lo único que la pantalla quiere que hagas. Este
 * aparece en una esquina, dice qué ha sumado y se va solo.
 *
 * **Y no roba el foco.** Va en un `aria-live` cortés: quien esté con el teclado
 * dentro de un bloque no sale de él, y quien use lector de pantalla se entera
 * al terminar la frase que estuviera oyendo. Un `alert` aquí interrumpiría la
 * lectura del acorde que se acaba de meter, que es lo que de verdad importa.
 */
const QUE_HICISTE: Readonly<Record<ComposeDeed, string>> = {
  parte: 'Ya se sabe qué parte es',
  cancion: 'Canción guardada',
  salida: 'Te has quedado con una salida',
  oido: 'Metido lo que oyó el micro',
  ensayo: 'Te la has tocado entera',
  'ensayo-limpio': 'Entera y a tiempo',
};

/** Cuánto se queda en pantalla. Lo que se tarda en leer dos líneas, y ni una más. */
const DURACION_AVISO = 4000;

export interface GananciaAlComponerProps {
  readonly gain: ComposeGain | null;
  readonly onDismiss: () => void;
  /** Se inyecta en los tests para no esperar cuatro segundos de verdad. */
  readonly duracion?: number;
}

export function GananciaAlComponer({
  gain,
  onDismiss,
  duracion = DURACION_AVISO,
}: GananciaAlComponerProps) {
  // El temporizador se rearma con cada aviso nuevo: dos hechos seguidos no
  // pueden dejar el segundo colgado con el reloj del primero.
  useEffect(() => {
    if (gain === null) {
      return;
    }
    const reloj = setTimeout(onDismiss, duracion);
    return () => clearTimeout(reloj);
  }, [gain, onDismiss, duracion]);

  return (
    <div
      aria-live="polite"
      // Anclado justo encima de quien lo monta, no a una distancia del borde de
      // la pantalla. Con `fixed` había que adivinar un número, y el número no
      // existe: en un teléfono hay **dos** barras apiladas —la de herramientas y
      // la navegación— y en pantalla ancha solo una, así que cualquier medida
      // que despejara una tapaba la otra. Quien lo monta lo pone en una caja
      // `relative` y esto sale hacia arriba desde ahí, como ya hace el cajón de
      // herramientas.
      className="pointer-events-none absolute right-3 bottom-full z-40 mb-2 max-w-[18rem]"
    >
      {gain !== null && (
        <div className="border-brass-dim bg-surface-raised rounded-md border px-3 py-2 shadow-lg">
          <p className="text-text text-sm font-medium">
            {QUE_HICISTE[gain.deed]}
            {/* El XP en monoespaciada porque es un número que se compara con
                otros, que es la regla de la casa. El resto, en la sans. */}
            {gain.xp > 0 && (
              <span className="text-brass-bright ml-2 font-mono text-xs">+{gain.xp} XP</span>
            )}
          </p>

          {gain.newBadges.length > 0 && (
            <p className="text-text-muted mt-1 text-xs">
              Medalla nueva:{' '}
              {badgesOf(gain.newBadges)
                .map((medalla) => medalla.name)
                .join(', ')}
            </p>
          )}

          {gain.goalJustMet && (
            <p className="text-brass-bright mt-1 text-xs">Meta del día cerrada, componiendo.</p>
          )}

          {/* Solo cuando el tope ya no deja sumar. Decirlo siempre sería un
              techo recordándose a sí mismo; decirlo justo aquí explica por qué
              el número ha dejado de subir, que si no parece que algo falla. */}
          {gain.xp === 0 && (
            <p className="text-text-muted mt-1 text-xs">
              Hoy componer ya no suma más XP. La racha sigue contando igual.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
