'use client';

import {
  BADGES,
  currentStreak,
  DAILY_GOAL_XP,
  dueReview,
  goalCompletion,
  TOTAL_XP,
  xpEarnedOn,
  type Progress,
} from '@core/music';
import { IconoGrieta, IconoRacha } from '@ui/icons';
import { ProgressRing } from '@ui/ProgressRing';

/**
 * El marcador del día: la meta, la racha y lo que queda por repasar.
 *
 * Antes aquí solo había un número que subía —el XP total sobre el del temario—, y
 * un número que sube durante diez cursos no da ninguna sensación de haber hecho
 * algo hoy. La meta diaria sí: se llena, se cierra y mañana está vacía otra vez,
 * que es lo que hace volver.
 *
 * El anillo no es decoración: es la única forma de ver a la vez cuánto llevas y
 * cuánto falta sin leer dos números y restarlos.
 */
export function DailyGoal({
  progress,
  day,
  onReview,
}: {
  readonly progress: Progress;
  /** Nulo hasta que se lee el reloj en el cliente. */
  readonly day: string | null;
  /** Nulo cuando el plan no incluye el repaso. */
  readonly onReview: (() => void) | null;
}) {
  const streak = day === null ? 0 : currentStreak(progress, day);
  const hoy = day === null ? 0 : xpEarnedOn(progress, day);
  const parte = day === null ? 0 : goalCompletion(progress, day);
  const cerrada = parte >= 1;
  const pendientes = day === null ? 0 : dueReview(progress.review, day).length;
  const medallas = progress.badges.length;

  return (
    <div className="border-border shrink-0 border-b px-3 py-3">
      <div className="flex items-center gap-4">
        <ProgressRing part={parte} label={`${hoy} de ${DAILY_GOAL_XP} XP de la meta de hoy`}>
          <span className={cerrada ? 'text-tube-bright' : 'text-text'}>{cerrada ? '✓' : hoy}</span>
        </ProgressRing>

        <div className="min-w-0 grow">
          <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
            La meta de hoy
          </p>
          <p className="text-text mt-0.5 text-sm">
            {parte >= 1 ? (
              <span className="text-tube-bright">Hecha. Lo de ahora es de propina.</span>
            ) : (
              <>
                Te faltan{' '}
                <span className="text-brass-bright font-mono">{DAILY_GOAL_XP - hoy} XP</span>: una
                unidad más.
              </>
            )}
          </p>

          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 font-mono text-xs">
            <span
              className={streak > 0 ? 'text-tube-bright' : 'text-text-muted'}
              title={
                streak > 0
                  ? `${streak} ${streak === 1 ? 'día' : 'días'} seguidos practicando`
                  : 'La racha se cuenta por días seguidos. Hoy todavía no cuenta.'
              }
            >
              {streak > 0 ? (
                <>
                  <IconoRacha /> {streak} {streak === 1 ? 'día' : 'días'} de racha
                </>
              ) : (
                'sin racha'
              )}
            </span>
            <span className="text-text-muted">
              {progress.xp} de {TOTAL_XP} XP
            </span>
            <span className="text-text-muted">
              {medallas} de {BADGES.length} medallas
            </span>
          </p>
        </div>
      </div>

      {/* La barra del temario entero, fina y debajo: es la que dice cuánto queda
          de aquí a terminar, y no compite con el anillo del día. */}
      <div className="border-border mt-2 h-1 w-full border" aria-hidden="true">
        <div
          className="bg-brass h-full"
          style={{ width: `${TOTAL_XP === 0 ? 0 : (progress.xp / TOTAL_XP) * 100}%` }}
        />
      </div>

      {pendientes > 0 && onReview !== null && (
        <button
          type="button"
          onClick={onReview}
          className="border-oxblood-bright text-text hover:bg-surface-raised min-h-tap mt-3 flex w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors"
        >
          <IconoGrieta />
          <span className="grow">
            {pendientes === 1
              ? 'Tienes una pregunta para repasar'
              : `Tienes ${pendientes} preguntas para repasar`}
          </span>
          <span className="text-brass-bright shrink-0 font-mono text-xs">Repasar</span>
        </button>
      )}
    </div>
  );
}
