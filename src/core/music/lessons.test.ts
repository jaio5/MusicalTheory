import { describe, expect, it } from 'vitest';

import { keySignature } from './circle-of-fifths';
import { keyName } from './keys';
import { LESSONS, lessonNotes, type LessonId } from './lessons';
import { pitchClassFromName, type PitchClass } from './notes';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');
const IDS = LESSONS.map((lesson) => lesson.id);

function answerOf(id: LessonId, index: number, tonic = C, mode: 'major' | 'minor' = 'major') {
  const exercise = lessonNotes(id, tonic, mode).exercises[index]!;
  return exercise.choices.find((choice) => choice.correct)!.text;
}

describe('Lecciones', () => {
  it('todas se pueden generar en cualquier tonalidad', () => {
    for (const id of IDS) {
      for (const mode of ['major', 'minor'] as const) {
        const notes = lessonNotes(id, A, mode);

        expect(notes.points.length).toBeGreaterThan(0);
        expect(notes.exercises.length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Y en las veinticuatro tonalidades, no solo en Do mayor.
   *
   * Miraba una sola, y por eso pasó diez años de lecciones en verde una pregunta
   * que en **diez de las doce menores** ofrecía la respuesta buena dos veces: una
   * marcada como buena y otra como mala. Quien pulsaba la segunda fallaba con el
   * acorde correcto en la mano.
   */
  it('cada ejercicio tiene una única respuesta buena y ninguna repetida', () => {
    for (const id of IDS) {
      for (let tonic = 0; tonic < 12; tonic++) {
        for (const mode of ['major', 'minor'] as const) {
          for (const exercise of lessonNotes(id, tonic as PitchClass, mode).exercises) {
            const donde = `${keyName(tonic as PitchClass, mode)} ${id}: ${exercise.prompt}`;

            expect(
              exercise.choices.filter((choice) => choice.correct),
              donde,
            ).toHaveLength(1);
            expect(new Set(exercise.choices.map((choice) => choice.text)).size, donde).toBe(
              exercise.choices.length,
            );
            expect(exercise.why, donde).not.toBe('');
          }
        }
      }
    }
  });

  /**
   * La buena salía siempre la primera, así que se aprobaba el temario pulsando a
   * la izquierda sin leer la pregunta. Se comprueba sobre todas las lecciones y
   * las dos especies: que aparezca en las cuatro posiciones y en ninguna mucho más
   * que en las otras.
   */
  it('la respuesta buena no cae siempre en el mismo sitio', () => {
    const sitios = new Map<number, number>();
    let total = 0;

    for (const id of IDS) {
      for (const [tonic, mode] of [
        [C, 'major'],
        [A, 'minor'],
      ] as const) {
        for (const exercise of lessonNotes(id, tonic, mode).exercises) {
          const donde = exercise.choices.findIndex((choice) => choice.correct);
          sitios.set(donde, (sitios.get(donde) ?? 0) + 1);
          total += 1;
        }
      }
    }

    expect([...sitios.keys()].sort()).toEqual([0, 1, 2, 3]);
    for (const veces of sitios.values()) {
      // Repartir no es cuadrar: con esta cuenta basta para que no haya un sitio
      // preferido, que es lo que se podía aprender de memoria.
      expect(veces).toBeGreaterThan(total / 10);
    }
  });

  /**
   * Con azar de verdad las opciones cambiarían de sitio en cada repintado y el
   * botón se movería debajo del dedo: la pregunta se vuelve a generar cada vez que
   * React pinta la unidad o el repaso.
   */
  it('el reparto es el mismo cada vez que se pide la misma lección', () => {
    for (const id of IDS) {
      const una = lessonNotes(id, C, 'major').exercises.map((exercise) =>
        exercise.choices.map((choice) => choice.text),
      );
      const otra = lessonNotes(id, C, 'major').exercises.map((exercise) =>
        exercise.choices.map((choice) => choice.text),
      );
      expect(otra).toEqual(una);
    }
  });

  /**
   * Y cambia con la tonalidad, que es lo que hace que repetir una unidad en otro
   * tono no sea repetir la misma pantalla. Se mira la lección entera y no un
   * ejercicio suelto: que uno caiga en el mismo sitio en dos tonalidades es una
   * coincidencia normal entre cuatro posiciones, y afirmarlo de uno sería exigir
   * al reparto algo que no promete.
   */
  it('en otra tonalidad las opciones caen de otra forma', () => {
    const sitios = (tonic: typeof C, mode: 'major' | 'minor') =>
      lessonNotes('degrees', tonic, mode).exercises.map((exercise) =>
        exercise.choices.findIndex((choice) => choice.correct),
      );

    expect(sitios(A, 'minor')).not.toEqual(sitios(C, 'major'));
  });

  it('pregunta por los acordes de la tonalidad en la que estás', () => {
    expect(answerOf('degrees', 0)).toBe('G');
    expect(answerOf('degrees', 0, A, 'minor')).toBe('Em');
  });

  it('el cuarto grado se nombra con su número romano', () => {
    expect(answerOf('degrees', 1)).toBe('IV');
  });

  it('la séptima del quinto grado de C mayor es G7', () => {
    expect(answerOf('qualities', 2)).toBe('G7');
  });

  it('la relativa de C mayor es A menor', () => {
    expect(answerOf('circle', 0)).toBe('A menor');
    expect(answerOf('circle', 0, A, 'minor')).toBe('C mayor');
  });

  it('una quinta arriba de C es G', () => {
    expect(answerOf('circle', 1)).toBe('G');
  });

  it('el bVII de C mayor es Bb', () => {
    expect(answerOf('borrowed', 0)).toBe('Bb');
  });

  /**
   * La armadura que se enseña es la de la tonalidad, y se comprueba contra la
   * que dibuja el pentagrama.
   *
   * Se preguntaba por la posición de la **nota** en la rueda, que es otra cosa:
   * La está en la mitad de sostenidos, pero La menor no lleva ninguna
   * alteración. Ocho de las veinticuatro contestaban mal, y entre ellas las dos
   * con las que arranca la aplicación —Do mayor y La menor—, así que era la
   * primera pregunta de armadura que veía casi todo el mundo. A quien acertaba
   * se le decía que no, que en una aplicación que enseña es el peor fallo que
   * hay.
   */
  it('en las veinticuatro tonalidades, la armadura que se pregunta es la de verdad', () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ['major', 'minor'] as const) {
        const firma = keySignature(tonic as PitchClass, mode);
        const debida =
          firma.letters.length === 0
            ? 'Sin alteraciones'
            : firma.accidental === 'sharp'
              ? 'Con sostenidos'
              : 'Con bemoles';

        expect(
          answerOf('circle', 2, tonic as PitchClass, mode),
          keyName(tonic as PitchClass, mode),
        ).toBe(debida);
      }
    }
  });

  it('las lecciones no se repiten', () => {
    expect(new Set(IDS).size).toBe(IDS.length);
  });
});
