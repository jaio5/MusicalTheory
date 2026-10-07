import { describe, expect, it } from 'vitest';

import { COURSES, TOTAL_XP, UNIT_ORDER, findUnit } from './curriculum';
import { LESSONS, lessonNotes } from './lessons';
import { pitchClassFromName } from './notes';
import {
  BADGES,
  badgesOf,
  COMPOSE_XP,
  DAILY_GOAL_XP,
  EMPTY_PROGRESS,
  MAX_COMPOSE_XP,
  MAX_XP_DEL_DIA,
  PRIMER_DIA,
  REVIEW_XP,
  completeUnit,
  practiceCompose,
  courseCompletion,
  currentStreak,
  goalCompletion,
  hitQuestion,
  isCourseDone,
  isCourseUnlocked,
  isGoalMet,
  isGradeDone,
  isUnitUnlocked,
  mergeProgress,
  missQuestion,
  nextUnit,
  isUnitDone,
  overallCompletion,
  parseProgress,
  practiceReview,
  startAt,
  startIndex,
  streakAfter,
  xpEarnedOn,
  type BadgeId,
  type Progress,
} from './progress';
import { posicionesDeLaUnidad } from './posiciones';
import { isUnitCracked, MASTERED_HITS } from './review';

/** Un instante cualquiera: el dominio lo pide por parámetro y aquí da igual cuál. */
const CUANDO = '2026-09-24T10:00:00.000Z';

const C = pitchClassFromName('C');

/**
 * Una unidad a la que la cola de repaso siempre puede apuntar: la primera de
 * tocar, que tiene un paso por nota de la escala. Las de teoría no valen para
 * esto, porque cuántas preguntas tienen lo decide su lección y se reescribe.
 */
const DE_TOCAR = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'play')!;

/** Termina unidades seguidas desde el principio, todas el mismo día. */
function avanzar(cuantas: number, day = '2026-07-29'): Progress {
  let progress = EMPTY_PROGRESS;
  for (const id of UNIT_ORDER.slice(0, cuantas)) {
    progress = completeUnit(progress, id, day);
  }
  return progress;
}

describe('la escalera del temario', () => {
  it('tiene los dos grados con sus cuatro y seis cursos', () => {
    expect(COURSES.filter((course) => course.grade === 'elemental')).toHaveLength(4);
    expect(COURSES.filter((course) => course.grade === 'profesional')).toHaveLength(6);
  });

  it('numera los cursos de uno en uno dentro de cada grado', () => {
    for (const grade of ['elemental', 'profesional'] as const) {
      const years = COURSES.filter((course) => course.grade === grade).map((course) => course.year);
      expect(years).toEqual(years.map((_, index) => index + 1));
    }
  });

  it('no repite identificadores de unidad', () => {
    expect(new Set(UNIT_ORDER).size).toBe(UNIT_ORDER.length);
  });

  it('cada unidad de teoría apunta a una lección que existe', () => {
    const ids = new Set(LESSONS.map((lesson) => lesson.id));
    for (const course of COURSES) {
      for (const unit of course.units) {
        if (unit.kind === 'theory') {
          expect(ids, `${unit.id} apunta a ${unit.lesson}`).toContain(unit.lesson);
        }
      }
    }
  });

  it('todas las lecciones del temario generan preguntas de verdad', () => {
    for (const course of COURSES) {
      for (const unit of course.units) {
        if (unit.kind !== 'theory') {
          continue;
        }
        for (const mode of ['major', 'minor'] as const) {
          const notes = lessonNotes(unit.lesson, C, mode);
          expect(notes.points.length, unit.lesson).toBeGreaterThan(1);
          expect(notes.exercises.length, unit.lesson).toBeGreaterThan(1);
          for (const exercise of notes.exercises) {
            // Una sola correcta, y siempre alguna: sin esto una pregunta no se
            // puede contestar o tiene dos respuestas buenas.
            expect(exercise.choices.filter((choice) => choice.correct)).toHaveLength(1);
            expect(exercise.why.length).toBeGreaterThan(10);
          }
        }
      }
    }
  });

  it('el temario suma el XP que dice sumar', () => {
    const suma = COURSES.reduce(
      (total, course) => total + course.units.reduce((acc, unit) => acc + unit.xp, 0),
      0,
    );
    expect(TOTAL_XP).toBe(suma);
  });
});

describe('desbloqueo', () => {
  it('la primera unidad está abierta y la segunda no', () => {
    expect(isUnitUnlocked(EMPTY_PROGRESS, UNIT_ORDER[0]!)).toBe(true);
    expect(isUnitUnlocked(EMPTY_PROGRESS, UNIT_ORDER[1]!)).toBe(false);
  });

  it('terminar una abre la siguiente', () => {
    const progress = avanzar(1);

    expect(isUnitUnlocked(progress, UNIT_ORDER[1]!)).toBe(true);
    expect(isUnitUnlocked(progress, UNIT_ORDER[2]!)).toBe(false);
  });

  it('el último curso está cerrado al empezar', () => {
    const last = COURSES.at(-1)!;

    expect(isCourseUnlocked(EMPTY_PROGRESS, last)).toBe(false);
  });

  it('el primer curso está abierto al empezar', () => {
    expect(isCourseUnlocked(EMPTY_PROGRESS, COURSES[0]!)).toBe(true);
  });

  it('dice por dónde seguir', () => {
    expect(nextUnit(EMPTY_PROGRESS)).toBe(UNIT_ORDER[0]);
    expect(nextUnit(avanzar(3))).toBe(UNIT_ORDER[3]);
  });

  it('cuando está todo hecho ya no hay por dónde seguir', () => {
    expect(nextUnit(avanzar(UNIT_ORDER.length))).toBeNull();
  });
});

describe('avance y XP', () => {
  it('sumar una unidad suma su XP', () => {
    const unit = findUnit(UNIT_ORDER[0]!)!.unit;

    expect(avanzar(1).xp).toBe(unit.xp);
  });

  it('repetir una unidad ya hecha no vuelve a sumar', () => {
    const una = avanzar(1);
    const otra = completeUnit(una, UNIT_ORDER[0]!, '2026-07-30');

    expect(otra).toBe(una);
  });

  it('una unidad que no existe no cambia nada', () => {
    expect(completeUnit(EMPTY_PROGRESS, 'no-existe', '2026-07-29')).toBe(EMPTY_PROGRESS);
  });

  it('el avance del curso va de cero a uno', () => {
    const course = COURSES[0]!;
    expect(courseCompletion(EMPTY_PROGRESS, course)).toBe(0);

    const todo = avanzar(course.units.length);
    expect(courseCompletion(todo, course)).toBe(1);
    expect(isCourseDone(todo, course)).toBe(true);
  });

  it('el avance global llega a uno al terminarlo todo', () => {
    expect(overallCompletion(EMPTY_PROGRESS)).toBe(0);
    expect(overallCompletion(avanzar(UNIT_ORDER.length))).toBe(1);
  });

  it('el grado se supera al cerrar sus cursos', () => {
    const elemental = COURSES.filter((course) => course.grade === 'elemental');
    const unidades = elemental.reduce((total, course) => total + course.units.length, 0);
    const progress = avanzar(unidades);

    expect(isGradeDone(progress, 'elemental')).toBe(true);
    expect(isGradeDone(progress, 'profesional')).toBe(false);
  });
});

