import { describe, expect, it } from 'vitest';

import { keySignature } from './circle-of-fifths';
import { keyName, type KeyMode } from './keys';
import { LESSONS, lessonNotes, type LessonId } from './lessons';
import { normalizePitchClass, pitchClassFromName, type PitchClass } from './notes';
import { scaleNotes } from './scales';

const C = pitchClassFromName('C');
const A = pitchClassFromName('A');
const IDS = LESSONS.map((lesson) => lesson.id);

/** Las diez lecciones de este fichero: las de `lecciones/` tienen sus tests. */
const DE_AQUI: readonly LessonId[] = [
  'degrees',
  'qualities',
  'circle',
  'borrowed',
  'scales',
  'functions',
  'sevenths',
  'substitutions',
  'modes',
  'cadences',
];

/** Las veinticuatro tonalidades. */
const TONALIDADES = Array.from({ length: 12 }, (_, tonic) =>
  (['major', 'minor'] as const).map((mode) => [tonic as PitchClass, mode] as const),
).flat();

function answerOf(id: LessonId, index: number, tonic = C, mode: KeyMode = 'major') {
  const exercise = lessonNotes(id, tonic, mode).exercises[index]!;
  return exercise.choices.find((choice) => choice.correct)!.text;
}

function exerciseOf(id: LessonId, index: number, tonic = C, mode: KeyMode = 'major') {
  return lessonNotes(id, tonic, mode).exercises[index]!;
}

/** Todo lo que se lee de una lección, en un solo texto. */
function textoDe(id: LessonId, tonic = C, mode: KeyMode = 'major') {
  const notes = lessonNotes(id, tonic, mode);
  return [
    ...notes.points,
    ...notes.exercises.flatMap((e) => [e.prompt, e.why, ...e.choices.map((c) => c.text)]),
  ].join(' ');
}

const LETRA: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** La altura de una nota escrita, con dobles alteraciones si las lleva. */
function altura(nota: string): PitchClass {
  const sostenidos = nota.split('#').length - 1;
  const bemoles = nota.slice(1).split('b').length - 1;
  return normalizePitchClass(LETRA[nota[0]!]! + sostenidos - bemoles);
}

