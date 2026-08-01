'use client';

import Link from 'next/link';

import { displayName, monthlyAiRequests } from '@core/billing';
import { AccessForm } from '@features/account';
import { useAccount } from '@state/account';

/**
 * Crear tu cuenta.
 *
 * Es a donde lleva el avatar de quien todavía no tiene ninguna. Pantalla propia y
 * no un panel dentro de la cuenta, porque quien llega aquí no viene a mirar nada:
 * viene a rellenar tres campos, y todo lo que no sea el formulario le estorba.
 *
 * Lo que se cuenta al lado es **por qué merece la pena**, y en ese orden: llevarte
 * el avance a otro aparato, que la IA necesita saber de quién es el gasto, y que
 * sin cuenta la aplicación sigue funcionando entera. Lo último es lo que evita que
 * esto parezca un muro: no lo es, y decirlo aquí cuesta una línea.
 *
 * Si ya has entrado no se pinta el formulario. Un formulario de registro delante
 * de quien ya tiene la sesión abierta es una invitación a crear una segunda cuenta
 * sin querer y perder el avance de la primera.
 */
export function RegisterScreen() {
  const { account, accounts, signedIn } = useAccount();

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 p-4 md:p-8">
        <header>
          <h1 className="text-text text-3xl">
            {signedIn ? 'Ya tienes cuenta' : 'Crear tu cuenta'}
          </h1>
          <p className="text-text-muted mt-3 max-w-prose">
            {signedIn
              ? `Estás dentro como ${displayName(account)}, así que no hay nada que crear aquí.`
              : 'Con cuenta, tu avance deja de vivir en este navegador y te lo llevas al móvil, al portátil o a donde estudies.'}
          </p>
        </header>

        {signedIn ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/cuenta"
              className="bg-brass text-background hover:bg-brass-bright inline-flex items-center justify-center rounded-md px-5 py-2.5 text-base"
            >
              Tu cuenta
            </Link>
            <Link
              href="/aprender"
              className="border-border text-text hover:border-brass-dim inline-flex items-center justify-center rounded-md border px-5 py-2.5 text-base"
            >
              Ir al camino
            </Link>
          </div>
        ) : (
          <section aria-label="Crear la cuenta">
            <AccessForm inicial="crear" />
          </section>
        )}

        {accounts && !signedIn && (
          <section aria-label="Para qué sirve la cuenta">
            <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
              Qué te da
            </h2>
            <ul className="text-text-muted mt-3 flex list-disc flex-col gap-2 pl-5 text-sm">
              <li>
                <strong className="text-text">Tu avance, en tu cuenta.</strong> Las unidades, el XP,
                la racha y lo que fallaste dejan de depender de este navegador, y al entrar en otro
                aparato se juntan quedándose lo mejor de cada lado.
              </li>
              <li>
                <strong className="text-text">La IA.</strong> El profesor y las ideas cuestan dinero
                por pregunta, así que hace falta saber de quién es el gasto. Sin pagar nada son{' '}
                {monthlyAiRequests('gratis', account.aiModel)} preguntas al profesor al mes.
              </li>
              <li>
                <strong className="text-text">Un plan, si lo quieres.</strong> Los{' '}
                <Link href="/planes" className="text-brass-bright hover:text-brass underline">
                  tres planes
                </Link>{' '}
                abren el Grado Profesional, el repaso y más IA. No hace falta ninguno para empezar.
              </li>
            </ul>
            <p className="text-text-muted mt-4 max-w-prose text-sm">
              Sin cuenta la aplicación funciona <strong className="text-text">entera</strong> menos
              la IA: el afinador, la rueda, el mástil, el metrónomo, componer, grabarte y los cuatro
              cursos del Grado Elemental. El avance se queda guardado en este navegador.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