describe('la racha', () => {
  it('empieza en uno el primer día', () => {
    expect(streakAfter(EMPTY_PROGRESS, '2026-07-29')).toBe(1);
  });

  it('practicar dos veces el mismo día no suma', () => {
    const progress = avanzar(1, '2026-07-29');

    expect(streakAfter(progress, '2026-07-29')).toBe(1);
  });

  it('sube de uno en uno en días seguidos', () => {
    let progress = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-27');
    progress = completeUnit(progress, UNIT_ORDER[1]!, '2026-07-28');
    progress = completeUnit(progress, UNIT_ORDER[2]!, '2026-07-29');

    expect(progress.streak).toBe(3);
  });

  it('saltarse un día la reinicia a uno, no a cero', () => {
    let progress = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-27');
    progress = completeUnit(progress, UNIT_ORDER[1]!, '2026-07-30');

    expect(progress.streak).toBe(1);
  });

  it('cruza el fin de mes sin romperse', () => {
    let progress = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-31');
    progress = completeUnit(progress, UNIT_ORDER[1]!, '2026-08-01');

    expect(progress.streak).toBe(2);
  });

  it('guarda la mejor racha aunque la actual se rompa', () => {
    let progress = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-25');
    progress = completeUnit(progress, UNIT_ORDER[1]!, '2026-07-26');
    progress = completeUnit(progress, UNIT_ORDER[2]!, '2026-07-27');
    progress = completeUnit(progress, UNIT_ORDER[3]!, '2026-08-15');

    expect(progress.streak).toBe(1);
    expect(progress.bestStreak).toBe(3);
  });

  /**
   * La racha guardada es la del último día que se practicó. Si han pasado tres
   * días, sigue guardada pero ya está rota, y enseñarla viva sería mentir.
   */
  it('vista hoy, se apaga si ya está rota', () => {
    const progress = avanzar(1, '2026-07-25');

    expect(currentStreak(progress, '2026-07-25')).toBe(1);
    expect(currentStreak(progress, '2026-07-26')).toBe(1);
    expect(currentStreak(progress, '2026-07-29')).toBe(0);
  });

  it('sin nada practicado no hay racha', () => {
    expect(currentStreak(EMPTY_PROGRESS, '2026-07-29')).toBe(0);
  });
});

describe('medallas', () => {
  it('la primera unidad da la de primer paso', () => {
    expect(avanzar(1).badges).toContain('primer-paso');
  });

  it('tocar una escala da la del mástil, y contestar no', () => {
    const primeraDeTocar = UNIT_ORDER.findIndex((id) => findUnit(id)?.unit.kind === 'play');
    expect(primeraDeTocar).toBeGreaterThan(-1);

    expect(avanzar(primeraDeTocar).badges).not.toContain('primera-escala');
    expect(avanzar(primeraDeTocar + 1).badges).toContain('primera-escala');
  });

  it('acertar todo a la primera da la de no fallar', () => {
    const progress = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-29', {
      flawless: true,
    });

    expect(progress.badges).toContain('sin-fallar');
  });

  it('sin acertarlo todo no la da', () => {
    expect(avanzar(1).badges).not.toContain('sin-fallar');
  });

  it('cerrar el primer curso da la de curso completo', () => {
    const progress = avanzar(COURSES[0]!.units.length);

    expect(progress.badges).toContain('curso-completo');
  });

  it('siete días seguidos dan la de la racha', () => {
    let progress = EMPTY_PROGRESS;
    const dias = [25, 26, 27, 28, 29, 30, 31];
    dias.forEach((dia, index) => {
      progress = completeUnit(progress, UNIT_ORDER[index]!, `2026-07-${dia}`);
    });

    expect(progress.streak).toBe(7);
    expect(progress.badges).toContain('racha-siete');
  });

  it('terminarlo todo da las dos de grado', () => {
    const progress = avanzar(UNIT_ORDER.length);

    expect(progress.badges).toContain('elemental-superado');
    expect(progress.badges).toContain('profesional-superado');
  });

  it('las medallas salen en el orden del catálogo, no en el que se ganan', () => {
    const progress = avanzar(UNIT_ORDER.length);
    const orden = BADGES.map((badge) => badge.id).filter((id) => progress.badges.includes(id));

    expect(progress.badges).toEqual(orden);
  });

  it('no se dan medallas repetidas', () => {
    const progress = avanzar(UNIT_ORDER.length);

    expect(new Set(progress.badges).size).toBe(progress.badges.length);
  });
});

describe('la meta del día', () => {
  it('sin actividad no hay nada ganado hoy', () => {
    expect(xpEarnedOn(EMPTY_PROGRESS, '2026-07-30')).toBe(0);
    expect(goalCompletion(EMPTY_PROGRESS, '2026-07-30')).toBe(0);
    expect(isGoalMet(EMPTY_PROGRESS, '2026-07-30')).toBe(false);
  });

  it('cuenta el XP de las unidades terminadas hoy', () => {
    const progress = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-30');
    const unidad = findUnit('e1-grados')!.unit;

    expect(xpEarnedOn(progress, '2026-07-30')).toBe(unidad.xp);
  });

  // Lo de ayer no cuenta para la meta de hoy: si contase, quien estudió mucho
  // ayer abriría la aplicación con la meta ya cumplida y no tocaría nada.
  it('lo de ayer no cuenta hoy', () => {
    const progress = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-29');

    expect(xpEarnedOn(progress, '2026-07-30')).toBe(0);
    expect(isGoalMet(progress, '2026-07-30')).toBe(false);
  });

  it('se llega a la meta con dos unidades y da su medalla', () => {
    let progress = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-30');
    progress = completeUnit(progress, 'e1-escala', '2026-07-30');

    expect(progress.xpToday).toBeGreaterThanOrEqual(DAILY_GOAL_XP);
    expect(goalCompletion(progress, '2026-07-30')).toBe(1);
    expect(progress.badges).toContain('meta-diaria');
  });

  it('el avance nunca pasa de uno aunque se estudie de más', () => {
    const progress = avanzar(6, '2026-07-30');
    expect(goalCompletion(progress, '2026-07-30')).toBe(1);
  });
});

describe('practiceReview', () => {
  it('suma a la meta del día sin tocar el XP del temario', () => {
    const antes = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-30');
    const despues = practiceReview(antes, '2026-07-30');

    expect(despues.xp).toBe(antes.xp);
    expect(despues.xpToday).toBe(antes.xpToday + REVIEW_XP);
  });

  // Repasar es practicar: quien solo repasa un día no pierde la racha.
  it('mantiene la racha viva', () => {
    const ayer = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-29');
    const hoy = practiceReview(ayer, '2026-07-30');

    expect(hoy.streak).toBe(2);
    expect(hoy.lastDay).toBe('2026-07-30');
  });

  it('da la medalla al dejar la cola vacía, y no antes', () => {
    expect(practiceReview(EMPTY_PROGRESS, '2026-07-30').badges).not.toContain('repaso-al-dia');
    expect(practiceReview(EMPTY_PROGRESS, '2026-07-30', { cleared: true }).badges).toContain(
      'repaso-al-dia',
    );
  });
});

describe('missQuestion y hitQuestion', () => {
  it('un fallo apunta la pregunta en la cola de repaso', () => {
    const progress = missQuestion(EMPTY_PROGRESS, 'e1-grados', 1, '2026-07-30');

    expect(progress.review).toHaveLength(1);
    expect(isUnitCracked(progress.review, 'e1-grados', '2026-07-30')).toBe(true);
  });

  it('acertarla en repaso la aplaza y terminarla la saca', () => {
    let progress = missQuestion(EMPTY_PROGRESS, 'e1-grados', 1, '2026-07-30');
    progress = hitQuestion(progress, 'e1-grados', 1, '2026-07-30');
    expect(isUnitCracked(progress.review, 'e1-grados', '2026-07-30')).toBe(false);

    progress = hitQuestion(progress, 'e1-grados', 1, '2026-07-31');
    expect(progress.review).toHaveLength(0);
  });

  it('no toca nada más del avance', () => {
    const antes = avanzar(3);
    const despues = missQuestion(antes, 'e1-grados', 1, '2026-07-30');

    expect(despues.done).toEqual(antes.done);
    expect(despues.xp).toBe(antes.xp);
    expect(despues.streak).toBe(antes.streak);
  });
});

