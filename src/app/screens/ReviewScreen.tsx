'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { can, cheapestPlanWith } from '@core/billing';
import { keyName } from '@core/music';
import { ReviewSession, UnitDone, useProgress } from '@features/learn';
import { KeyPanel } from '@features/wheel';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { PlanLock } from '@ui/PlanLock';

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

  if (!can(account.plan, 'repaso')) {
    return (
      <Marco>
        <h1 className="text-text text-2xl">El repaso va con plan</h1>
        <p className="text-text-muted mt-3 max-w-prose text-sm">
          Lo que fallas se apunta de todas formas: el día que tengas plan, estará esperándote. Lo
          que hace el repaso es traerte esas preguntas de vuelta, generadas otra vez en la tonalidad
          en la que estés tocando.
        </p>
        <div className="mt-4 max-w-prose">
          <PlanLock
            needed={cheapestPlanWith('repaso')}
            what="El repaso de lo que fallaste"
            signedIn={signedIn}
          />
        </div>
      </Marco>
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
      <header className="border-border bg-surface flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2">
        <Link
          href="/aprender"
          className="text-text-muted hover:text-text shrink-0 font-mono text-sm"
        >
          ← Camino
        </Link>
        <h1 className="text-text grow text-lg">Repaso</h1>
        <p className="text-text-muted shrink-0 font-mono text-xs">
          {activeKey === null ? 'sin tonalidad' : keyName(activeKey.tonic, activeKey.mode)}
        </p>
      </header>

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

function Marco({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Link href="/aprender" className="text-text-muted hover:text-text font-mono text-sm">
          ← Camino
        </Link>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
