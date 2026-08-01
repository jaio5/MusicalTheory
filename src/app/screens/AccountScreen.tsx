'use client';

import Link from 'next/link';

import { displayName, monthlyAiRequests, planOf, priceLabel } from '@core/billing';
import { AccessForm, NameForm, PasswordForm, SignOutButton } from '@features/account';
import { useAccount } from '@state/account';

/**
 * Tu cuenta: los ajustes de quien ya ha entrado.
 *
 * Cuatro secciones y cada una con su ancla —`#perfil`, `#suscripcion`,
 * `#contrasena`, `#privacidad`—, que son las cuatro entradas del desplegable del
 * avatar. Anclas y no cuatro pantallas: son cosas que se miran de una en una y
 * muy de tarde en tarde, y repartirlas obligaría a volver atrás para pasar de una
 * a otra.
 *
 * Los precios no están aquí. Eran dos preguntas metidas en una pantalla —«¿quién
 * soy?» y «¿qué compro?»— y quien entraba a cambiar la contraseña se encontraba una
 * lista de precios. Los planes viven en `/planes`, y aquí solo se dice cuál tienes y
 * se enlaza.
 */
export function AccountScreen() {
  const { account, accounts, signedIn } = useAccount();
  const plan = planOf(account.plan);

  // Sin haber entrado esto no son ajustes de nada: lo único que se puede hacer es
  // entrar, y se ofrece eso en vez de cuatro secciones vacías con candados.
  if (!signedIn) {
    return (
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-8">
          <header>
            <h1 className="text-text text-3xl">Entrar</h1>
            <p className="text-text-muted mt-2 max-w-prose text-sm">
              La cuenta sirve para dos cosas: llevarte el avance a otro aparato y tener un plan. Sin
              ella la aplicación funciona igual y el avance se queda en este navegador.
            </p>
          </header>

          <AccessForm />

          {accounts && (
            <p className="text-text-muted text-sm">
              ¿Todavía no tienes?{' '}
              <Link href="/registro" className="text-brass-bright hover:text-brass underline">
                Crear tu cuenta
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-10 p-4 md:p-8">
        <header>
          <h1 className="text-text text-3xl">Tu cuenta</h1>
          <p className="text-text-muted mt-2 text-sm">
            Estás dentro como <span className="text-text font-mono">{account.email}</span>.
          </p>
        </header>

        {/* `scroll-mt` para que el título no se quede pegado al borde de arriba al
            llegar desde el desplegable con el ancla. */}
        <section id="perfil" aria-label="Tu perfil" className="scroll-mt-4">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">Tu perfil</h2>
          <p className="text-text-muted mt-2 max-w-prose text-sm">
            En la aplicación se te llama <span className="text-text">{displayName(account)}</span>,
            y de ahí sale la letra del círculo de arriba.
          </p>
          <div className="mt-3">
            <NameForm />
          </div>
          <p className="text-text-muted mt-3 max-w-prose text-xs">
            El correo no se cambia desde aquí: identifica la cuenta, y cambiarlo pide confirmar la
            dirección nueva antes de mover nada. Mientras no haya envío de correo, hacerlo a medias
            dejaría cuentas apuntando a buzones que no existen.
          </p>
        </section>

        <section id="suscripcion" aria-label="Tu suscripción" className="scroll-mt-4">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Tu suscripción
          </h2>

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
              {plan.monthlyCents === 0 ? 'Ver los tres planes' : 'Cambiar de plan'}
            </Link>
          </div>
        </section>

        <section id="contrasena" aria-label="Tu contraseña" className="scroll-mt-4">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Contraseña
          </h2>
          <div className="mt-3">
            <PasswordForm />
          </div>
        </section>

        <section id="privacidad" aria-label="Qué se guarda de ti" className="scroll-mt-4">
          <h2 className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Qué se guarda de ti
          </h2>
          <ul className="text-text-muted mt-3 flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>Tu correo, tu nombre si lo has puesto, y tu contraseña cifrada. Nunca en claro.</li>
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

        <section aria-label="Salir">
          <p className="text-text-muted mb-3 max-w-prose text-xs">
            Al salir no se borra nada: el avance de este navegador se queda donde está, y la próxima
            vez que entres se junta con el de tu cuenta quedándose lo mejor de cada uno.
          </p>
          <div className="w-fit">
            <SignOutButton />
          </div>
        </section>
      </div>
    </div>
  );
}