describe('mergeProgress', () => {
  it('junta lo hecho en los dos sitios y recalcula el XP', () => {
    // La de la cuenta es una de las tres del equipo: la unión no la cuenta dos veces.
    const cuenta = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, '2026-07-28');
    const equipo = avanzar(3, '2026-07-30');

    const junto = mergeProgress(cuenta, equipo);

    expect(junto.done).toHaveLength(3);
    expect(junto.xp).toBe(
      junto.done.reduce((total, id) => total + (findUnit(id)?.unit.xp ?? 0), 0),
    );
  });

  it('se queda con la racha más larga que siga viva', () => {
    let larga = EMPTY_PROGRESS;
    for (let i = 0; i < 5; i += 1) {
      larga = completeUnit(larga, UNIT_ORDER[i]!, `2026-07-${26 + i}`);
    }
    const corta = completeUnit(EMPTY_PROGRESS, 'e2-calidades', '2026-07-30');

    const junto = mergeProgress(larga, corta);

    expect(junto.lastDay).toBe('2026-07-30');
    expect(junto.streak).toBe(5);
    expect(junto.bestStreak).toBeGreaterThanOrEqual(5);
  });

  // Una racha de treinta días que se cortó hace un mes no es una racha viva.
  it('no revive una racha vieja', () => {
    const vieja: Progress = {
      ...EMPTY_PROGRESS,
      done: ['e1-grados'],
      streak: 30,
      bestStreak: 30,
      lastDay: '2026-06-01',
    };
    const hoy = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-30');

    const junto = mergeProgress(vieja, hoy);

    expect(junto.streak).toBe(1);
    expect(junto.bestStreak).toBe(30);
  });

  it('junta todas las medallas, en el orden del catálogo', () => {
    const a: Progress = { ...EMPTY_PROGRESS, badges: ['racha-siete'] };
    const b: Progress = { ...EMPTY_PROGRESS, badges: ['primer-paso'] };

    expect(mergeProgress(a, b).badges).toEqual(['primer-paso', 'racha-siete']);
  });

  // Dos aparatos abiertos a la vez no significan el doble de trabajo.
  it('del XP del día se queda el mayor, no la suma', () => {
    const a = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-30');
    const b = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-30');

    expect(mergeProgress(a, b).xpToday).toBe(a.xpToday);
  });

  it('descarta unidades que ya no existen en el temario', () => {
    const raro: Progress = { ...EMPTY_PROGRESS, done: ['unidad-retirada'] };
    const bueno = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-30');

    expect(mergeProgress(raro, bueno).done).toEqual(['e1-grados']);
  });

  it('fusionar con un avance vacío no cambia nada relevante', () => {
    const progress = avanzar(4, '2026-07-30');
    const junto = mergeProgress(progress, EMPTY_PROGRESS);

    expect(junto.done).toEqual(progress.done);
    expect(junto.xp).toBe(progress.xp);
    expect(junto.streak).toBe(progress.streak);
    expect(junto.lastDay).toBe(progress.lastDay);
  });
});

describe('interpretar el avance guardado', () => {
  const PRIMERA = UNIT_ORDER[0]!;
  const SEGUNDA = UNIT_ORDER[1]!;

  it('lo que no es un objeto se descarta', () => {
    expect(parseProgress(null).done).toEqual([]);
    expect(parseProgress('vaya').done).toEqual([]);
    expect(parseProgress([1, 2]).done).toEqual([]);
  });

  it('recupera las unidades hechas', () => {
    const progress = parseProgress({ done: [PRIMERA, SEGUNDA] });

    expect(progress.done).toEqual([PRIMERA, SEGUNDA]);
  });

  /**
   * El XP no se lee del disco: se recalcula. Guardarlo aparte permite que las dos
   * cosas se contradigan, y entonces la barra dice una cosa y la lista otra.
   */
  it('recalcula el XP desde las unidades y no se cree el guardado', () => {
    const esperado = findUnit(PRIMERA)!.unit.xp;
    const progress = parseProgress({ done: [PRIMERA], xp: 99999 });

    expect(progress.xp).toBe(esperado);
  });

  it('descarta unidades que ya no existen en el temario', () => {
    const progress = parseProgress({ done: [PRIMERA, 'curso-de-laud-medieval'] });

    expect(progress.done).toEqual([PRIMERA]);
    expect(progress.xp).toBe(findUnit(PRIMERA)!.unit.xp);
  });

  it('no repite una unidad guardada dos veces', () => {
    const progress = parseProgress({ done: [PRIMERA, PRIMERA] });

    expect(progress.done).toEqual([PRIMERA]);
  });

  it('descarta medallas que no existen y ordena las que sí', () => {
    const progress = parseProgress({
      done: [PRIMERA],
      lastDay: '2026-07-29',
      streak: 1,
      bestStreak: 7,
      badges: ['racha-siete', 'medalla-inventada', 'primer-paso'],
    });

    expect(progress.badges).toEqual(['primer-paso', 'racha-siete']);
  });

  it('sin último día no hay racha, aunque venga un número', () => {
    const progress = parseProgress({ streak: 12, bestStreak: 30 });

    expect(progress.lastDay).toBeNull();
    expect(progress.streak).toBe(0);
  });

  it('descarta una fecha con formato raro', () => {
    expect(parseProgress({ lastDay: '29/07/2026', streak: 3 }).lastDay).toBeNull();
    expect(parseProgress({ lastDay: '2026-07-29', streak: 3 }).lastDay).toBe('2026-07-29');
  });

  it('una racha negativa o absurda se queda en cero', () => {
    expect(parseProgress({ lastDay: '2026-07-29', streak: -5 }).streak).toBe(0);
    expect(parseProgress({ lastDay: '2026-07-29', streak: 'muchos' }).streak).toBe(0);
  });

  it('la mejor racha nunca es menor que la actual', () => {
    const progress = parseProgress({ lastDay: '2026-07-29', streak: 9, bestStreak: 2 });

    expect(progress.bestStreak).toBe(9);
  });

  it('sin último día tampoco hay XP de hoy', () => {
    expect(parseProgress({ xpToday: 40 }).xpToday).toBe(0);
    expect(parseProgress({ lastDay: '2026-07-29', xpToday: 40 }).xpToday).toBe(40);
  });

  it('recupera la cola de repaso y tira lo que no encaja', () => {
    const progress = parseProgress({
      review: [
        { unitId: DE_TOCAR, index: 1, seenOn: '2026-07-29', hits: 1 },
        { unitId: 'curso-de-laud-medieval', index: 0, seenOn: '2026-07-29', hits: 0 },
        { unitId: DE_TOCAR, index: -3, seenOn: '2026-07-29', hits: 0 },
        { unitId: DE_TOCAR, index: 1.5, seenOn: '2026-07-29', hits: 0 },
        { unitId: DE_TOCAR, index: 'uno', seenOn: '2026-07-29', hits: 0 },
        { unitId: 7, index: 0, seenOn: '2026-07-29', hits: 0 },
        'ni siquiera es un objeto',
      ],
    });

    expect(progress.review).toEqual([
      { unitId: DE_TOCAR, index: 1, seenOn: '2026-07-29', hits: 1 },
    ]);
  });

  /**
   * El temario se reescribe y la cola no: una lección puede quedarse con menos
   * preguntas, o la unidad cambiar de lección. Lo que apunta más allá de la
   * última no se puede volver a preguntar, y si se quedara contaría como
   * pendiente para siempre sin que el repaso pudiera enseñarlo.
   */
  it('tira la posición que su unidad ya no tiene, y guarda la última que sí', () => {
    for (const id of UNIT_ORDER) {
      const unidad = findUnit(id)!.unit;
      const cuantas = posicionesDeLaUnidad(unidad);
      const leido = parseProgress(
        {
          review: [
            { unitId: id, index: cuantas - 1, seenOn: '2026-07-29', hits: 0 },
            { unitId: id, index: cuantas, seenOn: '2026-07-29', hits: 0 },
          ],
        },
        posicionesDeLaUnidad,
      );

      expect(
        leido.review.map((item) => item.index),
        id,
      ).toEqual(cuantas > 0 ? [cuantas - 1] : []);
    }
  });

  // Contarlas pide generar las lecciones, y quien lee el avance en el navegador
  // no las carga: allí la posición se deja como está y el repaso la salta.
  it('sin saber contarlas, no tira ninguna posición', () => {
    const leido = parseProgress({
      review: [{ unitId: DE_TOCAR, index: 999, seenOn: '2026-07-29', hits: 0 }],
    });

    expect(leido.review.map((item) => item.index)).toEqual([999]);
  });

  // Con los aciertos suficientes la pregunta debería haber salido de la cola.
  // Si alguien edita el JSON para dejarla dentro con más, se le recorta en vez
  // de quedarse una pregunta que no toca nunca.
  it('recorta los aciertos de una pregunta que debería estar fuera', () => {
    const progress = parseProgress({
      review: [{ unitId: DE_TOCAR, index: 0, seenOn: '2026-07-29', hits: 99 }],
    });

    expect(progress.review[0]?.hits).toBeLessThan(MASTERED_HITS);
  });

  it('una cola que no es una lista se queda vacía', () => {
    expect(parseProgress({ review: 'ninguna' }).review).toEqual([]);
  });
});

