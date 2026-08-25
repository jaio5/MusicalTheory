'use client';

import Link from 'next/link';

import { avatarInitial, displayName, monthlyAiRequests, planOf, priceLabel } from '@core/billing';
import { BADGES, currentStreak } from '@core/music';
import { estiloBoton } from '@ui/Button';
import { AccessForm, NameForm, PasswordForm, SignOutButton } from '@features/account';
import { useProgress } from '@features/learn';
import { useAccount } from '@state/account';
import { Screen, Section } from '@ui/Screen';

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
  const { progress, day } = useProgress();
  const plan = planOf(account.plan);

  // Sin haber entrado esto no son ajustes de nada: lo único que se puede hacer es
  // entrar, y se ofrece eso en vez de cuatro secciones vacías con candados.
  if (!signedIn) {
    return (
      <Screen
        title="Entrar"
        lead="La cuenta sirve para dos cosas: llevarte el avance a otro aparato y tener un plan. Sin ella la aplicación funciona igual y el avance se queda en este navegador."
        ancho="lectura"
      >
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
      </Screen>
    );
  }

  return (
    <Screen title="Tu cuenta" lead="Quién eres, qué plan tienes y qué se guarda de ti.">
      {/* La ficha: quién eres de un vistazo. Va antes que los ajustes porque
          entrar aquí es casi siempre mirar —cuánto llevo, qué plan tengo— y solo
          de vez en cuando cambiar algo. */}
      <div className="superficie-viva flex flex-wrap items-center gap-4 p-5">
        <span
          aria-hidden="true"
          className="border-brass-bright text-brass-bright bg-surface flex size-16 shrink-0 items-center justify-center rounded-full border-2 font-mono text-2xl"
        >
          {avatarInitial(account)}
        </span>

        <div className="min-w-0">
          <p className="text-text truncate text-xl">{displayName(account)}</p>
          <p className="text-text-muted truncate font-mono text-xs">{account.email}</p>
        </div>

        <div className="border-brass-dim ml-auto rounded-md border px-3 py-1.5 text-center">
          <p className="text-brass-bright font-mono text-sm">Plan {plan.name}</p>
          <p className="text-text-muted font-mono text-xs">{priceLabel(plan.id)}</p>
        </div>
      </div>

      {/* Lo que llevas hecho, en números. Sale del avance de este navegador, que
          es el mismo que se sube a la cuenta cuando el plan lo incluye. */}
      <Section title="Lo que llevas">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { que: 'XP', cuanto: progress.xp },
            { que: 'Racha', cuanto: day === null ? progress.streak : currentStreak(progress, day) },
            { que: 'Unidades', cuanto: progress.done.length },
            { que: 'Medallas', cuanto: `${progress.badges.length} de ${BADGES.length}` },
          ].map(({ que, cuanto }) => (
            <div key={que} className="superficie p-3 text-center">
              <dt className="text-text-muted font-mono text-xs tracking-widest uppercase">{que}</dt>
              <dd className="text-text mt-1 font-mono text-2xl tabular-nums">{cuanto}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="perfil" title="Tu perfil">
        <p className="text-text-muted max-w-prose text-sm">
          De cómo te llames salen el saludo y la letra del círculo, aquí y en la barra de arriba.
        </p>
        <div className="mt-3">
          <NameForm />
        </div>
        <p className="text-text-muted mt-3 max-w-prose text-xs">
          El correo no se cambia desde aquí: identifica la cuenta, y cambiarlo pide confirmar la
          dirección nueva antes de mover nada. Mientras no haya envío de correo, hacerlo a medias
          dejaría cuentas apuntando a buzones que no existen.
        </p>
      </Section>

      <Section id="suscripcion" title="Tu suscripción">
        <div className="superficie flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4">
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
          <Link href="/planes" className={estiloBoton('quiet')}>
            {plan.monthlyCents === 0 ? 'Ver los tres planes' : 'Cambiar de plan'}
          </Link>
        </div>
      </Section>

      <Section id="contrasena" title="Contraseña">
        <PasswordForm />
      </Section>

      <Section id="privacidad" title="Qué se guarda de ti">
        <ul className="text-text-muted flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>Tu correo, tu nombre si lo has puesto, y tu contraseña cifrada. Nunca en claro.</li>
          <li>
            Las unidades que has superado, el XP, la racha, las medallas, por dónde elegiste empezar
            y las preguntas que fallaste. Identificadores y números.
          </li>
          <li>Cuántas veces has usado la IA hoy, para descontarlo del cupo de tu plan.</li>
          <li>
            <strong className="text-text">Ni una muestra de audio ni un fotograma de vídeo.</strong>{' '}
            Eso no sale de tu equipo, y las cuentas no han cambiado eso.
          </li>
        </ul>
      </Section>

      <Section title="Salir">
        <p className="text-text-muted mb-3 max-w-prose text-xs">
          Al salir no se borra nada: el avance de este navegador se queda donde está, y la próxima
          vez que entres se junta con el de tu cuenta quedándose lo mejor de cada uno.
        </p>
        <div className="w-fit">
          <SignOutButton />
        </div>
      </Section>
    </Screen>
  );
}
