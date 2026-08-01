'use client';

import { BADGES, DAILY_GOAL_XP, goalCompletion, type Progress } from '@core/music';
import { Button } from '@ui/Button';

import type { Celebration } from './use-progress';

/**
 * La pantalla de después.
 *
 * Antes, terminar una unidad devolvía a la lista sin decir nada, y lo que se había
 * ganado había que buscarlo comparando un número del marcador con el que uno
 * recordaba. Esto lo cuenta: cuánto XP, cómo va la racha, si has cerrado la meta y
 * qué medallas son nuevas.
 *
 * Es corta a propósito y tiene el botón de seguir donde está el pulgar: la
 * celebración que hay que cerrar leyendo tres párrafos deja de ser un premio y se
 * convierte en un peaje. Y no hay confeti: esta aplicación se lee a un metro con
 * la guitarra puesta, y algo que se mueve mucho en la esquina se mira en vez de
 * seguir tocando.
 */
export function UnitDone({
  celebration,
  progress,
  day,
  onNext,
  nextLabel,
}: {
  readonly celebration: Celebration;
  readonly progress: Progress;
  readonly day: string | null;
  readonly onNext: () => void;
  /** Qué dice el botón: casi siempre «Seguir», y otra cosa al terminar el grado. */
  readonly nextLabel: string;
}) {
  const nuevas = BADGES.filter((badge) => celebration.newBadges.includes(badge.id));
  const parte = day === null ? 0 : goalCompletion(progress, day);

  return (
    <div className="flex min-h-0 grow flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <p className="text-tube-bright font-mono text-xs tracking-widest uppercase">
          {celebration.flawless && celebration.unitId !== 'repaso'
            ? 'Sin un fallo'
            : celebration.unitId === 'repaso'
              ? 'Repaso terminado'
              : 'Unidad superada'}
        </p>
        <h2 className="text-text mt-1 text-2xl">{celebration.title}</h2>
      </div>

      <dl className="flex flex-wrap items-baseline justify-center gap-x-8 gap-y-3">
        <Dato etiqueta="Ganado" valor={`+${celebration.xp} XP`} bueno />
        <Dato
          etiqueta="Racha"
          valor={`${celebration.streak} ${celebration.streak === 1 ? 'día' : 'días'}`}
          bueno={celebration.streak > 1}
        />
        <Dato
          etiqueta="Meta de hoy"
          valor={
            parte >= 1 ? 'cerrada' : `${Math.round(parte * DAILY_GOAL_XP)} de ${DAILY_GOAL_XP}`
          }
          bueno={parte >= 1}
        />
      </dl>

      {/* La barra de la meta, otra vez y en grande: es el momento en que se mira. */}
      <div
        className="border-border h-2 w-full max-w-sm border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={DAILY_GOAL_XP}
        aria-valuenow={Math.round(parte * DAILY_GOAL_XP)}
        aria-label="Meta de hoy"
      >
        <div
          className={parte >= 1 ? 'bg-tube h-full' : 'bg-brass h-full'}
          style={{ width: `${parte * 100}%`, transition: 'width 400ms ease-out' }}
        />
      </div>

      {celebration.goalJustMet && (
        <p className="text-tube-bright text-sm">
          Meta del día cerrada. Mañana empieza vacía otra vez.
        </p>
      )}

      {nuevas.length > 0 && (
        <div>
          <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
            {nuevas.length === 1 ? 'Medalla nueva' : 'Medallas nuevas'}
          </p>
          <ul aria-label="Medallas nuevas" className="mt-2 flex flex-wrap justify-center gap-2">
            {nuevas.map((badge) => (
              <li
                key={badge.id}
                className="border-brass-bright bg-surface-raised border px-2 py-1 text-sm"
              >
                <span className="text-brass-bright">{badge.name}</span>
                <span className="text-text-muted block text-xs">{badge.how}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={onNext}>{nextLabel}</Button>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  bueno = false,
}: {
  readonly etiqueta: string;
  readonly valor: string;
  readonly bueno?: boolean;
}) {
  return (
    <div>
      <dt className="text-text-muted font-mono text-xs tracking-widest uppercase">{etiqueta}</dt>
      <dd className={`mt-0.5 font-mono text-xl ${bueno ? 'text-tube-bright' : 'text-text'}`}>
        {valor}
      </dd>
    </div>
  );
}