describe('elegir por dónde empezar', () => {
  const PROFESIONAL_1 = COURSES.find((course) => course.id === 'profesional-1')!;
  const PRIMERA_DEL_PROFESIONAL = PROFESIONAL_1.units[0]!.id;

  it('sin elegir nada se empieza por el principio', () => {
    expect(startIndex(EMPTY_PROGRESS)).toBe(0);
    expect(nextUnit(EMPTY_PROGRESS)).toBe(UNIT_ORDER[0]);
  });

  it('elegir un curso abre su primera unidad sin haber hecho nada', () => {
    const progress = startAt(EMPTY_PROGRESS, 'profesional-1', CUANDO);

    expect(isUnitUnlocked(progress, PRIMERA_DEL_PROFESIONAL)).toBe(true);
    expect(nextUnit(progress)).toBe(PRIMERA_DEL_PROFESIONAL);
  });

  /**
   * Lo de antes queda abierto: quien empieza en el Profesional tiene que poder
   * bajar a mirar los grados el día que se pierda.
   */
  it('deja abierto todo lo anterior al punto de partida', () => {
    const progress = startAt(EMPTY_PROGRESS, 'profesional-1', CUANDO);

    for (const id of UNIT_ORDER.slice(0, startIndex(progress) + 1)) {
      expect(isUnitUnlocked(progress, id), id).toBe(true);
    }
  });

  // De ahí en adelante la escalera sigue intacta: cada curso usa lo anterior.
  it('de tu punto de partida en adelante sigue siendo una detrás de otra', () => {
    const progress = startAt(EMPTY_PROGRESS, 'profesional-1', CUANDO);
    const segunda = UNIT_ORDER[startIndex(progress) + 1]!;

    expect(isUnitUnlocked(progress, segunda)).toBe(false);

    const tras = completeUnit(progress, PRIMERA_DEL_PROFESIONAL, '2026-07-30');
    expect(isUnitUnlocked(tras, segunda)).toBe(true);
  });

  // Regalar once unidades por elegir un desplegable convertiría el marcador en
  // una mentira.
  it('no da por hechas las unidades que se salta, ni regala XP', () => {
    const progress = startAt(EMPTY_PROGRESS, 'profesional-2', CUANDO);

    expect(progress.done).toEqual([]);
    expect(progress.xp).toBe(0);
    expect(isUnitDone(progress, UNIT_ORDER[0]!)).toBe(false);
  });

  it('cuando ya no queda nada por delante, ofrece lo que se saltó', () => {
    let progress = startAt(EMPTY_PROGRESS, 'profesional-1', CUANDO);
    for (const id of UNIT_ORDER.slice(startIndex(progress))) {
      progress = completeUnit(progress, id, '2026-07-30');
    }

    expect(nextUnit(progress)).toBe(UNIT_ORDER[0]);
  });

  it('un curso que no existe deja el avance igual', () => {
    const progress = avanzar(2);

    expect(startAt(progress, 'curso-de-laud-medieval', '2026-09-24T10:00:00.000Z')).toBe(progress);
    expect(startIndex({ ...progress, startCourse: 'curso-de-laud-medieval' })).toBe(0);
  });

  it('se puede volver al principio', () => {
    const progress = startAt(
      startAt(EMPTY_PROGRESS, 'profesional-1', '2026-09-24T10:00:00.000Z'),
      null,
      '2026-09-24T11:00:00.000Z',
    );

    expect(startIndex(progress)).toBe(0);
    expect(nextUnit(progress)).toBe(UNIT_ORDER[0]);
  });

  it('se guarda y se recupera, y un curso retirado se olvida', () => {
    expect(parseProgress({ startCourse: 'profesional-3' }).startCourse).toBe('profesional-3');
    expect(parseProgress({ startCourse: 'lo-que-sea' }).startCourse).toBeNull();
    expect(parseProgress({}).startCourse).toBeNull();
  });

  // Se queda con el último que se eligió, venga de donde venga.
  it('al fusionar gana el punto de partida elegido más tarde', () => {
    const antes = startAt(EMPTY_PROGRESS, 'elemental-2', '2026-09-24T10:00:00.000Z');
    const despues = startAt(EMPTY_PROGRESS, 'profesional-1', '2026-09-24T11:00:00.000Z');

    expect(mergeProgress(antes, despues).startCourse).toBe('profesional-1');
    expect(mergeProgress(despues, antes).startCourse).toBe('profesional-1');
  });
});

