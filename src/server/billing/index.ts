/**
 * Qué cobrador hay puesto.
 *
 * Un solo sitio donde se elige. Mira si están las variables de Stripe —igual que
 * `db()` mira si está `DATABASE_URL`— y si no están devuelve el de mentira, que
 * es lo que hace que un clon recién bajado funcione sin configurar nada y que
 * los tests no necesiten una pasarela.
 *
 * **En producción, sin Stripe, el de mentira no**: el que no deja pagar. Antes
 * devolvía el de mentira también ahí, y una copia publicada a la que le faltara
 * una sola de las cinco variables regalaba un plan de pago a quien pulsara el botón.
 * Es lo mismo que hace el correo con `NoMailer`: lo que en desarrollo es cómodo,
 * en producción se cierra.
 *
 * Se comprueba en cada llamada y no una vez al arrancar, por lo mismo que la
 * base de datos: en desarrollo se añade una variable y se recarga en caliente, y
 * un valor calculado al importar el módulo obligaría a reiniciar.
 */

import { CobroCerrado, FakeBilling } from './fake';
import { StripeBilling, stripeConfigured } from './stripe';
import type { Billing } from './port';

export type { Billing, StartResult } from './port';
export { accesoDe, planOfPrice, stripeConfigured } from './stripe';

export function billing(): Billing {
  if (stripeConfigured()) {
    return StripeBilling;
  }
  return process.env.NODE_ENV === 'production' ? CobroCerrado : FakeBilling;
}
