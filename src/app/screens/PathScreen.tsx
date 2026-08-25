'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { can, cheapestPlanWith, nextAllowedUnit } from '@core/billing';
import { dueReview, findUnit } from '@core/music';
import { DailyGoal, LearnPath, StartPicker, Tutor, useProgress } from '@features/learn';
import { useAccount } from '@state/account';
import { PlanLock } from '@ui/PlanLock';
import { IconoTeoria, IconoTocar } from '@ui/icons';
import { WorkHeader } from '@ui/Screen';

/**
 * Aprender: el camino, y nada más.
 *
 * Antes esta pantalla era tres columnas —el temario, la unidad y el profesor— y eso
 * la convertía en un panel de control: se veía todo y no se estaba en nada. Ahora es
 * lo que dice ser, un camino, y cada cosa que se hace tiene su propia dirección:
 * `/aprender/una-unidad`, `/aprender/repaso`, `/profesor`. Se navega, no se mira.
 *
 * Una columna estrecha y centrada a propósito. El camino se lee de arriba abajo con
 * el pulgar, no en horizontal.
 */
export function PathScreen() {
  const router = useRouter();
  const { account, signedIn } = useAccount();
  const { progress, day, chooseStart } = useProgress();

  const repasa = can(account.plan, 'repaso');
  const pendientes = day === null ? 0 : dueReview(progress.review, day).length;
  const siguiente = nextAllowedUnit(progress, account.plan);
  const found = siguiente === null ? null : findUnit(siguiente);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkHeader title="Aprender" lead="Diez cursos, y empiezas por donde quieras." />
      {/* En pantalla ancha, dos columnas: a la izquierda lo que se consulta —la
          meta, por dónde empiezas y el botón de seguir— y a la derecha el camino,
          que es lo que se recorre. Antes era una columna de 576 px centrada, así
          que en un portátil media pantalla era fondo vacío y había que desplazarse
          para ver lo que ya cabía.

          En estrecho se apila en el orden de siempre: primero la meta, porque lo
          primero que se mira al abrir es si hoy ya has hecho algo. */}
      <div className="grid min-h-0 grow grid-cols-1 overflow-y-auto lg:grid-cols-[24rem_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[27rem_minmax(0,1fr)]">
        <div className="border-border flex flex-col lg:min-h-0 lg:overflow-y-auto lg:border-r">
          <DailyGoal
            progress={progress}
            day={day}
            onReview={repasa && pendientes > 0 ? () => router.push('/aprender/repaso') : null}
          />

          <div className="border-border flex flex-col gap-3 border-b px-3 py-3 lg:border-b-0">
            <StartPicker progress={progress} plan={account.plan} onChange={chooseStart} />

            {/* El botón grande de seguir, arriba y siempre a la misma altura: es lo
              que se pulsa nueve de cada diez veces que se abre esta pantalla. */}
            {found !== null ? (
              <Link
                href={`/aprender/${found.unit.id}`}
                className="bg-brass text-background hover:bg-brass-bright flex items-center gap-3 rounded-md px-4 py-3"
              >
                <span aria-hidden="true">
                  {found.unit.kind === 'play' ? <IconoTocar /> : <IconoTeoria />}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-xs opacity-80">
                    {found.course.year}º de{' '}
                    {found.course.grade === 'elemental' ? 'Elemental' : 'Profesional'} · seguir
                  </span>
                  <span className="block truncate text-base">{found.unit.title}</span>
                </span>
              </Link>
            ) : (
              <div className="border-border border p-3">
                <p className="text-text text-sm">
                  No queda nada abierto por delante.{' '}
                  {can(account.plan, 'grado-profesional')
                    ? 'Has terminado el temario: puedes volver a cualquier unidad, y en otra tonalidad no es repetir.'
                    : 'Lo siguiente es el Grado Profesional.'}
                </p>
                {!can(account.plan, 'grado-profesional') && (
                  <div className="mt-2">
                    <PlanLock
                      needed={cheapestPlanWith('grado-profesional')}
                      what="El Grado Profesional"
                      signedIn={signedIn}
                      compact
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 lg:overflow-y-auto">
          <LearnPath
            progress={progress}
            plan={account.plan}
            day={day}
            active={siguiente}
            onPick={(unitId) => router.push(`/aprender/${unitId}`)}
          />
        </div>
      </div>

      {/* En el camino no avisa de nada: está por si quieres preguntar algo antes
          de meterte en una unidad. */}
      <Tutor />
    </div>
  );
}
