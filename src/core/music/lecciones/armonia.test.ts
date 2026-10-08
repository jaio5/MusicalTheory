import { describe, expect, it } from 'vitest';

import { keyName, type KeyMode } from '../keys';
import type { LessonNotes } from '../lessons';
import { pitchClassFromName, type PitchClass } from '../notes';
import { LECCIONES_DE_ARMONIA } from './armonia';

const IDS = Object.keys(LECCIONES_DE_ARMONIA) as Array<keyof typeof LECCIONES_DE_ARMONIA>;
const MODOS = ['major', 'minor'] as const;
const C = pitchClassFromName('C');
const A = pitchClassFromName('A');

function todas(): Array<[PitchClass, KeyMode]> {
  return Array.from({ length: 12 }, (_, tonic) =>
    MODOS.map((mode) => [tonic as PitchClass, mode] as [PitchClass, KeyMode]),
  ).flat();
}

/** La lección tal como se escribe, con la buena delante: sin barajar. */
function leccion(id: keyof typeof LECCIONES_DE_ARMONIA, tonic: PitchClass, mode: KeyMode) {
  return LECCIONES_DE_ARMONIA[id](tonic, mode);
}

function buena(notes: LessonNotes, indice: number): string {
  return notes.exercises[indice]!.choices.find((choice) => choice.correct)!.text;
}

const LETRAS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

