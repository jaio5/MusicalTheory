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
 * Lo que no hace, y por eso **no se usa en producción**: cualquiera con una cuenta
 * puede darse el plan Conservatorio. En producción sin Stripe lo que hay es
 * `CobroCerrado`, abajo, que no deja subir de plan (`billing()` en `index.ts`).
 */

import type { Periodo, PlanId } from '@core/billing';

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
    periodo: Periodo;
  }): Promise<StartResult> {
    // Aquí «no existe» y «no se ha podido» son lo mismo: quien llama está
    // mirando una pantalla y hay que decirle que no se ha podido.
    const ok = (await setPlan(userId, plan)) === 'ok';
    return ok
      ? { kind: 'listo', plan }
      : { kind: 'error', reason: 'no se ha podido guardar el plan' };
  },

  async cancel({ userId }: { userId: string }): Promise<{ ok: boolean }> {
    return { ok: (await setPlan(userId, 'gratis')) === 'ok' };
  },

  async portal(): Promise<string | null> {
    // Aquí no se ha cobrado nunca, así que no hay tarjeta que cambiar ni
    // facturas que mirar. Nulo, y la pantalla no enseña el enlace.
    return null;
  },
};

/**
 * El que no deja pagar: lo que hay en producción sin Stripe configurado.
 *
 * Subir de plan contesta que no se ha podido, en vez de regalarlo. **Bajar a
 * gratis sí funciona**, porque no da nada que no se tenga y quien lo pide tiene
 * que poder dejar de tener un plan. No hay portal: aquí no se ha cobrado nunca.
 *
 * `charges` es `false`, así que la pantalla de planes sigue diciendo que aquí no
 * se cobra, que es verdad.
 */
export const CobroCerrado: Billing = {
  name: 'sin cobro configurado',
  charges: false,

  async start({
    userId,
    plan,
  }: {
    userId: string;
    email: string;
    plan: PlanId;
    periodo: Periodo;
  }): Promise<StartResult> {
    if (plan === 'gratis') {
      return (await this.cancel({ userId })).ok
        ? { kind: 'listo', plan: 'gratis' }
        : { kind: 'error', reason: 'no se ha podido guardar el plan' };
    }
    return { kind: 'error', reason: 'esta copia no tiene pasarela de pago configurada' };
  },

  async cancel({ userId }: { userId: string }): Promise<{ ok: boolean }> {
    return FakeBilling.cancel({ userId });
  },

  async portal(): Promise<string | null> {
    return null;
  },
};
