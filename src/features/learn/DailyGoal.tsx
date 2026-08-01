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
  const pendientes = day === null ? 0 : dueReview(progress.review, day).length;
  const medallas = progress.badges.length;

  return (
    <div className="border-border shrink-0 border-b px-3 py-3">
      <div className="flex items-center gap-4">
        <GoalRing part={parte} today={hoy} />

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
                  <span aria-hidden="true">🔥</span> {streak} {streak === 1 ? 'día' : 'días'} de
                  racha
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
          className="bg-brass-dim h-full"
          style={{ width: `${TOTAL_XP === 0 ? 0 : (progress.xp / TOTAL_XP) * 100}%` }}
        />
      </div>

      {pendientes > 0 && onReview !== null && (
        <button
          type="button"
          onClick={onReview}
          className="border-oxblood-bright text-text hover:bg-surface-raised mt-3 flex w-full items-baseline gap-2 border px-2 py-1.5 text-left text-sm"
        >
          <span aria-hidden="true">🩹</span>
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

/**
 * El anillo de la meta.
 *
 * SVG a mano y no una librería de gráficos: es un círculo con el trazo cortado, y
 * para eso no hace falta traerse nada. El truco es `strokeDasharray` con la
 * circunferencia entera y `strokeDashoffset` con lo que falta.
 */
function GoalRing({ part, today }: { readonly part: number; readonly today: number }) {
  const radio = 26;
  const vuelta = 2 * Math.PI * radio;
  const hecho = Math.max(0, Math.min(1, part));

  return (
    <div className="relative shrink-0">
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        role="img"
        aria-label={`${today} de ${DAILY_GOAL_XP} XP de la meta de hoy`}
      >
        {/* Girado un cuarto de vuelta para que empiece arriba y no a la derecha. */}
        <g transform="rotate(-90 32 32)">
          <circle
            cx="32"
            cy="32"
            r={radio}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth="5"
          />
          <circle
            cx="32"
            cy="32"
            r={radio}
            fill="none"
            stroke="currentColor"
            className={hecho >= 1 ? 'text-tube-bright' : 'text-brass-bright'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={vuelta}
            strokeDashoffset={vuelta * (1 - hecho)}
            style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
          />
        </g>
      </svg>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center font-mono text-sm ${
          hecho >= 1 ? 'text-tube-bright' : 'text-text'
        }`}
      >
        {hecho >= 1 ? '✓' : today}
      </span>
    </div>
  );
}
