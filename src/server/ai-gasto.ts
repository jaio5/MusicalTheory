/**
 * El techo de gasto de la IA **entre todos**, en dinero y no en preguntas.
 *
 * El cupo de cada cuenta (`ai-usage.ts`) acota a cada una, y nada acotaba la
 * suma. Con quince preguntas gratis por cuenta y un registro que no confirma el
 * correo, cien direcciones registrando cuentas al ritmo que deja el límite de
 * frecuencia gastaban unos 650 $ por hora con Sonnet 5.5, y eso no lo paraba
 * nadie más que la factura (adr/0114).
 *
 * Cuatro topes, en una fila por mes (`ai_gasto`):
 *
 * - **El del día y el del mes, para todos.** Cierran la IA a todo el mundo, de
 *   pago incluido, con un 503 que lo dice. Es el último muro: si se toca, algo va
 *   mal o el número se ha quedado pequeño.
 * - **El del día y el del mes del plan gratis**, más bajos y aparte: lo gratis es
 *   lo que se puede fabricar registrando cuentas, y con su propio techo un ataque
 *   con cuentas gratis cierra lo gratis sin cerrar lo que se paga.
 *
 * **Se reserva el peor caso antes de llamar y se asienta lo real después.**
 * Reservar es lo que lo hace atómico —los cuatro topes van en el `where` del
 * `on conflict`, como el cupo—: contar después dejaría pasar a la vez a todas las
 * peticiones que llegan antes de que la primera termine. Asentar es lo que lo
 * hace honrado: lo real sale del `usage` de la API (`costeDeUso`), y lo que no
 * trae `usage` se queda en el peor caso. Si el proceso se cae entre las dos, la
 * reserva se queda entera: se cuenta de más, nunca de menos.
 *
 * **Solo cuenta con la API.** El modelo de casa y el dominio no cuestan, y no
 * pasan por aquí. **Y sin base de datos no se sirve**: sin cuentas no hay IA
 * (`entitlements.ts`), y aquí `sin-contador` cierra igual que el cupo.
 */

import { sql, eq } from 'drizzle-orm';

import { db } from './db/client';
import { aiGasto } from './db/schema';
import { serverDay, serverMonth } from './ai-usage';

/** Los cuatro topes, en micro-dólares. */
export interface TopesDeGasto {
  readonly diario: number;
  readonly mensual: number;
  readonly gratisDiario: number;
  readonly gratisMensual: number;
}

/**
 * Los topes de serie, en dólares, y **son prudentes a propósito**: los de una
 * copia que acaba de abrir. Quien tenga clientes que pagan los sube, sabiendo
 * que el mensual tiene que cubrir lo que pueden gastar sus cuentas de pago
 * (`docs/DESPLIEGUE.md`). Al revés —uno alto por defecto— el primer ataque se
 * descubre en la factura.
 *
 * - **10 $ al día y 150 $ al mes para todos.** Unas novecientas preguntas al día
 *   en el peor caso con Sonnet 5.5.
 * - **2 $ al día y 30 $ al mes para lo gratis**: unas ciento ochenta preguntas, o
 *   sesenta cuentas gastando su cupo diario entero.
 */
export const TOPES_DE_SERIE_USD = {
  diario: 10,
  mensual: 150,
  gratisDiario: 2,
  gratisMensual: 30,
} as const;

/** Las variables de entorno de cada tope, en dólares. */
export const VARIABLES_DE_LOS_TOPES = {
  diario: 'IA_TOPE_DIARIO_USD',
  mensual: 'IA_TOPE_MENSUAL_USD',
  gratisDiario: 'IA_TOPE_GRATIS_DIARIO_USD',
  gratisMensual: 'IA_TOPE_GRATIS_MENSUAL_USD',
} as const;

/**
 * Un tope del entorno, en micro-dólares, o el de serie.
 *
 * Un número que no se entiende —vacío, negativo, «diez»— **no apaga el tope**: se
 * queda el de serie. Un error al escribir el `.env` no puede convertirse en gasto
 * sin límite. Cero sí vale, y cierra.
 */
function topeDe(variable: string, deSerie: number): number {
  const crudo = process.env[variable];
  const dolares = crudo === undefined || crudo.trim() === '' ? NaN : Number(crudo);
  const valido = Number.isFinite(dolares) && dolares >= 0 ? dolares : deSerie;
  return Math.round(valido * 1_000_000);
}

