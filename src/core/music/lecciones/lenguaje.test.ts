import { describe, expect, it } from 'vitest';

import { COURSES, type TheoryUnit } from '../curriculum';
import { keyName, type KeyMode } from '../keys';
import type { Exercise } from '../lessons';
import { pitchClassFromName, type PitchClass } from '../notes';
import { presentacionDe } from '../presentaciones';
import { LECCIONES_DE_LENGUAJE } from './lenguaje';

type Id = keyof typeof LECCIONES_DE_LENGUAJE;

const IDS = Object.keys(LECCIONES_DE_LENGUAJE) as Id[];
const pc = (name: Parameters<typeof pitchClassFromName>[0]) => pitchClassFromName(name);

function* tonalidades(): Generator<[PitchClass, KeyMode]> {
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      yield [tonic as PitchClass, mode];
    }
  }
}

/** Sin barajar: aquí se leen las lecciones tal como se escriben, con la buena primero. */
function leccion(id: Id, tonic: PitchClass, mode: KeyMode = 'major') {
  return LECCIONES_DE_LENGUAJE[id](tonic, mode);
}

function buena(exercise: Exercise): string {
  return exercise.choices.find((choice) => choice.correct)!.text;
}

function malas(exercise: Exercise): string[] {
  return exercise.choices.filter((choice) => !choice.correct).map((choice) => choice.text);
}