describe('Lecciones', () => {
  /**
   * Lo que la unidad promete en su presentación se pregunta, así que cada una
   * de las diez tiene que dar para una prueba: entre cinco y seis preguntas, de
   * cuatro opciones, y de tres a cinco puntos de teoría antes.
   */
  it('cada lección tiene de tres a cinco puntos y cinco o seis preguntas de cuatro opciones', () => {
    for (const id of DE_AQUI) {
      for (const [tonic, mode] of TONALIDADES) {
        const notes = lessonNotes(id, tonic, mode);
        const donde = `${keyName(tonic, mode)} ${id}`;

        expect(notes.points.length, donde).toBeGreaterThanOrEqual(3);
        expect(notes.points.length, donde).toBeLessThanOrEqual(5);
        expect(notes.exercises.length, donde).toBeGreaterThanOrEqual(5);
        expect(notes.exercises.length, donde).toBeLessThanOrEqual(6);
        for (const exercise of notes.exercises) {
          expect(exercise.choices, `${donde}: ${exercise.prompt}`).toHaveLength(4);
        }
      }
    }
  });

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

  // Preguntaba por el G7, que es de tercero de Profesional: esta unidad es de
  // cuarto de Elemental y lo que promete es qué especie sale sobre cada grado.
  it('las tríadas mayores salen sobre I, IV y V en mayor, y sobre III, VI y VII en menor', () => {
    expect(answerOf('qualities', 2)).toBe('I, IV y V');
    expect(answerOf('qualities', 2, A, 'minor')).toBe('III, VI y VII');
  });

  it('la relativa de C mayor es A menor', () => {
    expect(answerOf('circle', 0)).toBe('A menor');
    expect(answerOf('circle', 0, A, 'minor')).toBe('C mayor');
  });

  // Se pregunta por una tonalidad, y se contesta con una: antes era la nota.
  it('una quinta arriba de C mayor está G mayor, y de A menor, E menor', () => {
    expect(answerOf('circle', 1)).toBe('G mayor');
    expect(answerOf('circle', 1, A, 'minor')).toBe('E menor');
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

/**
 * El modo menor no es el mayor con otro nombre, y durante mucho tiempo estas
 * lecciones lo trataron así.
 *
 * Cuatro de las diez estaban escritas para mayor y se servían tal cual en menor.
 * En La menor se llegaba a decir que `Em7` es «la única con tercera mayor y
 * séptima menor», que `G7` lleva la quinta bemol y que `Fa` es el relativo
 * menor de `Am`. Las tres son falsas, y las tres las leía cualquiera que
 * estudiase en menor.
 */
describe('Lo que cambia al estudiar en menor', () => {
  it('la dominante es la mayor prestada del armonico, no el quinto grado', () => {
    expect(answerOf('sevenths', 0, A, 'minor')).toBe('E7');
    expect(answerOf('cadences', 0, A, 'minor')).toBe('E → Am');
    // Y en mayor sigue siendo la de siempre.
    expect(answerOf('sevenths', 0)).toBe('G7');
    expect(answerOf('cadences', 0)).toBe('G → C');
  });

  it('el semidisminuido que se pregunta es el que la tonalidad tiene', () => {
    // El vii en mayor y el ii en menor. Se preguntaba siempre por el séptimo,
    // así que en menor decía que G7 —una dominante— lleva la quinta bemol.
    for (const [tonic, mode] of [
      [C, 'major'],
      [A, 'minor'],
    ] as const) {
      expect(lessonNotes('sevenths', tonic, mode).exercises[2]!.prompt).toContain('Bm7b5');
    }
  });

  it('el acorde que más tira a casa en menor es la dominante mayor, no el v', () => {
    expect(answerOf('degrees', 2)).toBe('G');
    expect(answerOf('degrees', 2, A, 'minor')).toBe('E');
  });

  it('los de dominante en menor son los de la armónica', () => {
    expect(lessonNotes('functions', A, 'minor').points[1]).toContain('aprietan E y G#dim');
    expect(lessonNotes('functions', A, 'minor').exercises[0]!.prompt).toContain('papel hace E ');
  });

  it('la rota va al VI, que solo en mayor es el relativo', () => {
    expect(exerciseOf('cadences', 1, A, 'minor').why).not.toContain('relativo');
    expect(exerciseOf('cadences', 1, A, 'minor').why).toContain('al VI, F');
  });

  it('el prestado que se ensena existe en el modo en el que se ensena', () => {
    // En mayor, el bVII; en menor eso ya es el VII de la escala. Y tampoco es la
    // dominante mayor, que se llegó a enseñar como préstamo: es el V de la propia
    // tonalidad menor, por la armónica. El préstamo del menor es la tónica mayor.
    expect(answerOf('borrowed', 0)).toBe('Bb');
    expect(answerOf('borrowed', 0, A, 'minor')).toBe('A');
    expect(exerciseOf('borrowed', 0, A, 'minor').prompt).toContain('tercera de picardía');
    expect(lessonNotes('borrowed', A, 'minor').points[1]).toContain('E, no es un préstamo');
  });

  it('en menor, los tonales se cuentan con la dominante mayor, como el punto siguiente', () => {
    const notes = lessonNotes('degrees', A, 'minor');
    expect(notes.points[2]).toContain(
      'entre Am, Dm y E tienen las siete notas de la menor armónica',
    );
    expect(notes.points[3]).toContain('en menor se toca mayor, E');
    expect(exerciseOf('degrees', 4, A, 'minor').why).toContain('con Am, Dm y E');
    // En mayor no cambia nada.
    expect(lessonNotes('degrees', C, 'major').points[2]).toContain('entre C, F y G');
  });

  it('cerrar la frase se pregunta con la dominante que nombra el porqué', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const ejercicio = exerciseOf('functions', 3, tonic, mode);
      const nombrada = /Dejarla en (\S+) deja/.exec(ejercicio.why)![1]!;
      expect(
        ejercicio.choices.map((choice) => choice.text),
        keyName(tonic, mode),
      ).toContain(nombrada);
    }
    // La séptima del acorde y el séptimo grado de la escala son dos cosas.
    expect(exerciseOf('functions', 0, A, 'minor').why).toContain(
      'el séptimo grado de la escala subido',
    );
  });
});

/**
 * Un grado rebajado se escribe con bemol aunque la tonalidad vaya de sostenidos.
 *
 * Es una regla que este proyecto ya había peleado en el lienzo —«el bVII de Do
 * es Bb, nunca A#»— y que aquí seguía sin cumplirse: el frigio de Do salía con
 * cuatro notas de siete mal escritas, la cadencia del rock era «A# a C» y el
 * sustituto tritonal, «C#7». En Do mayor no hay ni un sostenido que escribir,
 * así que basta con mirar si aparece alguno.
 */
describe('Cómo se escribe lo que se rebaja', () => {
  it('en Do mayor no aparece ni un sostenido', () => {
    for (const id of [
      'modes',
      'cadences',
      'substitutions',
      'borrowed',
      'sevenths',
      'functions',
      'scales',
    ] as const) {
      expect(textoDe(id), id).not.toMatch(/[A-G]#/);
    }
  });

  it('el bVII de Db mayor es Cb, y la sensible de G# menor, F##', () => {
    expect(answerOf('borrowed', 0, pitchClassFromName('Db'))).toBe('Cb');
    expect(exerciseOf('degrees', 2, pitchClassFromName('G#'), 'minor').why).toContain(
      'lleva F##, la sensible',
    );
    // Y la tercera de picardía de G# menor es B#, no C.
    expect(answerOf('borrowed', 4, pitchClassFromName('G#'), 'minor')).toBe('B#');
  });
});

/**
 * Cada grado con su letra, que con los doce nombres de `noteName` no se puede.
 *
 * En F# mayor el séptimo grado es Mi#, y salía «Fdim»: la lista de los siete
 * acordes tenía dos sobre la letra F y ninguno sobre la E. Pasaba también en D#
 * menor, con el ii°.
 */
describe('La ortografía de los grados', () => {
  it('los siete acordes de cada tonalidad caen sobre las siete letras', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const lista = lessonNotes('degrees', tonic, mode).points[0]!;
      const letras = [...lista.matchAll(/ [iIvV]+°? ([A-G])/g)].map((match) => match[1]);

      expect(new Set(letras).size, keyName(tonic, mode)).toBe(7);
    }
  });

  it('F# mayor tiene E#dim y D# menor su ii° E#dim', () => {
    expect(lessonNotes('degrees', pitchClassFromName('F#'), 'major').points[0]).toContain(
      'vii° E#dim',
    );
    expect(lessonNotes('degrees', pitchClassFromName('D#'), 'minor').points[0]).toContain(
      'ii° E#dim',
    );
  });

  it('el mixolidio de Db se escribe con bemoles, y el frigio de Bb menor sobre Bb', () => {
    const db = lessonNotes('modes', pitchClassFromName('Db'), 'major').points;
    expect(db).toContain(
      'Mixolidio sobre Db: Db · Eb · F · Gb · Ab · Bb · Cb. Mayor con la séptima menor: de ahí sale el bVII del rock.',
    );
    expect(lessonNotes('modes', pitchClassFromName('Bb'), 'minor').points[4]).toMatch(
      /^Frigio sobre Bb: Bb · Cb · Db · Eb · F · Gb · Ab\./,
    );
  });
});

/**
 * Lo que cada unidad promete en su presentación (`curriculum.ts`) y no se
 * preguntaba. Se comprueba con valores concretos en Do mayor y La menor, y en
 * alguna con bemoles y otra con sostenidos.
 */
describe('Lo que promete cada unidad, preguntado', () => {
  const EB = pitchClassFromName('Eb');
  const E = pitchClassFromName('E');
  const F = pitchClassFromName('F');
  const FS = pitchClassFromName('F#');
  const BB = pitchClassFromName('Bb');

  it('grados: la minúscula, los tonales y el acorde de fuera', () => {
    expect(answerOf('degrees', 3)).toBe('Porque Dm es un acorde menor');
    expect(answerOf('degrees', 3, A, 'minor')).toBe('Porque Am es un acorde menor');
    expect(answerOf('degrees', 4)).toBe('I, IV y V');
    expect(answerOf('degrees', 5)).toBe('D');
    expect(answerOf('degrees', 5, A, 'minor')).toBe('B');
    expect(exerciseOf('degrees', 5).why).toContain('D pide F#');
    expect(answerOf('degrees', 5, EB)).toBe('F');
  });

  it('especies: las cuatro tríadas por sus terceras, y la aumentada', () => {
    expect(answerOf('qualities', 0)).toBe('Menor');
    expect(answerOf('qualities', 1)).toBe('Bdim');
    expect(answerOf('qualities', 3)).toBe('Dos terceras mayores');
    expect(answerOf('qualities', 4)).toBe('Una mayor y encima una menor');
    expect(answerOf('qualities', 5)).toBe('G');
    expect(answerOf('qualities', 5, A, 'minor')).toBe('E');
    expect(lessonNotes('qualities', C, 'major').points[3]).toContain('Caug = C, E, G#');
    expect(lessonNotes('qualities', A, 'minor').points[3]).toContain('Caug = C, E, G#');
    // La de G# menor armónica lleva la sensible, que es F doble sostenido.
    expect(lessonNotes('qualities', pitchClassFromName('G#'), 'minor').points[3]).toContain(
      'Baug = B, D#, F##',
    );
  });

  it('armaduras: el orden, y la tonalidad por la armadura', () => {
    expect(answerOf('circle', 3)).toBe('Fa, Do, Sol, Re, La, Mi, Si');
    expect(answerOf('circle', 3, F)).toBe('Si, Mi, La, Re, Sol, Do, Fa');
    expect(answerOf('circle', 3, BB, 'minor')).toBe('Si, Mi, La, Re, Sol, Do, Fa');
    expect(exerciseOf('circle', 4).prompt).toContain('sin alteraciones');
    expect(answerOf('circle', 4, EB)).toBe('Eb mayor');
    expect(exerciseOf('circle', 4, EB).why).toBe('El penúltimo bemol, Eb, es la tónica: Eb mayor.');
    expect(exerciseOf('circle', 4, E).why).toBe(
      'El último sostenido es D#, y medio tono por encima está E: E mayor.',
    );
    expect(exerciseOf('circle', 4, F).why).toBe('Con un solo bemol, Bb, es F mayor.');
    expect(exerciseOf('circle', 4, pitchClassFromName('C#'), 'minor').why).toContain(
      'C# menor es su relativa',
    );
    expect(answerOf('circle', 5)).toBe('Una');
    // La vecina de arriba de F# es C#, no Db.
    expect(answerOf('circle', 1, FS)).toBe('C# mayor');
  });

  it('intercambio modal: el paralelo, el iv menor y la nota de fuera', () => {
    expect(answerOf('borrowed', 1)).toBe('Fm');
    expect(answerOf('borrowed', 1, A, 'minor')).toBe('Dm');
    expect(answerOf('borrowed', 3)).toBe('C menor');
    expect(answerOf('borrowed', 3, A, 'minor')).toBe('A mayor');
    expect(answerOf('borrowed', 3, pitchClassFromName('C#'), 'minor')).toBe('C# mayor');
    expect(answerOf('borrowed', 4)).toBe('Bb');
    expect(answerOf('borrowed', 4, A, 'minor')).toBe('C#');
    expect(exerciseOf('borrowed', 4, A, 'minor').prompt).toBe(
      '¿Qué nota de fuera de A menor trae el acorde A?',
    );
    expect(answerOf('borrowed', 0, E)).toBe('D');
  });

  it('pentatónicas y blues: sin semitonos, la quinta disminuida y la relativa', () => {
    expect(answerOf('scales', 1)).toBe('Pentatónica mayor de C');
    expect(answerOf('scales', 1, A, 'minor')).toBe('Pentatónica menor de A');
    expect(answerOf('scales', 2)).toBe('Una quinta disminuida');
    expect(answerOf('scales', 3)).toBe('Un tono o una tercera menor, nunca un semitono');
    expect(answerOf('scales', 4)).toBe('Gb');
    expect(answerOf('scales', 4, A, 'minor')).toBe('Eb');
    expect(answerOf('scales', 4, E)).toBe('Bb');
    // La quinta disminuida de Bb es Fb: con E sería una cuarta aumentada.
    expect(answerOf('scales', 4, BB)).toBe('Fb');
    expect(answerOf('scales', 5)).toBe('La de A');
    expect(answerOf('scales', 5, A, 'minor')).toBe('La de C');
    expect(lessonNotes('scales', C, 'major').points[0]).toContain('C, D, E, G, A');
  });

  /**
   * La pentatónica buena no trae ni una nota de fuera, y cada mala trae alguna:
   * si no, «encaja sin ninguna nota de fuera» tendría dos respuestas buenas.
   */
  it('en las veinticuatro, solo la pentatónica buena cabe en la escala', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const escala = scaleNotes(tonic, mode === 'major' ? 'major' : 'naturalMinor');
      for (const choice of exerciseOf('scales', 1, tonic, mode).choices) {
        const [, especie, raiz] = /^Pentatónica (mayor|menor) de (.+)$/.exec(choice.text)!;
        const notas = scaleNotes(
          altura(raiz!),
          especie === 'mayor' ? 'majorPentatonic' : 'minorPentatonic',
        );
        expect(
          notas.every((nota) => escala.includes(nota)),
          `${keyName(tonic, mode)}: ${choice.text}`,
        ).toBe(choice.correct);
      }
    }
  });

  it('funciones: el II por el IV y el tritono de la dominante', () => {
    expect(answerOf('functions', 4)).toBe('Porque comparte F y A con F');
    expect(answerOf('functions', 4, A, 'minor')).toBe('Porque comparte D y F con Dm');
    expect(answerOf('functions', 5)).toBe('B y F');
    expect(answerOf('functions', 5, A, 'minor')).toBe('G# y D');
    expect(answerOf('functions', 5, EB)).toBe('D y Ab');
  });

  /** El tritono que se pregunta mide seis semitonos de verdad, en las veinticuatro. */
  it('en las veinticuatro, el tritono de la dominante son seis semitonos', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const [abajo, arriba] = answerOf('functions', 5, tonic, mode).split(' y ');
      expect(normalizePitchClass(altura(arriba!) - altura(abajo!)), keyName(tonic, mode)).toBe(6);
    }
  });

  it('séptimas: las cinco especies y su cifrado', () => {
    expect(exerciseOf('sevenths', 3).prompt).toContain('Dm7');
    expect(answerOf('sevenths', 3)).toBe('Menor: tríada menor y séptima menor');
    expect(exerciseOf('sevenths', 4).prompt).toContain('Bdim7');
    expect(exerciseOf('sevenths', 4, A, 'minor').prompt).toContain('G#dim7');
    expect(answerOf('sevenths', 4)).toBe('Tres terceras menores seguidas');
    expect(answerOf('sevenths', 5)).toBe('viiø7');
    expect(answerOf('sevenths', 5, A, 'minor')).toBe('iiø7');
    expect(lessonNotes('sevenths', C, 'major').points[4]).toContain('Bdim7 = B, D, F, Ab');
  });

  it('sustituciones: el II por el IV, la regla y el tritonal', () => {
    expect(answerOf('substitutions', 3)).toBe('Dm');
    expect(answerOf('substitutions', 3, A, 'minor')).toBe('Bdim');
    expect(answerOf('substitutions', 4)).toBe('Que haga la misma función y comparta notas con él');
    expect(answerOf('substitutions', 5)).toBe('Db7');
    expect(answerOf('substitutions', 5, A, 'minor')).toBe('Bb7');
    expect(answerOf('substitutions', 5, E)).toBe('F7');
  });

  it('modos: los siete, la nota característica y los mayores', () => {
    expect(lessonNotes('modes', C, 'major').points[0]).toContain(
      'C jónico, D dórico, E frigio, F lidio, G mixolidio, A eólico, B locrio',
    );
    // En menor, los de su relativa mayor.
    expect(lessonNotes('modes', A, 'minor').points[0]).toContain('Con las de C mayor');
    expect(answerOf('modes', 3)).toBe('La cuarta, que es aumentada');
    expect(answerOf('modes', 4)).toBe('Jónico, lidio y mixolidio');
    expect(answerOf('modes', 5)).toBe('Locrio');
    expect(exerciseOf('modes', 5).prompt).toContain('empieza en B');
    expect(exerciseOf('modes', 5, FS).prompt).toContain('empieza en E#');
  });

  /**
   * Con los nombres del conservatorio español. Se llamaba «auténtica», que es
   * como la llaman los libros en inglés, y no estaban ni la imperfecta ni la
   * semicadencia, que la unidad promete.
   */
  it('cadencias: perfecta, imperfecta, plagal, semicadencia y rota', () => {
    expect(answerOf('cadences', 1)).toBe('Cadencia rota');
    expect(answerOf('cadences', 2)).toBe('Semicadencia');
    expect(exerciseOf('cadences', 2, A, 'minor').prompt).toBe(
      'Una frase acaba en E, después de Dm. ¿Qué cadencia hace?',
    );
    expect(answerOf('cadences', 3)).toBe('Plagal');
    expect(exerciseOf('cadences', 3, A, 'minor').prompt).toContain('Dm → Am');
    expect(answerOf('cadences', 4)).toBe('Imperfecta');
    expect(exerciseOf('cadences', 4).prompt).toContain('(C/E)');
    expect(exerciseOf('cadences', 4, A, 'minor').prompt).toContain('(Am/C)');
    expect(answerOf('cadences', 5)).toBe(
      'Los dos en estado fundamental y la tónica en la voz de arriba',
    );
    for (const [tonic, mode] of TONALIDADES) {
      const opciones = lessonNotes('cadences', tonic, mode).exercises.flatMap((e) =>
        e.choices.map((c) => c.text),
      );
      expect(opciones.join(' '), keyName(tonic, mode)).not.toMatch(/auténtica/i);
    }
  });
});

