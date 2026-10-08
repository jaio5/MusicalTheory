'use client';

import Link from 'next/link';

import { PAID_PLANS, planOf, priceLabel, type Plan } from '@core/billing';
import { useAccount } from '@state/account';

/**
 * Lo que va al lado de la ventana de pago: este plan entre los otros de pago.
 * Se llamó `ElPlanEntreLosTres` mientras hubo tres (adr/0104).
 *
 * **La ventana de pago era una columna en un rincón**: el resumen, el aviso y el
 * botón en 768 px, y a 1920 la pantalla usaba el 40 % del ancho. Lo que llena ese
 * lado no es estirar el resumen —una lista de lo que se abre se lee igual de
 * estrecha— sino lo que se pregunta quien está a punto de pagar todos los meses:
 * **¿es este el que quiero, o me basta el de abajo?** Contestarlo aquí ahorra
 * volver a la lista, que es donde se pierde el plan que se había elegido.
 *
 * Todos, con su precio y la frase que dice qué trae cada uno que el anterior
 * no (`plans.ts`, `claim`), y el que se está mirando encendido. Los otros
 * llevan a su propia ventana. El tuyo, si tienes uno, lo dice.
 *
 * Y una línea de lo que **no** cambia con ningún plan, porque es la duda que
 * frena: que la guitarra estuviera de pago.
 */
export function ElPlanEntreLosDePago({ plan }: { readonly plan: Plan }) {
  const { account } = useAccount();
  const tuyo = planOf(account.plan).id;

  return (
    // Las tarjetas se reparten por el ancho **de su caja**: van en una columna
    // estrecha en un teléfono, debajo del pago, y una al lado de otra en un monitor.
    <section aria-label="Los planes de pago" className="@container flex flex-col gap-4">
      <h2 className="rotulo">Los planes de pago</h2>

      <ul className="grid gap-3 @min-[30rem]:grid-cols-2">
        {PAID_PLANS.map((otro) => {
          const este = otro.id === plan.id;
          const dentro = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-text">{otro.name}</span>
                <span className="text-brass-bright shrink-0 tabular-nums">
                  {priceLabel(otro.id)}
                </span>
              </span>
              <span className="text-text-muted mt-1 block">{otro.claim}</span>
              {(este || otro.id === tuyo) && (
                <span className="rotulo text-tube-bright mt-2 block">
                  {este && otro.id === tuyo
                    ? 'El que miras, y el tuyo'
                    : este
                      ? 'El que miras'
                      : 'El tuyo'}
                </span>
              )}
            </>
          );

          return (
            <li key={otro.id} className="flex">
              {este ? (
                // El que se está mirando no es un enlace a sí mismo: se enciende y
                // se dice, para quien no ve el color, con `aria-current`.
                <div aria-current="page" className="superficie-viva w-full p-4">
                  {dentro}
                </div>
              ) : (
                <Link
                  href={`/planes/${otro.id}`}
                  className="superficie tarjeta-pulsable min-h-tap block w-full p-4"
                >
                  {dentro}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-text-muted max-w-prose">
        Con ningún plan cambia la guitarra: el afinador, la rueda, el mástil, el metrónomo,
        componer, grabar y el Grado Elemental son gratis, y lo que tocas no sale de tu equipo.{' '}
        <Link href="/planes" className="enlace">
          Compararlos con calma
        </Link>
        .
      </p>
    </section>
  );
}
