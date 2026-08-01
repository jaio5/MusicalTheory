/**
 * Quién pide, con qué plan, y si le queda cupo.
 *
 * Es la única puerta por la que pasan las dos rutas de IA antes de gastar dinero.
 * La interfaz también pregunta lo mismo, pero lo pregunta a `core/billing`, que es
 * la misma tabla: si la pantalla y la ruta consultasen tablas distintas, llegaría
 * el día en que la pantalla enseña un botón que el servidor rechaza.
 *
 * Aquí no se decide nada: se lee la sesión, se lee el plan, y se le pregunta al
 * dominio cuánto cupo da ese plan con el modelo que hay puesto. Toda la política
 * está en `core/billing/plans.ts` y toda la aritmética en `core/billing/cost.ts`.
 *
 * **La IA pide cuenta.** Es la decisión que hace que el límite sea de verdad por
 * cliente: sin cuenta no hay cliente al que limitar, solo una dirección IP que se
 * cambia con el móvil en la mano. Lo que había antes —un contador por dirección y
 * en memoria— no era un límite, era un rótulo.
 */

import {
  ANONYMOUS,
  can,
  cheapestPlanWith,
  dailyAiRequests,
  monthlyAiRequests,
  planOf,
  remaining,
  type Account,
  type AiFeature,
  type Capability,
  type Plan,
} from '@core/billing';

import { aiUsageOf, spendAiRequest } from './ai-usage';
import { configuredModel } from './ai-model';
import { authAvailable, currentUserId } from './auth';
import { findUserById } from './users';

/** Los cupos que da un plan con el modelo que hay puesto ahora mismo. */
export function limitsFor(planId: Account['plan']): { monthly: number; daily: number } {
  const model = configuredModel();
  return { monthly: monthlyAiRequests(planId, model), daily: dailyAiRequests(planId, model) };
}

/**
 * La cuenta de quien está pidiendo, con lo que le queda de cupo.
 *
 * Sin base de datos, sin secreto de firma o sin haber entrado, es la cuenta
 * anónima: sin cupo y sin IA. Nunca lanza: si algo falla al leer la sesión, quien
 * pide es anónimo, que es la respuesta segura.
 */
export async function currentAccount(): Promise<Account> {
  const session = await currentSession();
  return session?.account ?? { ...ANONYMOUS, aiModel: configuredModel() };
}

/** Lo mismo, pero además con el identificador de la fila para poder escribir. */
export async function currentSession(): Promise<{ userId: string; account: Account } | null> {
  if (!authAvailable()) {
    return null;
  }
  const userId = await currentUserId();
  if (userId === null) {
    return null;
  }
  const user = await findUserById(userId);
  if (user === null) {
    return null;
  }

  const usage = await aiUsageOf(userId);
  const limits = limitsFor(user.plan);

  return {
    userId,
    account: {
      email: user.email,
      plan: user.plan,
      aiModel: configuredModel(),
      aiLeftToday: remaining(limits.daily, usage.today),
      aiLeftMonth: remaining(limits.monthly, usage.month),
    },
  };
}

export type AiVerdict =
  /** Adelante, y quedan tantas. */
  | { readonly kind: 'ok'; readonly account: Account; readonly leftMonth: number }
  /** Sin cuenta no hay a quién contarle el gasto, así que no se sirve. */
  | { readonly kind: 'sin-cuenta' }
  /** El plan no incluye esto; con este otro sí. */
  | { readonly kind: 'plan'; readonly account: Account; readonly needed: Plan | null }
  /** El plan lo incluye, pero se ha gastado el cupo del mes o del día. */
  | { readonly kind: 'cupo'; readonly account: Account; readonly scope: 'dia' | 'mes' }
  /** No se ha podido contar, así que no se sirve. */
  | { readonly kind: 'sin-contador'; readonly account: Account };

/**
 * Pide permiso para una llamada al modelo y, si lo da, la descuenta.
 *
 * Descuenta antes de llamar al modelo y no después. Al contrario de lo que parece,
 * es lo correcto: descontar después significa que dos peticiones a la vez pasan
 * las dos, y que si el proceso se cae a mitad de llamada la llamada se ha pagado y
 * no se ha contado. Se cobra el intento, no el acierto, y por eso las rutas no
 * reintentan más de una vez.
 */
export async function spendAi(capability: Capability & AiFeature): Promise<AiVerdict> {
  const session = await currentSession();
  if (session === null) {
    return { kind: 'sin-cuenta' };
  }
  const { account, userId } = session;

  if (!can(account.plan, capability)) {
    return { kind: 'plan', account, needed: cheapestPlanWith(capability) };
  }

  const spent = await spendAiRequest(userId, limitsFor(account.plan));
  switch (spent.kind) {
    case 'ok':
      return {
        kind: 'ok',
        account,
        leftMonth: remaining(limitsFor(account.plan).monthly, spent.usage.month),
      };
    case 'sin-cupo-mensual':
      return { kind: 'cupo', account, scope: 'mes' };
    case 'sin-cupo-diario':
      return { kind: 'cupo', account, scope: 'dia' };
    case 'sin-contador':
      return { kind: 'sin-contador', account };
  }
}

/** El plan de quien pide, ya resuelto contra el catálogo. */
export async function currentPlan(): Promise<Plan> {
  const account = await currentAccount();
  return planOf(account.plan);
}
