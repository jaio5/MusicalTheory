/**
 * Lo que llevas hecho: qué está desbloqueado, cuánto has sumado y qué medallas
 * tienes.
 *
 * Es dominio puro y sin reloj. El día entra por parámetro como una cadena
 * `AAAA-MM-DD`, igual que el instante entra por parámetro en el ejercicio de
 * escala. Así una racha de treinta días se prueba en un milisegundo, sin
 * simular relojes ni esperar.
 *
 * El desbloqueo era lineal desde la primera unidad, y se defendía aquí mismo con
 * que la escalera se sostiene sobre que cada curso usa solo lo explicado antes. Ese
 * argumento sigue valiendo hacia adelante, y ya no vale hacia atrás: quien lleva
 * diez años tocando y viene a por las sustituciones no hace once unidades de peaje,
 * cierra la pestaña. Ahora se elige el punto de partida —`startCourse`— y desde ahí
 * la escalera funciona igual. El porqué y las alternativas, en
 * [adr/0007](../../../docs/adr/0007-elegir-por-donde-empezar.md).
 */

import { COURSES, findUnit, TOTAL_XP, UNIT_ORDER, type Course, type GradeId } from './curriculum';
import {
  EMPTY_REVIEW,
  MASTERED_HITS,
  mergeReview,
  recordHit,
  recordMiss,
  type ReviewItem,
  type ReviewQueue,
} from './review';

export type BadgeId =
  | 'primer-paso'
  | 'primera-escala'
  | 'cinco-escalas'
  | 'sin-fallar'
  | 'curso-completo'
  | 'elemental-superado'
  | 'profesional-superado'
  | 'racha-siete'
  | 'repaso-al-dia'
  | 'meta-diaria';

export interface Badge {
  readonly id: BadgeId;
  readonly name: string;
  /** Qué hay que hacer para tenerla. Se enseña también cuando no se tiene. */
  readonly how: string;
}

export const BADGES: readonly Badge[] = [
  { id: 'primer-paso', name: 'Primer paso', how: 'Termina tu primera unidad.' },
  {
    id: 'primera-escala',
    name: 'Manos al mástil',
    how: 'Toca una escala entera, subiendo y bajando, validada por el micro.',
  },
  { id: 'cinco-escalas', name: 'Cinco escalas', how: 'Supera cinco unidades de tocar.' },
  {
    id: 'sin-fallar',
    name: 'Sin un fallo',
    how: 'Termina una unidad de teoría acertando todas a la primera.',
  },
  { id: 'curso-completo', name: 'Curso cerrado', how: 'Termina todas las unidades de un curso.' },
  {
    id: 'elemental-superado',
    name: 'Grado Elemental',
    how: 'Termina los cuatro cursos del Grado Elemental.',
  },
  {
    id: 'profesional-superado',
    name: 'Grado Profesional',
    how: 'Termina los seis cursos del Grado Profesional.',
  },
  { id: 'racha-siete', name: 'Siete días', how: 'Practica siete días seguidos.' },
  { id: 'repaso-al-dia', name: 'Nada pendiente', how: 'Termina un repaso y deja la cola vacía.' },
  { id: 'meta-diaria', name: 'Meta del día', how: 'Llega a la meta de XP de un día.' },
];

export interface Progress {
  /** Unidades superadas. El orden no importa: lo que importa es si están. */
  readonly done: readonly string[];
  readonly xp: number;
  /** Días seguidos practicando. Cero si nunca se ha practicado. */
  readonly streak: number;
  /** El día más largo de la racha que se ha alcanzado. */
  readonly bestStreak: number;
  /** Último día con actividad, `AAAA-MM-DD`, o null. */
  readonly lastDay: string | null;
  readonly badges: readonly BadgeId[];
  /**
   * XP ganado el día de `lastDay`. Es el que cuenta para la meta diaria.
   *
   * Este sí se guarda, al contrario que `xp`, que se recalcula desde las
   * unidades hechas. No hay de dónde recalcularlo: un día de solo repaso suma a
   * la meta y no añade ninguna unidad, así que si no se guarda, se pierde.
   */
  readonly xpToday: number;
  /** Las preguntas falladas esperando repaso. */
  readonly review: ReviewQueue;
  /**
   * El curso por el que se ha decidido empezar, o nulo para empezar por el
   * principio.
   *
   * Existe porque el desbloqueo lineal, que se defendía aquí mismo, tenía un
   * agujero: quien ya sabe teoría no quiere pasar por «qué es un grado» para
   * llegar a las sustituciones, y obligarle es la forma más rápida de que cierre
   * la aplicación. Con esto elige dónde se pone y desde ahí la escalera sigue
   * funcionando igual, de una en una.
   *
   * Lo que **no** hace es dar por hechas las unidades anteriores: quedan abiertas
   * —se pueden hacer cuando quiera— pero sin XP y sin marcar. Regalar el avance
   * de once unidades por elegir un desplegable convertiría el marcador en una
   * mentira.
   */
  readonly startCourse: string | null;
}