describe('el punto de partida al fusionar', () => {
  /** Un avance con solo el curso de partida puesto, como lo guardaba la versión vieja. */
  function desde(startCourse: string | null): Progress {
    return { ...EMPTY_PROGRESS, startCourse };
  }

  /** Y uno con el curso y **cuándo se eligió**, que es lo que ahora decide. */
  function desdeCuando(startCourse: string | null, startCourseAt: string): Progress {
    return { ...EMPTY_PROGRESS, startCourse, startCourseAt };
  }

  it('gana el que abre más camino', () => {
    expect(mergeProgress(desde('elemental-1'), desde('profesional-2')).startCourse).toBe(
      'profesional-2',
    );
    expect(mergeProgress(desde('profesional-2'), desde('elemental-1')).startCourse).toBe(
      'profesional-2',
    );
  });

  it('elegir el primer curso no se pierde al subirlo, aunque no abra nada', () => {
    // El fallo que esto arregla: `elemental-1` y «ninguno» tienen el mismo
    // índice —cero— así que empataban, y en el empate ganaba el primero, que al
    // subir el avance es el del servidor. El desplegable olvidaba la elección.
    expect(mergeProgress(desde(null), desde('elemental-1')).startCourse).toBe('elemental-1');
    expect(mergeProgress(desde('elemental-1'), desde(null)).startCourse).toBe('elemental-1');
  });

  it('sin elección en ninguno de los dos, sigue sin haberla', () => {
    expect(mergeProgress(desde(null), desde(null)).startCourse).toBeNull();
  });

  /**
   * **El desplegable era de sentido único, y este es el fallo.**
   *
   * «El que abre más camino» convertía retroceder en imposible: elegías un curso
   * anterior, se subía, el servidor comparaba índices, ganaba el de antes y el
   * desplegable volvía solo al de siempre sin decir por qué. Con la cuenta
   * abierta, quien hubiera probado Cadencias una vez se quedaba ahí para
   * siempre.
   *
   * El error era tratar una preferencia como un acumulado. El XP y las unidades
   * hechas se ganan; un punto de partida se dice, y de lo que se dice vale lo
   * último.
   */
  it('se puede retroceder el punto de partida, que antes no se podia', () => {
    const viejo = desdeCuando('profesional-6', '2026-09-24T10:00:00.000Z');
    const nuevo = desdeCuando('elemental-2', '2026-09-24T11:00:00.000Z');

    expect(mergeProgress(viejo, nuevo).startCourse).toBe('elemental-2');
    expect(mergeProgress(nuevo, viejo).startCourse).toBe('elemental-2');
  });

  it('y se puede volver al principio del todo', () => {
    const viejo = desdeCuando('profesional-6', '2026-09-24T10:00:00.000Z');
    const alPrincipio = desdeCuando(null, '2026-09-24T11:00:00.000Z');

    expect(mergeProgress(viejo, alPrincipio).startCourse).toBeNull();
  });

  // El instante del que gana viaja con él: si no, la siguiente fusión volvería a
  // no tener con qué comparar y el retroceso se deshace a la segunda.
  it('el instante del que gana no se pierde al fusionar', () => {
    const viejo = desdeCuando('profesional-6', '2026-09-24T10:00:00.000Z');
    const nuevo = desdeCuando('elemental-2', '2026-09-24T11:00:00.000Z');

    expect(mergeProgress(viejo, nuevo).startCourseAt).toBe('2026-09-24T11:00:00.000Z');
  });

  /**
   * Lo guardado antes de que el instante existiera no tiene ninguno, y entonces
   * se decide como se decidía. Que uno lo tenga y el otro no **tampoco** vale
   * para ordenarlos: no significa que el que lo tiene sea el más reciente.
   */
  it('sin instante en ninguno de los dos, decide el que abre mas camino', () => {
    expect(mergeProgress(desde('elemental-1'), desde('profesional-2')).startCourse).toBe(
      'profesional-2',
    );
  });

  /**
   * Dos elecciones en el mismo milisegundo no se pueden ordenar, así que decide
   * la regla de antes. Pasa con dos aparatos a la vez, y con un reloj que no
   * avanza entre dos pulsaciones.
   */
  it('con el mismo instante en los dos, decide el que abre mas camino', () => {
    const uno = desdeCuando('elemental-2', '2026-09-24T11:00:00.000Z');
    const otro = desdeCuando('profesional-4', '2026-09-24T11:00:00.000Z');

    expect(mergeProgress(uno, otro).startCourse).toBe('profesional-4');
    expect(mergeProgress(otro, uno).startCourse).toBe('profesional-4');
  });

  /**
   * El instante viene de un `localStorage` que cualquiera puede editar. Una
   * cadena que no sea una fecha se lee como si no hubiera ninguno: dejarla pasar
   * haría que la comparación devolviera siempre falso sin decir por qué.
   */
  it('un instante que no es una fecha se lee como si no hubiera', () => {
    expect(parseProgress({ startCourseAt: 'ayer por la tarde' }).startCourseAt).toBeNull();
    expect(parseProgress({ startCourseAt: 42 }).startCourseAt).toBeNull();
    expect(parseProgress({ startCourseAt: '2026-09-24T11:00:00.000Z' }).startCourseAt).toBe(
      '2026-09-24T11:00:00.000Z',
    );
  });

  /**
   * **Y tener instante gana a no tenerlo**, que es lo que evita que cada avance
   * ya guardado se lleve un primer retroceso fallido: lo del servidor no lo
   * tenía, lo recién elegido sí, y sin esta regla volvía a decidir el índice. El
   * desplegable rebotaba una vez y a la segunda funcionaba, que es peor que
   * fallar siempre porque parece cosa de suerte.
   */
  it('lo elegido con instante gana a lo guardado sin el', () => {
    const viejoSinInstante = desde('profesional-6');
    const recienElegido = desdeCuando('elemental-2', '2026-09-24T11:00:00.000Z');

    expect(mergeProgress(viejoSinInstante, recienElegido).startCourse).toBe('elemental-2');
    expect(mergeProgress(recienElegido, viejoSinInstante).startCourse).toBe('elemental-2');
  });
});

describe('los bordes que nunca se dan, y por eso hay que fijarlos', () => {
  /**
   * Ninguno de estos casos se produce tocando: son las respuestas que el dominio
   * da cuando le llega algo imposible. Están escritos porque **lo que hacen no
   * es obvio** —una unidad desconocida podría abrirse en vez de cerrarse, una
   * fecha corrida hacia atrás podría poner la racha a cero— y porque un
   * `parseProgress` que deje pasar basura las convierte en casos reales.
   */
  it('una unidad que no existe no está abierta', () => {
    // Pasa con un enlace guardado a algo que se renombró.
    expect(isUnitUnlocked(EMPTY_PROGRESS, 'inventada')).toBe(false);
    expect(isUnitDone(EMPTY_PROGRESS, 'inventada')).toBe(false);
  });

  it('un curso sin unidades cuenta como terminado, no como dividir entre cero', () => {
    const vacio = { ...COURSES[0]!, units: [] };

    expect(courseCompletion(EMPTY_PROGRESS, vacio)).toBe(1);
    expect(isCourseDone(EMPTY_PROGRESS, vacio)).toBe(true);
  });

  it('una meta de cero está cumplida, no rota', () => {
    expect(goalCompletion(EMPTY_PROGRESS, '2026-08-27', 0)).toBe(1);
  });

  it('un día que no se puede leer deja la racha como estaba', () => {
    // Lo que hay guardado lo escribió el navegador de alguien, así que la fecha
    // puede ser cualquier cosa. Ponerla a cero castigaría por un dato corrupto.
    const conRacha: Progress = { ...EMPTY_PROGRESS, streak: 5, lastDay: '2026-08-20' };

    expect(streakAfter(conRacha, 'no-es-un-dia')).toBe(5);
    expect(currentStreak(conRacha, 'no-es-un-dia')).toBe(5);
  });

  it('un día anterior al último tampoco la rompe', () => {
    // Pasa al juntar dos aparatos con la hora descuadrada.
    const conRacha: Progress = { ...EMPTY_PROGRESS, streak: 5, lastDay: '2026-08-20' };

    expect(streakAfter(conRacha, '2026-08-18')).toBe(5);
    expect(currentStreak(conRacha, '2026-08-18')).toBe(5);
  });

  it('sin haber practicado nunca no hay racha que llevar', () => {
    expect(currentStreak(EMPTY_PROGRESS, '2026-08-27')).toBe(0);
  });
});

describe('las medallas que da un repaso', () => {
  it('siete días seguidos dan la de la racha', () => {
    const seguido: Progress = {
      ...EMPTY_PROGRESS,
      streak: 6,
      bestStreak: 6,
      lastDay: '2026-08-26',
    };

    const despues = practiceReview(seguido, '2026-08-27', { cleared: false });

    expect(despues.badges).toContain('racha-siete');
  });

  it('y llegar a la meta del día da la suya, repasando', () => {
    // El repaso suma a la meta como una unidad: si no, quien solo repasa un día
    // pierde la racha por haber hecho justo lo que hay que hacer.
    const casi: Progress = {
      ...EMPTY_PROGRESS,
      lastDay: '2026-08-27',
      xpToday: DAILY_GOAL_XP - 1,
      streak: 1,
    };

    const despues = practiceReview(casi, '2026-08-27', { cleared: true });

    expect(despues.badges).toContain('meta-diaria');
    expect(despues.badges).toContain('repaso-al-dia');
  });
});

