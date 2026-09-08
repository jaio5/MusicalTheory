'use client';

import { can, cheapestPlanWith, dailyAiRequests, monthlyAiRequests, planOf } from '@core/billing';
import { keyName } from '@core/music';
import { Teacher } from '@features/learn';
import { KeyPanel } from '@features/wheel';
import { Disclosure } from '@ui/Disclosure';
import { useAccount } from '@state/account';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { PlanLock } from '@ui/PlanLock';
import { Screen, Section } from '@ui/Screen';

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
    <Screen
      title="Profesor"
      lead="Pregunta lo que quieras de teoría: responde en la tonalidad que tengas puesta y con sus acordes, en tres frases."
    >
      {/*
        La rueda está abierta mientras no haya tonalidad y plegada en cuanto la
        hay.

        Sin tonalidad el profesor no contesta, así que la rueda es lo que hay que
        hacer y tiene que estar delante. Con tonalidad puesta se elige una vez y
        no se vuelve: abierta se quedaba ocupando trescientos veinte píxeles de
        alto y media pantalla de ancho vacía a su derecha, empujando la pregunta
        —que es a lo que se viene— por debajo del pliegue.

        Es el mismo patrón que usan la unidad y el afinador, y por lo mismo.
      */}
      {/* Con relieve y con el relleno justo: cerrada es **una línea**, y una caja
          de cuatro de relleno alrededor de un renglón deja ochenta píxeles de
          hueco que no dicen nada. Abierta, el relleno lo pone lo de dentro. */}
      <section aria-label="Tonalidad" className="superficie px-4 py-1">
        <Disclosure
          abierto={activeKey === null}
          summary={
            <>
              Está explicando en{' '}
              <span className="text-brass-bright">
                {activeKey === null
                  ? 'ninguna tonalidad todavía'
                  : keyName(activeKey.tonic, activeKey.mode)}
              </span>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <KeyPanel compact />
            <p className="text-text-muted max-w-prose min-w-0 text-sm">
              {activeKey === null
                ? 'Elígela en la rueda, o toca unas notas sueltas con el micro abierto y se detecta sola.'
                : 'Cámbiala y la misma pregunta se contesta con otros acordes.'}
            </p>
          </div>
        </Disclosure>
      </section>

      <Section title="La pregunta">
        <Teacher />
      </Section>

      {/* El cupo es de todos los planes, así que aquí no hay candado que enseñar
            salvo el del profesor que sabe por dónde vas, que es lo que distingue a
            Pro. */}
      {!can(account.plan, 'profesor-con-progreso') && (
        <Section title="Con el plan Pro">
          {/* Aquí no es compacto: es el contenido entero de un apartado, y su
              enlace es lo único que se puede hacer en él. Compacto es para una
              fila estrecha metida dentro de otra cosa, como la del camino. */}
          <PlanLock
            needed={cheapestPlanWith('profesor-con-progreso')}
            what="Un profesor que sabe qué unidades llevas hechas"
            signedIn={signedIn}
          />
        </Section>
      )}

      <p className="text-text-muted text-xs">
        Tu plan {plan.name} incluye {monthlyAiRequests(plan.id, account.aiModel)} peticiones a la IA
        al mes —hasta {dailyAiRequests(plan.id, account.aiModel)} en un mismo día—, contando las
        preguntas de aquí y las ideas de componer. A la IA solo viajan símbolos: la tonalidad, la
        escala y lo que escribas. Nada de audio.
      </p>
    </Screen>
  );
}