/**
 * Lo que encontró la revisión del temario leyéndolo como lo lee el alumno, en las
 * veinticuatro tonalidades. Cada prueba es un fallo que estaba en pantalla.
 */
describe('Lo que se lee, revisado', () => {
  const DB = pitchClassFromName('Db');
  const EB = pitchClassFromName('Eb');

  it('el disminuido se pregunta por su disonancia, no por pedir resolver como el V', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const ejercicio = exerciseOf('qualities', 1, tonic, mode);
      expect(ejercicio.prompt).toBe(
        '¿Cuál de estas tríadas es disonante por sí misma, aunque suene sola?',
      );
      const disonantes = ejercicio.choices.filter((choice) => choice.text.endsWith('dim'));
      expect(disonantes, keyName(tonic, mode)).toHaveLength(1);
      expect(disonantes[0]!.correct, keyName(tonic, mode)).toBe(true);
    }
  });

  it('la homónima se escribe con la letra de su tónica, y se dice cómo la escribe la rueda', () => {
    const relativa = exerciseOf('circle', 0, DB);
    expect(relativa.choices.map((choice) => choice.text)).toContain('Db menor');
    expect(relativa.choices.map((choice) => choice.text)).not.toContain('C# menor');
    expect(relativa.why).toContain(
      'Db menor tiene la misma tónica, pero es otra tonalidad. En la práctica se escribe C# menor',
    );
    // Eb menor lleva seis bemoles, y D# menor seis sostenidos: no hay nada que aclarar.
    expect(exerciseOf('circle', 0, EB).why).toContain('Eb menor tiene la misma tónica');
    expect(exerciseOf('circle', 0, EB).why).not.toContain('En la práctica');
    expect(exerciseOf('circle', 0, A, 'minor').why).toMatch(
      /A mayor tiene la misma tónica, pero es otra tonalidad\.$/,
    );
  });

  it('la armadura se dice como se lee: «lleva un bemol», no «son 1 bemol»', () => {
    const F = pitchClassFromName('F');
    expect(exerciseOf('circle', 2, F).why).toBe('Su armadura lleva un bemol: Bb.');
    expect(lessonNotes('circle', pitchClassFromName('D'), 'minor').points[1]).toContain(
      'D menor lleva un bemol: Bb.',
    );
    expect(exerciseOf('circle', 2, DB).why).toBe(
      'Su armadura lleva 5 bemoles: Bb, Eb, Ab, Db, Gb.',
    );
  });

  /*
    La nota de blues se escribe como quinta disminuida salvo cuando eso pide un
    doble bemol: entonces, como cuarta aumentada (la razón está en
    `scalesLesson`). Lo que se fija aquí es la decisión, y que la pregunta del
    intervalo diga la nota que pregunta.
  */
  it('la nota de blues: quinta disminuida, o cuarta aumentada donde la quinta pediría doble bemol', () => {
    expect(lessonNotes('scales', C, 'major').points[2]).toContain('Sobre C: C, Eb, F, Gb, G, Bb');
    expect(lessonNotes('scales', DB, 'major').points[2]).toContain(
      'Sobre Db: Db, Fb, Gb, G, Ab, Cb',
    );
    expect(lessonNotes('scales', EB, 'major').points[2]).toContain(
      'Sobre Eb: Eb, Gb, Ab, A, Bb, Db',
    );
    expect(lessonNotes('scales', pitchClassFromName('Ab'), 'major').points[2]).toContain(
      'Sobre Ab: Ab, Cb, Db, D, Eb, Gb',
    );
    expect(lessonNotes('scales', DB, 'major').points[2]).toContain(
      'como quinta disminuida sería Abb',
    );
    expect(answerOf('scales', 4, DB)).toBe('G');
    expect(answerOf('scales', 2, DB)).toBe('Una cuarta aumentada');
    expect(answerOf('scales', 2)).toBe('Una quinta disminuida');
    expect(exerciseOf('scales', 2, DB).prompt).toBe(
      'Sobre Db, la escala de blues añade G a la pentatónica menor. ¿Qué intervalo forma con la tónica?',
    );

    for (const [tonic, mode] of TONALIDADES) {
      const donde = keyName(tonic, mode);
      const nota = answerOf('scales', 4, tonic, mode);
      // A tres tonos de la tónica, y escrita sin doble alteración.
      const tonica = /^La .* de (\S+) son/.exec(lessonNotes('scales', tonic, mode).points[0]!)![1]!;
      expect(normalizePitchClass(altura(nota) - altura(tonica)), donde).toBe(6);
      expect(nota, donde).not.toMatch(/bb|##/);
      // Y ninguna opción de «qué nota añade» lleva doble bemol.
      for (const choice of exerciseOf('scales', 4, tonic, mode).choices) {
        expect(choice.text, donde).not.toMatch(/bb/);
      }
      // El intervalo que se da por bueno es el de las letras escritas.
      const letras = (nota.charCodeAt(0) - tonica.charCodeAt(0) + 7) % 7;
      expect(answerOf('scales', 2, tonic, mode), donde).toBe(
        letras === 4 ? 'Una quinta disminuida' : 'Una cuarta aumentada',
      );
    }
  });
});
