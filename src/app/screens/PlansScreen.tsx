'use client';

import Link from 'next/link';

import { monthlyAiRequests, PAID_PLANS, planOf } from '@core/billing';
import { PlanCards } from '@features/account';
import { enUnaFrase, loQueNoTrae, loQueSuma } from '@features/account/lo-que-va-con-plan';
import { useAccount } from '@state/account';
import { Screen, Section } from '@ui/Screen';

/**
 * La pantalla de planes: tres de pago y lo que hay sin pagar.
 *
 * Pantalla propia y no un bloque dentro de la cuenta. Son dos preguntas
 * distintas —«¿quién soy?» y «¿qué compro?»— y quien llega aquí desde un candado
 * viene a la segunda.
 *
 * Lo primero que se lee es lo que **no** cuesta dinero, y es a propósito: en esta
 * aplicación casi todo pasa en el navegador de quien toca y servirlo no cuesta
 * nada. Empezar por la lista de precios daría a entender que la guitarra está de
 * pago, y no lo está.
 */
export function PlansScreen() {
  const { account, signedIn } = useAccount();
  const actual = planOf(account.plan);

  return (
    <Screen title="Planes">
      {/*
        **Lo que se lee, en dos columnas; lo que se compara, a todo lo ancho.**

        Era una sola columna de 65 caracteres pegada a la izquierda de una caja de
        1280: a 1920 la pantalla usaba el 61 % del ancho, y los cuatro párrafos y
        las tres dudas se apilaban uno tras otro con el resto en negro. Ahora lo
        gratis y lo de pago se leen uno al lado del otro —son la misma pregunta,
        «¿qué pago?», contestada por los dos lados—, las tarjetas se comparan en
        su fila y las dudas se reparten en columnas. Cada párrafo sigue con su
        `max-w-prose`: se usa el ancho componiendo, no alargando renglones.
      */}
      <div className="grid gap-x-[clamp(2rem,4vw,5rem)] gap-y-10 md:grid-cols-2">
        <div>
          <p className="text-text-muted max-w-prose">
            El afinador, la rueda, el mástil, el metrónomo, los acordes, el camino de progresiones y
            grabar lo que tocas son{' '}
            <strong className="text-text">gratis y lo van a seguir siendo</strong>: pasan enteros en
            tu navegador, así que servirlos no nos cuesta nada.
          </p>
          {/* Sin enumerar lo que traen: lo enumeraba, se dejaba el repaso y las
              canciones, y la tarjeta de al lado decía otra cosa. Lo dicen ellas. */}
          <p className="text-text-muted mt-2 max-w-prose">
            Lo que cuesta dinero es la IA —cada pregunta al profesor y cada tanda de salidas es una
            llamada a un modelo que se paga—. De eso van estos tres planes, que traen además lo que
            no entra gratis: cada tarjeta dice qué.
          </p>
        </div>

        <Section title="Y sin pagar nada">
          {/* Lo que no entra sale de la tabla de permisos: escrito a mano decía
              «menos la IA y el Grado Profesional», y el repaso y guardar las
              canciones también van con plan. */}
          <p className="text-text-muted max-w-prose text-sm">
            Sin plan tienes los cuatro cursos del Elemental, con sus preguntas generadas en la
            tonalidad que estés tocando, y {monthlyAiRequests('gratis', account.aiModel)} preguntas
            al profesor al mes para que puedas juzgar si merece la pena. Lo que no entra es{' '}
            {enUnaFrase(loQueNoTrae('gratis'))}. Hace falta una cuenta para usar la IA —es la única
            forma de contar el gasto por persona— y el avance se guarda en este navegador.
          </p>
          <p className="text-text-muted mt-2 max-w-prose text-sm">
            {signedIn ? (
              <>
                Ahora mismo tienes el plan <span className="text-text">{actual.name}</span>.{' '}
                <Link href="/cuenta" className="enlace">
                  Tu cuenta
                </Link>
                .
              </>
            ) : (
              <>
                No has entrado, así que estás en el plan gratis.{' '}
                <Link href="/registro" className="enlace">
                  Crear una cuenta
                </Link>
                .
              </>
            )}
          </p>
        </Section>
      </div>

      {/* Las tarjetas a todo lo ancho, y desde 1792 px con las dudas al lado: a
          esa anchura tres tarjetas solas salían de ochocientos píxeles cada una,
          con el «nuevo» a medio metro de lo que marca. */}
      <div className="grid gap-x-[clamp(2rem,4vw,5rem)] gap-y-10 min-[112rem]:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)]">
        <Section title="Los tres planes de pago">
          <PlanCards />
        </Section>

        {/*
        Las dudas que frenan, contestadas aquí y no en otra pantalla.

        Las tres salen de lo que el proyecto ya tiene decidido y escrito
        —`docs/CUENTAS-Y-PLANES.md`—, no de lo que sonaría bien: **una respuesta
        que no se puede comprobar es peor que no contestar**, porque se descubre
        después de pagar.
      */}
        <Section title="Dudas">
          {/* Cada pregunta con su respuesta en un `div`, que HTML deja meter en un
            `dl` justo para esto: sin él la rejilla repartía las preguntas en una
            columna y las respuestas en otra. Tres columnas desde `md`, y otra vez
            una cuando van al lado de las tarjetas. */}
          <dl className="grid gap-x-8 gap-y-5 text-sm md:grid-cols-3 min-[112rem]:grid-cols-1">
            <div className="max-w-prose">
              <dt className="text-text">¿Se sube lo que toco?</dt>
              <dd className="text-text-muted mt-1">
                No. El sonido se analiza en tu propio navegador y no sale del equipo. Al modelo solo
                le llegan símbolos: los grados de tus acordes y los nombres de las notas.
              </dd>
            </div>

            <div className="max-w-prose">
              <dt className="text-text">¿Y si me quedo sin preguntas?</dt>
              <dd className="text-text-muted mt-1">
                El cupo se cuenta en preguntas al profesor, y una salida gasta varias porque cuesta
                más servirla: cada tarjeta dice cuántas. Hay dos topes y el mensaje dice cuál se ha
                agotado. El del día se pasa mañana; el del mes, subiendo de plan o esperando al día
                uno. Lo demás —el afinador, el mástil, el lienzo, grabar— sigue funcionando igual,
                porque no cuesta nada servirlo.
              </dd>
            </div>

            <div className="max-w-prose">
              <dt className="text-text">¿Hace falta pagar para probarlo?</dt>
              <dd className="text-text-muted mt-1">
                No. Sin cuenta tienes todo lo que pasa en tu navegador y los cuatro cursos del
                Elemental, y con una cuenta gratis, unas preguntas al profesor para juzgar si merece
                la pena. Desde el plan {PAID_PLANS[0]!.name} se suman{' '}
                {enUnaFrase(loQueSuma(PAID_PLANS[0]!.id))}.
              </dd>
            </div>
          </dl>
        </Section>
      </div>
    </Screen>
  );
}
