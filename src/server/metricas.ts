/**
 * La analítica: contar lo que pasa y saber si alguien vuelve, en nuestra base.
 *
 * Sin servicios de fuera, sin cookies y sin guardar direcciones IP
 * ([adr/0110](../../docs/adr/0110-contar-sin-seguir.md)). Son dos mitades:
 *
 * - **Lo sumado** (`metricas_conteo`): cuántas visitas tuvo cada ruta un día,
 *   cuántas unidades se terminaron, cuántas canciones se guardaron. Sin nadie
 *   dentro, ni seudónimo: no hay nada que relacionar.
 * - **Quién vuelve** (`metricas_visitantes` y `metricas_dias`): un seudónimo y los
 *   días en que estuvo. El seudónimo sale de la cuenta, si se ha entrado, o del
 *   identificador de un navegador **que ha dicho que sí**; quien no ha entrado ni
 *   lo ha dicho solo suma.
 *
 * **Sin base de datos no hace nada**, y un fallo de la base tampoco rompe nada:
 * contar es lo último que puede tumbar una petición que venía a otra cosa.
 */

import { createHmac } from 'node:crypto';

import { and, eq, gte, lt, sql } from 'drizzle-orm';

import {
  declaradoPorElNavegador,
  shiftDay,
  utcDay,
  type CountedEvent,
  type KnownRoute,
  type Retention,
} from '@core/analytics';

import { db } from './db/client';
import { metricasConteo, metricasDias, metricasVisitantes } from './db/schema';

/**
 * Trece meses: lo que se guarda un día de alguien antes de borrarlo.
 *
 * Es el plazo que la CNIL recomienda para un identificador de medición de
 * audiencia, y sobra para lo que se pregunta aquí —la ventana más larga es la de
 * los treinta días—. Lo sumado no caduca: no es de
 * nadie.
 */
export const DIAS_QUE_SE_GUARDAN = 395;

/**
 * El seudónimo de una cuenta o de un navegador.
 *
 * HMAC y no un SHA-256 a secas: un identificador de cuenta es un UUID que viaja
 * en la cookie, y con el hash desnudo bastaría con calcularlo para saber qué fila
 * es de quién. Con el secreto del servidor no. Sin secreto —una copia sin
 * cuentas— no hay cuentas que proteger, y el de un navegador ya es aleatorio.
 *
 * **Cambiar `AUTH_SECRET` cambia todos los seudónimos**, así que después de
 * rotarlo todo el mundo parece nuevo. Es el precio de no tener otra variable.
 */
export function seudonimo(de: 'cuenta' | 'navegador', id: string): string {
  return createHmac('sha256', process.env['AUTH_SECRET'] ?? '')
    .update(`${de}:${id}`)
    .digest('hex')
    .slice(0, 32);
}

export interface EventoContado {
  readonly evento: CountedEvent;
  readonly ruta: KnownRoute | '';
  /** El seudónimo, o nulo si nadie ha dado con qué reconocerle. */
  readonly visitante: string | null;
  /**
   * Si se puede apuntar a un visitante **que aún no existe**. Sin ella, sí.
   *
   * Lo pone la ruta para los seudónimos de navegador, que son un UUID que cualquiera
   * inventa: sesenta por minuto desde una dirección eran sesenta «primera vez» y la
   * retención decía lo que quisiera quien los mandaba (adr/0113). Si dice que no, el
   * evento se suma igual, sin nadie dentro.
   */
  readonly admitirNuevo?: () => Promise<boolean>;
}

/** Suma uno a la casilla de ese día, evento y ruta. */
async function sumar(
  database: NonNullable<ReturnType<typeof db>>,
  dia: string,
  evento: CountedEvent,
  ruta: string,
): Promise<void> {
  await database
    .insert(metricasConteo)
    .values({ dia, evento, ruta, cuenta: 1 })
    .onConflictDoUpdate({
      target: [metricasConteo.dia, metricasConteo.evento, metricasConteo.ruta],
      set: { cuenta: sql`${metricasConteo.cuenta} + 1` },
    });
}

/**
 * Si este visitante se puede apuntar: ya existía, o es nuevo y la ruta lo admite.
 *
 * Se pregunta **solo por los nuevos**, y por eso se mira antes si existe: el tope
 * de nuevos no puede gastarse con las visitas de quien ya vuelve.
 */
async function cabe(
  database: NonNullable<ReturnType<typeof db>>,
  visitante: string,
  evento: EventoContado,
): Promise<boolean> {
  if (evento.admitirNuevo === undefined) {
    return true;
  }
  const [existe] = await database
    .select({ visitante: metricasVisitantes.visitante })
    .from(metricasVisitantes)
    .where(eq(metricasVisitantes.visitante, visitante))
    .limit(1);
  return existe !== undefined || (await evento.admitirNuevo());
}

/**
 * Cada cuántos eventos se borra lo caducado. Lo mismo que la poda del límite de
 * frecuencia: una tarea programada más para borrar unas filas no compensa.
 */
const CADA_CUANTOS = 200;
let vistos = 0;