describe('componer cuenta como practicar', () => {
  const HOY = '2026-09-13';

  it('suma a la meta del día y enciende la racha', () => {
    const despues = practiceCompose(EMPTY_PROGRESS, HOY, 'cancion');

    expect(despues.xpToday).toBe(COMPOSE_XP.cancion);
    expect(despues.streak).toBe(1);
    expect(despues.lastDay).toBe(HOY);
  });

  it('y no toca el XP del temario', () => {
    // No es un olvido: `xp` se recalcula desde las unidades hechas al fusionar y
    // al leer, así que cualquier punto sumado ahí se perdería al entrar en la
    // cuenta desde otro aparato. Componer mide el día, no el temario.
    const conUnidad = avanzar(1);
    const despues = practiceCompose(conUnidad, HOY, 'parte');

    expect(despues.xp).toBe(conUnidad.xp);
  });

  it('mantiene la racha igual que un repaso, sin unidades de por medio', () => {
    const ayer: Progress = { ...EMPTY_PROGRESS, lastDay: '2026-09-12', streak: 4, bestStreak: 4 };

    const despues = practiceCompose(ayer, HOY, 'oido');

    expect(despues.streak).toBe(5);
    expect(despues.bestStreak).toBe(5);
  });

  describe('el tope del día', () => {
    /** Compone hasta que el tope no deje sumar más. */
    function hastaElTope(day = HOY): Progress {
      let progress = EMPTY_PROGRESS;
      for (let i = 0; i < 20; i += 1) {
        progress = practiceCompose(progress, day, 'cancion');
      }
      return progress;
    }

    it('corta en el tope por mucho que se insista', () => {
      const lleno = hastaElTope();

      expect(lleno.composeToday).toBe(MAX_COMPOSE_XP);
      expect(lleno.xpToday).toBe(MAX_COMPOSE_XP);

      // Y una vuelta más no mueve nada: el tope está lleno de verdad.
      expect(practiceCompose(lleno, HOY, 'cancion').xpToday).toBe(MAX_COMPOSE_XP);
    });

    it('y el último que cabe se recorta, no se descarta entero', () => {
      // Con el tope a uno de llenarse, un hecho de quince puntos tiene que dar
      // uno y dejarlo lleno. Descartarlo entero regalaría el hueco.
      const casi: Progress = {
        ...EMPTY_PROGRESS,
        lastDay: HOY,
        streak: 1,
        xpToday: MAX_COMPOSE_XP - 1,
        composeToday: MAX_COMPOSE_XP - 1,
      };

      const despues = practiceCompose(casi, HOY, 'cancion');

      expect(despues.composeToday).toBe(MAX_COMPOSE_XP);
      expect(despues.xpToday).toBe(MAX_COMPOSE_XP);
    });

    it('pero seguir componiendo con el tope lleno no rompe la racha', () => {
      // Lo importante de este: quien lleva cuatro horas componiendo no ha dejado
      // de practicar porque el contador esté lleno.
      const lleno = hastaElTope('2026-09-12');

      const manana = practiceCompose(lleno, HOY, 'cancion');

      expect(manana.streak).toBe(2);
    });

    it('y al día siguiente el tope vuelve a estar entero', () => {
      const lleno = hastaElTope('2026-09-12');

      const manana = practiceCompose(lleno, HOY, 'salida');

      expect(manana.composeToday).toBe(COMPOSE_XP.salida);
      expect(manana.xpToday).toBe(COMPOSE_XP.salida);
    });

    it('no deja que componer tape lo ganado con unidades', () => {
      // El tope es de lo que da componer, no del día: quien haya hecho dos
      // unidades y además componga tiene que pasar de la meta, no quedarse en
      // ella.
      const conUnidades = avanzar(2, HOY);
      const antes = conUnidades.xpToday;

      const despues = practiceCompose(conUnidades, HOY, 'cancion');

      expect(despues.xpToday).toBe(antes + COMPOSE_XP.cancion);
      expect(despues.composeToday).toBe(COMPOSE_XP.cancion);
    });
  });

  describe('las medallas que da componer', () => {
    it('guardar una canción da la primera', () => {
      expect(practiceCompose(EMPTY_PROGRESS, HOY, 'cancion').badges).toContain('primera-cancion');
    });

    it('meter un acorde que oyó el micro da la suya', () => {
      expect(practiceCompose(EMPTY_PROGRESS, HOY, 'oido').badges).toContain('de-oido');
    });

    it('quedarse con una salida de la IA da la suya', () => {
      expect(practiceCompose(EMPTY_PROGRESS, HOY, 'salida').badges).toContain('a-tu-manera');
    });

    it('y cerrar una parte no da ninguna propia: es el hecho más corriente', () => {
      const despues = practiceCompose(EMPTY_PROGRESS, HOY, 'parte');

      expect(despues.badges).toEqual([]);
    });

    it('llegar a la meta del día componiendo da la de la meta', () => {
      const casi: Progress = {
        ...EMPTY_PROGRESS,
        lastDay: HOY,
        streak: 1,
        xpToday: DAILY_GOAL_XP - 1,
        composeToday: 0,
      };

      expect(practiceCompose(casi, HOY, 'oido').badges).toContain('meta-diaria');
    });

    it('y llegar a siete días componiendo también cuenta', () => {
      const seguido: Progress = {
        ...EMPTY_PROGRESS,
        lastDay: '2026-09-12',
        streak: 6,
        bestStreak: 6,
      };

      expect(practiceCompose(seguido, HOY, 'parte').badges).toContain('racha-siete');
    });
  });

  describe('lo compuesto al fusionar y al leer', () => {
    it('de dos aparatos se queda el mayor, no la suma', () => {
      const uno: Progress = { ...EMPTY_PROGRESS, lastDay: HOY, streak: 1, composeToday: 25 };
      const otro: Progress = { ...EMPTY_PROGRESS, lastDay: HOY, streak: 1, composeToday: 15 };

      expect(mergeProgress(uno, otro).composeToday).toBe(25);
    });

    it('y sin último día no hay nada compuesto hoy', () => {
      expect(mergeProgress(EMPTY_PROGRESS, EMPTY_PROGRESS).composeToday).toBe(0);
    });

    it('lo guardado se acota al tope, que lo escribió un navegador', () => {
      const leido = parseProgress({ lastDay: HOY, streak: 1, composeToday: 9999 });

      expect(leido.composeToday).toBe(MAX_COMPOSE_XP);
    });

    it('un número imposible se lee como cero', () => {
      expect(parseProgress({ lastDay: HOY, streak: 1, composeToday: -40 }).composeToday).toBe(0);
      expect(parseProgress({ lastDay: HOY, streak: 1, composeToday: 'mucho' }).composeToday).toBe(
        0,
      );
    });

    it('y sin último día tampoco, aunque venga escrito', () => {
      expect(parseProgress({ composeToday: 30 }).composeToday).toBe(0);
    });
  });
});

describe('las medallas de una lista de identificadores', () => {
  it('salen en el orden del catálogo, no en el que se den', () => {
    // Lo preguntan la pantalla de fin de unidad y el aviso de componer, y cada
    // una lo resolvía a su manera —una filtrando, la otra buscando de una en
    // una— con dos órdenes distintos para la misma pregunta. El del catálogo es
    // el que sigue el resto del fichero: una lista que baila según cuándo se
    // ganaron no se puede leer dos veces igual.
    const enOrden = BADGES.map((badge) => badge.id);
    const revueltas = [...enOrden].reverse();

    expect(badgesOf(revueltas).map((badge) => badge.id)).toEqual(enOrden);
  });

  it('y lo que no existe se cae, en vez de dejar un hueco sin nombre', () => {
    expect(badgesOf(['primer-paso', 'medalla-retirada' as BadgeId])).toEqual([
      BADGES.find((badge) => badge.id === 'primer-paso'),
    ]);
  });

  it('sin nada que buscar, ninguna', () => {
    expect(badgesOf([])).toEqual([]);
  });
});

