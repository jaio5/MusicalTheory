/**
 * Lo que se cuenta de cómo se usa la aplicación, y cómo se lee si alguien vuelve.
 *
 * TypeScript puro, como todo `core/`: aquí no hay base de datos ni `fetch`. Lo
 * comparten la ruta que recibe los eventos —que tiene que decidir qué se guarda—
 * y el navegador, que solo importa los tipos (`import type`) para no meter nada
 * de esto en el paquete de todas las rutas.
 *
 * **Lo que se puede guardar está escrito aquí, y nada más** (regla 4: a la base
 * de datos solo identificadores, números y fechas). Un evento es uno de una lista
 * cerrada, una ruta es uno de unos pocos patrones —`/aprender/[unidad]`, no la
 * unidad— y lo demás se tira. Nada que alguien escriba llega a una fila
 * ([adr/0110](../../docs/adr/0110-contar-sin-seguir.md)).
 */

import { isRecord } from './parse';

/** Lo que el navegador puede contar. Lo demás lo cuenta el servidor. */
export const BROWSER_EVENTS = ['visita', 'unidad-terminada', 'toma-grabada'] as const;
export type BrowserEvent = (typeof BROWSER_EVENTS)[number];

/**
 * Si un evento lo declara el navegador, y por tanto **nadie lo comprueba**.
 *
 * Una «unidad terminada» la manda el navegador al guardar el avance, y cualquiera
 * puede mandarla a mano: es lo que dice quien la manda, no algo que haya pasado
 * aquí. Se cuenta igual —es lo único que hay sin tocar el avance— pero la lectura
 * lo marca, para no leerla como se lee una canción guardada, que sí cuenta el
 * servidor al guardarla ([adr/0113](../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 */
export function declaradoPorElNavegador(evento: string): boolean {
  return BROWSER_EVENTS.some((declarado) => declarado === evento);
}

/**
 * Todo lo que acaba en la tabla de cuentas.
 *
 * `cancion-guardada` la cuenta la ruta de las canciones, porque guardar ya pasa
 * por el servidor y preguntarle al navegador sería fiarse de él para nada.
 * `primera-vez` y `vuelve-otro-dia` no los manda nadie: salen de comparar el día
 * con los que ya había de ese visitante.
 */
export type CountedEvent = BrowserEvent | 'cancion-guardada' | 'primera-vez' | 'vuelve-otro-dia';

/**
 * Las rutas que existen, en la forma en que se guardan.
 *
 * Las que llevan un trozo variable se guardan con el hueco y no con lo que va
 * dentro: qué unidad abre cada uno no es una pregunta que haga falta contestar
 * para saber si vuelve, y una dirección escrita a mano es texto libre.
 */
export const KNOWN_ROUTES = [
  '/',
  '/aprender',
  '/aprender/repaso',
  '/aprender/[unidad]',
  '/componer',
  '/afinar',
  '/profesor',
  '/planes',
  '/planes/[plan]',
  '/registro',
  '/cuenta',
  '/olvidada',
  '/privacidad',
  '/aviso-legal',
] as const;
export type KnownRoute = (typeof KNOWN_ROUTES)[number] | 'otra';

/** Una dirección cualquiera, convertida en una de las de arriba o en «otra». */
export function normalizeRoute(path: string): KnownRoute {
  const clean = path.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';
  const known = KNOWN_ROUTES.find((route) => route === clean);
  if (known !== undefined) {
    return known;
  }
  if (/^\/aprender\/[^/]+$/.test(clean)) {
    return '/aprender/[unidad]';
  }
  if (/^\/planes\/[^/]+$/.test(clean)) {
    return '/planes/[plan]';
  }
  return 'otra';
}

/**
 * El identificador de un navegador que ha dicho que sí: un UUID y nada más.
 *
 * Se exige la forma para que no viaje otra cosa por ese campo —un correo, una
 * frase— y acabe guardada aunque sea cifrada.
 */
const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface BrowserReport {
  readonly event: BrowserEvent;
  /** Solo en las visitas: en lo demás la ruta no dice nada. */
  readonly route: KnownRoute | '';
  /** El del navegador, si ha dicho que sí. */
  readonly deviceId: string | null;
}

