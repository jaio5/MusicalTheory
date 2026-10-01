/**
 * Los dos cupos de llamadas al modelo: el del mes y el del día.
 *
 * **Se cuentan en preguntas al profesor, no en peticiones** (adr/0067): una
 * pregunta gasta una y una tanda de salidas gasta las que cuesta —tres, hoy—.
 * Las columnas siguen siendo las mismas enteras; lo que cambia es cuánto sube
 * cada una por petición.
 *
 * Esto es lo que de verdad hay que defender, y hasta hace poco no se defendía:
 * había un cupo diario escrito a mano que nadie había multiplicado por treinta
 * días ni por el precio del modelo. Cuarenta al día con Opus 5 son unos veintiséis
 * euros de coste al mes para un plan de 4,99 €.
 *
 * Ahora hay dos topes y cada uno hace un trabajo distinto:
 *
 * - **El del mes protege el dinero.** Sale de dividir el presupuesto del plan
 *   —lo que se puede gastar sin comerse el margen— entre lo que cuesta una
 *   pregunta. Está calculado en `core/billing/cost.ts`.
 * - **El del día protege la experiencia.** Evita que alguien se funda el mes en
 *   una tarde y se quede treinta días sin profesor, que es una forma rara de
 *   cumplir lo prometido.
 *
 * Los dos se comprueban **en la misma sentencia**, que es la razón de que la tabla
 * tenga una fila por cuenta y mes con el día dentro: con dos escrituras hay una
 * rendija entre ellas por la que dos peticiones simultáneas se cuelan.
 *
 * **El mes y el día son los del reloj del servidor, en UTC.** El que paga la
 * factura es el servidor y el cupo es suyo. La consecuencia es que a quien esté en
 * Sídney el cupo se le renueva a media tarde; la alternativa —creerse la zona
 * horaria que diga el navegador— permitiría renovar el cupo cambiando la hora del
 * ordenador. La racha, que no cuesta dinero, sigue en la hora de quien toca.
 */

import { and, eq, sql } from 'drizzle-orm';

import { db } from './db/client';
import { aiUsage } from './db/schema';

/** El día de hoy en UTC, `AAAA-MM-DD`. */
export function serverDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** El mes en curso en UTC, `AAAA-MM`. Es el periodo de facturación. */
export function serverMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export interface Usage {
  /** Preguntas del cupo gastadas este mes. */
  readonly month: number;
  /** Preguntas del cupo gastadas hoy. */
  readonly today: number;
}

const NO_USAGE: Usage = { month: 0, today: 0 };

export type SpendResult =
  | { readonly kind: 'ok'; readonly usage: Usage }
  /** El tope del mes. Se arregla subiendo de plan o esperando al día uno. */
  | { readonly kind: 'sin-cupo-mensual' }
  /** El tope del día. Se arregla mañana. */
  | { readonly kind: 'sin-cupo-diario' }
  /** No se ha podido contar, así que no se sirve. */
  | { readonly kind: 'sin-contador' };

/**
 * Gasta `unidades` preguntas del cupo de una cuenta, si caben enteras en los dos
 * topes. **Enteras o nada**: dejar pasar una salida con dos preguntas restantes
 * sería pagar una petición que el presupuesto no cubre.
 *
 * Una sola sentencia: sube los dos contadores y comprueba los dos topes en el
 * `where` del `on conflict`. Si no devuelve fila, es que uno de los dos topes lo
 * ha impedido —y entonces se lee la fila, ya sin prisa, para saber cuál fue y
 * poder decirlo—. Leer primero y escribir después dejaría pasar dos peticiones
 * simultáneas justo cuando se está contando dinero.
 *
 * El `case` del contador diario es lo que hace que no haya que borrar nada nunca:
 * si la fila es de otro día, el contador del día empieza en uno y el del mes sigue.
 */
export async function spendAiRequest(
  userId: string,
  limits: { readonly monthly: number; readonly daily: number },
  unidades = 1,
  now: Date = new Date(),
): Promise<SpendResult> {
  // La fila nueva entra por el `insert` y no pasa por el `where` del conflicto,
  // así que lo que no cabe ni en un cupo vacío se para aquí.
  if (unidades > limits.monthly) {
    return { kind: 'sin-cupo-mensual' };
  }
  if (unidades > limits.daily) {
    return { kind: 'sin-cupo-diario' };
  }
  const database = db();
  if (database === null) {
    return { kind: 'sin-contador' };
  }

  const month = serverMonth(now);
  const day = serverDay(now);

  try {
    const rows = await database
      .insert(aiUsage)
      .values({ userId, month, count: unidades, day, dayCount: unidades })
      .onConflictDoUpdate({
        target: [aiUsage.userId, aiUsage.month],
        set: {
          count: sql`${aiUsage.count} + ${unidades}`,
          day: sql`${day}`,
          dayCount: sql`case when ${aiUsage.day} = ${day} then ${aiUsage.dayCount} + ${unidades} else ${unidades} end`,
        },
        // Sobre `day` ya cabe: el `if` de arriba garantiza `unidades <= daily`.
        setWhere: sql`${aiUsage.count} + ${unidades} <= ${limits.monthly}
          and (${aiUsage.day} <> ${day} or ${aiUsage.dayCount} + ${unidades} <= ${limits.daily})`,
      })
      .returning({ count: aiUsage.count, dayCount: aiUsage.dayCount });

    const row = rows[0];
    if (row !== undefined) {
      return { kind: 'ok', usage: { month: row.count, today: row.dayCount } };
    }

    // Sin fila: uno de los dos topes lo ha impedido. Se lee para saber cuál, que
    // es lo que permite decir «vuelve mañana» o «sube de plan» en vez de un
    // «límite alcanzado» que obliga a adivinar.
    const usage = await aiUsageOf(userId, now);
    return usage.month + unidades > limits.monthly
      ? { kind: 'sin-cupo-mensual' }
      : { kind: 'sin-cupo-diario' };
  } catch {
    // Si la base de datos no contesta, no se sirve la llamada al modelo. Al revés
    // —servir cuando no se puede contar— es la forma de que una caída de Postgres
    // se convierta en una factura.
    return { kind: 'sin-contador' };
  }
}

/** Lo que lleva gastado esa cuenta. Ceros también cuando no se puede saber. */
export async function aiUsageOf(userId: string, now: Date = new Date()): Promise<Usage> {
  const database = db();
  if (database === null) {
    return NO_USAGE;
  }
  const month = serverMonth(now);
  const day = serverDay(now);
  try {
    const [row] = await database
      .select({ count: aiUsage.count, day: aiUsage.day, dayCount: aiUsage.dayCount })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.month, month)))
      .limit(1);

    if (row === undefined) {
      return NO_USAGE;
    }
    // El contador del día solo cuenta si la fila es de hoy; si es de ayer, hoy no
    // se ha gastado nada todavía aunque el número siga guardado.
    return { month: row.count, today: row.day === day ? row.dayCount : 0 };
  } catch {
    return NO_USAGE;
  }
}
