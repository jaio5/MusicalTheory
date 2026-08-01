'use client';

import Link from 'next/link';

import { monthlyAiRequests, planOf, priceLabel } from '@core/billing';
import { AccessForm, SignOutButton } from '@features/account';
import { useAccount } from '@state/account';

/**
 * Tu cuenta: quién eres, qué plan tienes y qué se guarda de ti.
 *
 * Los precios ya no están aquí. Eran dos preguntas metidas en una pantalla —«¿quién
 * soy?» y «¿qué compro?»— y quien entraba a cambiar la contraseña se encontraba una
 * lista de precios. Los planes viven en `/planes`, y aquí solo se dice cuál tienes y
 * se enlaza.
 */
export function AccountScreen() {
  const { account, accounts, signedIn } = useAccount();
  const plan = planOf(account.plan);

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 p-4 md:p-8">
        <header>
          <h1 className="text-text text-3xl">Tu cuenta</h1>
          <p className="text-text-muted mt-2 text-sm">
            La cuenta sirve para dos cosas: llevarte el avance a otro aparato y tener un plan. Sin
            ella la aplicación funciona igual y el avance se queda en este navegador.
          </p>
        </header>

        <section aria-label="Tu sesión">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
            {signedIn ? 'Estás dentro' : 'Entrar'}
          </h2>

          {signedIn ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-text text-sm">
                Como <span className="font-mono">{account.email}</span>.
              </p>
              <p className="text-text-muted max-w-prose text-xs">
                Al salir no se borra nada: el avance de este navegador se queda donde está, y la
                próxima vez que entres se junta con el de tu cuenta quedándose lo mejor de cada uno.
              </p>
              <div className="w-fit">
                <SignOutButton />
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <AccessForm />
            </div>
          )}
        </section>

        <section aria-label="Tu plan">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">Tu plan</h2>

          <div className="border-border mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border p-4">
            <p className="text-brass-bright text-xl">{plan.name}</p>
            <p className="text-text-muted font-mono text-sm">{priceLabel(plan.id)}</p>
            <p className="text-text-muted ml-auto font-mono text-xs">
              {account.aiLeftMonth === null
                ? `${monthlyAiRequests(plan.id, account.aiModel)} peticiones a la IA al mes`
                : `${account.aiLeftMonth} de ${monthlyAiRequests(plan.id, account.aiModel)} peticiones a la IA este mes`}
            </p>
          </div>

          <p className="text-text-muted mt-2 text-sm">{plan.claim}</p>

          <div className="mt-3">
            <Link
              href="/planes"
              className="border-border text-text hover:border-brass-dim inline-flex items-center justify-center rounded-md border px-5 py-2.5 text-base"
            >
              {plan.monthlyCents === 0 ? 'Ver los planes' : 'Cambiar de plan'}
            </Link>
          </div>
        </section>

        {accounts && (
          <section aria-label="Qué se guarda de ti">
            <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
              Qué se guarda de ti
            </h2>
            <ul className="text-text-muted mt-3 flex list-disc flex-col gap-1 pl-5 text-sm">
              <li>Tu correo, y tu contraseña cifrada. Nunca la contraseña.</li>
              <li>
                Las unidades que has superado, el XP, la racha, las medallas, por dónde elegiste
                empezar y las preguntas que fallaste. Identificadores y números.
              </li>
              <li>Cuántas veces has usado la IA hoy, para descontarlo del cupo de tu plan.</li>
              <li>
                <strong className="text-text">
                  Ni una muestra de audio ni un fotograma de vídeo.
                </strong>{' '}
                Eso no sale de tu equipo, y las cuentas no han cambiado eso.
              </li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
