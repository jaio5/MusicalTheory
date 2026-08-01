/**
 * El cobrador que no cobra.
 *
 * Cambia el plan en la base de datos y ya está. Es lo que permite que los tres
 * planes, los candados y los cupos estén escritos, probados y funcionando sin
 * tener una cuenta de Stripe ni un webhook accesible desde internet.
 *
 * Y es honesto en la pantalla: `charges` es `false`, así que la pantalla de
 * planes avisa de que aquí no se cobra nada. El día que se enchufe Stripe, esa
 * misma pantalla dejará de avisarlo sola.
 *
 * Lo que no hace, y hay que saberlo antes de publicar esto de cara al mundo:
 * cualquiera con una cuenta puede darse el plan Conservatorio. Mientras el
 * cobrador sea este, los cupos son una protección contra el gasto accidental, no
 * contra el que quiere gastar.
 */

import type { PlanId } from '@core/billing';

import { setPlan } from '../users';

import type { Billing, StartResult } from './port';

export const FakeBilling: Billing = {
  name: 'cobro de mentira',
  charges: false,

  async start({
    userId,
    plan,
  }: {
    userId: string;
    email: string;
    plan: PlanId;
  }): Promise<StartResult> {
    const ok = await setPlan(userId, plan);
    return ok
      ? { kind: 'listo', plan }
      : { kind: 'error', reason: 'no se ha podido guardar el plan' };
  },

  async cancel({ userId }: { userId: string }): Promise<{ ok: boolean }> {
    return { ok: await setPlan(userId, 'gratis') };
  },
};