export const EMPTY_PROGRESS: Progress = {
  done: [],
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  badges: [],
  xpToday: 0,
  review: EMPTY_REVIEW,
  startCourse: null,
};

/**
 * La meta de cada día, en XP.
 *
 * Cuarenta es una unidad de tocar y una de teoría, o dos de teoría: una sesión
 * de las que se hacen sin quitarse la guitarra. Una meta que no se alcanza en un
 * rato deja de ser una meta y pasa a ser un reproche.
 */
export const DAILY_GOAL_XP = 40;

/** Lo que se gana por terminar un repaso. No suma al total del temario. */
export const REVIEW_XP = 10;

export function isUnitDone(progress: Progress, unitId: string): boolean {
  return progress.done.includes(unitId);
}

/**
 * Dónde se ha puesto quien estudia: el índice de la primera unidad de su curso de
 * partida.
 *
 * Cero si no ha elegido nada, y cero también si eligió un curso que ya no existe:
 * ante la duda, por el principio, que es el único sitio que seguro se entiende.
 */
export function startIndex(progress: Progress): number {
  if (progress.startCourse === null) {
    return 0;
  }
  const course = COURSES.find((candidate) => candidate.id === progress.startCourse);
  const first = course?.units[0]?.id;
  if (first === undefined) {
    return 0;
  }
  const index = UNIT_ORDER.indexOf(first);
  return index < 0 ? 0 : index;
}

/**
 * Elige por dónde empezar. Un curso que no existe deja el avance como estaba.
 *
 * No borra nada ni da nada por hecho: mover el punto de partida solo cambia qué
 * está abierto.
 */
export function startAt(progress: Progress, courseId: string | null): Progress {
  if (courseId !== null && !COURSES.some((course) => course.id === courseId)) {
    return progress;
  }
  return progress.startCourse === courseId ? progress : { ...progress, startCourse: courseId };
}

/**
 * Si una unidad está abierta.
 *
 * Dos reglas y en este orden:
 *
 * 1. **Tu punto de partida y todo lo que va antes está abierto.** Lo de antes
 *    porque quien empieza en el Profesional tiene que poder bajar a mirar los
 *    grados el día que se pierda, y cerrárselo sería castigarle por haberse
 *    puesto una meta alta.
 * 2. **De tu punto de partida en adelante, una detrás de otra.** Ahí la escalera
 *    sigue intacta: cada curso usa solo lo explicado antes, y dejar entrar a las
 *    sustituciones sin haber visto las funciones no es libertad, es un curso que
 *    no se entiende.
 */
export function isUnitUnlocked(progress: Progress, unitId: string): boolean {
  const index = UNIT_ORDER.indexOf(unitId);
  if (index < 0) {
    return false;
  }
  if (index <= startIndex(progress)) {
    return true;
  }
  return isUnitDone(progress, UNIT_ORDER[index - 1]!);
}

/**
 * La unidad por la que seguir: la primera sin hacer **desde donde te pusiste**.
 *
 * Desde donde te pusiste y no desde el principio: a quien eligió empezar en el
 * Profesional, mandarle a «qué es un grado» sería deshacer su decisión en el
 * primer clic. Cuando ya no queda nada por delante sí se ofrece lo que se saltó,
 * que a esas alturas es lo único que falta.
 */
export function nextUnit(progress: Progress): string | null {
  const desde = startIndex(progress);
  const adelante = UNIT_ORDER.slice(desde).find((id) => !isUnitDone(progress, id));
  return adelante ?? UNIT_ORDER.find((id) => !isUnitDone(progress, id)) ?? null;
}

export function courseCompletion(progress: Progress, course: Course): number {
  if (course.units.length === 0) {
    return 1;
  }
  const done = course.units.filter((unit) => isUnitDone(progress, unit.id)).length;
  return done / course.units.length;
}

