import { describe, expect, it } from 'vitest';

import { diatonicTriads, seventhNotes } from './chords';
import { keySignature, relativeMajor, relativeMinor } from './circle-of-fifths';
import {
  checkAnswerAgainstTheory,
  findTheory,
  GLOSSARY,
  keyChordTable,
  MAX_REFERENCE_LENGTH,
  normalizeForSearch,
  theoryReference,
  type TheoryKey,
} from './glossary';
import { roleOfDegreeSymbol, HARMONIC_ROLES } from './harmonic-function';
import { keyName, type KeyMode } from './keys';
import { normalizePitchClass, type PitchClass } from './notes';
import { resolveDegree, type DegreeSymbol } from './progressions';
import { scaleNotes } from './scales';

/** Las veinticuatro tonalidades: doce tónicas por dos modos. */
const TONALIDADES: readonly TheoryKey[] = Array.from({ length: 12 }, (_, tonic) =>
  (['major', 'minor'] as const).map((mode) => ({ tonic: tonic as PitchClass, mode })),
).flat();

const DO_MAYOR: TheoryKey = { tonic: 0, mode: 'major' };
const LA_MENOR: TheoryKey = { tonic: 9, mode: 'minor' };

function entrada(id: string) {
  const encontrada = GLOSSARY.find((candidata) => candidata.id === id);
  if (encontrada === undefined) {
    throw new Error(`No hay entrada ${id}`);
  }
  return encontrada;
}

function acorde(key: TheoryKey, degree: DegreeSymbol): string {
  return resolveDegree(key.tonic, key.mode, degree).symbol;
}

const LETRAS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** La altura de una nota escrita a mano en un test, con sus alteraciones. */
function altura(nota: string): number {
  const sostenidos = nota.split('#').length - 1;
  const bemoles = nota.slice(1).split('b').length - 1;
  return normalizePitchClass((LETRAS[nota[0] as string] as number) + sostenidos - bemoles);
}

