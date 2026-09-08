'use client';

import Link from 'next/link';

import { displayName, monthlyAiRequests } from '@core/billing';
import { AccessForm } from '@features/account';
import { useAccount } from '@state/account';
import { estiloBoton } from '@ui/Button';
import { IconoCamino, IconoProfesor, IconoTocar } from '@ui/icons';
import { Mascota } from '@ui/Mascota';
import { Screen } from '@ui/Screen';

/**
 * Crear tu cuenta.
 *
 * Es a donde lleva el avatar de quien todavía no tiene ninguna. Pantalla propia y
 * no un panel dentro de la cuenta, porque quien llega aquí no viene a mirar nada:
 * viene a rellenar tres campos.
 *
 * **Dos columnas, y el formulario primero.** A la izquierda lo que hay que hacer;
 * a la derecha, por qué merece la pena. En una sola columna, las razones quedaban
 * por debajo del pliegue y no las leía nadie, o quedaban encima y había que pasar
 * por delante de ellas para llegar al campo del correo. En pantalla estrecha se
 * apilan en ese mismo orden: primero el formulario.
 *
 * El muñeco da la bienvenida porque **esta es la única pantalla donde un
 * desconocido se para a decidir**: pone cara a lo que hay dentro. Es el mismo del
 * profesor, no un dibujo nuevo.
 *
 * Lo último que se cuenta es que sin cuenta la aplicación funciona entera. Es lo
 * que evita que esto parezca un muro: no lo es, y decirlo cuesta una línea.
 *
 * Si ya has entrado no se pinta el formulario. Un formulario de registro delante
 * de quien ya tiene la sesión abierta es una invitación a crear una segunda cuenta
 * sin querer y perder el avance de la primera.
 */
export function RegisterScreen() {
  const { account, accounts, signedIn } = useAccount();

  if (signedIn) {
    return (
      <Screen
        title="Ya tienes cuenta"
        lead={`Estás dentro como ${displayName(account)}, así que no hay nada que crear aquí.`}
        ancho="lectura"
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/cuenta" className={estiloBoton('primary')}>
            Tu cuenta
          </Link>
          <Link href="/aprender" className={estiloBoton('quiet')}>
            Ir al camino
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title="Crear tu cuenta"
      lead="Tu avance deja de vivir en este navegador y te lo llevas al móvil, al portátil o a donde estudies."
    >
      {/* Dos columnas solo cuando hay algo que poner en la segunda. Sin cuentas
          configuradas, «Qué te da» no existe y la rejilla dejaba el aviso pegado
          a la izquierda con el resto de la pantalla en blanco. */}
      <div
        className={`grid gap-6 lg:gap-10 ${
          accounts ? 'lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]' : 'max-w-md'
        }`}
      >
        {/* El formulario, en su tarjeta y con el muñeco asomando por arriba: es lo
            único que hay que hacer en esta pantalla y tiene que verse como tal. */}
        <section aria-label="Crear la cuenta" className="superficie-viva relative p-5 pt-10">
          <div className="absolute -top-6 left-5">
            <Mascota className="size-16" />
          </div>
          <AccessForm inicial="crear" />
        </section>

        {accounts && (
          <section aria-label="Qué te da la cuenta" className="flex flex-col gap-4">
            <h2 className="rotulo">Qué te da</h2>

            <ul className="flex flex-col gap-3">
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
                  <span className="text-brass-bright mt-0.5 shrink-0">
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
              Sin cuenta la aplicación funciona <strong className="text-text">entera</strong> menos
              la IA: el afinador, la rueda, el mástil, el metrónomo, componer, grabar y los cuatro
              cursos del Grado Elemental. El avance se queda guardado en este navegador.{' '}
              <Link href="/planes" className="enlace">
                Ver los tres planes
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </Screen>
  );
}