/** Los topes de ahora, leídos en cada petición como el resto del entorno. */
export function topesDeGasto(): TopesDeGasto {
  return {
    diario: topeDe(VARIABLES_DE_LOS_TOPES.diario, TOPES_DE_SERIE_USD.diario),
    mensual: topeDe(VARIABLES_DE_LOS_TOPES.mensual, TOPES_DE_SERIE_USD.mensual),
    gratisDiario: topeDe(VARIABLES_DE_LOS_TOPES.gratisDiario, TOPES_DE_SERIE_USD.gratisDiario),
    gratisMensual: topeDe(VARIABLES_DE_LOS_TOPES.gratisMensual, TOPES_DE_SERIE_USD.gratisMensual),
  };
}

/** Lo reservado por una petición, para asentarlo o devolverlo después. */
export interface Reserva {
  readonly mes: string;
  readonly dia: string;
  readonly micros: number;
  readonly gratis: boolean;
}

/** Qué tope ha cerrado: de quién y de cuándo. */
export interface TopeAlcanzado {
  readonly quien: 'todos' | 'gratis';
  readonly cuando: 'dia' | 'mes';
}

export type ResultadoDeReservar =
  | { readonly kind: 'ok'; readonly reserva: Reserva }
  | ({ readonly kind: 'tope' } & TopeAlcanzado)
  /** No se ha podido contar, así que no se sirve. */
  | { readonly kind: 'sin-contador' };

interface Fila {
  readonly micros: number;
  readonly dia: string;
  readonly diaMicros: number;
  readonly gratisMicros: number;
  readonly gratisDiaMicros: number;
}

/**
 * Cuál de los topes no deja pasar `micros` más, con la fila como está. Nulo si
 * caben todos. El de todos primero: es el que más dice.
 */
export function topeQueCierra(
  fila: Fila | null,
  micros: number,
  gratis: boolean,
  hoy: string,
  topes: TopesDeGasto,
): TopeAlcanzado | null {
  const deHoy = fila !== null && fila.dia === hoy;
  const mes = fila?.micros ?? 0;
  const dia = deHoy ? fila.diaMicros : 0;
  if (mes + micros > topes.mensual) {
    return { quien: 'todos', cuando: 'mes' };
  }
  if (dia + micros > topes.diario) {
    return { quien: 'todos', cuando: 'dia' };
  }
  if (!gratis) {
    return null;
  }
  if ((fila?.gratisMicros ?? 0) + micros > topes.gratisMensual) {
    return { quien: 'gratis', cuando: 'mes' };
  }
  if ((deHoy ? fila.gratisDiaMicros : 0) + micros > topes.gratisDiario) {
    return { quien: 'gratis', cuando: 'dia' };
  }
  return null;
}

/**
 * Reserva el peor caso de una petición, si cabe en los topes que le tocan.
 *
 * **Una sola sentencia**, como `spendAiRequest`: sube los contadores y comprueba
 * los topes en el `where` del `on conflict`. Sin fila de vuelta es que un tope lo
 * ha impedido, y se lee la fila para decir cuál. Las condiciones de lo gratis
 * solo van cuando la petición es gratis: si no, un exceso de lo gratis cerraría
 * también lo que se paga.
 */
