'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useEnvio } from './use-envio';

import {
  can,
  cupoEnPalabras,
  monthlyAiRequests,
  planOf,
  MESES_GRATIS_AL_AÑO,
  MESES_QUE_SE_PAGAN_AL_AÑO,
  priceLabel,
  type Periodo,
  type Plan,
} from '@core/billing';
import { changePlan, useAccount } from '@state/account';
import { Button, estiloBoton } from '@ui/Button';

import { AccessForm } from './AccessForm';
import { enUnaFrase, loQueTrae } from './lo-que-va-con-plan';
import { ETIQUETAS } from './PlanCards';
import { Aviso } from '@ui/Aviso';
import { Segmentado } from '@ui/Segmentado';

/**
 * La ventana de pagar un plan concreto.
 *
 * Una pantalla por plan y no un botón en una lista: aquí se está a punto de gastar
 * dinero todos los meses, y eso merece una pantalla que diga qué plan, cuánto, y
 * qué se abre exactamente. Es también donde entra quien no tiene cuenta, porque no
 * hay a quién cobrarle sin cuenta y mandarle a otra dirección a registrarse le hace
 * perder el plan que había elegido.
 *
 * **No hay formulario de tarjeta, y no es un olvido.** Los datos de la tarjeta se
 * escriben en la pasarela, que es quien puede recibirlos: aquí no pasan nunca, y
 * eso es media integración de pagos resuelta por no hacer nada. Cuando hay
 * pasarela, la respuesta del servidor trae una dirección y esta pantalla sale
 * hacia ella.
 *
 * **El aviso de que no se cobra cuelga del cobrador**, no de una constante. Si
 * estuviera escrito fijo, el día que se enchufe la pasarela seguiría diciendo que
 * no se cobra mientras se cobra, que es la peor de las dos mentiras posibles.
 */