/** Las notas escritas detrás de «= » en una referencia: «G7 = G B D F». */
function notasTrasIgual(texto: string, simbolo: string): string[] {
  const escapado = simbolo.replace(/[#]/g, '\\#');
  const encontrado = new RegExp(`${escapado} = ([A-G#b ]+)`).exec(texto);
  return (encontrado?.[1] ?? '').trim().split(' ');
}

describe('el glosario, resuelto en las veinticuatro tonalidades', () => {
  it('ninguna entrada revienta, y todas caben en su tope', () => {
    for (const key of TONALIDADES) {
      for (const item of GLOSSARY) {
        const texto = theoryReference(item, key);
        expect(texto.length, `${item.id} en ${keyName(key.tonic, key.mode)}`).toBeLessThanOrEqual(
          MAX_REFERENCE_LENGTH,
        );
        expect(texto).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('hay entre treinta y cincuenta entradas, y cada nombre es de una sola', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
    expect(GLOSSARY.length).toBeLessThanOrEqual(50);

    const vistos = new Map<string, string>();
    for (const item of GLOSSARY) {
      for (const nombre of [...item.names, ...(item.aliases ?? [])]) {
        // Un nombre sin normalizar no casaría nunca con una pregunta normalizada.
        expect(normalizeForSearch(nombre), nombre).toBe(nombre);
        expect(vistos.get(nombre), `${nombre} está en dos entradas`).toBeUndefined();
        vistos.set(nombre, item.id);
      }
    }
  });

  /**
   * La razón de ser del glosario: lo que depende de la tonalidad lo dice el
   * dominio. Si `resolveDegree` dice que el V de Fa es C, la perfecta en Fa dice
   * C → F, en las veinticuatro.
   */
  it('las cadencias dicen los acordes que da el dominio', () => {
    for (const key of TONALIDADES) {
      const casa = key.mode === 'major' ? 'I' : 'i';
      const sub = key.mode === 'major' ? 'IV' : 'iv';
      const sexto = key.mode === 'major' ? 'vi' : 'VI';
      const nombre = keyName(key.tonic, key.mode);

      expect(theoryReference(entrada('cadencia-perfecta'), key), nombre).toContain(
        `${acorde(key, 'V')} → ${acorde(key, casa)}`,
      );
      expect(theoryReference(entrada('cadencia-plagal'), key), nombre).toContain(
        `${acorde(key, sub)} → ${acorde(key, casa)}`,
      );
      expect(theoryReference(entrada('cadencia-rota'), key), nombre).toContain(
        `${acorde(key, 'V')} → ${acorde(key, sexto)}`,
      );
      expect(theoryReference(entrada('semicadencia'), key), nombre).toContain(
        `acaba en ${acorde(key, 'V')}`,
      );
    }
  });

  it('la perfecta en Do mayor es G → C, y en La menor E → Am', () => {
    expect(theoryReference(entrada('cadencia-perfecta'), DO_MAYOR)).toContain('V → I: G → C');
    expect(theoryReference(entrada('cadencia-perfecta'), LA_MENOR)).toContain('V → i: E → Am');
  });

  it('la relativa es la del círculo, de los dos lados', () => {
    for (const key of TONALIDADES) {
      const otra =
        key.mode === 'major'
          ? keyName(relativeMinor(key.tonic), 'minor')
          : keyName(relativeMajor(key.tonic), 'major');
      expect(theoryReference(entrada('relativa'), key)).toContain(`es ${otra}`);
    }
  });

  it('la armadura cuenta lo que dice keySignature', () => {
    for (const key of TONALIDADES) {
      const { letters } = keySignature(key.tonic, key.mode);
      const texto = theoryReference(entrada('armadura'), key);
      expect(texto).toContain(letters.length === 0 ? 'no lleva' : `lleva ${letters.length} `);
    }
    expect(theoryReference(entrada('armadura'), { tonic: 2, mode: 'major' })).toContain(
      '2 sostenidos: F# C#',
    );
    expect(theoryReference(entrada('armadura'), { tonic: 5, mode: 'major' })).toContain(
      '1 bemol: Bb',
    );
    expect(theoryReference(entrada('armadura'), { tonic: 3, mode: 'major' })).toContain(
      '3 bemoles: Bb Eb Ab',
    );
  });

  /**
   * Las notas se escriben por letras, no por teclas: el E7 de La menor lleva G#
   * y no Ab. Aquí se comprueba que suenan las del dominio y que cada nota del
   * acorde cae en su letra.
   */
  it('la séptima de dominante suena las notas del dominio, bien escritas', () => {
    for (const key of TONALIDADES) {
      const quinto = resolveDegree(key.tonic, key.mode, 'V');
      const simbolo = `${/^[A-G][#b]?/.exec(quinto.symbol)?.[0]}7`;
      const notas = notasTrasIgual(theoryReference(entrada('septima-dominante'), key), simbolo);

      expect(notas.map(altura)).toEqual(seventhNotes(quinto.root, 'dominant7'));
      // Fundamental, tercera, quinta y séptima: cuatro letras saltando de dos en dos.
      const letras = notas.map((nota) => 'CDEFGAB'.indexOf(nota[0] as string));
      expect(letras.map((letra) => (letra - (letras[0] as number) + 7) % 7)).toEqual([0, 2, 4, 6]);
    }
    expect(theoryReference(entrada('septima-dominante'), LA_MENOR)).toContain('E7 = E G# B D');
    expect(theoryReference(entrada('septima-dominante'), DO_MAYOR)).toContain('G7 = G B D F');
  });

  it('las escalas de siete suenan las del dominio, con una letra por grado', () => {
    for (const key of TONALIDADES) {
      const mayor = key.mode === 'major' ? key.tonic : relativeMajor(key.tonic);
      const menor = key.mode === 'minor' ? key.tonic : relativeMinor(key.tonic);
      const casos = [
        ['escala-mayor', scaleNotes(mayor, 'major')],
        ['menor-natural', scaleNotes(menor, 'naturalMinor')],
        ['menor-armonica', scaleNotes(menor, 'harmonicMinor')],
      ] as const;
      for (const [id, esperadas] of casos) {
        const texto = theoryReference(entrada(id), key);
        const notas = (/: ([A-G#b ]+)[.;]/.exec(texto)?.[1] ?? '').trim().split(' ');
        expect(notas.map(altura), `${id} en ${keyName(key.tonic, key.mode)}`).toEqual(esperadas);
        expect(new Set(notas.map((nota) => nota[0])).size).toBe(7);
      }
    }
    // La armónica de D# menor lleva la sensible doble: es lo que se escribe.
    expect(theoryReference(entrada('menor-armonica'), { tonic: 3, mode: 'minor' })).toContain(
      'C##',
    );
  });

  it('la melódica sube la sexta y la séptima de la natural', () => {
    expect(theoryReference(entrada('menor-melodica'), LA_MENOR)).toContain('A B C D E F# G#');
  });

  it('los modos empiezan en su grado de la mayor', () => {
    expect(theoryReference(entrada('modo-dorico'), DO_MAYOR)).toContain('empieza en D');
    expect(theoryReference(entrada('modo-lidio'), DO_MAYOR)).toContain('F G A B C D E');
    expect(theoryReference(entrada('modo-mixolidio'), { tonic: 7, mode: 'major' })).toContain(
      'D E F# G A B C',
    );
    // En menor, los de su relativa mayor.
    expect(theoryReference(entrada('modos'), LA_MENOR)).toContain('C jónico, D dórico');
    // Y el locrio de F# empieza en E#, que noteName no sabe escribir.
    expect(theoryReference(entrada('modo-locrio'), { tonic: 6, mode: 'major' })).toContain(
      'empieza en E#',
    );
  });

  it('las pentatónicas y el blues sacan sus notas de la escala de siete', () => {
    expect(theoryReference(entrada('pentatonica-menor'), { tonic: 4, mode: 'minor' })).toContain(
      'E G A B D',
    );
    expect(theoryReference(entrada('pentatonica-menor'), DO_MAYOR)).toContain('A C D E G');
    expect(theoryReference(entrada('pentatonica-mayor'), LA_MENOR)).toContain('C D E G A');
    expect(theoryReference(entrada('blues'), LA_MENOR)).toContain('A C D Eb E G');
  });

  it('la sustitución sale de substitutionOfDegree', () => {
    expect(theoryReference(entrada('sustitucion'), DO_MAYOR)).toContain(
      'Dm por F, Em o Am por C, Bdim por G',
    );
    expect(theoryReference(entrada('sustitucion'), LA_MENOR)).toContain(
      'Bdim o F por Dm, C por Am',
    );
  });

  it('cada entrada con tonalidad la nombra, y las que no dependen de ella no la llevan', () => {
    for (const item of GLOSSARY) {
      const texto = theoryReference(item, DO_MAYOR);
      expect(texto.startsWith(`${item.title}: `)).toBe(true);
      expect(texto.endsWith('.')).toBe(true);
    }
    expect(theoryReference(entrada('compas'), DO_MAYOR)).not.toContain('C mayor');
  });
});

describe('la tabla de la tonalidad', () => {
  it('lleva los siete acordes con su papel, y en menor también el V mayor', () => {
    for (const key of TONALIDADES) {
      const tabla = keyChordTable(key);
      const grados = diatonicTriads(0, key.mode === 'major' ? 'major' : 'naturalMinor').map(
        (triada) => triada.roman as DegreeSymbol,
      );
      for (const grado of key.mode === 'minor' ? [...grados, 'V' as const] : grados) {
        const papel = HARMONIC_ROLES[roleOfDegreeSymbol(grado)].name;
        const tramo = tabla.slice(tabla.indexOf(`${papel}:`));
        expect(tramo.slice(0, tramo.indexOf('.')), `${grado} en ${tabla}`).toContain(
          `${grado} ${acorde(key, grado)}`,
        );
      }
    }
  });

  it('en Do mayor y en La menor, como se escribe a mano', () => {
    expect(keyChordTable(DO_MAYOR)).toBe(
      'Acordes de C mayor. Tónica: I C, iii Em, vi Am. Subdominante: ii Dm, IV F. Dominante: V G, vii° Bdim.',
    );
    expect(keyChordTable(LA_MENOR)).toBe(
      'Acordes de A menor. Tónica: i Am, III C, VI F. Subdominante: ii° Bdim, iv Dm. Dominante: v Em, V E, VII G.',
    );
  });
});

describe('qué entrada contesta a cada pregunta', () => {
  it.each([
    ['¿Qué es una cadencia perfecta?', ['cadencia-perfecta']],
    ['¿Qué es una cadencia auténtica?', ['cadencia-perfecta']],
    ['¿Qué es una cadencia?', ['cadencia']],
    [
      '¿Qué diferencia hay entre la cadencia perfecta y la plagal?',
      ['cadencia-perfecta', 'cadencia-plagal'],
    ],
    ['¿Qué es una cadencia deceptiva?', ['cadencia-rota']],
    ['¿Por qué el V va al I?', ['cadencia-perfecta']],
    ['¿Cuál es la relativa menor de esta tonalidad?', ['relativa']],
    ['¿Cuántos semitonos tiene una tercera mayor?', ['intervalos']],
    ['¿Qué es un tritono?', ['tritono']],
    ['¿Qué es un acorde de séptima?', ['septima-dominante']],
    ['¿Y un Cmaj7, qué es la séptima mayor?', ['maj7']],
    ['¿Por qué suena tan bien un ii–V–I?', ['ii-v-i']],
    ['¿Qué es el V/V?', ['dominante-secundaria']],
    ['¿Qué tiene de especial el lidio?', ['modo-lidio']],
    ['¿Qué modo es el mixolidio y cuándo lo uso?', ['modos', 'modo-mixolidio']],
    ['¿Qué notas tiene la escala de blues?', ['blues']],
    ['¿Qué es un blues de doce compases?', ['blues-de-doce']],
    [
      '¿Qué diferencia hay entre la menor natural y la armónica?',
      ['menor-natural', 'menor-armonica'],
    ],
    ['¿Cuántos sostenidos tiene la armadura?', ['armadura']],
    ['¿Qué son las síncopas?', ['sincopa']],
  ])('%s', (pregunta, esperadas) => {
    expect(findTheory(pregunta).map((item) => item.id)).toEqual(esperadas);
  });

  it('la frase larga gana a la corta que lleva dentro', () => {
    // «cadencia» casa también, pero es parte de «cadencia perfecta»: no entra.
    expect(findTheory('¿Qué es una cadencia perfecta?')).toHaveLength(1);
  });

  it('nunca más de dos, y ninguna si la pregunta no es de nada del glosario', () => {
    expect(findTheory('¿cadencia plagal, tritono o modo lidio?')).toHaveLength(2);
    expect(findTheory('¿Cómo cambio las cuerdas de la guitarra?')).toEqual([]);
    expect(findTheory('')).toEqual([]);
  });
});

/** Lo que contestó el modelo de casa, copiado del examen. */
function comprueba(pregunta: string, respuesta: string, key: TheoryKey = DO_MAYOR) {
  return checkAnswerAgainstTheory(pregunta, respuesta, key);
}

describe('comprobar lo que contesta el profesor', () => {
  /**
   * Las dos respuestas que destaparon esto, a «¿qué es una cadencia perfecta?» en
   * Do mayor. Las dos pasaban todo lo que la ruta miraba.
   */
  it('rechaza las dos respuestas malas que dio el modelo de casa', () => {
    expect(
      comprueba(
        '¿Qué es una cadencia perfecta?',
        'La cadencia perfecta es el movimiento de I a V a I. En C mayor, es C a G a C.',
      ),
    ).not.toBeNull();
    expect(
      comprueba(
        '¿Qué es una cadencia perfecta?',
        'La cadencia perfecta es el IV-V en la tonalidad. En C mayor, es F-C.',
      ),
    ).not.toBeNull();
  });

  /**
   * **Sin falsos rechazos**: estas son respuestas buenas, tal cual las escribió el
   * modelo de casa en el examen. Si una deja de pasar, la ruta la tiraría y
   * contestaría «no ha venido bien formada» a quien preguntó bien.
   */
  it.each([
    [
      '¿Qué es una cadencia perfecta?',
      'La cadencia perfecta es cuando el acorde dominante resuelve en la tónica. En C mayor, es el G que va a C, o el G7 que va a C con séptima.',
      DO_MAYOR,
    ],
    [
      '¿Qué es una cadencia auténtica?',
      'La cadencia auténtica es cuando el acorde dominante resuelve en la tónica. En G mayor, es D → G o D7 → G, cerrando la frase con fuerza.',
      { tonic: 7, mode: 'major' },
    ],
    [
      '¿Qué es una cadencia perfecta?',
      'La cadencia perfecta es cuando el dominante resuelve en la tónica. En A menor, es el E que va a Am, o el E7 que va a Am, con la séptima para cerrar más claro.',
      LA_MENOR,
    ],
    [
      '¿Qué es una cadencia plagal?',
      'La cadencia plagal es cuando la subdominante va a la tónica, cerrando con suavidad. En G mayor, es C → G.',
      { tonic: 7, mode: 'major' },
    ],
    [
      '¿Cómo suena la cadencia plagal en esta tonalidad?',
      'La cadencia plagal en D menor es iv → i: Gm a Dm. Es un cierre suave, como un amén, que deja la sensación de reposo.',
      { tonic: 2, mode: 'minor' },
    ],
    [
      '¿Qué es una cadencia rota?',
      'Una cadencia rota es cuando el acorde dominante en lugar de ir a la tónica, cae en el sexto grado. En C mayor, el G se va al Am.',
      DO_MAYOR,
    ],
    [
      '¿Qué es una cadencia deceptiva?',
      'La cadencia deceptiva es cuando el dominante, en vez de ir a la tónica, cae en el VI. En E menor, el V (B) va al VI (C), compartiendo dos notas con la tónica.',
      { tonic: 4, mode: 'minor' },
    ],
    [
      '¿Qué es una semicadencia?',
      'La semicadencia acaba en el dominante y deja la frase abierta. En F mayor, llega a C desde F o Bb.',
      { tonic: 5, mode: 'major' },
    ],
    [
      '¿Qué es una semicadencia?',
      'La semicadencia acaba en el dominante y deja la frase abierta. En F mayor, llega desde la tónica o la subdominante hacia el C, como F → C o Bb → C.',
      { tonic: 5, mode: 'major' },
    ],
    [
      '¿Cuál es la relativa menor de esta tonalidad?',
      'La relativa menor de A mayor es F# menor.',
      { tonic: 9, mode: 'major' },
    ],
    [
      '¿Y cuál es su relativa mayor?',
      'La relativa mayor de E menor es G mayor. La misma armadura, tres semitonos arriba.',
      { tonic: 4, mode: 'minor' },
    ],
  ] as const)('acepta: %s → %s', (pregunta, respuesta, key: TheoryKey) => {
    expect(comprueba(pregunta, respuesta, key)).toBeNull();
  });

  /** Las malas del examen de antes, tal cual. */
  it.each([
    [
      '¿Qué es una cadencia auténtica?',
      'La cadencia auténtica es el movimiento de I a V a I. En G mayor, es G mayor a D mayor a G mayor.',
      { tonic: 7, mode: 'major' },
    ],
    [
      '¿Qué es una cadencia perfecta?',
      'La cadencia perfecta es el movimiento de i a V. En A menor, es el grado i a V, que suena como A menor a E mayor.',
      LA_MENOR,
    ],
    [
      '¿Qué es una cadencia plagal?',
      'Es cuando el IV grado se mueve al I, como en G mayor el D al G.',
      { tonic: 7, mode: 'major' },
    ],
    [
      '¿Cómo suena la cadencia plagal en esta tonalidad?',
      'La cadencia plagal en D menor es i-VII-V. En tu tonalidad, sería Dm - B - A.',
      { tonic: 2, mode: 'minor' },
    ],
    [
      '¿Qué es una cadencia rota?',
      'Una cadencia rota es cuando la dominante no va al I. Si tocas el V (G7) y lo dejas en el V/ii (A7), eso es una cadencia rota.',
      DO_MAYOR,
    ],
    [
      '¿Qué es una cadencia deceptiva?',
      'La cadencia deceptiva es cuando el V/iv se resuelve en el VII. En E menor, sería el V/iv (B) que va al VII (G#).',
      { tonic: 4, mode: 'minor' },
    ],
    [
      '¿Cuál es la relativa menor de esta tonalidad?',
      'La relativa menor es c menor. En A mayor, el VI grado es c.',
      { tonic: 9, mode: 'major' },
    ],
  ] as const)('rechaza: %s → %s', (pregunta, respuesta, key: TheoryKey) => {
    expect(comprueba(pregunta, respuesta, key)).not.toBeNull();
  });

  it('la cadencia de otra con el nombre de esta no pasa, aunque esté la buena', () => {
    expect(
      comprueba(
        '¿Qué es una cadencia perfecta?',
        'La cadencia perfecta es G → C, o también F → C.',
      ),
    ).toMatch(/plagal/);
    // Si la nombra, está comparando, y comparar está bien.
    expect(
      comprueba(
        '¿Qué es una cadencia perfecta?',
        'La perfecta es G → C; la plagal, en cambio, F → C.',
      ),
    ).toBeNull();
  });

  it('lee grados con su etiqueta entre paréntesis y grados prestados', () => {
    expect(comprueba('¿Qué es una cadencia perfecta?', 'La perfecta es V (G) → I (C).')).toBeNull();
    expect(
      comprueba(
        '¿Qué es una cadencia perfecta?',
        'La perfecta es V → I; el bVII → I y el V/vi son otra cosa.',
      ),
    ).toBeNull();
    // Una coma con un verbo no corta: «G, que resuelve en C».
    expect(
      comprueba('¿Qué es una cadencia perfecta?', 'La perfecta es G, que resuelve en C.'),
    ).toBeNull();
    // Una coma sola, sí: una lista no es una progresión.
    expect(comprueba('¿Qué es una cadencia perfecta?', 'La perfecta: G, C.')).not.toBeNull();
  });

  it('la perfecta puede venir preparada, pero no dando la vuelta', () => {
    expect(comprueba('¿Qué es una cadencia perfecta?', 'La perfecta: Dm → G → C.')).toBeNull();
    expect(comprueba('¿Qué es una cadencia perfecta?', 'La perfecta: C → G → C.')).not.toBeNull();
    expect(
      comprueba('¿Qué es una cadencia perfecta?', 'La perfecta: F → Dm → G → C.'),
    ).not.toBeNull();
  });

  it('la semicadencia acaba en la dominante y no se queda en ella', () => {
    expect(comprueba('¿Qué es una semicadencia?', 'La semicadencia: C → G.')).toBeNull();
    expect(comprueba('¿Qué es una semicadencia?', 'La semicadencia acaba en G.')).toBeNull();
    // Un acorde sin tercera cae en el grado de su fundamental.
    expect(comprueba('¿Qué es una semicadencia?', 'La semicadencia: C5 → G5.')).toBeNull();
    expect(comprueba('¿Qué es una semicadencia?', 'La semicadencia: G → G.')).not.toBeNull();
    expect(comprueba('¿Qué es una semicadencia?', 'La semicadencia es G → C.')).not.toBeNull();
    // En menor vale también el v, que es la dominante de la natural.
    expect(
      comprueba('¿Qué es una semicadencia?', 'La semicadencia: Am → Em.', LA_MENOR),
    ).toBeNull();
  });

  it('la relativa tiene que decir cuál es, y la que es', () => {
    expect(
      comprueba('¿Cuál es la relativa menor?', 'La relativa menor de C mayor es E menor.'),
    ).toMatch(/E/);
    expect(
      comprueba('¿Cuál es la relativa menor?', 'La relativa menor comparte las mismas notas.'),
    ).not.toBeNull();
    expect(comprueba('¿Cuál es la relativa menor?', 'Su relativa es Am.')).toBeNull();
    expect(comprueba('¿Cuál es la relativa?', 'La relativa mayor es C.', LA_MENOR)).toBeNull();
  });

  it('con un alias en la pregunta, solo comprueba si la respuesta nombra la cadencia', () => {
    // «¿Por qué el V va al I?» se puede contestar con la sensible, sin cadencias.
    expect(
      comprueba('¿Por qué el V va al I?', 'Porque el V lleva la sensible, que tira a la tónica.'),
    ).toBeNull();
    expect(
      comprueba('¿Por qué el V va al I?', 'Es la cadencia perfecta: C a G a C.'),
    ).not.toBeNull();
  });

  /**
   * Una pregunta por otra tonalidad se contesta en esa otra, y comprobarla contra
   * la puesta sería rechazar una respuesta buena.
   */
  it('no comprueba nada si la pregunta es de otra tonalidad', () => {
    for (const pregunta of [
      '¿Cuál es la relativa de G mayor?',
      '¿Cuál es la relativa de G?',
      '¿Y la relativa de sol mayor?',
      '¿Y la relativa de fa sostenido menor?',
      '¿Y la de si bemol mayor?',
      '¿Y la relativa de mi b mayor?',
    ]) {
      expect(comprueba(pregunta, 'La relativa menor de G mayor es E menor.'), pregunta).toBeNull();
    }
    // La misma tonalidad, nombrada, sí se comprueba.
    expect(
      comprueba('¿Cuál es la relativa de do mayor?', 'La relativa menor de C mayor es E menor.'),
    ).not.toBeNull();
  });

  /**
   * Falsos rechazos que encontró la auditoría: respuestas buenas que la ruta tiraba
   * dos veces y cobraba igual. Las tres familias: la etiqueta entre paréntesis
   * detrás de los grados, la relativa en castellano y la cadencia en solfeo.
   */
  it.each([
    ['¿Qué es la cadencia perfecta?', 'Es V → I (G → C).', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'V7 → I (G7 → C).', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'Es G → C (V → I).', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'Es G (V) → C (I).', DO_MAYOR],
    ['¿Qué es la cadencia plagal?', 'Es IV → I (F → C).', DO_MAYOR],
    ['¿Qué es la cadencia rota?', 'Es V → vi (G → Am).', DO_MAYOR],
    // Un aparte del mismo tipo tampoco alarga la progresión de fuera.
    ['¿Qué es la cadencia perfecta?', 'Es G → C (G7 → C, con séptima).', DO_MAYOR],
    // Un paréntesis sin acordes dentro sigue uniendo, como antes.
    ['¿Qué es la cadencia perfecta?', 'De G (la dominante) a C.', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'Es la del final (G → C).', DO_MAYOR],
    [
      '¿Cuál es la relativa?',
      'La relativa menor de Do mayor es La menor: comparten las mismas notas.',
      DO_MAYOR,
    ],
    [
      '¿Cuál es la relativa?',
      'Su relativa menor es Mi menor, con las mismas siete notas.',
      { tonic: 7, mode: 'major' },
    ],
    [
      '¿Cuál es la relativa menor?',
      'La relativa menor de La mayor es Fa sostenido menor.',
      { tonic: 9, mode: 'major' },
    ],
    ['¿Cuál es la relativa menor?', 'Es Fa# menor.', { tonic: 9, mode: 'major' }],
    [
      '¿Cuál es la relativa mayor?',
      'La relativa mayor de Sol menor es Si bemol mayor.',
      { tonic: 7, mode: 'minor' },
    ],
    [
      '¿Qué es la cadencia perfecta?',
      'Es ir del quinto grado al primero: en Do mayor, de Sol a Do.',
      DO_MAYOR,
    ],
    [
      '¿Qué es la cadencia perfecta?',
      'Es el paso de la dominante a la tónica: de Sol a Do, G → C.',
      DO_MAYOR,
    ],
    ['¿Qué es la cadencia perfecta?', 'En minúsculas, de sol a do.', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'En minúsculas, sol → do.', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'Sol resuelve en Do: es la perfecta.', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'Es Sol7 → Do.', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'En Fa mayor es Do → Fa.', { tonic: 5, mode: 'major' }],
    [
      '¿Qué es la cadencia perfecta?',
      'En Mi bemol mayor es Sib → Mib.',
      { tonic: 3, mode: 'major' },
    ],
    // «En C» detrás de los grados es la tonalidad, no un tercer acorde.
    ['¿Qué es la cadencia perfecta?', 'Es V → I en C.', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'Es V → I en Do.', DO_MAYOR],
    ['¿Qué es la cadencia perfecta?', 'El V resuelve en C.', DO_MAYOR],
  ] as const)('acepta, sin falso rechazo: %s → %s', (pregunta, respuesta, key: TheoryKey) => {
    expect(comprueba(pregunta, respuesta, key)).toBeNull();
  });

  /**
   * «la» es un artículo y «si» una conjunción. Leídas como La y Si, cada una de
   * estas alargaría la progresión —«la Dm → G → C» serían cuatro acordes— o
   * escribiría otra cadencia —«el G va a la» sería G → A, la rota—, y se
   * rechazarían.
   */
  it.each([
    'Es G → C: el G va a la tónica.',
    'Es G → C, y se oye mejor con la Dm → G → C entera.',
    'La Dm → G → C acaba en una perfecta.',
    'Si Dm → G → C, la perfecta son los dos últimos.',
    'Suena a cierre si Dm → G → C.',
    'Si la tocas con séptima, G7 → C suena aún más a final.',
    'Es G → C, de la dominante a la tónica.',
  ])('«la» y «si» no son acordes: %s', (respuesta) => {
    expect(comprueba('¿Qué es la cadencia perfecta?', respuesta)).toBeNull();
  });

  it('en castellano, lo que está mal se sigue rechazando', () => {
    expect(
      comprueba('¿Cuál es la relativa?', 'La relativa menor de Do mayor es Mi menor.'),
    ).toMatch(/relativa es E$/);
    expect(
      comprueba('¿Cuál es la relativa?', 'La relativa mayor de Sol menor es Re mayor.', {
        tonic: 7,
        mode: 'minor',
      }),
    ).toMatch(/relativa es D$/);
    expect(comprueba('¿Qué es la cadencia perfecta?', 'Es de Do a Sol a Do.')).not.toBeNull();
    expect(comprueba('¿Qué es la cadencia perfecta?', 'Es de Fa a Do.')).not.toBeNull();
    expect(comprueba('¿Qué es la cadencia perfecta?', 'De Sol a Do, o de Fa a Do.')).toMatch(
      /plagal/,
    );
    // Un aparte que dice otra cadencia es otra progresión, y se mira igual.
    expect(comprueba('¿Qué es la cadencia perfecta?', 'Es V → I (F → C).')).toMatch(/plagal/);
    // Un paréntesis detrás de otra cosa que un acorde no es un aparte.
    expect(
      comprueba('¿Qué es la cadencia perfecta?', 'Es F → C, es decir (IV → I).'),
    ).not.toBeNull();
  });

  /**
   * El patrón de cifrados deja pasar una letra con su alteración, y `E#`, `Cb` o
   * `Fb7` son de esas: suenan, pero el lector del dominio no los conoce. No son de
   * la tonalidad, y no hacen de ningún grado.
   */
  it('un cifrado que el lector no conoce no es de la tonalidad', () => {
    expect(comprueba('¿Qué es la cadencia perfecta?', 'La perfecta es Fb7 → Cb.')).not.toBeNull();
    expect(comprueba('¿Qué es una semicadencia?', 'La semicadencia: C → E#.')).not.toBeNull();
    expect(
      comprueba('¿Qué es la cadencia perfecta?', 'La perfecta es G → C; E# y Cb son otra cosa.'),
    ).toBeNull();
  });

  it('lo que no tiene firma no se comprueba', () => {
    expect(comprueba('¿Qué es un tritono?', 'Cualquier cosa.')).toBeNull();
    expect(comprueba('¿Cómo cambio las cuerdas?', 'Con paciencia.')).toBeNull();
  });
});

describe('normalizar lo que se pregunta', () => {
  it('quita tildes, mayúsculas y signos', () => {
    expect(normalizeForSearch('¿Qué es el ii–V–I?')).toBe('que es el ii v i');
    expect(normalizeForSearch('Síncopa, compás y armonía')).toBe('sincopa compas y armonia');
    expect(normalizeForSearch('Engaño')).toBe('engano');
  });
});

describe('las firmas, en los dos modos', () => {
  it('las cadencias tienen firma en mayor y en menor', () => {
    for (const item of GLOSSARY) {
      const firma = item.signature;
      if (firma?.kind === 'cadence') {
        for (const mode of ['major', 'minor'] as KeyMode[]) {
          expect(firma.exact?.[mode] ?? firma.endsOn?.[mode], `${item.id} ${mode}`).toBeDefined();
        }
      }
    }
  });
});