export async function reservarGasto(
  micros: number,
  gratis: boolean,
  now: Date = new Date(),
): Promise<ResultadoDeReservar> {
  const topes = topesDeGasto();
  const mes = serverMonth(now);
  const dia = serverDay(now);

  // La fila nueva entra por el `insert` y no pasa por el `where` del conflicto:
  // lo que no cabe ni con el contador a cero se para aquí.
  const sinNada = topeQueCierra(null, micros, gratis, dia, topes);
  if (sinNada !== null) {
    return { kind: 'tope', ...sinNada };
  }
  const database = db();
  if (database === null) {
    return { kind: 'sin-contador' };
  }

  const g = gratis ? micros : 0;
  const deHoy = sql`${aiGasto.dia} = ${dia}`;
  const condiciones = [
    sql`${aiGasto.micros} + ${micros} <= ${topes.mensual}`,
    sql`(not ${deHoy} or ${aiGasto.diaMicros} + ${micros} <= ${topes.diario})`,
    ...(gratis
      ? [
          sql`${aiGasto.gratisMicros} + ${micros} <= ${topes.gratisMensual}`,
          sql`(not ${deHoy} or ${aiGasto.gratisDiaMicros} + ${micros} <= ${topes.gratisDiario})`,
        ]
      : []),
  ];

  try {
    const filas = await database
      .insert(aiGasto)
      .values({ mes, micros, dia, diaMicros: micros, gratisMicros: g, gratisDiaMicros: g })
      .onConflictDoUpdate({
        target: aiGasto.mes,
        set: {
          micros: sql`${aiGasto.micros} + ${micros}`,
          dia: sql`${dia}`,
          diaMicros: sql`case when ${deHoy} then ${aiGasto.diaMicros} + ${micros} else ${micros} end`,
          gratisMicros: sql`${aiGasto.gratisMicros} + ${g}`,
          gratisDiaMicros: sql`case when ${deHoy} then ${aiGasto.gratisDiaMicros} + ${g} else ${g} end`,
        },
        setWhere: sql.join(condiciones, sql` and `),
      })
      .returning({ mes: aiGasto.mes });

    if (filas.length > 0) {
      return { kind: 'ok', reserva: { mes, dia, micros, gratis } };
    }

    const [fila] = await database.select().from(aiGasto).where(eq(aiGasto.mes, mes)).limit(1);
    // Si la fila ya no dice por qué —otra petición asentó entre medias y ahora
    // cabría—, se dice el del mes de todos: no se reintenta aquí, y quien pide
    // vuelve a probar.
    /* v8 ignore start -- sin fila o sin tope que cierre solo se da si otra peticion asienta entre la escritura y esta lectura */
    const cierra = topeQueCierra(fila ?? null, micros, gratis, dia, topes) ?? {
      quien: 'todos',
      cuando: 'mes',
    };
    /* v8 ignore stop */
    return { kind: 'tope', ...cierra };
  } catch {
    // Si la base no contesta, no se sirve: servir sin contar es como una caída de
    // Postgres se convierte en una factura.
    return { kind: 'sin-contador' };
  }
}

/**
 * Cambia lo reservado por lo gastado de verdad: suma `real - reservado`.
 *
 * Casi siempre resta, porque se reserva el peor caso. **El día solo se toca si
 * sigue siendo el de la reserva**: pasada la medianoche, la reserva se quedó en
 * el contador de ayer, que ya no cuenta. Nunca baja de cero.
 *
 * No lanza ni contesta: si falla, la reserva se queda entera, que es contar de
 * más.
 */
export async function asentarGasto(reserva: Reserva, realMicros: number): Promise<void> {
  const database = db();
  if (database === null) {
    return;
  }
  const delta = Math.round(realMicros) - reserva.micros;
  const g = reserva.gratis ? delta : 0;
  const deEseDia = sql`${aiGasto.dia} = ${reserva.dia}`;
  try {
    await database
      .update(aiGasto)
      .set({
        micros: sql`greatest(0, ${aiGasto.micros} + ${delta})`,
        diaMicros: sql`case when ${deEseDia} then greatest(0, ${aiGasto.diaMicros} + ${delta}) else ${aiGasto.diaMicros} end`,
        gratisMicros: sql`greatest(0, ${aiGasto.gratisMicros} + ${g})`,
        gratisDiaMicros: sql`case when ${deEseDia} then greatest(0, ${aiGasto.gratisDiaMicros} + ${g}) else ${aiGasto.gratisDiaMicros} end`,
      })
      .where(eq(aiGasto.mes, reserva.mes));
  } catch {
    // Contar de más no tumba la respuesta, que ya está pagada.
  }
}

/** Devuelve una reserva entera: la petición no ha llegado al modelo. */
export async function devolverGasto(reserva: Reserva): Promise<void> {
  await asentarGasto(reserva, 0);
}

/** Lo gastado este mes, para el registro y los tests. Nulo si no se sabe. */
export async function gastoDelMes(now: Date = new Date()): Promise<Fila | null> {
  const database = db();
  if (database === null) {
    return null;
  }
  try {
    const [fila] = await database
      .select()
      .from(aiGasto)
      .where(eq(aiGasto.mes, serverMonth(now)))
      .limit(1);
    return fila ?? null;
  } catch {
    return null;
  }
}

/**
 * Los segundos hasta que se abra el tope que ha cerrado: la medianoche UTC
 * siguiente, o el día uno del mes que viene. Es el `Retry-After` del 503.
 */
export function segundosHastaQueAbra(cuando: 'dia' | 'mes', now: Date = new Date()): number {
  const abre =
    cuando === 'dia'
      ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((abre - now.getTime()) / 1000));
}
