/**
 * Lo que fallaste, para que vuelva.
 *
 * Una pregunta contestada mal y explicada se entiende en el momento y se olvida
 * en tres días. Esta es la cola que la trae de vuelta: dominio puro, sin reloj
 * —el día entra por parámetro, como en el resto del progreso— y sin texto.
 *
 * **Sin texto es la decisión que sostiene el fichero.** Una pregunta no se
 * guarda como frase sino como su sitio: la unidad y el número de pregunta dentro
 * de su lección. Las preguntas se generan en la tonalidad en la que estés, así
 * que guardar «¿Cuál es el V grado de Sol mayor?» daría una cola que no encaja
 * con nada en cuanto cambies de tonalidad. Guardando el sitio, el repaso se
 * vuelve a calcular en la tonalidad de hoy y sigue preguntando por lo mismo.
 */

/** Una pregunta esperando repaso. */
export interface ReviewItem {
  readonly unitId: string;
  /** Qué pregunta de esa lección, por su posición. */
  readonly index: number;
  /** Último día en que se vio, `AAAA-MM-DD`. */
  readonly seenOn: string;
  /** Aciertos seguidos desde el último fallo. */
  readonly hits: number;
}

export type ReviewQueue = readonly ReviewItem[];

export const EMPTY_REVIEW: ReviewQueue = [];

/**
 * Cuántos días hay que esperar según los aciertos que lleve.
 *
 * Dos pasos y fuera, no siete. Una cola de siete pasos necesita meses de
 * constancia para vaciarse, y una cola que no se vacía nunca deja de ser un
 * repaso y pasa a ser una deuda. Con dos pasos —hoy y mañana— el efecto se nota
 * y se puede llegar a tenerlo todo limpio, que es lo que hace que apetezca.
 */
export const REVIEW_INTERVALS: readonly number[] = [0, 1];

/** Con estos aciertos seguidos, la pregunta sale de la cola. */
export const MASTERED_HITS = REVIEW_INTERVALS.length;

/**
 * Tope de la cola.
 *
 * Sin tope, quien contesta a bulto durante un mes acumula cientos de preguntas
 * pendientes y el repaso se vuelve imposible de terminar. Al pasarse, se suelta
 * lo más viejo: lo que fallaste hace tres semanas ya no dice nada sobre lo que
 * te cuesta hoy.
 */
export const REVIEW_LIMIT = 60;

function isSame(item: ReviewItem, unitId: string, index: number): boolean {
  return item.unitId === unitId && item.index === index;
}

/** Días entre dos fechas `AAAA-MM-DD`, o `NaN` si alguna no lo es. */
function daysBetween(from: string, to: string): number {
  const parse = (day: string): number => Date.parse(`${day}T12:00:00Z`);
  const start = parse(from);
  const end = parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Number.NaN;
  }
  return Math.round((end - start) / 86_400_000);
}

/**
 * Apunta un fallo.
 *
 * Volver a fallar una pregunta que ya estaba en la cola no la duplica: la
 * reinicia. Lo que importa es que sigue sin saberse, no cuántas veces se ha
 * fallado.
 */
export function recordMiss(
  queue: ReviewQueue,
  unitId: string,
  index: number,
  day: string,
): ReviewQueue {
  const rest = queue.filter((item) => !isSame(item, unitId, index));
  const next: ReviewItem = { unitId, index, seenOn: day, hits: 0 };
  // El nuevo va al final y el recorte se hace por delante, así que lo que se
  // suelta al llegar al tope es siempre lo más antiguo.
  return [...rest, next].slice(-REVIEW_LIMIT);
}

/**
 * Apunta un acierto en repaso.
 *
 * Acertar algo que no estaba en la cola no hace nada: la cola es de lo que se
 * falló, no un historial de todo lo contestado.
 */
export function recordHit(
  queue: ReviewQueue,
  unitId: string,
  index: number,
  day: string,
): ReviewQueue {
  const found = queue.find((item) => isSame(item, unitId, index));
  if (found === undefined) {
    return queue;
  }
  const hits = found.hits + 1;
  if (hits >= MASTERED_HITS) {
    return queue.filter((item) => !isSame(item, unitId, index));
  }
  return queue.map((item) => (isSame(item, unitId, index) ? { ...item, seenOn: day, hits } : item));
}

/** Si a esa pregunta le toca hoy. */
export function isDue(item: ReviewItem, day: string): boolean {
  const wait = REVIEW_INTERVALS[Math.min(item.hits, REVIEW_INTERVALS.length - 1)] ?? 0;
  const gap = daysBetween(item.seenOn, day);
  // Una fecha imposible no puede dejar una pregunta atrapada para siempre: si no
  // se puede calcular la espera, toca.
  return Number.isNaN(gap) || gap >= wait;
}

/**
 * Lo que toca repasar hoy, lo más viejo primero.
 *
 * Lo más viejo primero y no lo más reciente: lo que llevas más tiempo sin ver es
 * lo que está más cerca de olvidarse del todo.
 */
export function dueReview(queue: ReviewQueue, day: string): readonly ReviewItem[] {
  // Sobre una copia: ordenar la cola en su sitio sería mutar lo que nos han
  // pasado, y esto es dominio puro.
  return [...queue]
    .filter((item) => isDue(item, day))
    .sort((a, b) => (a.seenOn === b.seenOn ? a.index - b.index : a.seenOn < b.seenOn ? -1 : 1));
}

/**
 * Una unidad está agrietada cuando tiene preguntas esperando repaso.
 *
 * Es lo que hace que el camino no sea una lista de cosas cerradas para siempre:
 * una unidad superada se agrieta y pide volver a pasar por ella.
 */
export function isUnitCracked(queue: ReviewQueue, unitId: string, day: string): boolean {
  return queue.some((item) => item.unitId === unitId && isDue(item, day));
}

export function crackedUnits(queue: ReviewQueue, day: string): readonly string[] {
  return [...new Set(dueReview(queue, day).map((item) => item.unitId))];
}

/**
 * Junta dos colas, quedándose con lo peor de cada una.
 *
 * Lo peor y no lo mejor: si un aparato dice que la pregunta se acertó dos veces
 * y el otro que se acaba de fallar, lo cierto es que se falló. Dar por sabido
 * algo que no se sabe es el único error que esta cola no puede permitirse.
 */
export function mergeReview(a: ReviewQueue, b: ReviewQueue): ReviewQueue {
  const merged = new Map<string, ReviewItem>();
  for (const item of [...a, ...b]) {
    const clave = `${item.unitId}#${item.index}`;
    const previo = merged.get(clave);
    if (previo === undefined) {
      merged.set(clave, item);
      continue;
    }
    merged.set(clave, {
      unitId: item.unitId,
      index: item.index,
      // La fecha más reciente, porque es la última vez que se vio de verdad.
      seenOn: item.seenOn > previo.seenOn ? item.seenOn : previo.seenOn,
      // Y los aciertos del que menos lleve: dar por sabido lo que no se sabe es
      // el único error que esta cola no puede permitirse.
      hits: Math.min(previo.hits, item.hits),
    });
  }
  return [...merged.values()].slice(-REVIEW_LIMIT);
}