export function isCourseDone(progress: Progress, course: Course): boolean {
  return course.units.every((unit) => isUnitDone(progress, unit.id));
}

/** Un curso se abre cuando alguna de sus unidades está abierta. */
export function isCourseUnlocked(progress: Progress, course: Course): boolean {
  return course.units.some((unit) => isUnitUnlocked(progress, unit.id));
}

export function isGradeDone(progress: Progress, grade: GradeId): boolean {
  return COURSES.filter((course) => course.grade === grade).every((course) =>
    isCourseDone(progress, course),
  );
}

/** De 0 a 1 sobre todo el temario. */
export function overallCompletion(progress: Progress): number {
  return TOTAL_XP === 0 ? 0 : Math.min(1, progress.xp / TOTAL_XP);
}

/**
 * Diferencia en días entre dos fechas `AAAA-MM-DD`.
 *
 * Se comparan a mediodía UTC y no a medianoche: así un cambio de horario de
 * verano no convierte dos días seguidos en el mismo día ni en tres.
 */
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
 * La racha después de practicar en `day`.
 *
 * Practicar dos veces el mismo día no suma: la racha cuenta días, no sesiones.
 * Saltarse uno la reinicia a uno, no a cero, porque hoy sí has practicado.
 */
export function streakAfter(progress: Progress, day: string): number {
  if (progress.lastDay === null) {
    return 1;
  }
  const gap = daysBetween(progress.lastDay, day);
  if (Number.isNaN(gap) || gap < 0) {
    return progress.streak;
  }
  if (gap === 0) {
    return Math.max(1, progress.streak);
  }
  return gap === 1 ? progress.streak + 1 : 1;
}

export interface CompleteOptions {
  /** Si se acertó todo a la primera, para la medalla de no fallar. */
  readonly flawless?: boolean;
}

/**
 * Cierra una unidad y devuelve el progreso nuevo.
 *
 * Repetir una unidad ya hecha no suma XP ni toca la racha: el temario se
 * puede repasar cuantas veces se quiera, pero el avance se gana una vez.
 */
export function completeUnit(
  progress: Progress,
  unitId: string,
  day: string,
  { flawless = false }: CompleteOptions = {},
): Progress {
  const found = findUnit(unitId);
  if (found === null || isUnitDone(progress, unitId)) {
    return progress;
  }

  const done = [...progress.done, unitId];
  const streak = streakAfter(progress, day);
  const next: Progress = {
    ...progress,
    done,
    xp: progress.xp + found.unit.xp,
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
    lastDay: day,
    xpToday: xpEarnedOn(progress, day) + found.unit.xp,
  };

  return { ...next, badges: awardBadges(next, found.course, found.unit.kind, flawless) };
}

/**
 * Qué medallas toca dar con el progreso ya actualizado.
 *
 * Se calculan desde el estado y no se acumulan a mano: así una medalla no puede
 * quedarse sin dar porque alguien olvidó comprobarla en un camino concreto.
 */
function awardBadges(
  progress: Progress,
  course: Course,
  kind: 'theory' | 'play',
  flawless: boolean,
): readonly BadgeId[] {
  const badges = new Set<BadgeId>(progress.badges);

  badges.add('primer-paso');

  const playsDone = progress.done.filter((id) => findUnit(id)?.unit.kind === 'play').length;
  if (kind === 'play') {
    badges.add('primera-escala');
    if (playsDone >= 5) {
      badges.add('cinco-escalas');
    }
  }
  if (flawless && kind === 'theory') {
    badges.add('sin-fallar');
  }
  if (isCourseDone(progress, course)) {
    badges.add('curso-completo');
  }
  if (isGradeDone(progress, 'elemental')) {
    badges.add('elemental-superado');
  }
  if (isGradeDone(progress, 'profesional')) {
    badges.add('profesional-superado');
  }
  if (progress.streak >= 7) {
    badges.add('racha-siete');
  }
  if (progress.xpToday >= DAILY_GOAL_XP) {
    badges.add('meta-diaria');
  }

  return orderBadges(badges);
}

/**
 * En el orden del catálogo, para que la lista no baile según el orden en que se
 * hayan ganado.
 */
function orderBadges(badges: ReadonlySet<BadgeId>): readonly BadgeId[] {
  return BADGES.filter((badge) => badges.has(badge.id)).map((badge) => badge.id);
}

