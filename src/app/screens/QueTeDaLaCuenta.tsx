'use client';

import Link from 'next/link';

import { monthlyAiRequests } from '@core/billing';
import { enUnaFrase, loQueNoTrae, loQueTrae } from '@features/account/lo-que-va-con-plan';
import { useAccount } from '@state/account';
import { IconoAfinar, IconoCamino, IconoComponer, IconoProfesor, IconoTocar } from '@ui/icons';

/**
 * Lo que va al lado del formulario de la cuenta, en `/registro` y en `/cuenta`
 * sin haber entrado.
 *
 * **Las dos pantallas eran media pantalla vacía**: un formulario de veintidós rem
 * a la izquierda —o, sin cuentas configuradas, un aviso de tres líneas— y el resto
 * del ancho en negro. Lo que llena ese lado no es estirar el formulario, que se
 * rellena igual de estrecho, sino contestar la pregunta que se hace quien está
 * delante: **¿para qué quiero yo una cuenta?**
 *
 * Y la respuesta cambia según haya cuentas o no, porque no se puede prometer lo
 * que aquí no existe:
 *
 * - **Con cuentas**, lo que te da: el avance que te sigue, el profesor y un plan.
 * - **Sin cuentas**, lo que ya funciona sin ella, y con un enlace a cada sitio.
 *   Ofrecer «crea una cuenta para llevarte el avance» al lado de «aquí no hay
 *   cuentas» sería contar una cosa y su contraria en la misma pantalla.
 *
 * Las tarjetas se reparten por el ancho que tengan **medido sobre su caja**, no
 * sobre la ventana: van al lado del formulario en un escritorio y debajo en un
 * teléfono, y la ventana no dice cuál de las dos.
 */
export function QueTeDaLaCuenta({ accounts }: { readonly accounts: boolean }) {
  const { account } = useAccount();

  if (!accounts) {
    return (
      <section aria-label="Lo que funciona sin cuenta" className="@container flex flex-col gap-4">
        <h2 className="rotulo">Lo que funciona sin cuenta</h2>
        {/* Enlaces y no tres frases: lo honesto de «funciona igual» es poder ir
            ahora mismo a comprobarlo. Cada tarjeta es un enlace entero, así que se
            pulsa con el dedo y lleva su `tarjeta-pulsable`. */}
        <ul className="grid gap-3 @min-[34rem]:grid-cols-3">
          {[
            {
              Icono: IconoCamino,
              href: '/aprender',
              titulo: 'El camino',
              texto: 'Los cuatro cursos del Grado Elemental, con el avance en este navegador.',
            },
            {
              Icono: IconoComponer,
              href: '/componer',
              titulo: 'Componer',
              texto: 'La rueda, los acordes, la canción por bloques y grabar lo que tocas.',
            },
            {
              Icono: IconoAfinar,
              href: '/afinar',
              titulo: 'Afinar',
              texto: 'Cuerda a cuerda y con la afinación que elijas.',
            },
          ].map(({ Icono, href, titulo, texto }) => (
            <li key={href} className="flex">
              <Link
                href={href}
                className="superficie tarjeta-pulsable min-h-tap flex w-full gap-3 p-4"
              >
                <span aria-hidden="true" className="text-brass-bright mt-0.5 shrink-0">
                  <Icono />
                </span>
                <span className="min-w-0">
                  <span className="text-text block text-sm">{titulo}</span>
                  <span className="text-text-muted mt-1 block text-sm">{texto}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {/* Lo que no hay sale de la tabla de permisos. Decía «lo único que pide
            cuenta es la IA», y el repaso y guardar las canciones también van con
            un plan, que va con una cuenta. */}
        <p className="text-text-muted max-w-prose text-sm">
          Lo que no hay sin cuenta es lo que va con ella: {enUnaFrase(loQueTrae('pro'))}. La IA,
          porque cuesta dinero servirla y hay que saber de quién es el gasto; lo demás, porque va
          con un plan, y un plan va con una cuenta.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Qué te da la cuenta" className="@container flex flex-col gap-4">
      <h2 className="rotulo">Qué te da</h2>

      <ul className="grid gap-3 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3">
        {[
          {
            Icono: IconoCamino,
            titulo: 'Tu avance, en tu cuenta',
            texto:
              'Las unidades, el XP, la racha y lo que fallaste dejan de depender de este navegador. Al entrar en otro aparato se juntan quedándose lo mejor de cada lado.',
          },
          {
            Icono: IconoProfesor,
            titulo: 'El profesor',
            texto: `Cada pregunta es una llamada a un modelo que se paga, así que hace falta saber de quién es el gasto. Sin pagar nada son ${monthlyAiRequests('gratis', account.aiModel)} preguntas al mes.`,
          },
          {
            Icono: IconoTocar,
            titulo: 'Un plan, si lo quieres',
            texto:
              'Los tres planes abren el Grado Profesional, el repaso y más IA. No hace falta ninguno para empezar.',
          },
        ].map(({ Icono, titulo, texto }) => (
          <li key={titulo} className="superficie flex gap-3 p-4">
            <span aria-hidden="true" className="text-brass-bright mt-0.5 shrink-0">
              <Icono />
            </span>
            <div className="min-w-0">
              <p className="text-text text-sm">{titulo}</p>
              <p className="text-text-muted mt-1 text-sm">{texto}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-text-muted max-w-prose text-sm">
        Sin cuenta funciona <strong className="text-text">todo lo que pasa en tu navegador</strong>:
        el afinador, la rueda, el mástil, el metrónomo, componer, grabar y los cuatro cursos del
        Grado Elemental, con el avance guardado en él. Lo que va con un plan no:{' '}
        {enUnaFrase(loQueNoTrae('gratis'))}.{' '}
        <Link href="/planes" className="enlace">
          Ver los tres planes
        </Link>
        .
      </p>
    </section>
  );
}
