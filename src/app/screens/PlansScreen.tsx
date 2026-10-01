'use client';

import Link from 'next/link';

import { monthlyAiRequests, planOf } from '@core/billing';
import { PlanCards } from '@features/account';
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
    <Screen title="Planes" ancho="ancha">
      <div>
        <p className="text-text-muted max-w-prose">
          El afinador, la rueda, el mástil, el metrónomo, los acordes, el camino de progresiones y
          grabar lo que tocas son{' '}
          <strong className="text-text">gratis y lo van a seguir siendo</strong>: pasan enteros en
          tu navegador, así que servirlos no nos cuesta nada.
        </p>
        <p className="text-text-muted mt-2 max-w-prose">
          Lo que cuesta dinero es la IA —cada pregunta al profesor y cada tanda de salidas es una
          llamada a un modelo que se paga— y el temario del Grado Profesional. De eso van estos tres
          planes.
        </p>
      </div>

      <Section title="Los tres planes de pago">
        <PlanCards />
      </Section>

      <Section title="Y sin pagar nada">
        <p className="text-text-muted max-w-prose text-sm">
          Sin plan tienes la aplicación entera menos la IA y el Grado Profesional: los cuatro cursos
          del Elemental, con sus preguntas generadas en la tonalidad que estés tocando, y{' '}
          {monthlyAiRequests('gratis', account.aiModel)} preguntas al profesor al mes para que
          puedas juzgar si merece la pena. Hace falta una cuenta para usar la IA —es la única forma
          de contar el gasto por persona— y el avance se guarda en este navegador.
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

      {/*
        Las dudas que frenan, contestadas aquí y no en otra pantalla.

        Las tres salen de lo que el proyecto ya tiene decidido y escrito
        —`docs/CUENTAS-Y-PLANES.md`—, no de lo que sonaría bien: **una respuesta
        que no se puede comprobar es peor que no contestar**, porque se descubre
        después de pagar.
      */}
      <Section title="Dudas">
        <dl className="max-w-prose text-sm">
          <dt className="text-text">¿Se sube lo que toco?</dt>
          <dd className="text-text-muted mt-1 mb-4">
            No. El sonido se analiza en tu propio navegador y no sale del equipo. Al modelo solo le
            llegan símbolos: los grados de tus acordes y los nombres de las notas.
          </dd>

          <dt className="text-text">¿Y si me quedo sin preguntas?</dt>
          <dd className="text-text-muted mt-1 mb-4">
            El cupo se cuenta en preguntas al profesor, y una salida gasta varias porque cuesta más
            servirla: cada tarjeta dice cuántas. Hay dos topes y el mensaje dice cuál se ha agotado.
            El del día se pasa mañana; el del mes, subiendo de plan o esperando al día uno. Lo demás
            —el afinador, el mástil, el lienzo, grabar— sigue funcionando igual, porque no cuesta
            nada servirlo.
          </dd>

          <dt className="text-text">¿Hace falta pagar para probarlo?</dt>
          <dd className="text-text-muted mt-1">
            No. Sin cuenta tienes la aplicación entera menos la IA y el Grado Profesional, y con una
            cuenta gratis, unas preguntas al profesor para juzgar si merece la pena.
          </dd>
        </dl>
      </Section>
    </Screen>
  );
}
