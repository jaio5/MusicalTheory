/**
 * Qué cobrador hay puesto.
 *
 * Un solo sitio donde se elige, para que enchufar Stripe sea añadir un fichero y
 * una línea aquí. Cuando exista `StripeBilling`, esto mirará si están sus
 * variables de entorno —igual que `db()` mira si está `DATABASE_URL`— y si no
 * están seguirá devolviendo el de mentira, que es lo que hace que un clon recién
 * bajado funcione sin configurar nada.
 */

import { FakeBilling } from './fake';
import type { Billing } from './port';

export type { Billing, StartResult } from './port';

export function billing(): Billing {
  return FakeBilling;
}