/**
 * Apunta un evento. Nunca lanza.
 *
 * `primera-vez` y `vuelve-otro-dia` no los manda nadie: salen de aquí, de si el
 * seudónimo ya existía y de si ese día ya estaba apuntado. Así no hay que fiarse
 * del navegador para decir que es nuevo, y veinte visitas en una tarde son una
 * vuelta y no veinte.
 */
export async function registrarEvento(evento: EventoContado, dia: string): Promise<void> {
  const database = db();
  if (database === null) {
    return;
  }

  try {
    await sumar(database, dia, evento.evento, evento.ruta);

    if (evento.visitante !== null && (await cabe(database, evento.visitante, evento))) {
      const visitante = evento.visitante;
      const [nuevo] = await database
        .insert(metricasVisitantes)
        .values({ visitante, primerDia: dia, ultimoDia: dia })
        .onConflictDoNothing()
        .returning({ visitante: metricasVisitantes.visitante });
      const [otroDia] = await database
        .insert(metricasDias)
        .values({ visitante, dia })
        .onConflictDoNothing()
        .returning({ dia: metricasDias.dia });

      if (nuevo !== undefined) {
        await sumar(database, dia, 'primera-vez', '');
      } else if (otroDia !== undefined) {
        await database
          .update(metricasVisitantes)
          .set({ ultimoDia: dia })
          .where(eq(metricasVisitantes.visitante, visitante));
        await sumar(database, dia, 'vuelve-otro-dia', '');
      }
    }

    vistos += 1;
    if (vistos % CADA_CUANTOS === 0) {
      await podar(dia);
    }
  } catch (error) {
    // Mudo en producción —contar no es una avería— pero no en desarrollo: un
    // `catch` mudo escondió una fase entera que el límite compartido no compartía.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[métricas] la base de datos no contesta:', error);
    }
  }
}

/** Borra los días de más de trece meses, y a quien no ha vuelto desde entonces. */
export async function podar(hoy: string): Promise<void> {
  const database = db();
  /* v8 ignore next 3 -- se poda despues de escribir, y para escribir hace falta la base */
  if (database === null) {
    return;
  }
  const limite = shiftDay(hoy, -DIAS_QUE_SE_GUARDAN);
  await database.delete(metricasDias).where(lt(metricasDias.dia, limite));
  await database.delete(metricasVisitantes).where(lt(metricasVisitantes.ultimoDia, limite));
}

/**
 * Olvida a una cuenta. Lo llama borrarla: el seudónimo no cuelga de `users` con
 * una clave foránea —no puede, es un HMAC—, así que el `on delete cascade` no
 * llega hasta aquí y hay que hacerlo a mano.
 */
export async function olvidarCuenta(userId: string): Promise<void> {
  const database = db();
  if (database === null) {
    return;
  }
  const visitante = seudonimo('cuenta', userId);
  try {
    await database.delete(metricasDias).where(eq(metricasDias.visitante, visitante));
    await database.delete(metricasVisitantes).where(eq(metricasVisitantes.visitante, visitante));
  } catch {
    // La cuenta ya está borrada; esto es lo que quedaba de ella, sin nombre.
  }
}

export interface Metricas {
  readonly hoy: string;
  readonly retencion: Retention;
  /**
   * Lo sumado de los últimos treinta días, por evento y ruta.
   *
   * `declarado` dice que **lo cuenta el navegador y nadie lo comprueba**: una
   * visita, una unidad terminada o una toma grabada pueden mandarse a mano. Lo
   * demás lo cuenta el servidor al hacerlo (adr/0113).
   */
  readonly ultimos30: ReadonlyArray<{
    evento: string;
    ruta: string;
    cuenta: number;
    declarado: boolean;
  }>;
}

/** Un día en SQL: el texto `AAAA-MM-DD` con su tipo, para poder sumarle días. */
const dia = (texto: string) => sql`${texto}::date`;

/** Cuántas filas cumplen una condición, como entero. */
const cuantos = (condicion: ReturnType<typeof sql>) =>
  sql<number>`(count(*) filter (where ${condicion}))::int`;

/**
 * La retención, contada en Postgres.
 *
 * **Antes se traían a memoria todos los visitantes y sus días** y se contaban en
 * `computeRetention`: con trece meses guardados, la memoria de leer crecía con
 * cada visitante, y sin tope de nuevos cualquiera podía hacerla crecer. Ahora sale
 * una fila con ocho números, sea cual sea el tamaño de la tabla.
 *
 * **La definición sigue siendo la de `core/analytics.ts`.** Esto la escribe otra
 * vez en SQL, y por eso `metricas.test.ts` compara las dos con los mismos
 * visitantes: si una cambia sin la otra, falla. Cada visitante se resume en
 * banderas —estuvo en los últimos siete días, volvió entre el día 7 y el 13 tras
 * el primero, estuvo en cada una de las cuatro semanas— y fuera se cuentan.
 */