/**
 * Ensayar cuenta como practicar.
 *
 * Es la otra mitad de [adr/0028](../../../docs/adr/0028-componer-tambien-cuenta.md):
 * escribir la canción ya sumaba, y tocarse lo que escribiste —que es lo que de
 * verdad cuesta— no sumaba nada.
 */
describe('ensayar suma como componer', () => {
  const HOY = '2026-09-13';

  it('un ensayo entero mantiene la racha y suma a la meta del dia', () => {
    const despues = practiceCompose(EMPTY_PROGRESS, HOY, 'ensayo');

    expect(despues.streak).toBe(1);
    expect(xpEarnedOn(despues, HOY)).toBe(COMPOSE_XP.ensayo);
    expect(despues.badges).toContain('ensayo-entero');
  });

  // Salga como salga: quien se la toca entera fallando la mitad es justo quien
  // más practicó, y pagarle menos sería la nota de corte que aquí no hay.
  it('vale lo mismo salga como salga', () => {
    expect(COMPOSE_XP['ensayo-limpio']).toBe(COMPOSE_XP.ensayo);
  });

  it('clavarla da las dos medallas, no solo la dificil', () => {
    const despues = practiceCompose(EMPTY_PROGRESS, HOY, 'ensayo-limpio');

    expect(despues.badges).toContain('ensayo-limpio');
    // Tener la difícil sin la fácil se lee como que falta una.
    expect(despues.badges).toContain('ensayo-entero');
  });

  it('las dos medallas estan en el catalogo, con su explicacion', () => {
    expect(badgesOf(['ensayo-entero', 'ensayo-limpio']).map((medalla) => medalla.name)).toEqual([
      'De principio a fin',
      'Clavada',
    ]);
  });
});

/**
 * La medalla del repaso dice lo que premia.
 *
 * Decía «deja la cola vacía» y se gana al terminar un repaso sin fallar
 * ninguna: lo acertado espera al día siguiente, pero sigue en la cola. Con el
 * texto de antes, la medalla se encendía en la misma pantalla que decía «tienes
 * una pregunta para repasar».
 */
describe('la medalla del repaso', () => {
  const HOY = '2026-09-19';

  it('se gana al no dejar nada pendiente para hoy, y lo dice asi', () => {
    const limpio = practiceReview(EMPTY_PROGRESS, HOY, { cleared: true });

    expect(limpio.badges).toContain('repaso-al-dia');
    expect(badgesOf(['repaso-al-dia'])[0]?.how).toMatch(/pendiente para hoy/);
    expect(badgesOf(['repaso-al-dia'])[0]?.how).not.toMatch(/cola vacía/);
  });

  it('y fallando alguna no se gana', () => {
    expect(practiceReview(EMPTY_PROGRESS, HOY, { cleared: false }).badges).not.toContain(
      'repaso-al-dia',
    );
  });
});

describe('los bordes del avance guardado', () => {
  // Elegir el curso que ya estaba puesto no cambia nada: el avance es el mismo.
  it('elegir el mismo curso deja el avance igual', () => {
    const conCurso = startAt(EMPTY_PROGRESS, COURSES[0]!.id, '2026-09-24T10:00:00.000Z');

    // Y ni siquiera mueve el instante: no se ha elegido nada nuevo.
    expect(startAt(conCurso, COURSES[0]!.id, '2026-09-24T18:00:00.000Z')).toBe(conCurso);
  });

  /**
   * Y una fecha que no es una fecha no puede dejar una pregunta atrapada: se lee
   * como la más vieja posible, así que toca repasarla hoy.
   */
  it('una fecha imposible en la cola se lee como la mas vieja', () => {
    const leido = parseProgress({
      done: [],
      review: [{ unitId: DE_TOCAR, index: 0, seenOn: 'ayer', hits: 0 }],
    });

    expect(leido.review[0]?.seenOn).toBe('1970-01-01');
  });
});

/**
 * El temario se reordenó al estilo del conservatorio: unidades nuevas delante,
 * otras que cambiaron de curso conservando su id y cinco que se retiraron por
 * repetir la lección de otra. Lo que ya hay guardado —en el navegador y en la
 * cuenta— se escribió con el de antes, y tiene que seguir leyéndose.
 */
describe('lo guardado con el temario de antes', () => {
  /** Las unidades del temario anterior, tal cual se guardaban. */
  const HECHAS_ANTES = [
    'e1-grados',
    'e1-escala',
    'e1-oido',
    'e1-repaso',
    'e2-calidades',
    'e2-menor',
    'e2-repaso',
    'e3-rueda',
    'e3-oido',
    'e3-pentatonica',
    'e4-escalas',
    'e4-pentatonica',
    'e4-blues',
    'p1-funciones',
    'p1-oido',
    'p1-escala',
    'p1-repaso',
  ];
  const RETIRADAS = ['e1-repaso', 'p1-escala', 'p1-repaso', 'p4-tritono', 'p6-repaso'];

  const GUARDADO = {
    done: HECHAS_ANTES,
    xp: 400,
    streak: 3,
    bestStreak: 9,
    lastDay: '2026-07-29',
    badges: ['primer-paso', 'cinco-escalas', 'elemental-superado'],
    xpToday: 20,
    review: [
      { unitId: 'p1-repaso', index: 0, seenOn: '2026-07-28', hits: 0 },
      { unitId: 'p4-tritono', index: 1, seenOn: '2026-07-28', hits: 0 },
      { unitId: 'e1-grados', index: 0, seenOn: '2026-07-28', hits: 1 },
      { unitId: 'e1-grados', index: 500, seenOn: '2026-07-28', hits: 0 },
    ],
    startCourse: 'elemental-4',
    startCourseAt: CUANDO,
  };

  it('se queda con lo hecho que sigue en el temario y suelta lo retirado', () => {
    const leido = parseProgress(GUARDADO);

    expect(leido.done).toEqual(HECHAS_ANTES.filter((id) => !RETIRADAS.includes(id)));
    expect(leido.xp).toBe(leido.done.reduce((total, id) => total + findUnit(id)!.unit.xp, 0));
    // Lo que se ganó, se ganó: el Elemental ya no está cerrado con el temario de
    // ahora y su medalla se queda. Y se suman las que lo hecho demuestra.
    expect(leido.badges).toEqual([
      'primer-paso',
      'primera-escala',
      'cinco-escalas',
      'curso-completo',
      'elemental-superado',
      'racha-siete',
    ]);
  });

  it('de la cola solo queda lo que se puede volver a preguntar', () => {
    const leido = parseProgress(GUARDADO, posicionesDeLaUnidad);

    expect(leido.review).toEqual([
      { unitId: 'e1-grados', index: 0, seenOn: '2026-07-28', hits: 1 },
    ]);
  });

  it('el punto de partida sigue existiendo, y las unidades nuevas de detrás se abren', () => {
    const leido = parseProgress(GUARDADO);

    expect(leido.startCourse).toBe('elemental-4');
    // Todo lo anterior al punto de partida está abierto, también lo nuevo.
    expect(isUnitUnlocked(leido, 'e1-notas')).toBe(true);
    expect(isUnitUnlocked(leido, 'e3-menores')).toBe(true);
    // Y por delante se sigue por la primera que falta desde allí.
    expect(nextUnit(leido)).toBe(
      UNIT_ORDER.slice(startIndex(leido)).find((id) => !leido.done.includes(id)),
    );
  });

  it('sin punto de partida, lo nuevo se abre detrás de lo que ya estaba hecho', () => {
    const leido = parseProgress({ ...GUARDADO, startCourse: null, startCourseAt: null });

    expect(nextUnit(leido)).toBe(UNIT_ORDER[0]);
    // Medir intervalos va justo detrás de la escala mayor tocada, que estaba hecha.
    expect(isUnitUnlocked(leido, 'e2-intervalos')).toBe(true);
    // Y lo hecho no se cierra aunque lo de delante sea nuevo y esté sin hacer.
    expect(isUnitDone(leido, 'e1-escala')).toBe(true);
  });

  it('se funde con un avance del temario nuevo sin traer nada retirado', () => {
    const nuevo = completeUnit(EMPTY_PROGRESS, 'e1-notas', '2026-07-30');
    // La cuenta guardó con el temario de antes y no se pasó por la lectura: la
    // fusión tampoco puede dejar entrar lo retirado.
    const viejo: Progress = { ...parseProgress(GUARDADO), done: HECHAS_ANTES };

    const junto = mergeProgress(viejo, nuevo);

    expect(junto.done).toContain('e1-notas');
    expect(junto.done.some((id) => RETIRADAS.includes(id))).toBe(false);
    expect(junto.xp).toBe(junto.done.reduce((total, id) => total + findUnit(id)!.unit.xp, 0));
  });

  it('terminar una unidad nueva con medallas de antes no pierde ninguna', () => {
    const leido = parseProgress(GUARDADO);
    const despues = completeUnit(leido, 'e1-notas', '2026-07-30');

    expect(despues.badges).toEqual(expect.arrayContaining([...leido.badges]));
  });
});