export function Checkout({
  plan,
  charges = false,
}: {
  readonly plan: Plan;
  readonly charges?: boolean;
}) {
  const router = useRouter();
  const { account, accounts, signedIn, refresh } = useAccount();
  // `hecho` se llama `done` aquí desde antes; el sobre es el mismo.
  const { error, setError, hecho: done, setHecho: setDone, working, enviar } = useEnvio();

  // Al mes por defecto: es lo que se puede dejar en cualquier momento, y quien
  // quiere el año lo elige sabiendo que lo elige (adr/0106).
  const [periodo, setPeriodo] = useState<Periodo>('mensual');

  const actual = planOf(account.plan);
  const yaEsTuyo = actual.id === plan.id;
  const esSubida = plan.monthlyCents > actual.monthlyCents;

  async function activar(): Promise<void> {
    await enviar(async () => {
      const result = await changePlan(plan.id, periodo);
      if (result.kind === 'ir-a-pagar') {
        // Con pasarela puesta, se sale a pagar a su dominio. `assign` y no
        // `router.push`: es otra web, no una ruta de esta aplicación.
        window.location.assign(result.url);
        return;
      }
      if (result.kind === 'error') {
        setError(result.message);
        return;
      }
      await refresh();
      setDone(true);
      // El plan lo lee el servidor al pintar, así que hay que pedirle que vuelva a
      // hacerlo: sin esto, el resto de la aplicación seguiría con el plan de antes.
      router.refresh();
    });
  }

  if (done || yaEsTuyo) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="rotulo text-tube-bright">{done ? 'Plan activado' : 'Ya lo tienes'}</p>
          <h2 className="text-text mt-1 text-2xl">Tienes el plan {plan.name}</h2>
          <p className="text-text-muted mt-2 max-w-prose text-sm">
            {/* v8 ignore start -- los planes de pago abren todos el Grado Profesional; la otra frase espera a que haya uno que no */}
            {can(plan.id, 'grado-profesional')
              ? 'El Grado Profesional está abierto, y puedes empezar por el curso que quieras desde el camino.'
              : 'Ya puedes seguir por donde ibas.'}
            {/* v8 ignore stop */}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/aprender" className={estiloBoton('primary')}>
            Ir al camino
          </Link>
          <Link href="/cuenta" className={estiloBoton('quiet')}>
            Ver mi cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Qué vas a contratar">
        <h2 className="rotulo">Lo que vas a contratar</h2>

        <div className="superficie mt-3 overflow-hidden">
          {/* **Con la letra grande, el precio baja de línea en vez de cortarse.**
              Iba `shrink-0` al lado del nombre en una caja que recorta, y al 150 %
              «4,99 € al mes» se salía por la derecha y no se leía. Ahora la fila
              se parte: el nombre parte de cero (`basis-0`) y crece, así que el
              precio solo baja cuando no le quedan diez rem al nombre, y si ni solo
              cabe, se parte él también. */}
          <div className="border-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-3">
            <div className="min-w-[min(100%,10rem)] grow basis-0">
              <p className="text-text text-lg">Plan {plan.name}</p>
              <p className="text-text-muted text-sm">{plan.claim}</p>
            </div>
            <p className="text-brass-bright min-w-0 font-mono text-lg">
              {priceLabel(plan.id, periodo)}
            </p>
          </div>

          {/* **Al mes o al año, en el mismo sitio que el precio**, porque es lo que
              lo cambia. El año lleva su «dos meses gratis» dicho con el número de
              meses de verdad, no escrito a mano: si un día cambia, la frase
              cambia con él. Lo que se abre y el cupo son los mismos en los dos. */}
          <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
            <Segmentado
              etiqueta="Cada cuánto se paga"
              opciones={[
                { valor: 'mensual', texto: 'Al mes' },
                { valor: 'anual', texto: 'Al año' },
              ]}
              valor={periodo}
              onCambiar={setPeriodo}
            />
            <p className="text-text-muted text-sm">
              {periodo === 'anual'
                ? `Pagas ${MESES_QUE_SE_PAGAN_AL_AÑO} meses y tienes 12: ${MESES_GRATIS_AL_AÑO} gratis.`
                : `O ${priceLabel(plan.id, 'anual')}: ${MESES_GRATIS_AL_AÑO} meses gratis.`}
            </p>
          </div>

          <ul className="flex flex-col gap-1 px-4 py-3">
            {ETIQUETAS.filter(({ capability }) => can(plan.id, capability)).map(
              ({ capability, label }) => {
                // Lo que ya tenías no es lo que estás comprando. Marcarlo como
                // nuevo sería inflar la lista con cosas por las que ya pagabas.
                const nuevo = !can(actual.id, capability);
                return (
                  <li key={capability} className="flex items-baseline gap-2 text-sm">
                    <span aria-hidden="true" className="text-tube-bright">
                      ✓
                    </span>
                    <span className="text-text">{label}</span>
                    {nuevo && esSubida && (
                      <span className="text-brass-bright text-xs font-medium">nuevo</span>
                    )}
                  </li>
                );
              },
            )}
            <li className="text-text mt-1 flex items-baseline gap-2 text-sm">
              <span aria-hidden="true" className="text-tube-bright">
                ✓
              </span>
              <span>
                {cupoEnPalabras(plan.id, account.aiModel)}
                {esSubida && (
                  <span className="text-text-muted">
                    {' '}
                    · ahora tienes {monthlyAiRequests(actual.id, account.aiModel)}
                  </span>
                )}
              </span>
            </li>
          </ul>
        </div>

        {!esSubida && (
          <p className="text-text-muted mt-2 text-sm">
            Vienes del plan {actual.name}. Comprueba que no pierdes nada que estés usando: lo que no
            entra en {plan.name} aparece tachado en la lista de planes.
          </p>
        )}
      </section>

      {!accounts ? (
        // Lo que no hay sale de la tabla de permisos: decía «todo lo que no es IA
        // funciona igual», y el repaso y guardar canciones tampoco están sin plan.
        <p className="text-text-muted max-w-prose text-sm">
          Esta copia de la aplicación no tiene cuentas configuradas, así que no hay dónde guardar un
          plan, y lo que trae el {plan.name} tampoco está aquí: {enUnaFrase(loQueTrae(plan.id))}. Lo
          que pasa en tu navegador —afinar, componer, grabar y el Grado Elemental— funciona igual y
          sin pagar nada.
        </p>
      ) : !signedIn ? (
        <section aria-label="Entrar para continuar">
          <h2 className="rotulo">Primero, tu cuenta</h2>
          <p className="text-text-muted mt-1 mb-3 max-w-prose text-sm">
            El plan va asociado a una cuenta. Al entrar te quedas aquí y sigues con el plan{' '}
            {plan.name}.
          </p>
          <AccessForm />
        </section>
      ) : (
        <section aria-label="Confirmar">
          <h2 className="rotulo">Confirmar</h2>

          {/* Lo que sigue es la frase más importante de la pantalla y va antes del
              botón, no debajo en letra pequeña. */}
          <div className="superficie-viva mt-3 p-3">
            <p className="text-text text-sm">
              {charges ? (
                <>
                  <strong>Al confirmar se sale a pagar.</strong> Los datos de la tarjeta se escriben
                  en la pasarela y no pasan por aquí. El plan {plan.name} se activa cuando el pago
                  se confirma, y se cobra {priceLabel(plan.id, periodo).toLowerCase()} hasta que lo
                  canceles.
                </>
              ) : (
                <>
                  <strong>Aquí todavía no se cobra nada.</strong> No hay pasarela de pago enchufada:
                  al confirmar, tu cuenta pasa al plan {plan.name} sin que se te cargue ningún
                  importe y sin pedirte una tarjeta. El precio de arriba es el que costará cuando la
                  haya.
                </>
              )}
            </p>
          </div>

          <div className="mt-4">
            <Button onClick={() => void activar()} cargando={working}>
              {working ? 'Un momento...' : `Activar el plan ${plan.name}`}
            </Button>
          </div>

          <Aviso mensaje={error} className="mt-3" />
        </section>
      )}
    </div>
  );
}
