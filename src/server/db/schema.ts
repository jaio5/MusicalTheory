/**
 * Las cuatro tablas. No hay más.
 *
 * Antes de esto la aplicación no tenía base de datos, y sigue sin necesitarla
 * para casi nada: el afinador, la rueda, el mástil, el metrónomo y la grabación
 * no guardan una fila. La base de datos existe para cuatro cosas que no pueden
 * vivir en el navegador: saber quién eres, qué plan tienes, cuántas llamadas al
 * modelo llevas hoy y las canciones que has guardado.
 *
 * **Ni audio ni vídeo, aquí tampoco.** Lo que se guarda del progreso son
 * identificadores de unidad, números y fechas; lo que se guarda de una canción
 * son grados, un tempo y nombres de sección. Ni una muestra de sonido.
 */

import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** Siempre en minúsculas: se normaliza antes de escribir. */
  email: text('email').notNull().unique(),
  /** Cómo quiere que le llamen. Puede no haberlo dicho. */
  name: text('name'),
  /**
   * La contraseña cifrada, con su formato dentro de la propia cadena. Nunca la
   * contraseña. Cómo se calcula está en `server/password.ts`.
   */
  passwordHash: text('password_hash').notNull(),
  /**
   * El identificador del plan, en texto y no como enumerado de Postgres.
   *
   * En texto porque un enumerado obliga a una migración para añadir un plan, y
   * porque `planOf` ya trata como gratis cualquier valor que no reconozca: la
   * base de datos no es el sitio donde se defiende esta regla.
   */
  plan: text('plan').notNull().default('gratis'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * El avance, uno por cuenta y guardado entero como documento.
 *
 * Como documento y no como una fila por unidad terminada porque se lee y se
 * escribe siempre completo: la pantalla de aprender necesita el avance entero
 * para pintar el camino, y `parseProgress` ya sabe interpretarlo y limpiarlo.
 * Una tabla de unidades sería más ortodoxa y no resolvería ninguna pregunta que
 * alguien vaya a hacer.
 *
 * Lo que se pierde: no se puede preguntar «cuánta gente terminó el tercer
 * curso» sin abrir todos los documentos. Cuando eso haga falta, se normaliza.
 */
export const progress = pgTable('progress', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cuántas llamadas al modelo lleva cada cuenta, este mes y hoy.
 *
 * **Una fila por cuenta y mes, con el día dentro.** No es un ahorro de filas: es
 * lo que permite comprobar los dos topes —el del mes y el del día— en una sola
 * sentencia atómica. Con dos tablas hacen falta dos escrituras, y entre las dos
 * hay una rendija por la que dos peticiones simultáneas se cuelan; o hay que
 * devolver la primera cuando la segunda falla, que es un caso más que puede salir
 * mal justo donde se está contando dinero.
 *
 * `day` y `dayCount` son el día en curso: cuando llega una petición de otro día,
 * el contador diario se pone a uno y el mensual sigue subiendo. Así no hace falta
 * borrar nada nunca.
 *
 * Lo que se pierde: el histórico por días. Antes había una fila por día y se podía
 * dibujar el uso de un mes; ahora solo se sabe el mes y el día de hoy. Se cambia a
 * gusto por la atomicidad, y el día que haga falta el histórico se añade una tabla
 * de solo escritura al lado, sin tocar esta.
 */
export const aiUsage = pgTable(
  'ai_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** `AAAA-MM`: el mes de facturación, en UTC como el resto del cupo. */
    month: text('month').notNull(),
    /** Peticiones de todo el mes. Es el contador que protege el dinero. */
    count: integer('count').notNull().default(0),
    /** `AAAA-MM-DD` del último día con actividad. */
    day: date('day').notNull(),
    /** Peticiones de ese día. Evita fundirse el mes en una tarde. */
    dayCount: integer('day_count').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })],
);

/**
 * Las canciones de una cuenta. Una fila por canción, y no un documento por
 * cuenta como el avance.
 *
 * La diferencia con `progress` es la pregunta que se hace: el avance se lee y se
 * escribe siempre entero —la pantalla de aprender necesita el camino completo—,
 * mientras que una canción se abre, se renombra y se borra **de una en una**. Con
 * todas dentro de un documento, renombrar una sería reescribir las cincuenta, y
 * dos pestañas abiertas se pisarían la una a la otra.
 *
 * `name` sale del documento y sube a columna porque es lo único que se necesita
 * para pintar la lista: así listar veinte canciones no abre veinte `jsonb`. No
 * está duplicado dentro de `data`; el nombre vive aquí y solo aquí.
 *
 * Lo que hay en `data` son **grados**, no cifrados, y eso lo decide
 * `core/music/song.ts`. Ni audio ni vídeo, aquí tampoco.
 */
export const songs = pgTable(
  'songs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Se lista siempre lo de una cuenta y por fecha. Sin este índice, cada lista
  // recorre las canciones de todo el mundo para quedarse con las de uno.
  (table) => [index('songs_user_updated_idx').on(table.userId, table.updatedAt)],
);