/**
 * Lo que alguien manda desde la consola para tener un avance imposible.
 *
 * La auditoría lo subió tal cual y se guardó: racha y XP del día de `1e308`, un
 * último día `9999-99-99` que ganaba todas las fusiones siguientes y las quince
 * medallas sin haber hecho nada. Lo que se prueba es que **nada de eso sobrevive a
 * leerlo con el día del servidor**, y que lo legítimo de dos aparatos sí
 * (adr/0116).
 */
describe('un avance inventado, leído con el día del servidor', () => {
  const HOY = '2026-10-07';
  const INVENTADO = {
    done: [],
    streak: 1e308,
    bestStreak: 1e308,
    lastDay: '9999-99-99',
    xpToday: 1e308,
    composeToday: 1e308,
    badges: BADGES.map((badge) => badge.id),
    review: [{ unitId: DE_TOCAR, index: 0, seenOn: '9999-12-31', hits: 0 }],
    startCourse: 'profesional-6',
    startCourseAt: '9999-12-31T00:00:00.000Z',
  };

  it('no se queda nada imposible', () => {
    const leido = parseProgress(INVENTADO, undefined, HOY);

    expect(leido.lastDay).toBeNull();
    expect(leido.streak).toBe(0);
    expect(leido.bestStreak).toBeLessThanOrEqual(80);
    expect(leido.xpToday).toBe(0);
    expect(leido.badges).toEqual([]);
    expect(leido.review[0]?.seenOn).toBe('1970-01-01');
    expect(leido.startCourseAt).toBeNull();
  });

  it('una fecha bien formada pero del futuro tampoco vale', () => {
    const leido = parseProgress({ ...INVENTADO, lastDay: '9999-12-31' }, undefined, HOY);

    expect(leido.lastDay).toBeNull();
  });

  it('mañana sí vale: en UTC+14 ya es mañana', () => {
    const leido = parseProgress({ ...INVENTADO, lastDay: '2026-10-08' }, undefined, HOY);

    expect(leido.lastDay).toBe('2026-10-08');
    // La racha no pasa de los días que lleva existiendo la aplicación.
    expect(leido.streak).toBe(daysBetweenPrimerDia('2026-10-08'));
    expect(leido.bestStreak).toBe(leido.streak);
    expect(leido.xpToday).toBe(MAX_XP_DEL_DIA);
    expect(leido.composeToday).toBe(MAX_COMPOSE_XP);
    // Las que no dejan rastro se creen, porque ha practicado; las que se sacan del
    // avance, no: no ha hecho ninguna unidad.
    expect(leido.badges).toContain('primera-cancion');
    expect(leido.badges).toContain('racha-siete');
    expect(leido.badges).not.toContain('primer-paso');
    expect(leido.badges).not.toContain('sin-fallar');
    expect(leido.badges).not.toContain('profesional-superado');
  });

  it('sin el día del servidor se mira la forma de la fecha, no lo lejos que cae', () => {
    // El navegador no tiene un reloj del que fiarse y lo suyo es suyo: lo recorta
    // el servidor al subirlo.
    expect(parseProgress({ lastDay: '9999-12-31', streak: 3 }).lastDay).toBe('9999-12-31');
    expect(parseProgress({ lastDay: '9999-99-99', streak: 3 }).lastDay).toBeNull();
  });

  it('un valor envenenado ya guardado se arregla en la siguiente fusión', () => {
    // Lo guardado pasa por `parseProgress` al leerse, y entonces el `9999` deja de
    // ganar: manda el día de verdad del aparato que sube.
    const guardado = parseProgress({ ...INVENTADO, lastDay: '9999-12-31' }, undefined, HOY);
    const deVerdad = completeUnit(EMPTY_PROGRESS, UNIT_ORDER[0]!, HOY);

    const junto = mergeProgress(guardado, deVerdad);

    expect(junto.lastDay).toBe(HOY);
    expect(junto.streak).toBe(1);
    expect(junto.xpToday).toBe(deVerdad.xpToday);
    expect(junto.startCourse).toBe('profesional-6');
  });

  it('lo legítimo de dos aparatos no se pierde', () => {
    let uno = EMPTY_PROGRESS;
    for (let i = 0; i < 8; i += 1) {
      uno = completeUnit(uno, UNIT_ORDER[i]!, `2026-09-${String(20 + i).padStart(2, '0')}`);
    }
    uno = practiceCompose(uno, '2026-09-27', 'cancion');
    const otro = practiceReview(completeUnit(EMPTY_PROGRESS, 'e2-calidades', HOY), HOY, {
      cleared: true,
    });

    const subido = parseProgress(JSON.parse(JSON.stringify(otro)), undefined, HOY);
    const guardado = parseProgress(JSON.parse(JSON.stringify(uno)), undefined, HOY);
    const junto = mergeProgress(guardado, subido);

    expect(subido).toEqual(otro);
    expect(guardado).toEqual(uno);
    expect(junto.done).toHaveLength(9);
    expect(junto.bestStreak).toBe(8);
    expect(junto.badges).toEqual(
      expect.arrayContaining(['racha-siete', 'primera-cancion', 'repaso-al-dia']),
    );
  });

  it('las medallas que lo hecho demuestra llegan solas, sin que nadie las mande', () => {
    // Todo el temario hecho es un avance posible —se puede subir, y es su avance—,
    // y entonces los dos grados están cerrados digan lo que digan las medallas.
    const leido = parseProgress({ done: UNIT_ORDER, lastDay: HOY, streak: 1 }, undefined, HOY);

    expect(leido.badges).toEqual(
      expect.arrayContaining(['curso-completo', 'elemental-superado', 'profesional-superado']),
    );
  });

  it('repasar sin parar no pasa del techo del día', () => {
    let progress = EMPTY_PROGRESS;
    for (let i = 0; i < 2 * (MAX_XP_DEL_DIA / REVIEW_XP); i += 1) {
      progress = practiceReview(progress, HOY);
    }

    expect(progress.xpToday).toBe(MAX_XP_DEL_DIA);
  });

  function daysBetweenPrimerDia(hasta: string): number {
    return (
      (Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${PRIMER_DIA}T12:00:00Z`)) / 86_400_000 + 1
    );
  }
});
