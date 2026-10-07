'use client';

import { useRouter } from 'next/navigation';

import { can, cheapestPlanWith } from '@core/billing';
import { dueReview, keyName } from '@core/music';
import {
  ComoFuncionaElRepaso,
  HUECO_DEL_TUTOR,
  LaColaDeHoy,
  ReviewSession,
  UnitDone,
  useProgress,
} from '@features/learn';
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

  // Cómo funciona y qué vuelve hoy: con plan y sin él, es lo que va al lado.
  const loQueVuelve = <LaColaDeHoy progress={progress} day={day} />;

  if (!can(account.plan, 'repaso')) {
    return (
      <Screen
        title="El repaso va con plan"
        lead="Lo que fallas vuelve, escrito en la tonalidad de hoy, hasta que lo aciertas."
        back={{ href: '/aprender', label: 'Camino' }}
        ancho="lectura"
        aside={
          <>
            {loQueVuelve}
            <ComoFuncionaElRepaso />
          </>
        }
      >
        {/*
          **El candado a la izquierda y cómo funciona al lado** (`aside` de
          `ui/Screen`). Eran tres renglones y el candado en una columna, y a 1920
          px la pantalla usaba el 34 % del ancho: quien llegaba aquí desde el
          camino veía que el repaso era de pago y no qué era.

          **Y decía algo falso.** «Lo que fallas se apunta de todas formas» no es
          lo que hace la unidad: sin plan no apunta nada (`UnitScreen`, y lo
          fijan sus pruebas). Ahora dice lo que pasa. Lo que sí puede haber es
          una cola de antes —de cuando hubo plan, o traída de la cuenta—, y esa
          se cuenta.
        */}
        {/* Media pantalla como mucho, desde `md`: con `lectura` lo principal mide lo
            que mida su contenido, y un párrafo de prosa mide 44 rem. A 769 px eso
            dejaba al lado una columna de doscientos y las tarjetas en una palabra
            por renglón. */}
        <div className="flex flex-col gap-4 md:max-w-[calc(50vw-3rem)]">
          <p className="text-text-muted max-w-prose text-sm">
            Con un plan, cada pregunta que fallas en una unidad se apunta y vuelve aquí, generada
            otra vez en la tonalidad en la que estés tocando. Sin plan, fallar se explica igual,
            pero la pregunta no se apunta.
          </p>

          {esperando > 0 && (
            <p className="text-text max-w-prose">
              Aun así,{' '}
              <span className="text-brass-bright font-mono">
                {esperando === 1 ? 'hay 1 pregunta' : `hay ${esperando} preguntas`}
              </span>{' '}
              esperando en tu cola de antes.
            </p>
          )}
          <div className="max-w-prose">
            <PlanLock
              needed={cheapestPlanWith('repaso')}
              what="El repaso de lo que fallaste"
              signedIn={signedIn}
            />
          </div>
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
          <p className="text-text-muted text-xs">
            {activeKey === null ? 'sin tonalidad' : keyName(activeKey.tonic, activeKey.mode)}
          </p>
        }
      />

      {/* Sin tonalidad, la rueda arriba en una franja. **Solo hasta `lg`**: desde
          ahí va en la columna de al lado, a la vista mientras se contesta. */}
      {activeKey === null && (
        <div className="border-border flex shrink-0 flex-col items-center gap-2 border-b p-3 lg:hidden">
          <KeyPanel compact />
        </div>
      )}

      {/*
        **La pregunta en su columna y, desde `lg`, lo que la acompaña al lado.**

        Era la columna de la unidad, 672 px centrados, con el resto de la
        pantalla en negro. La pregunta se queda igual de estrecha —se lee de una
        pasada—, y al lado va lo que se consulta mientras se contesta: en qué
        tonalidad, qué vuelve hoy y cómo sale una pregunta de la cola. Es un
        panel con su borde y su propio desplazamiento, como las áreas de componer,
        porque esto es un taller y no un documento.

        En un teléfono no hay lado: la pregunta es lo único que cabe y lo único a
        lo que se viene.
      */}
      <div className="flex min-h-0 grow">
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

        {/* Con el hueco del muñeco al pie, como la columna de la pregunta: flota
            encima de las dos y puede estar en este lado. */}
        <aside
          aria-label="Lo que acompaña al repaso"
          className={`border-border hidden min-h-0 w-[clamp(20rem,36%,40rem)] shrink-0 flex-col gap-8 overflow-y-auto border-l p-4 lg:flex ${HUECO_DEL_TUTOR}`}
        >
          <section aria-label="Tonalidad del repaso" className="flex flex-col gap-3">
            <h2 className="rotulo">Tonalidad</h2>
            <div className="w-full max-w-sm">
              <KeyPanel compact />
            </div>
            <p className="text-text-muted max-w-prose text-sm">
              {activeKey === null
                ? 'Elige una y las preguntas se escriben con sus acordes.'
                : 'Cámbiala y las mismas preguntas hablan de otros acordes.'}
            </p>
          </section>
          {loQueVuelve}
          <ComoFuncionaElRepaso />
        </aside>
      </div>
    </div>
  );
}
