'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { can, cheapestPlanWith, nextAllowedUnit, unitAccess } from '@core/billing';
import { findUnit, keyName } from '@core/music';
import { LearnPanel, TheoryUnit, UnitDone, useProgress, type Celebration } from '@features/learn';
import { KeyPanel } from '@features/wheel';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { PlanLock } from '@ui/PlanLock';
import { Disclosure } from '@ui/Disclosure';
import { Screen, WorkHeader } from '@ui/Screen';

/**
 * Una unidad, a pantalla completa y con su propia dirección.
 *
 * Con dirección propia se puede enlazar, volver atrás con el botón del navegador y
 * dejarla a medias sin perder el sitio. Y sobre todo: mientras se contesta no hay
 * nada más en pantalla, que es la mitad de por qué esto funciona.
 *
 * La tonalidad está aquí porque **aquí hace falta**: las preguntas se generan con
 * los acordes de la tonalidad en la que estés, así que sin ella no hay unidad que
 * enseñar. En una barra que se despliega, no ocupando media pantalla.
 */
export function UnitScreen({ unitId }: { readonly unitId: string }) {
  const router = useRouter();
  const activeKey = useSessionStore(selectActiveKey);
  const { account, signedIn } = useAccount();
  const { progress, day, celebration, dismissCelebration, complete, miss } = useProgress();

  const found = findUnit(unitId);
  const acceso = unitAccess(progress, account.plan, unitId);
  const repasa = can(account.plan, 'repaso');

  if (found === null) {
    return (
      <Marco titulo="Esta unidad no existe">
        <p className="text-text-muted max-w-prose text-sm">
          Puede que se haya renombrado o retirado del temario. Vuelve al camino y sigue por donde
          ibas.
        </p>
      </Marco>
    );
  }

  if (acceso === 'por-plan') {
    return (
      <Marco titulo={found.unit.title}>
        <p className="text-text-muted max-w-prose text-sm">
          Es del Grado Profesional. Los cuatro cursos del Elemental son gratis y lo seguirán siendo;
          los seis del Profesional —funciones, cuatríadas, prestados, sustituciones, modos y
          cadencias— van con plan.
        </p>
        <div className="mt-4 max-w-prose">
          <PlanLock
            needed={cheapestPlanWith('grado-profesional')}
            what="El Grado Profesional"
            signedIn={signedIn}
          />
        </div>
      </Marco>
    );
  }

  if (acceso === 'por-temario') {
    return (
      <Marco titulo={found.unit.title}>
        <p className="text-text-muted max-w-prose text-sm">
          Todavía no está abierta: se abre al terminar la anterior. Si quieres empezar por aquí,
          cambia tu punto de partida en el camino y esta unidad se abre sola.
        </p>
      </Marco>
    );
  }

  // Terminada: se enseña lo ganado y se ofrece la siguiente. La celebración vive en
  // esta pantalla y no en el camino porque es el final de lo que se acaba de hacer.
  if (celebration !== null && celebration.unitId === unitId) {
    return (
      <Siguiente
        celebration={celebration}
        progress={progress}
        day={day}
        onNext={() => {
          dismissCelebration();
          const siguiente = nextAllowedUnit(progress, account.plan);
          router.push(siguiente === null ? '/aprender' : `/aprender/${siguiente}`);
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkHeader
        title={found.unit.title}
        lead={`${found.course.year}º de ${
          found.course.grade === 'elemental' ? 'Elemental' : 'Profesional'
        } · ${found.course.title}`}
        back={{ href: '/aprender', label: 'Camino' }}
        actions={<p className="text-text-muted font-mono text-xs">{found.unit.xp} XP</p>}
      />

      {/* La tonalidad, en una barra que se abre. Cerrada ocupa una línea y dice en
          qué tonalidad estás, que es lo único que hay que saber mientras contestas. */}
      <Disclosure
        className="border-border bg-surface shrink-0 border-b px-4"
        summary={
          <>
            Tonalidad:{' '}
            <span className="text-brass-bright">
              {activeKey === null ? 'sin elegir' : keyName(activeKey.tonic, activeKey.mode)}
            </span>
          </>
        }
      >
        <div className="flex flex-col items-center gap-2 pt-2 pb-4">
          <KeyPanel compact />
          <p className="text-text-muted max-w-prose text-center text-xs">
            Las preguntas se escriben con los acordes de esta tonalidad. Cámbiala y las mismas
            preguntas hablan de otros acordes.
          </p>
        </div>
      </Disclosure>

      <div className="mx-auto min-h-0 w-full max-w-2xl grow overflow-y-auto">
        {found.unit.kind === 'theory' ? (
          <TheoryUnit
            unit={found.unit}
            onDone={(flawless) => complete(unitId, flawless)}
            {...(repasa ? { onMiss: (index: number) => miss(unitId, index) } : {})}
          />
        ) : (
          <div className="p-4">
            {/* Las notas que costaron entran en la cola igual que una pregunta
                fallada. Terminar la escala sigue siendo terminarla —aquí no se
                suspende— pero lo que salió regular vuelve. */}
            <LearnPanel
              scaleId={found.unit.scaleId}
              onDone={(stumbled) => {
                if (repasa) {
                  for (const index of stumbled) {
                    miss(unitId, index);
                  }
                }
                complete(unitId, stumbled.length === 0);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * El marco de esta pantalla es el de todas —`ui/Screen`—, con la vuelta al camino
 * arriba. Antes era un componente local, y el repaso tenía otro casi igual: dos
 * copias del mismo marco que ya se habían separado en el ancho y en el hueco bajo
 * el título.
 */
function Marco({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Screen title={titulo} back={{ href: '/aprender', label: 'Camino' }} ancho="lectura">
      {children}
    </Screen>
  );
}

/** La pantalla de después, centrada y sin nada alrededor. */
function Siguiente({
  celebration,
  progress,
  day,
  onNext,
}: {
  readonly celebration: Celebration;
  readonly progress: Parameters<typeof UnitDone>[0]['progress'];
  readonly day: string | null;
  readonly onNext: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <UnitDone
        celebration={celebration}
        progress={progress}
        day={day}
        nextLabel="Seguir"
        onNext={onNext}
      />
      <p className="pb-6 text-center">
        <Link href="/aprender" className="text-text-muted hover:text-text font-mono text-sm">
          Volver al camino
        </Link>
      </p>
    </div>
  );
}