async function retencionEnSql(
  database: NonNullable<ReturnType<typeof db>>,
  hoy: string,
): Promise<Retention> {
  const d = metricasDias.dia;
  const primero = metricasVisitantes.primerDia;
  const entre = (desde: ReturnType<typeof sql>, hasta: ReturnType<typeof sql>) =>
    sql<boolean>`coalesce(bool_or(${d} between ${desde} and ${hasta}), false)`;
  const semana = (atras: number) =>
    entre(dia(shiftDay(hoy, -7 * atras - 6)), dia(shiftDay(hoy, -7 * atras)));

  const porVisitante = database
    .select({
      primero,
      activo: entre(dia(shiftDay(hoy, -6)), dia(hoy)).as('activo'),
      volvio7: entre(sql`${primero} + 7`, sql`${primero} + 13`).as('volvio7'),
      volvio30: entre(sql`${primero} + 30`, sql`${primero} + 36`).as('volvio30'),
      enElMes: entre(dia(shiftDay(hoy, -27)), dia(hoy)).as('en_el_mes'),
      semana3: semana(3).as('semana3'),
      semana2: semana(2).as('semana2'),
      semana1: semana(1).as('semana1'),
      semana0: semana(0).as('semana0'),
    })
    .from(metricasVisitantes)
    .leftJoin(
      metricasDias,
      and(
        eq(metricasDias.visitante, metricasVisitantes.visitante),
        gte(metricasDias.dia, shiftDay(hoy, -DIAS_QUE_SE_GUARDAN)),
      ),
    )
    .groupBy(metricasVisitantes.visitante, primero)
    .as('por_visitante');

  const v = porVisitante;
  const cohorte7 = sql`${v.primero} + 13 <= ${dia(hoy)}`;
  const cohorte30 = sql`${v.primero} + 36 <= ${dia(hoy)}`;
  const cohorteSemanal = sql`${v.primero} <= ${dia(shiftDay(hoy, -27))} and ${v.enElMes}`;
  const [fila] = await database
    .select({
      activeLast7: cuantos(sql`${v.activo}`),
      newLast7: cuantos(sql`${v.activo} and ${v.primero} >= ${dia(shiftDay(hoy, -6))}`),
      day7Cohort: cuantos(cohorte7),
      day7Returned: cuantos(sql`${cohorte7} and ${v.volvio7}`),
      day30Cohort: cuantos(cohorte30),
      day30Returned: cuantos(sql`${cohorte30} and ${v.volvio30}`),
      weeklyCohort: cuantos(cohorteSemanal),
      weeklyReturned: cuantos(
        sql`${cohorteSemanal} and ${v.semana3} and ${v.semana2} and ${v.semana1} and ${v.semana0}`,
      ),
    })
    .from(porVisitante);

  // Un `select` de recuentos sin `group by` devuelve siempre una fila, también
  // con la tabla vacía.
  const n = fila!;
  return {
    activeLast7: n.activeLast7,
    newLast7: n.newLast7,
    day7: { cohort: n.day7Cohort, returned: n.day7Returned },
    day30: { cohort: n.day30Cohort, returned: n.day30Returned },
    weekly: { cohort: n.weeklyCohort, returned: n.weeklyReturned },
  };
}

/** Lo que se lee: si vuelven, y lo sumado del último mes. */
export async function leerMetricas(hoy: string): Promise<Metricas | null> {
  const database = db();
  if (database === null) {
    return null;
  }

  const [retencion, conteo] = await Promise.all([
    retencionEnSql(database, hoy),
    database
      .select({
        evento: metricasConteo.evento,
        ruta: metricasConteo.ruta,
        cuenta: sql<number>`sum(${metricasConteo.cuenta})::int`,
      })
      .from(metricasConteo)
      .where(gte(metricasConteo.dia, shiftDay(hoy, -29)))
      .groupBy(metricasConteo.evento, metricasConteo.ruta)
      .orderBy(metricasConteo.evento, metricasConteo.ruta),
  ]);

  return {
    hoy,
    retencion,
    ultimos30: conteo.map((fila) => ({ ...fila, declarado: declaradoPorElNavegador(fila.evento) })),
  };
}

/**
 * Si el navegador pide que no se le siga: `DNT: 1` o `Sec-GPC: 1`.
 *
 * Se respeta **en el servidor** además de en el navegador: lo que manda la
 * cabecera es lo que la persona configuró, y una página vieja en caché o un
 * script que no la mire no puede saltársela. Con cualquiera de las dos no se
 * cuenta nada, ni sumado: es más simple de explicar que «solo lo sumado».
 */
export function noQuiereQueLeSigan(headers: Headers): boolean {
  return headers.get('dnt') === '1' || headers.get('sec-gpc') === '1';
}

/**
 * Lo que cuenta el servidor por su cuenta —guardar una canción—, con el
 * seudónimo de la cuenta que lo hizo. Nunca lanza y nunca hace esperar más de
 * lo que tarda la base en contestar.
 */
export async function contarEnElServidor(
  request: Request,
  evento: CountedEvent,
  userId: string,
  ahora: number = Date.now(),
): Promise<void> {
  if (noQuiereQueLeSigan(request.headers)) {
    return;
  }
  await registrarEvento(
    { evento, ruta: '', visitante: seudonimo('cuenta', userId) },
    utcDay(ahora),
  );
}