describe('Las lecciones de Lenguaje Musical', () => {
  it('en las veinticuatro tonalidades: teoría breve, seis preguntas de cuatro opciones y una sola buena', () => {
    for (const id of IDS) {
      for (const [tonic, mode] of tonalidades()) {
        const notes = leccion(id, tonic, mode);
        const donde = `${keyName(tonic, mode)} ${id}`;

        expect(notes.points.length, donde).toBeGreaterThanOrEqual(3);
        expect(notes.points.length, donde).toBeLessThanOrEqual(5);
        expect(notes.exercises.length, donde).toBeGreaterThanOrEqual(5);
        expect(notes.exercises.length, donde).toBeLessThanOrEqual(6);

        for (const exercise of notes.exercises) {
          const aqui = `${donde}: ${exercise.prompt}`;
          expect(exercise.choices, aqui).toHaveLength(4);
          expect(
            exercise.choices.filter((choice) => choice.correct),
            aqui,
          ).toHaveLength(1);
          expect(new Set(exercise.choices.map((choice) => choice.text)).size, aqui).toBe(4);
          expect(exercise.why.trim(), aqui).not.toBe('');
        }
      }
    }
  });

  it('ningún texto se queda a medias', () => {
    for (const id of IDS) {
      for (const [tonic, mode] of tonalidades()) {
        const notes = leccion(id, tonic, mode);
        const textos = [
          ...notes.points,
          ...notes.exercises.flatMap((exercise) => [
            exercise.prompt,
            exercise.why,
            ...exercise.choices.map((choice) => choice.text),
          ]),
        ];
        for (const texto of textos) {
          expect(texto, `${keyName(tonic, mode)} ${id}`).not.toMatch(/undefined|NaN|\[object/);
        }
      }
    }
  });

  /**
   * Una opción mala con doble alteración no la escribe nadie que esté
   * aprendiendo: se nota a la legua que es mala. Solo se admite cuando es la
   * escala o la nota de verdad —la sensible de G# menor es F##— y en sus
   * hermanas de la misma pregunta, que la comparten.
   */
  it('las dobles alteraciones solo salen donde la escala las pide', () => {
    const dobles = /(?<![A-G])[A-G](##|bb)(?![#b])/;
    for (const [tonic, mode] of tonalidades()) {
      for (const id of ['notas', 'claves', 'intervalos'] as const) {
        for (const exercise of leccion(id, tonic, mode).exercises) {
          for (const choice of exercise.choices) {
            expect(choice.text, `${keyName(tonic, mode)} ${id}: ${exercise.prompt}`).not.toMatch(
              dobles,
            );
          }
        }
      }
    }
  });

  it('cada unidad del temario que las usa promete como mucho lo que pregunta', () => {
    const unidades = COURSES.flatMap((course) => course.units).filter(
      (unit): unit is TheoryUnit =>
        unit.kind === 'theory' && (IDS as readonly string[]).includes(unit.lesson),
    );
    expect(unidades.map((unit) => unit.lesson).sort()).toEqual([...IDS].sort());
    for (const unit of unidades) {
      const notes = leccion(unit.lesson as Id, pc('C'));
      expect(presentacionDe(unit.id).contenidos.length).toBeLessThanOrEqual(notes.exercises.length);
    }
  });
});

describe('Las notas', () => {
  it('la serie sigue después de Si por Do', () => {
    expect(buena(leccion('notas', pc('B')).exercises[0]!)).toBe('Do (C)');
    expect(buena(leccion('notas', pc('C')).exercises[0]!)).toBe('Re (D)');
  });

  it('el ejemplo de alteración es la última de la armadura', () => {
    // D mayor: F# y C#; la enarmónica de C# es Db.
    const re = leccion('notas', pc('D')).exercises[5]!;
    expect(re.prompt).toContain('C#');
    expect(buena(re)).toBe('Db');
    // F# mayor: la última es E#, y su enarmónica es F natural.
    expect(buena(leccion('notas', pc('F#')).exercises[5]!)).toBe('F');
    // Bb mayor: Bb y Eb; la de Eb es D#.
    expect(buena(leccion('notas', pc('Bb')).exercises[5]!)).toBe('D#');
  });

  it('Do mayor y La menor, que no llevan armadura, no ponen el mismo ejemplo', () => {
    expect(buena(leccion('notas', pc('C')).exercises[5]!)).toBe('Gb');
    expect(buena(leccion('notas', pc('A'), 'minor').exercises[5]!)).toBe('Ab');
  });

  it('el becuadro deja la nota natural, y el bemol baja', () => {
    expect(buena(leccion('notas', pc('F')).exercises[2]!)).toBe('B, natural');
    expect(buena(leccion('notas', pc('F')).exercises[1]!)).toBe('La baja un semitono');
  });

  it('el semitono de la escala es diatónico: III-IV en mayor y II-III en menor', () => {
    expect(leccion('notas', pc('C')).exercises[4]!.prompt).toContain('de E a F');
    expect(leccion('notas', pc('A'), 'minor').exercises[4]!.prompt).toContain('de B a C');
    expect(leccion('notas', pc('D#'), 'minor').exercises[4]!.prompt).toContain('de E# a F#');
  });
});

describe('El pentagrama y las claves', () => {
  it('en clave de sol, C va en el tercer espacio y G en la segunda línea', () => {
    expect(buena(leccion('claves', pc('C')).exercises[0]!)).toBe('En el tercer espacio');
    expect(buena(leccion('claves', pc('G')).exercises[0]!)).toBe('En la segunda línea');
    // La alteración no mueve la nota de sitio.
    expect(buena(leccion('claves', pc('F#')).exercises[0]!)).toBe('En el primer espacio');
  });

  it('en clave de fa, la primera línea es Sol y no Mi', () => {
    const fa = leccion('claves', pc('C')).exercises[1]!;
    expect(fa.prompt).toContain('la primera línea');
    expect(buena(fa)).toBe('Sol (G)');
    expect(malas(fa)).toContain('Mi (E)');
  });

  it('el Do central se pregunta en una clave en mayor y en la otra en menor', () => {
    expect(buena(leccion('claves', pc('C')).exercises[3]!)).toBe(
      'En la primera línea adicional por debajo',
    );
    expect(buena(leccion('claves', pc('A'), 'minor').exercises[3]!)).toBe(
      'En la primera línea adicional por encima',
    );
  });

  it('la guitarra suena una octava más grave de lo escrito', () => {
    expect(buena(leccion('claves', pc('C')).exercises[4]!)).toBe('Una octava más grave');
  });
});

describe('Figuras y compás', () => {
  const valor: Record<string, number> = {
    redonda: 16,
    blanca: 8,
    negra: 4,
    corchea: 2,
    semicorchea: 1,
  };

  it('las equivalencias son las de verdad en todas las tonalidades', () => {
    for (const [tonic, mode] of tonalidades()) {
      const ejercicio = leccion('ritmo', tonic, mode).exercises[0]!;
      const [, pequena, grande] = /¿Cuántas (\w+)s caben en una (\w+)\?/.exec(ejercicio.prompt)!;
      expect(Number(buena(ejercicio))).toBe(valor[grande!]! / valor[pequena!]!);
    }
  });

  it('el puntillo suma la mitad: una blanca con puntillo son tres negras', () => {
    const blanca = leccion('ritmo', pc('C#')).exercises[1]!;
    expect(blanca.prompt).toContain('blanca con puntillo');
    expect(buena(blanca)).toBe('Tres negras');
  });

  it('el 6/8 son dos partes de negra con puntillo', () => {
    expect(buena(leccion('ritmo', pc('C')).exercises[4]!)).toBe('Dos partes de negra con puntillo');
  });

  it('el silencio de redonda cuelga de la cuarta línea; el de blanca se apoya en la tercera', () => {
    expect(buena(leccion('ritmo', pc('C')).exercises[2]!)).toBe('De redonda');
    expect(buena(leccion('ritmo', pc('A'), 'minor').exercises[2]!)).toBe('De blanca');
  });
});

describe('La escala mayor', () => {
  it('F mayor lleva Bb, D mayor F# y F# mayor E#', () => {
    expect(buena(leccion('escalaMayor', pc('F')).exercises[1]!)).toBe('F · G · A · Bb · C · D · E');
    expect(buena(leccion('escalaMayor', pc('D')).exercises[1]!)).toBe(
      'D · E · F# · G · A · B · C#',
    );
    expect(buena(leccion('escalaMayor', pc('F#')).exercises[1]!)).toBe(
      'F# · G# · A# · B · C# · D# · E#',
    );
  });

  it('entre las malas está la misma escala mal escrita, que repite letra', () => {
    expect(malas(leccion('escalaMayor', pc('G')).exercises[1]!)).toContain(
      'G · A · B · C · D · E · Gb',
    );
  });

  it('en menor se estudia la mayor de la misma tónica, y se dice cuando cambia de nombre', () => {
    expect(buena(leccion('escalaMayor', pc('A'), 'minor').exercises[1]!)).toBe(
      'A · B · C# · D · E · F# · G#',
    );
    const reSostenido = leccion('escalaMayor', pc('D#'), 'minor').points[1]!;
    expect(reSostenido).toContain('Eb');
    expect(reSostenido).toContain('D# mayor llevaría 9 sostenidos');
  });

  it('cada grado con su nombre: el VI es la superdominante y el VII la sensible', () => {
    const nombres = leccion('escalaMayor', pc('C')).points[2]!;
    expect(nombres).toContain('VI superdominante (A)');
    expect(nombres).toContain('VII sensible (B)');
  });

  it('tonales I, IV y V; modales III y VI', () => {
    expect(buena(leccion('escalaMayor', pc('C')).exercises[4]!)).toBe('I, IV y V: C, F y G');
    expect(buena(leccion('escalaMayor', pc('C'), 'minor').exercises[4]!)).toBe('III y VI: E y A');
  });

  it('en las de sostenidos se explica el VII, y en las de bemoles el IV', () => {
    expect(leccion('escalaMayor', pc('G')).exercises[5]!.prompt).toContain('el VII es F# y no F');
    expect(leccion('escalaMayor', pc('F')).exercises[5]!.prompt).toContain('el IV es Bb y no B');
  });
});

describe('Los intervalos', () => {
  it('la tercera de E mayor es G#, una tercera mayor, y al invertirla queda una sexta menor', () => {
    const inversion = leccion('intervalos', pc('E')).exercises[4]!;
    expect(inversion.prompt).toContain('De E a G# hay una tercera mayor');
    expect(buena(inversion)).toBe('Sexta menor');
  });

  it('en menor la tercera es menor, y su inversión una sexta mayor', () => {
    const inversion = leccion('intervalos', pc('A'), 'minor').exercises[4]!;
    expect(inversion.prompt).toContain('De A a C hay una tercera menor');
    expect(buena(inversion)).toBe('Sexta mayor');
  });

  it('el número cuenta letras: de C a G hay una quinta, y es justa', () => {
    // En C el primer ejercicio mide la tercera y el segundo la quinta.
    expect(buena(leccion('intervalos', pc('C')).exercises[0]!)).toBe('Tercera');
    const quinta = leccion('intervalos', pc('C')).exercises[1]!;
    expect(quinta.prompt).toContain('de C a G');
    expect(buena(quinta)).toBe('Quinta justa');
    expect(malas(quinta)).toContain('Sexta disminuida');
  });

  it('construir el intervalo da la nota con su letra', () => {
    // De F# una tercera mayor es A#, y Bb es la trampa.
    const construir = leccion('intervalos', pc('F#')).exercises[2]!;
    expect(construir.prompt).toContain('tercera mayor por encima de F#');
    expect(buena(construir)).toBe('A#');
    expect(malas(construir)).toContain('Bb');
  });

  it('una justa con un semitono menos es disminuida, nunca menor', () => {
    const cambio = leccion('intervalos', pc('C')).exercises[3]!;
    expect(buena(cambio)).toBe('Una quinta disminuida');
    expect(malas(cambio)).toContain('Una quinta menor');
  });

  it('las consonancias se preguntan con los intervalos de la tonalidad', () => {
    expect(buena(leccion('intervalos', pc('C')).exercises[5]!)).toBe('C–G (quinta justa)');
    expect(buena(leccion('intervalos', pc('Db')).exercises[5]!)).toBe('Db–F (tercera mayor)');
    expect(buena(leccion('intervalos', pc('D')).exercises[5]!)).toBe('D–C# (séptima mayor)');
    expect(buena(leccion('intervalos', pc('D'), 'minor').exercises[5]!)).toBe(
      'D–E (segunda mayor)',
    );
  });
});

describe('Las escalas menores', () => {
  it('la relativa mayor de A menor es C mayor, y en C mayor se estudia La menor', () => {
    expect(buena(leccion('escalasMenores', pc('A'), 'minor').exercises[0]!)).toBe('C mayor');
    expect(buena(leccion('escalasMenores', pc('C')).exercises[0]!)).toBe('C mayor');
    expect(malas(leccion('escalasMenores', pc('A'), 'minor').exercises[0]!)).toContain('A mayor');
  });

  it('la homónima comparte la tónica, también en la letra', () => {
    // Decía «Eb mayor comparte la tónica» de D# menor: suena igual, con otra letra.
    const relativa = leccion('escalasMenores', pc('D#'), 'minor').exercises[0]!;
    expect(malas(relativa)).toContain('D# mayor');
    expect(malas(relativa)).not.toContain('Eb mayor');
    expect(relativa.why).toContain('D# mayor comparte la tónica');
    expect(relativa.why).toContain('En la práctica se escribe Eb mayor');
  });

  it('la armónica sube el VII: G# en A menor, F## en G# menor', () => {
    expect(buena(leccion('escalasMenores', pc('A'), 'minor').exercises[1]!)).toBe(
      'Sube el VII: G pasa a G#',
    );
    expect(buena(leccion('escalasMenores', pc('G#'), 'minor').exercises[1]!)).toBe(
      'Sube el VII: F# pasa a F##',
    );
  });

  it('su segunda aumentada es de letras vecinas y tres semitonos', () => {
    const segunda = leccion('escalasMenores', pc('A'), 'minor').exercises[2]!;
    expect(segunda.prompt).toContain('de F a G#');
    expect(buena(segunda)).toBe('Una segunda aumentada, de tres semitonos');
  });

  it('la melódica sube el VI y el VII al subir y vuelve a la natural al bajar', () => {
    const menores = leccion('escalasMenores', pc('D#'), 'minor');
    expect(buena(menores.exercises[3]!)).toBe('D# · E# · F# · G# · A# · B# · C## · D#');
    expect(buena(menores.exercises[4]!)).toBe('D# · C# · B · A# · G# · F# · E# · D#');
  });

  it('las de bemoles también: Bb menor sube Gb a G y Ab a A', () => {
    expect(buena(leccion('escalasMenores', pc('Bb'), 'minor').exercises[3]!)).toBe(
      'Bb · C · Db · Eb · F · G · A · Bb',
    );
  });

  it('el modo lo decide la tercera', () => {
    expect(buena(leccion('escalasMenores', pc('E'), 'minor').exercises[5]!)).toBe(
      'La tercera sobre la tónica: de E a G hay tres semitonos',
    );
  });
});
