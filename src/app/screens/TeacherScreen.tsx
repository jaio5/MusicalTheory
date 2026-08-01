'use client';

import { can, cheapestPlanWith, dailyAiRequests, monthlyAiRequests, planOf } from '@core/billing';
import { keyName } from '@core/music';
import { Teacher } from '@features/learn';
import { KeyPanel } from '@features/wheel';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { PlanLock } from '@ui/PlanLock';

/**
 * El profesor, en su propia pantalla.
 *
 * Estaba en una columna de la pantalla de aprender, y ahí tenía dos problemas: el
 * sitio para escribir era estrecho —se pregunta escribiendo, y a nadie le apetece
 * escribir en una caja de doscientos píxeles— y solo se podía preguntar mientras se
 * estudiaba, cuando la mitad de las dudas salen componiendo.
 *
 * Aquí la tonalidad está a la vista y grande, porque es lo que cambia la respuesta:
 * el profesor contesta con los acordes de la tonalidad que tengas puesta, no con un
 * ejemplo en Do mayor.
 */
export function TeacherScreen() {
  const activeKey = useSessionStore(selectActiveKey);
  const { account, signedIn } = useAccount();
  const plan = planOf(account.plan);

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-8">
        <header>
          <h1 className="text-text text-3xl">Profesor</h1>
          <p className="text-text-muted mt-2 max-w-prose">
            Pregunta lo que quieras de teoría. Responde en la tonalidad que tengas puesta y con sus
            acordes, en tres frases y sin darte una lección que no has pedido.
          </p>
        </header>

        <section
          aria-label="Tonalidad"
          className="border-border flex flex-wrap items-center gap-4 border p-4"
        >
          <KeyPanel compact />
          <div className="min-w-0">
            <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
              Está explicando en
            </p>
            <p className="text-brass-bright text-lg">
              {activeKey === null
                ? 'ninguna tonalidad todavía'
                : keyName(activeKey.tonic, activeKey.mode)}
            </p>
            <p className="text-text-muted mt-1 text-xs">
              {activeKey === null
                ? 'Elige una en la rueda, o toca unos compases con el micro abierto y se detecta sola.'
                : 'Cámbiala y la misma pregunta se contesta con otros acordes.'}
            </p>
          </div>
        </section>

        <section aria-label="La pregunta">
          <Teacher />
        </section>

        {/* El cupo es de todos los planes, así que aquí no hay candado que enseñar
            salvo el del profesor que sabe por dónde vas, que es lo que distingue a
            Pro. */}
        {!can(account.plan, 'profesor-con-progreso') && (
          <section aria-label="Con el plan Pro">
            <PlanLock
              needed={cheapestPlanWith('profesor-con-progreso')}
              what="Un profesor que sabe qué unidades llevas hechas"
              signedIn={signedIn}
              compact
            />
          </section>
        )}

        <p className="text-text-muted text-xs">
          Tu plan {plan.name} incluye {monthlyAiRequests(plan.id, account.aiModel)} peticiones a la
          IA al mes —hasta {dailyAiRequests(plan.id, account.aiModel)} en un mismo día—, contando
          las preguntas de aquí y las ideas de componer. A la IA solo viajan símbolos: la tonalidad,
          la escala y lo que escribas. Ni audio, ni vídeo.
        </p>
      </div>
    </div>
  );
}
