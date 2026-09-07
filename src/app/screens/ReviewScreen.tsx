'use client';

import { useRouter } from 'next/navigation';

import { can, cheapestPlanWith } from '@core/billing';
import { dueReview, keyName } from '@core/music';
import { ReviewSession, UnitDone, useProgress } from '@features/learn';
import { KeyPanel } from '@features/wheel';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { PlanLock } from '@ui/PlanLock';
import { Screen, WorkHeader } from '@ui/Screen';

/**
 * El repaso, en su propia pantalla.
 *
 * Propia porque es una sesión con principio y final, como una unidad: la cola se
 * congela al entrar, se contesta y se sale. Metida en una pestaña del camino se
 * olvidaba, y era justo lo que no podía pasar con lo que uno ya ha fallado una vez.
 */
export function ReviewScreen() {
  const router = useRouter();
  const activeKey = useSessionStore(selectActiveKey);
  const { account, signedIn } = useAccount();
  const { progress, day, celebration, dismissCelebration, hit, miss, finishReview } = useProgress();
  // `day` es nulo hasta que el avance se ha leído del navegador: sin él no hay
  // día con el que comparar y la cola no se puede contar todavía.
  const esperando = day === null ? 0 : dueReview(progress.review, day).length;

  if (!can(account.plan, 'repaso')) {
    return (
      <Screen
        title="El repaso va con plan"
        back={{ href: '/aprender', label: 'Camino' }}
        ancho="lectura"
      >
        <p className="text-text-muted max-w-prose text-sm">
          Lo que fallas se apunta de todas formas: el día que tengas plan, estará esperándote. Lo
          que hace el repaso es traerte esas preguntas de vuelta, generadas otra vez en la tonalidad
          en la que estés tocando.
        </p>

        {/* Cuántas hay esperando. «Se apunta de todas formas» era una promesa
            abstracta; el número la hace comprobable, y es un dato que ya estaba
            calculado y no se enseñaba en ninguna parte. */}
        {esperando > 0 && (
          <p className="text-text mt-3 max-w-prose">
            Ahora mismo{' '}
            <span className="text-brass-bright font-mono">
              {esperando === 1 ? 'hay 1 pregunta' : `hay ${esperando} preguntas`}
            </span>{' '}
            esperando en tu cola.
          </p>
        )}
        <div className="mt-4 max-w-prose">
          <PlanLock
            needed={cheapestPlanWith('repaso')}
            what="El repaso de lo que fallaste"
            signedIn={signedIn}
          />
        </div>
      </Screen>
    );
  }

  if (celebration !== null && celebration.unitId === 'repaso') {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <UnitDone
          celebration={celebration}
          progress={progress}
          day={day}
          nextLabel="Volver al camino"
          onNext={() => {
            dismissCelebration();
            router.push('/aprender');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkHeader
        title="Repaso"
        lead="Lo que fallaste, otra vez y en la tonalidad de hoy."
        back={{ href: '/aprender', label: 'Camino' }}
        actions={
          <p className="text-text-muted font-mono text-xs">
            {activeKey === null ? 'sin tonalidad' : keyName(activeKey.tonic, activeKey.mode)}
          </p>
        }
      />

      {activeKey === null && (
        <div className="border-border flex shrink-0 flex-col items-center gap-2 border-b p-3">
          <KeyPanel compact />
        </div>
      )}

      <div className="mx-auto min-h-0 w-full max-w-2xl grow overflow-y-auto">
        {day === null ? (
          // El día se lee después de pintar, igual que el avance. Un instante.
          <p className="text-text-muted p-4 text-sm">Un momento...</p>
        ) : (
          <ReviewSession
            progress={progress}
            day={day}
            onHit={hit}
            onMiss={miss}
            onDone={finishReview}
            onLeave={() => router.push('/aprender')}
          />
        )}
      </div>
    </div>
  );
}
