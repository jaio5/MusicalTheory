'use client';

import {
  can,
  cheapestPlanWith,
  dailyAiRequests,
  gastoDeUnaSalida,
  monthlyAiRequests,
  planOf,
} from '@core/billing';
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

  // Con relieve y con el relleno justo: cerrada es **una línea**, y una caja de
  // cuatro de relleno alrededor de un renglón deja ochenta píxeles de hueco que no
  // dicen nada. Abierta, el relleno lo pone lo de dentro.
  const tonalidad = (
    <section
      aria-label="Tonalidad"
      className="superficie px-4 py-1 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1"
    >
      <Disclosure
        summary={
          <>
            Explicando en:{' '}
            <span className="text-brass-bright">
              {activeKey === null
                ? 'ninguna tonalidad todavía'
                : keyName(activeKey.tonic, activeKey.mode)}
            </span>
          </>
        }
      >
        {/* **En fila en cuanto hay ancho** (`docs/ESTILO.md`) y otra vez en
            columna desde `lg`, que es cuando va en la columna estrecha de al lado
            del formulario: ahí la rueda ocupa el ancho y la frase va debajo. */}
        <div className="flex flex-col items-center gap-4 pt-3 sm:flex-row sm:gap-6 lg:flex-col lg:items-start lg:gap-4">
          <div className="w-full max-w-sm shrink-0">
            <KeyPanel compact />
          </div>
          <p className="text-text-muted max-w-prose min-w-0 text-sm">
            {activeKey === null
              ? 'Elige una en la rueda, o toca unas notas sueltas con el micro abierto y se detecta sola.'
              : 'Cámbiala y la misma pregunta se contesta con otros acordes.'}
          </p>
        </div>
      </Disclosure>
    </section>
  );

  return (
    <Screen
      title="Profesor"
      lead="Pregunta lo que quieras de teoría: responde en la tonalidad que tengas puesta y con sus acordes, en tres frases."
    >
      {/*
        **La pregunta primero, y la tonalidad a un lado o plegada.**

        Mandaba la rueda: era lo primero de la pantalla, y a 390 px la pregunta —a
        lo que se viene— caía bajo el pliegue. Ahora la pregunta va delante, y la
        tonalidad es una línea («Explicando en: Do mayor») que se abre si hace
        falta cambiarla; desde `lg` es una columna al lado del formulario, donde no
        le quita altura a nadie.

        Tampoco hace falta abrirla para empezar: sin tonalidad, el formulario
        ofrece las cuatro más comunes ahí mismo (`features/learn/Teacher`), así que
        la rueda es para quien quiere otra..
      */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Section title="La pregunta">
            <Teacher />
          </Section>
        </div>
        {tonalidad}
      </div>

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
        Tu plan {plan.name} incluye {monthlyAiRequests(plan.id, account.aiModel)} preguntas al
        profesor al mes —hasta {dailyAiRequests(plan.id, account.aiModel)} en un mismo día—
        {can(plan.id, 'versiones') && (
          <>, y las salidas de componer salen de ahí: {gastoDeUnaSalida(account.aiModel)}</>
        )}
        . A la IA solo viajan símbolos: la tonalidad, la escala y lo que escribas. Nada de audio.
      </p>
    </Screen>
  );
}
