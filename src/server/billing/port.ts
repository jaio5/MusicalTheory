/**
 * Por dónde se cobra. La interfaz, no el cobrador.
 *
 * Es el mismo patrón que `AudioInput`, `CameraInput` y `SessionStorage`: la
 * aplicación habla con una interfaz y la implementación se elige al arrancar. Ahí
 * se ganó poder probar el afinador sin micrófono; aquí se gana poder tener los
 * tres planes funcionando y probados **antes** de que exista una cuenta de
 * Stripe, y enchufar Stripe después sin tocar ni las rutas ni las pantallas.
 *
 * Lo que hay hoy detrás de esta interfaz es `FakeBilling`, que cambia el plan al
 * pulsar y no cobra nada. Lo que habrá mañana es `StripeBilling`, que devuelve
 * una dirección de Checkout y espera a que su webhook confirme. La diferencia
 * entre las dos está en `start`: una termina el cambio en el momento y la otra
 * manda a otro sitio y termina más tarde. Todo lo demás es igual, y por eso el
 * resultado tiene esas dos formas y no una.
 */

import type { PlanId } from '@core/billing';

export type StartResult =
  /** Cambiado ya. No hay nada más que hacer. */
  | { readonly kind: 'listo'; readonly plan: PlanId }
  /** Hay que ir a pagar a otro sitio; el plan cambiará cuando lo confirmen. */
  | { readonly kind: 'ir-a-pagar'; readonly url: string }
  | { readonly kind: 'error'; readonly reason: string };

export interface Billing {
  /** Cómo se llama, para poder decir en la pantalla qué pasarela hay puesta. */
  readonly name: string;
  /**
   * Si esta pasarela cobra dinero de verdad.
   *
   * Lo pregunta la pantalla para avisar de que no se está cobrando nada. Una
   * pantalla de pago que no cobra y no lo dice es una pantalla que engaña.
   */
  readonly charges: boolean;
  /** Empieza el cambio al plan pedido. */
  start(input: { userId: string; email: string; plan: PlanId }): Promise<StartResult>;
  /** Deja la cuenta en el plan gratis. */
  cancel(input: { userId: string }): Promise<{ ok: boolean }>;
  /**
   * A dónde se va a cambiar la tarjeta o ver las facturas, si esa pasarela lo
   * ofrece.
   *
   * Devuelve nulo cuando no hay adónde ir, y eso son dos casos que desde fuera
   * son el mismo: el cobrador que no cobra no tiene facturas que enseñar, y una
   * cuenta que nunca ha pagado tampoco. La pantalla no enseña el enlace en
   * ninguno de los dos, que es lo correcto en los dos.
   *
   * **Esto no se reimplementa aquí, ni se debe.** Cambiar una tarjeta es
   * recibir un número de tarjeta, y el motivo de tener pasarela es que esos
   * números no pasen nunca por este servidor.
   */
  portal(input: { userId: string; email: string }): Promise<string | null>;
}