/**
 * La racha vista hoy, sin tocar nada.
 *
 * La guardada es la del último día que se practicó. Si desde entonces ha pasado
 * más de un día, ya está rota aunque el número siga guardado, y enseñarla como
 * viva sería mentir.
 */
export function currentStreak(progress: Progress, today: string): number {
  if (progress.lastDay === null) {
    return 0;
  }
  const gap = daysBetween(progress.lastDay, today);
  if (Number.isNaN(gap) || gap < 0) {
    return progress.streak;
  }
  return gap <= 1 ? progress.streak : 0;
}

/**
 * Lo ganado en un día concreto.
 *
 * El progreso solo guarda el XP del último día con actividad, no un diario
 * entero. Preguntar por otro día devuelve cero, que es la verdad que se puede
 * afirmar: no hay constancia de nada. Guardar el histórico completo sería
 * guardar un dato que nadie ha pedido enseñar todavía.
 */
export function xpEarnedOn(progress: Progress, day: string): number {
  return progress.lastDay === day ? progress.xpToday : 0;
}

/** Cuánto llevas de la meta de hoy, de 0 a 1. */
export function goalCompletion(
  progress: Progress,
  day: string,
  goal: number = DAILY_GOAL_XP,
): number {
  if (goal <= 0) {
    return 1;
  }
  return Math.min(1, xpEarnedOn(progress, day) / goal);
}

export function isGoalMet(progress: Progress, day: string, goal: number = DAILY_GOAL_XP): boolean {
  return xpEarnedOn(progress, day) >= goal;
}

/** Apunta que se ha fallado una pregunta, para que vuelva en el repaso. */
export function missQuestion(
  progress: Progress,
  unitId: string,
  index: number,
  day: string,
): Progress {
  return { ...progress, review: recordMiss(progress.review, unitId, index, day) };
}

/**
 * Apunta que se ha acertado una pregunta que estaba pendiente.
 *
 * Acertar algo que no estaba en la cola no cambia nada: la cola es de lo que se
 * falló, no un historial de todo lo contestado.
 */
export function hitQuestion(
  progress: Progress,
  unitId: string,
  index: number,
  day: string,
): Progress {
  return { ...progress, review: recordHit(progress.review, unitId, index, day) };
}

export interface ReviewDoneOptions {
  /** Si al terminar no quedaba nada pendiente para hoy. */
  readonly cleared?: boolean;
}

/**
 * Cierra una sesión de repaso.
 *
 * Repasar cuenta como practicar: mantiene la racha y suma a la meta del día.
 * Lo que no hace es subir el XP del temario, porque repasar no avanza el
 * temario: son diez XP que cuentan para hoy y desaparecen mañana. Si repasar
 * sumase al total, el marcador diría que llevas medio Profesional hecho por
 * haber repasado mucho el Elemental.
 */
export function practiceReview(
  progress: Progress,
  day: string,
  { cleared = false }: ReviewDoneOptions = {},
): Progress {
  const streak = streakAfter(progress, day);
  const xpToday = xpEarnedOn(progress, day) + REVIEW_XP;

  const badges = new Set<BadgeId>(progress.badges);
  if (cleared) {
    badges.add('repaso-al-dia');
  }
  if (streak >= 7) {
    badges.add('racha-siete');
  }
  if (xpToday >= DAILY_GOAL_XP) {
    badges.add('meta-diaria');
  }

  return {
    ...progress,
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
    lastDay: day,
    xpToday,
    badges: orderBadges(badges),
  };
}

