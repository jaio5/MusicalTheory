'use client';

import { BADGES, type Progress } from '@core/music';

/**
 * Las diez medallas, las ganadas y las que faltan.
 *
 * Existían desde el principio y **no se veían en ninguna parte**: se contaban en
 * una línea de la meta diaria —«0 de 10 medallas»— y aparecían un momento al
 * terminar la unidad que las daba. Un contador dice cuántas llevas y no dice
 * ninguna de las dos cosas que interesan: cuáles tienes y qué hay que hacer para
 * las otras.
 *
 * Las que faltan se enseñan **con su cómo**, no ocultas. Una medalla secreta es
 * una sorpresa; una medalla con las instrucciones al lado es una lista de cosas
 * que probar, y esta aplicación va de lo segundo: aquí no se compite, se aprende.
 *
 * Va en la columna que ya existía y se quedaba vacía a media altura.
 */
export function Badges({ progress }: { readonly progress: Progress }) {
  const ganadas = new Set(progress.badges);

  return (
    <section aria-label="Medallas" className="px-3 py-3">
      <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
        Medallas · {ganadas.size} de {BADGES.length}
      </h2>

      <ul className="mt-3 flex flex-col gap-2">
        {BADGES.map((badge) => {
          const tenida = ganadas.has(badge.id);
          return (
            <li
              key={badge.id}
              className={`flex items-baseline gap-3 ${tenida ? '' : 'opacity-55'}`}
            >
              {/* Un punto y no un icono: son diez y cada una con su dibujo sería
                  una pared de adornos. Lleno cuando está, hueco cuando falta. */}
              <span
                aria-hidden
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  tenida ? 'bg-brass-bright' : 'border-border border'
                }`}
              />
              <span className="min-w-0">
                <span className={`block text-sm ${tenida ? 'text-text' : 'text-text-muted'}`}>
                  {badge.name}
                </span>
                {!tenida && (
                  <span className="text-text-muted block text-xs leading-snug">{badge.how}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