/** Lo que manda el navegador, o nulo si no es un evento que se cuente. */
export function parseBrowserReport(raw: unknown): BrowserReport | null {
  if (!isRecord(raw)) {
    return null;
  }
  const event = BROWSER_EVENTS.find((known) => known === raw['evento']);
  if (event === undefined) {
    return null;
  }
  const route = event === 'visita' && typeof raw['ruta'] === 'string' ? raw['ruta'] : null;
  const id = raw['visitante'];
  return {
    event,
    route: route === null ? '' : normalizeRoute(route),
    deviceId: typeof id === 'string' && DEVICE_ID.test(id) ? id : null,
  };
}

/** `AAAA-MM-DD` de un instante, en UTC como el resto de fechas guardadas. */
export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** Un día `AAAA-MM-DD` movido `days` días. */
export function shiftDay(day: string, days: number): string {
  return utcDay(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000);
}

/** Lo que se sabe de un visitante: su primer día y los días en que estuvo. */
export interface VisitorDays {
  readonly firstDay: string;
  readonly days: readonly string[];
}

/** Cuántos podían volver y cuántos volvieron. Los dos números, no el tanto por ciento. */
export interface Returned {
  readonly cohort: number;
  readonly returned: number;
}

export interface Retention {
  /** Visitantes distintos en los últimos siete días, hoy incluido. */
  readonly activeLast7: number;
  /** De ellos, los que llegaron por primera vez en esos siete días. */
  readonly newLast7: number;
  /** Volvió en su segunda semana: algún día entre el 7 y el 13 después del primero. */
  readonly day7: Returned;
  /** Seguía a los treinta: algún día entre el 30 y el 36 después del primero. */
  readonly day30: Returned;
  /**
   * Vuelven cada semana: de los que llegaron hace cuatro semanas o más y han
   * estado en las cuatro últimas, cuántos estuvieron **en cada una**.
   */
  readonly weekly: Returned;
}

/**
 * Si alguien volvió, contado de la manera más aburrida posible.
 *
 * **Es la definición, no la lectura.** La lectura va en SQL
 * (`server/metricas.ts`), para no traer a memoria todos los visitantes, y
 * `server/metricas.test.ts` comprueba que da lo mismo que esto con los mismos
 * datos.
 *
 * **Ventanas y no días sueltos.** «Volvió el día 7 exacto» con veinte visitantes
 * es ruido: quien vuelve el 8 cuenta como perdido. Una semana de ventana es lo
 * que usa cualquier panel de retención y lo que se puede leer con pocos datos.
 *
 * **Y solo entra en la cuenta quien ha tenido tiempo de volver**: alguien que
 * llegó hace tres días no puede haber vuelto en su segunda semana, y contarlo
 * como perdido hundiría el número cada vez que llega gente nueva.
 */
export function computeRetention(visitors: readonly VisitorDays[], today: string): Retention {
  const sinceLast7 = shiftDay(today, -6);
  const day7 = { cohort: 0, returned: 0 };
  const day30 = { cohort: 0, returned: 0 };
  const weekly = { cohort: 0, returned: 0 };
  let activeLast7 = 0;
  let newLast7 = 0;

  // Las cuatro últimas semanas, de la más antigua a hoy, cada una de siete días.
  const weeks = [3, 2, 1, 0].map((back) => ({
    from: shiftDay(today, -7 * back - 6),
    to: shiftDay(today, -7 * back),
  }));

  for (const { firstDay, days } of visitors) {
    const within = (from: string, to: string) => days.some((day) => day >= from && day <= to);

    if (within(sinceLast7, today)) {
      activeLast7 += 1;
      if (firstDay >= sinceLast7) {
        newLast7 += 1;
      }
    }

    if (shiftDay(firstDay, 13) <= today) {
      day7.cohort += 1;
      if (within(shiftDay(firstDay, 7), shiftDay(firstDay, 13))) {
        day7.returned += 1;
      }
    }

    if (shiftDay(firstDay, 36) <= today) {
      day30.cohort += 1;
      if (within(shiftDay(firstDay, 30), shiftDay(firstDay, 36))) {
        day30.returned += 1;
      }
    }

    if (firstDay <= weeks[0]!.from && within(weeks[0]!.from, today)) {
      weekly.cohort += 1;
      if (weeks.every((week) => within(week.from, week.to))) {
        weekly.returned += 1;
      }
    }
  }

  return { activeLast7, newLast7, day7, day30, weekly };
}
