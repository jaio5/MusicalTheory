import { describe, expect, it } from 'vitest';

import { COURSES, TOTAL_XP, UNIT_ORDER, findUnit } from './curriculum';
import { LESSONS, lessonNotes } from './lessons';
import { pitchClassFromName } from './notes';
import {
  BADGES,
  DAILY_GOAL_XP,
  EMPTY_PROGRESS,
  REVIEW_XP,
  completeUnit,
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
  type Progress,
} from './progress';
import { isUnitCracked, MASTERED_HITS } from './review';

const C = pitchClassFromName('C');

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
    const cuenta = completeUnit(EMPTY_PROGRESS, 'e1-grados', '2026-07-28');
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
        { unitId: PRIMERA, index: 1, seenOn: '2026-07-29', hits: 1 },
        { unitId: 'curso-de-laud-medieval', index: 0, seenOn: '2026-07-29', hits: 0 },
        { unitId: PRIMERA, index: -3, seenOn: '2026-07-29', hits: 0 },
        'ni siquiera es un objeto',
      ],
    });

    expect(progress.review).toEqual([{ unitId: PRIMERA, index: 1, seenOn: '2026-07-29', hits: 1 }]);
  });

  // Con los aciertos suficientes la pregunta debería haber salido de la cola.
  // Si alguien edita el JSON para dejarla dentro con más, se le recorta en vez
  // de quedarse una pregunta que no toca nunca.
  it('recorta los aciertos de una pregunta que debería estar fuera', () => {
    const progress = parseProgress({
      review: [{ unitId: PRIMERA, index: 0, seenOn: '2026-07-29', hits: 99 }],
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
    const progress = startAt(EMPTY_PROGRESS, 'profesional-1');

    expect(isUnitUnlocked(progress, PRIMERA_DEL_PROFESIONAL)).toBe(true);
    expect(nextUnit(progress)).toBe(PRIMERA_DEL_PROFESIONAL);
  });

  /**
   * Lo de antes queda abierto: quien empieza en el Profesional tiene que poder
   * bajar a mirar los grados el día que se pierda.
   */
  it('deja abierto todo lo anterior al punto de partida', () => {
    const progress = startAt(EMPTY_PROGRESS, 'profesional-1');

    for (const id of UNIT_ORDER.slice(0, startIndex(progress) + 1)) {
      expect(isUnitUnlocked(progress, id), id).toBe(true);
    }
  });

  // De ahí en adelante la escalera sigue intacta: cada curso usa lo anterior.
  it('de tu punto de partida en adelante sigue siendo una detrás de otra', () => {
    const progress = startAt(EMPTY_PROGRESS, 'profesional-1');
    const segunda = UNIT_ORDER[startIndex(progress) + 1]!;

    expect(isUnitUnlocked(progress, segunda)).toBe(false);

    const tras = completeUnit(progress, PRIMERA_DEL_PROFESIONAL, '2026-07-30');
    expect(isUnitUnlocked(tras, segunda)).toBe(true);
  });

  // Regalar once unidades por elegir un desplegable convertiría el marcador en
  // una mentira.
  it('no da por hechas las unidades que se salta, ni regala XP', () => {
    const progress = startAt(EMPTY_PROGRESS, 'profesional-2');

    expect(progress.done).toEqual([]);
    expect(progress.xp).toBe(0);
    expect(isUnitDone(progress, UNIT_ORDER[0]!)).toBe(false);
  });

  it('cuando ya no queda nada por delante, ofrece lo que se saltó', () => {
    let progress = startAt(EMPTY_PROGRESS, 'profesional-1');
    for (const id of UNIT_ORDER.slice(startIndex(progress))) {
      progress = completeUnit(progress, id, '2026-07-30');
    }

    expect(nextUnit(progress)).toBe(UNIT_ORDER[0]);
  });

  it('un curso que no existe deja el avance igual', () => {
    const progress = avanzar(2);

    expect(startAt(progress, 'curso-de-laud-medieval')).toBe(progress);
    expect(startIndex({ ...progress, startCourse: 'curso-de-laud-medieval' })).toBe(0);
  });

  it('se puede volver al principio', () => {
    const progress = startAt(startAt(EMPTY_PROGRESS, 'profesional-1'), null);

    expect(startIndex(progress)).toBe(0);
    expect(nextUnit(progress)).toBe(UNIT_ORDER[0]);
  });

  it('se guarda y se recupera, y un curso retirado se olvida', () => {
    expect(parseProgress({ startCourse: 'profesional-3' }).startCourse).toBe('profesional-3');
    expect(parseProgress({ startCourse: 'lo-que-sea' }).startCourse).toBeNull();
    expect(parseProgress({}).startCourse).toBeNull();
  });

  // Se queda con el que abre más camino, como el resto de la fusión.
  it('al fusionar gana el punto de partida más adelantado', () => {
    const antes = startAt(EMPTY_PROGRESS, 'elemental-2');
    const despues = startAt(EMPTY_PROGRESS, 'profesional-1');

    expect(mergeProgress(antes, despues).startCourse).toBe('profesional-1');
    expect(mergeProgress(despues, antes).startCourse).toBe('profesional-1');
  });
});