/** Qué suena y con qué letra se escribe un nombre como `F##` o `Ebb`. */
function leer(nombre: string): { letra: number; altura: number } {
  const letra = LETRAS.indexOf(nombre[0]!);
  const sube = (nombre.match(/#/g) ?? []).length;
  const baja = (nombre.slice(1).match(/b/g) ?? []).length;
  return { letra, altura: (((NATURAL[letra]! + sube - baja) % 12) + 12) % 12 };
}

/** La tónica de la tonalidad, leída del nombre que le pone la aplicación. */
function tonica(tonic: PitchClass, mode: KeyMode) {
  return leer(keyName(tonic, mode).split(' ')[0]!);
}

describe('Las lecciones de Armonía, en las veinticuatro tonalidades', () => {
  it('cada una explica de tres a cinco cosas y pregunta de cinco a seis', () => {
    for (const id of IDS) {
      for (const [tonic, mode] of todas()) {
        const notes = leccion(id, tonic, mode);
        const donde = `${keyName(tonic, mode)} ${id}`;

        expect(notes.points.length, donde).toBeGreaterThanOrEqual(3);
        expect(notes.points.length, donde).toBeLessThanOrEqual(5);
        expect(notes.exercises.length, donde).toBeGreaterThanOrEqual(5);
        expect(notes.exercises.length, donde).toBeLessThanOrEqual(6);
      }
    }
  });

  it('cuatro opciones, una sola buena, ninguna repetida y siempre un porqué', () => {
    for (const id of IDS) {
      for (const [tonic, mode] of todas()) {
        for (const exercise of leccion(id, tonic, mode).exercises) {
          const donde = `${keyName(tonic, mode)} ${id}: ${exercise.prompt}`;

          expect(exercise.choices, donde).toHaveLength(4);
          expect(
            exercise.choices.filter((choice) => choice.correct),
            donde,
          ).toHaveLength(1);
          expect(new Set(exercise.choices.map((choice) => choice.text)).size, donde).toBe(4);
          expect(exercise.why.trim(), donde).not.toBe('');
        }
      }
    }
  });

  it('nada se queda sin rellenar', () => {
    for (const id of IDS) {
      for (const [tonic, mode] of todas()) {
        const notes = leccion(id, tonic, mode);
        const texto = [
          ...notes.points,
          ...notes.exercises.flatMap((e) => [e.prompt, e.why, ...e.choices.map((c) => c.text)]),
        ].join(' ');

        expect(texto, `${keyName(tonic, mode)} ${id}`).not.toMatch(/undefined|NaN|\$\{/);
      }
    }
  });
});

describe('Inversiones', () => {
  it('el bajo de la primera inversión es la tercera', () => {
    expect(buena(leccion('inversiones', C, 'major'), 0)).toBe('E');
    expect(buena(leccion('inversiones', A, 'minor'), 0)).toBe('C');
  });

  it('la segunda inversión se cifra 6/4 y se escribe con barra', () => {
    expect(buena(leccion('inversiones', C, 'major'), 1)).toBe('6/4');
    expect(buena(leccion('inversiones', C, 'major'), 3)).toBe('C/G');
    expect(buena(leccion('inversiones', A, 'minor'), 3)).toBe('Am/E');
  });

  it('en menor el V lleva en el bajo la sensible del armónico, bien escrita', () => {
    expect(leccion('inversiones', A, 'minor').exercises[2]!.prompt).toContain('E/G#');
    // Sol# menor: la sensible es Fa doble sostenido, no Sol.
    expect(
      leccion('inversiones', pitchClassFromName('G#'), 'minor').exercises[2]!.prompt,
    ).toContain('D#/F##');
  });

  it('la 6/4 que vale es la cadencial', () => {
    expect(buena(leccion('inversiones', C, 'major'), 4)).toBe(
      'Antes de G, en la cadencia: C/G → G → C',
    );
    expect(buena(leccion('inversiones', A, 'minor'), 4)).toBe(
      'Antes de E, en la cadencia: Am/E → E → Am',
    );
  });
});

describe('Enlace de acordes', () => {
  it('la nota común de I a IV es la tónica, y la tercera va por el camino más corto', () => {
    expect(buena(leccion('enlaces', C, 'major'), 0)).toBe('C');
    expect(buena(leccion('enlaces', C, 'major'), 1)).toBe('Sube a F');
    expect(buena(leccion('enlaces', A, 'minor'), 1)).toBe('Sube a D');
  });

  it('las quintas paralelas que se enseñan son quintas de verdad, en todas las tonalidades', () => {
    for (const [tonic, mode] of todas()) {
      const prompt = leccion('enlaces', tonic, mode).exercises[3]!.prompt;
      const [, bajo1, bajo2, alto1, alto2] =
        /de (\S+) a (\S+) y la soprano de (\S+) a (\S+)\./.exec(prompt)!;
      const quinta = (abajo: string, arriba: string) =>
        (leer(arriba).altura - leer(abajo).altura + 12) % 12;

      expect(quinta(bajo1!, alto1!), prompt).toBe(7);
      expect(quinta(bajo2!, alto2!), prompt).toBe(7);
    }
  });

  it('la sensible sube a la tónica, y en menor es la del armónico', () => {
    expect(buena(leccion('enlaces', C, 'major'), 5)).toBe('Sube a C');
    expect(leccion('enlaces', A, 'minor').exercises[5]!.prompt).toContain('G#');
    expect(buena(leccion('enlaces', A, 'minor'), 5)).toBe('Sube a A');
  });
});

describe('La séptima de dominante', () => {
  it('se forma sobre el V, y en menor con la sensible subida', () => {
    expect(buena(leccion('septimaDominante', C, 'major'), 0)).toBe('G7');
    expect(buena(leccion('septimaDominante', A, 'minor'), 0)).toBe('E7');
    expect(buena(leccion('septimaDominante', pitchClassFromName('G#'), 'minor'), 0)).toBe('D#7');
  });

  it('el tritono está entre la sensible y la séptima, a seis semitonos en todas', () => {
    expect(buena(leccion('septimaDominante', C, 'major'), 1)).toBe('B y F');
    expect(buena(leccion('septimaDominante', A, 'minor'), 1)).toBe('G# y D');
    for (const [tonic, mode] of todas()) {
      const [sensible, septima] = buena(leccion('septimaDominante', tonic, mode), 1).split(' y ');
      const t = tonica(tonic, mode);

      expect((leer(septima!).altura - leer(sensible!).altura + 12) % 12).toBe(6);
      // La sensible, medio tono por debajo de la tónica y con la letra de antes.
      expect((t.altura - leer(sensible!).altura + 12) % 12).toBe(1);
      expect((t.letra - leer(sensible!).letra + 7) % 7).toBe(1);
    }
  });

  it('la sensible sube y la séptima baja', () => {
    expect(buena(leccion('septimaDominante', C, 'major'), 2)).toBe('B sube a C y F baja a E');
    expect(buena(leccion('septimaDominante', A, 'minor'), 2)).toBe('G# sube a A y D baja a C');
  });

  it('las inversiones se cifran 6/5, +6 y +4, y la de +4 resuelve en primera inversión', () => {
    expect(buena(leccion('septimaDominante', C, 'major'), 3)).toBe('6/5, con la quinta disminuida');
    expect(buena(leccion('septimaDominante', C, 'major'), 4)).toBe('D');
    expect(buena(leccion('septimaDominante', A, 'minor'), 4)).toBe('B');
    expect(buena(leccion('septimaDominante', C, 'major'), 5)).toBe('C/E: C en primera inversión');
    expect(buena(leccion('septimaDominante', A, 'minor'), 5)).toBe('Am/C: Am en primera inversión');
  });
});

describe('Dominantes secundarias', () => {
  it('el V/V de Do es D7 y el de La menor, B7', () => {
    expect(buena(leccion('secundarias', C, 'major'), 0)).toBe('D7');
    expect(buena(leccion('secundarias', A, 'minor'), 0)).toBe('B7');
  });

  it('las cinco de Do mayor, con su destino', () => {
    expect(leccion('secundarias', C, 'major').points[1]).toBe(
      'En C mayor: V/II = A7 → Dm, V/III = B7 → Em, V/IV = C7 → F, V/V = D7 → G, V/VI = E7 → Am.',
    );
  });

  it('en menor, las cinco que no son disminuidas, con el VII de la natural', () => {
    expect(leccion('secundarias', A, 'minor').points[1]).toBe(
      'En A menor: V/III = G7 → C, V/IV = A7 → Dm, V/V = B7 → E, V/VI = C7 → F, V/VII = D7 → G.',
    );
  });

  it('en menor no se tonicaliza el II, que es disminuido', () => {
    const notes = leccion('secundarias', A, 'minor');

    expect(notes.points[1]).not.toContain('V/II ');
    expect(notes.exercises[4]!.prompt).toBe('¿Por qué no se usa un V/II en A menor?');
    expect(leccion('secundarias', C, 'major').exercises[4]!.prompt).toBe(
      '¿Por qué no se usa un V/VII en C mayor?',
    );
  });

  it('la nota alterada es la sensible del V, medio tono por debajo, en las veinticuatro', () => {
    expect(buena(leccion('secundarias', C, 'major'), 1)).toBe('F#');
    expect(buena(leccion('secundarias', A, 'minor'), 1)).toBe('D#');
    // Fa# mayor: G#7, cuya tercera es Si#, no Do.
    expect(buena(leccion('secundarias', pitchClassFromName('F#'), 'major'), 1)).toBe('B#');
    for (const [tonic, mode] of todas()) {
      const sensible = leer(buena(leccion('secundarias', tonic, mode), 1));
      const t = tonica(tonic, mode);

      expect((t.altura + 7 - sensible.altura + 12) % 12).toBe(1);
      expect((t.letra + 4 - sensible.letra + 7) % 7).toBe(1);
    }
  });

  it('en menor el V/VI altera la séptima y el V/V dos notas, no «la sensible» a secas', () => {
    expect(leccion('secundarias', A, 'minor').points[3]).toBe(
      'Lo que trae de fuera de la escala es, sobre todo, la sensible del grado al que va. B7 trae D# y F#: D# está medio tono por debajo de E y sube a ella, y F# hace justa la quinta que la escala da disminuida sobre B. Dos no alteran la sensible: V/III, G7, es el VII de la menor natural con su séptima y no altera nada; y V/VI, C7, ya encuentra E en la escala, así que lo alterado es su séptima, Bb, que baja.',
    );
    expect(leccion('secundarias', C, 'major').points[3]).toBe(
      'Lo que trae de fuera de la escala es, sobre todo, la sensible del grado al que va: en D7, F# está medio tono por debajo de G y sube a ella. V/III, B7, trae dos, D# y F#: la sensible de E y la quinta justa que la escala da disminuida. Y V/IV es C con séptima: no altera la sensible, que ya está en la escala, sino la séptima, Bb, que baja.',
    );
    expect(leccion('secundarias', A, 'minor').exercises[1]!.why).toContain(
      'No es la única alterada: F# hace justa la quinta',
    );
    expect(leccion('secundarias', A, 'minor').exercises[0]!.why).toContain('trae D# y F#');
    expect(leccion('secundarias', C, 'major').exercises[0]!.why).toContain('lleva F#, que es');
  });

  it('lo que dice alterado es lo que sale de la escala, contado por alturas en las veinticuatro', () => {
    const ESCALA = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
    for (const [tonic, mode] of todas()) {
      const notes = leccion('secundarias', tonic, mode);
      const t = tonica(tonic, mode);
      const escala = ESCALA[mode].map((i) => (t.altura + i) % 12);
      const fuera = (raiz: number) =>
        [0, 4, 7, 10].filter((i) => !escala.includes((raiz + i) % 12)).length;
      const donde = keyName(tonic, mode);
      // El V/V, sobre el II; el V/III, sobre el VII de la escala; el V/IV, sobre la tónica.
      const delQuinto = fuera(t.altura + 2);

      expect(delQuinto, donde).toBe(mode === 'major' ? 1 : 2);
      expect(notes.exercises[1]!.why.endsWith('Por eso es la nota alterada.'), donde).toBe(
        delQuinto === 1,
      );
      expect(fuera(t.altura + ESCALA[mode][6]!), donde).toBe(mode === 'major' ? 2 : 0);
      if (mode === 'minor') {
        // El V/VI, sobre la tercera: solo sale su séptima.
        const raiz = t.altura + 3;
        expect(fuera(raiz), donde).toBe(1);
        expect(escala.includes((raiz + 10) % 12), donde).toBe(false);
      } else {
        expect(fuera(t.altura), donde).toBe(1);
        expect(escala.includes((t.altura + 10) % 12), donde).toBe(false);
      }
    }
  });

  it('E7 va a Am en Do, y A7 a Dm en La menor', () => {
    expect(buena(leccion('secundarias', C, 'major'), 2)).toBe('Am');
    expect(buena(leccion('secundarias', C, 'major'), 3)).toBe('V/VI');
    expect(buena(leccion('secundarias', A, 'minor'), 2)).toBe('Dm');
    expect(buena(leccion('secundarias', A, 'minor'), 3)).toBe('V/IV');
  });
});

describe('Modulación', () => {
  it('los cinco vecinos de Do mayor y de La menor', () => {
    expect(leccion('modulacion', C, 'major').points[0]).toContain(
      'A menor, G mayor, E menor, F mayor y D menor',
    );
    expect(leccion('modulacion', A, 'minor').points[0]).toContain(
      'C mayor, E menor, G mayor, D menor y F mayor',
    );
  });

  it('el vecino se escribe con la letra del grado, no con la de la rueda', () => {
    // De Fa# mayor se modula a Do# mayor; la rueda lo llamaría Reb.
    expect(buena(leccion('modulacion', pitchClassFromName('F#'), 'major'), 0)).toBe('C# mayor');
    // La homónima con la letra de la tónica: «C# menor tiene la misma tónica» que
    // Db mayor era decir dos cosas a la vez.
    const deReb = leccion('modulacion', pitchClassFromName('Db'), 'major').exercises[0]!;
    expect(deReb.choices.map((choice) => choice.text)).toContain('Db menor');
    expect(deReb.why).toContain('Db menor tiene la misma tónica');
  });

  it('el pivote es de las dos tonalidades', () => {
    expect(buena(leccion('modulacion', C, 'major'), 2)).toBe('Am');
    expect(buena(leccion('modulacion', A, 'minor'), 2)).toBe('C');
  });

  it('lo que confirma la modulación es la cadencia en el tono nuevo', () => {
    expect(buena(leccion('modulacion', C, 'major'), 5)).toBe('Una cadencia en G mayor: D → G');
    expect(buena(leccion('modulacion', A, 'minor'), 5)).toBe('Una cadencia en E menor: B → Em');
  });
});

describe('Napolitana y sextas aumentadas', () => {
  it('la napolitana es el II rebajado con la cuarta en el bajo', () => {
    expect(buena(leccion('cromaticos', C, 'major'), 0)).toBe('Db/F');
    expect(buena(leccion('cromaticos', A, 'minor'), 0)).toBe('Bb/D');
    // Reb mayor: Mibb, que se escribe así aunque nadie lo pronuncie a gusto.
    expect(buena(leccion('cromaticos', pitchClassFromName('Db'), 'major'), 0)).toBe('Ebb/Gb');
  });

  it('en las veinticuatro, la napolitana está medio tono encima de la tónica y con la letra del II', () => {
    for (const [tonic, mode] of todas()) {
      const [raiz, bajo] = buena(leccion('cromaticos', tonic, mode), 0).split('/');
      const t = tonica(tonic, mode);

      expect((leer(raiz!).altura - t.altura + 12) % 12).toBe(1);
      expect((leer(raiz!).letra - t.letra + 7) % 7).toBe(1);
      expect((leer(bajo!).altura - t.altura + 12) % 12).toBe(5);
    }
  });

  it('va a la dominante', () => {
    expect(buena(leccion('cromaticos', C, 'major'), 1)).toBe('A G, la dominante');
    expect(buena(leccion('cromaticos', A, 'minor'), 1)).toBe('A E, la dominante');
  });

  it('la sexta aumentada va del VI rebajado a la cuarta subida, y lo es en todas', () => {
    expect(buena(leccion('cromaticos', C, 'major'), 2)).toBe('Ab y F#');
    expect(buena(leccion('cromaticos', A, 'minor'), 2)).toBe('F y D#');
    expect(buena(leccion('cromaticos', pitchClassFromName('D#'), 'minor'), 2)).toBe('B y G##');
    for (const [tonic, mode] of todas()) {
      const [abajo, arriba] = buena(leccion('cromaticos', tonic, mode), 2).split(' y ');
      const grave = leer(abajo!);
      const agudo = leer(arriba!);

      // Diez semitonos y cinco letras: una sexta aumentada, no una séptima menor.
      expect((agudo.altura - grave.altura + 12) % 12).toBe(10);
      expect((agudo.letra - grave.letra + 7) % 7).toBe(5);
    }
  });

  it('las tres sextas aumentadas de Do mayor y de La menor', () => {
    expect(leccion('cromaticos', C, 'major').points[3]).toBe(
      'Son tres: la italiana (Ab–C–F#), la francesa, que añade D (Ab–C–D–F#), y la alemana, que añade Eb (Ab–C–Eb–F#).',
    );
    expect(leccion('cromaticos', A, 'minor').points[3]).toBe(
      'Son tres: la italiana (F–A–D#), la francesa, que añade B (F–A–B–D#), y la alemana, que añade C (F–A–C–D#).',
    );
    expect(buena(leccion('cromaticos', C, 'major'), 4)).toBe('D');
  });
});
