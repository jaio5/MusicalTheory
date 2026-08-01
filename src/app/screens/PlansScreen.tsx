'use client';

import Link from 'next/link';

import { monthlyAiRequests, planOf } from '@core/billing';
import { PlanCards } from '@features/account';
import { useAccount } from '@state/account';

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
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4 md:p-8">
        <header>
          <h1 className="text-text text-3xl">Planes</h1>
          <p className="text-text-muted mt-3 max-w-prose">
            El afinador, la rueda, el mástil, el metrónomo, los acordes, el camino de progresiones y
            grabarte tocando son{' '}
            <strong className="text-text">gratis y lo van a seguir siendo</strong>: pasan enteros en
            tu navegador, así que servirlos no nos cuesta nada.
          </p>
          <p className="text-text-muted mt-2 max-w-prose">
            Lo que cuesta dinero es la IA —cada pregunta al profesor y cada tanda de ideas es una
            llamada a un modelo que se paga— y el temario del Grado Profesional. De eso van estos
            tres planes.
          </p>
        </header>

        <section aria-label="Los tres planes de pago">
          <PlanCards />
        </section>

        <section aria-label="Sin pagar nada">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Y sin pagar nada
          </h2>
          <p className="text-text-muted mt-2 max-w-prose text-sm">
            Sin plan tienes la aplicación entera menos la IA y el Grado Profesional: los cuatro
            cursos del Elemental, con sus preguntas generadas en la tonalidad que estés tocando, y{' '}
            {monthlyAiRequests('gratis', account.aiModel)} preguntas al profesor al mes para que
            puedas juzgar si merece la pena. Hace falta una cuenta para usar la IA —es la única
            forma de contar el gasto por persona— y el avance se guarda en este navegador.
          </p>
          <p className="text-text-muted mt-2 max-w-prose text-sm">
            {signedIn ? (
              <>
                Ahora mismo tienes el plan <span className="text-text">{actual.name}</span>.{' '}
                <Link href="/cuenta" className="text-brass-bright hover:text-brass underline">
                  Tu cuenta
                </Link>
                .
              </>
            ) : (
              <>
                No has entrado, así que estás en el plan gratis.{' '}
                <Link href="/registro" className="text-brass-bright hover:text-brass underline">
                  Crear una cuenta
                </Link>
                .
              </>
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
