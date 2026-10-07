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
  requestCostMicros,
  unidadesDe,
  type Account,
  type AiFeature,
  type Capability,
  type Plan,
} from '@core/billing';

import { devolverGasto, reservarGasto, type Reserva, type TopeAlcanzado } from './ai-gasto';
import { aiUsageOf, huellaDelCorreo, spendAiRequest } from './ai-usage';
import { configuredModel, modelProvider } from './ai-model';
import { authAvailable, currentCookie } from './auth';
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
  const cookie = await currentCookie();
  if (cookie === null) {
    return null;
  }
  const userId = cookie.id;
  // **La cuenta y su gasto a la vez**, no una detrás de otra. Van en todas las
  // peticiones —el layout pinta con esto—, y en serie eran dos viajes a Postgres
  // uno tras otro. El de gasto sobra solo si la fila no está o la cookie es
  // vieja, que es lo raro; y ninguno de los dos lanza —los dos contestan su
  // «nada» si la base falla—, así que juntarlos no cambia qué se responde.
  const [user, usage] = await Promise.all([findUserById(userId), aiUsageOf(userId)]);
  if (user === null) {
    return null;
  }

  // La versión de la cookie contra la de la cuenta. Cambiar la contraseña sube
  // la de la cuenta, así que a partir de ese momento las cookies firmadas antes
  // dejan de valer: es lo que echa a las demás sesiones sin tabla de sesiones y
  // sin una consulta de más, porque la fila ya estaba leída.
  if (cookie.sessionVersion !== user.sessionVersion) {
    return null;
  }

  const limits = limitsFor(user.plan);

  return {
    userId,
    account: {
      email: user.email,
      name: user.name,
      plan: user.plan,
      aiModel: configuredModel(),
      aiLeftToday: remaining(limits.daily, usage.today),
      aiLeftMonth: remaining(limits.monthly, usage.month),
    },
  };
}

export type AiVerdict =
  /**
   * Adelante, y quedan tantas. Con la reserva del techo de gasto, que la ruta
   * asienta con lo gastado de verdad; nula cuando no hay gasto que contar —el
   * modelo de casa o el dominio—.
   */
  | {
      readonly kind: 'ok';
      readonly account: Account;
      readonly leftMonth: number;
      readonly reserva: Reserva | null;
    }
  /** El techo de gasto de esta copia, de todos o de lo gratis (`ai-gasto.ts`). */
  | ({ readonly kind: 'tope-global'; readonly account: Account } & TopeAlcanzado)
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
 *
 * **Dos contadores, y el de todos va primero** (adr/0114): el techo de gasto
 * reserva el peor caso en dinero, y solo si cabe se gasta el cupo de la cuenta.
 * Al revés, una petición que el techo para le costaba una pregunta a quien la
 * hizo. Si después es el cupo el que dice que no, la reserva se devuelve.
 *
 * `session` la pasa la ruta, que ya la ha leído para frenar por cuenta; sin ella
 * se lee aquí.
 */
export async function spendAi(
  capability: Capability & AiFeature,
  session?: { userId: string; account: Account } | null,
): Promise<AiVerdict> {
  const quien = session === undefined ? await currentSession() : session;
  if (quien === null) {
    return { kind: 'sin-cuenta' };
  }
  const { account, userId } = quien;

  if (!can(account.plan, capability)) {
    return { kind: 'plan', account, needed: cheapestPlanWith(capability) };
  }

  const modelo = configuredModel();
  let reserva: Reserva | null = null;
  // Solo la API cuesta dinero: el modelo de casa y el dominio no pasan por el techo.
  if (modelProvider() === 'anthropic') {
    const gratis = planOf(account.plan).monthlyCents === 0;
    const reservado = await reservarGasto(requestCostMicros(capability, modelo), gratis);
    if (reservado.kind === 'sin-contador') {
      return { kind: 'sin-contador', account };
    }
    if (reservado.kind === 'tope') {
      return { kind: 'tope-global', account, quien: reservado.quien, cuando: reservado.cuando };
    }
    reserva = reservado.reserva;
  }

  // Lo que cuesta más que una pregunta gasta más de una (adr/0067).
  const unidades = unidadesDe(capability, modelo);
  const limits = limitsFor(account.plan);
  const spent = await spendAiRequest(
    userId,
    limits,
    unidades,
    new Date(),
    // Lo que gastó este mes una cuenta borrada con el mismo correo (adr/0114).
    account.email === null ? undefined : huellaDelCorreo(account.email),
  );
  if (spent.kind !== 'ok' && reserva !== null) {
    await devolverGasto(reserva);
  }
  switch (spent.kind) {
    case 'ok':
      return {
        kind: 'ok',
        account,
        leftMonth: remaining(limits.monthly, spent.usage.month),
        reserva,
      };
    case 'sin-cupo-mensual':
      return { kind: 'cupo', account, scope: 'mes' };
    case 'sin-cupo-diario':
      return { kind: 'cupo', account, scope: 'dia' };
    case 'sin-contador':
      return { kind: 'sin-contador', account };
  }
}