/**
 * Junta el avance de la cuenta con el que hubiera en este navegador.
 *
 * Hace falta la primera vez que alguien entra en una cuenta desde un aparato
 * donde ya había estudiado sin cuenta: hay dos avances de verdad y ninguno se
 * puede tirar. Se queda lo mejor de cada uno —la unión de lo hecho, la racha más
 * larga, todas las medallas— porque nadie estudió de menos, y del XP del día se
 * queda el mayor en vez de la suma: sumar dos aparatos que estuvieron abiertos a
 * la vez inventaría trabajo que no se hizo.
 *
 * El XP total no se toca aquí: sale de las unidades hechas, y esas ya están
 * unidas.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const done = [...new Set([...a.done, ...b.done])].filter((id) => findUnit(id) !== null);
  const lastDay =
    a.lastDay === null || (b.lastDay !== null && b.lastDay > a.lastDay) ? b.lastDay : a.lastDay;

  // La racha del que llegue más lejos, pero solo si es el que tiene el último
  // día: una racha de treinta días que se cortó hace un mes no es la racha viva.
  const streak =
    lastDay === null ? 0 : Math.max(currentStreak(a, lastDay), currentStreak(b, lastDay));

  return {
    done,
    xp: done.reduce((total, id) => total + (findUnit(id)?.unit.xp ?? 0), 0),
    streak,
    bestStreak: Math.max(a.bestStreak, b.bestStreak, streak),
    lastDay,
    badges: orderBadges(new Set([...a.badges, ...b.badges])),
    xpToday: lastDay === null ? 0 : Math.max(xpEarnedOn(a, lastDay), xpEarnedOn(b, lastDay)),
    review: mergeReview(a.review, b.review),
    // Del punto de partida, el que está más adelante: es el que abre más camino,
    // y este fichero se queda siempre con lo más abierto salvo cuando eso
    // significaría dar algo por sabido. El precio: quien retroceda su punto de
    // partida en un aparato tendrá que hacerlo también en el otro.
    startCourse: startIndex(a) >= startIndex(b) ? a.startCourse : b.startCourse,
  };
}

/** `AAAA-MM-DD` y nada más. Cualquier otra cosa se descarta. */
function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function asStrings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function asReviewQueue(value: unknown): ReviewQueue {
  if (!Array.isArray(value)) {
    return EMPTY_REVIEW;
  }
  const known = new Set(UNIT_ORDER);
  return value.flatMap((raw): ReviewItem[] => {
    if (typeof raw !== 'object' || raw === null) {
      return [];
    }
    const item = raw as Record<string, unknown>;
    const unitId = item['unitId'];
    const index = item['index'];
    // Una pregunta de una unidad retirada no se puede volver a generar, así que
    // no se puede repasar: se suelta en vez de quedarse como deuda eterna.
    if (typeof unitId !== 'string' || !known.has(unitId)) {
      return [];
    }
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
      return [];
    }
    return [
      {
        unitId,
        index,
        seenOn: isDay(item['seenOn']) ? item['seenOn'] : '1970-01-01',
        hits: Math.min(asCount(item['hits']), MASTERED_HITS - 1),
      },
    ];
  });
}

/**
 * Interpreta un avance guardado y lo deja consistente.
 *
 * Vive en el dominio porque protege dos puertas distintas y ninguna de las dos
 * es de fiar: lo que hay en el `localStorage` de un navegador —que cualquiera
 * puede editar— y lo que hay en la base de datos, que pudo escribirlo una
 * versión anterior del temario. La misma función para las dos, o la que se quede
 * sin repasar es por la que entrará la incoherencia.
 *
 * El XP no se lee de lo guardado: se recalcula desde las unidades hechas.
 * Guardarlo y leerlo por separado permite que las dos cosas se contradigan, y
 * entonces la barra de avance dice una cosa y la lista de unidades otra. El XP
 * del día sí se lee, porque no hay de dónde recalcularlo.
 */
export function parseProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return EMPTY_PROGRESS;
  }
  const record = raw as Record<string, unknown>;

  const known = new Set(UNIT_ORDER);
  const done = [...new Set(asStrings(record['done']).filter((id) => known.has(id)))];
  const xp = done.reduce((total, id) => total + (findUnit(id)?.unit.xp ?? 0), 0);

  // En el orden del catálogo y descartando lo que no exista: así una medalla
  // retirada no reaparece y la lista no depende de cómo se guardó.
  const saved = new Set(asStrings(record['badges']));
  const badges: readonly BadgeId[] = BADGES.map((badge) => badge.id).filter((id) => saved.has(id));

  const streak = asCount(record['streak']);
  const lastDay = isDay(record['lastDay']) ? record['lastDay'] : null;

  return {
    done,
    xp,
    // Sin último día no puede haber racha: sería una racha que no empezó nunca.
    streak: lastDay === null ? 0 : streak,
    bestStreak: Math.max(asCount(record['bestStreak']), lastDay === null ? 0 : streak),
    lastDay,
    badges,
    // Y sin último día tampoco puede haber XP de hoy.
    xpToday: lastDay === null ? 0 : asCount(record['xpToday']),
    review: asReviewQueue(record['review']),
    startCourse: asCourseId(record['startCourse']),
  };
}

/** Un curso del temario, o nulo. Un curso retirado se olvida. */
function asCourseId(value: unknown): string | null {
  return typeof value === 'string' && COURSES.some((course) => course.id === value) ? value : null;
}
