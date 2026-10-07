import { describe, expect, it } from 'vitest';

import { diatonicTriads, seventhNotes } from './chords';
import { keySignature, relativeMajor, relativeMinor } from './circle-of-fifths';
import {
  checkAnswerAgainstTheory,
  findTheory,
  respuestaDelGlosario,
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
import { keyDegree, spelledName } from './spelling';

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

/**
 * El acorde de un grado de la escala como lo escribe el glosario: la especie de
 * `resolveDegree` y la fundamental con la letra del grado —`E#dim` y no `Fdim`
 * en Fa# mayor—. Solo para los grados sin bemol ni secundaria, que son los que
 * se piden aquí.
 */
function acorde(key: TheoryKey, degree: DegreeSymbol): string {
  const numero = NUMEROS.indexOf(degree.replace('°', '').toUpperCase()) + 1;
  const especie = resolveDegree(key.tonic, key.mode, degree).symbol.replace(/^[A-G][#b]?/, '');
  return `${spelledName(keyDegree(key.tonic, key.mode, numero))}${especie}`;
}

const NUMEROS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

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

  it('hay entre treinta y setenta entradas, y cada nombre es de una sola', () => {
    // Setenta y no cincuenta desde que el examen ampliado enseñó lo que faltaba:
    // la inversión, los acordes de la tonalidad, las figuras, la dominante de la
    // dominante aparte y cinco de la aplicación. El tope no es de tokens —van dos
    // por pregunta como mucho—, es para que no crezca sin mirarlo.
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
    expect(GLOSSARY.length).toBeLessThanOrEqual(70);

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

  /**
   * Con los nombres del conservatorio: la perfecta pide los dos acordes en estado
   * fundamental y la tónica arriba, y si no, es imperfecta. Decía solo «la
   * dominante resolviendo en la tónica», que es las dos a la vez.
   */
  it('la perfecta dice qué la separa de la imperfecta', () => {
    const texto = theoryReference(entrada('cadencia-perfecta'), DO_MAYOR);
    expect(texto).toContain('estado fundamental');
    expect(texto).toContain('tónica arriba');
    expect(texto).toContain('imperfecta');
  });

  /**
   * Lo que se nombra a partir de la tónica se escribe con su letra. `keyName`
   * llamaba «Db mayor» al paralelo de C# menor —cuyo V no es G# sino Ab— y «Db
   * mayor» a la vecina de arriba de F# mayor, que está una quinta por encima de
   * Fa#: Do#.
   */
  it('el paralelo y las vecinas conservan la letra de la tónica', () => {
    const doSostenidoMenor: TheoryKey = { tonic: 1, mode: 'minor' };
    expect(theoryReference(entrada('prestado'), doSostenidoMenor)).toContain(
      'G#, que es el de C# mayor',
    );
    expect(theoryReference(entrada('circulo-de-quintas'), { tonic: 6, mode: 'major' })).toContain(
      'Vecinas de F# mayor: C# mayor y B mayor',
    );
    expect(theoryReference(entrada('circulo-de-quintas'), { tonic: 3, mode: 'major' })).toContain(
      'Vecinas de Eb mayor: Bb mayor y Ab mayor',
    );
    expect(theoryReference(entrada('circulo-de-quintas'), LA_MENOR)).toContain('E menor y D menor');
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

/**
 * Los acordes se cifran con la letra de su grado, como en las lecciones: el
 * profesor no puede decir `Fdim` al lado de una unidad que dice `E#dim`.
 */
describe('cada acorde con la letra de su grado', () => {
  const FA_SOSTENIDO_MAYOR: TheoryKey = { tonic: 6, mode: 'major' };
  const SOL_SOSTENIDO_MENOR: TheoryKey = { tonic: 8, mode: 'minor' };
  const RE_SOSTENIDO_MENOR: TheoryKey = { tonic: 3, mode: 'minor' };
  const RE_BEMOL_MAYOR: TheoryKey = { tonic: 1, mode: 'major' };

  it('en Fa# mayor el vii° es E#dim, y sus notas E# G# B', () => {
    expect(keyChordTable(FA_SOSTENIDO_MAYOR)).toBe(
      'Acordes de F# mayor. Tónica: I F#, iii A#m, vi D#m. Subdominante: ii G#m, IV B. Dominante: V C#, vii° E#dim.',
    );
    expect(theoryReference(entrada('disminuido'), FA_SOSTENIDO_MAYOR)).toContain(
      'En F# mayor: E#dim = E# G# B, el vii°.',
    );
    expect(theoryReference(entrada('m7b5'), FA_SOSTENIDO_MAYOR)).toContain(
      'E#m7b5 = E# G# B D#, el viiø7.',
    );
  });

  it('en Re# menor el ii° es E#dim y la dominante de la dominante, E#7', () => {
    expect(keyChordTable(RE_SOSTENIDO_MENOR)).toContain('Subdominante: ii° E#dim, iv G#m.');
    expect(theoryReference(entrada('dominante-de-la-dominante'), RE_SOSTENIDO_MENOR)).toContain(
      'En D# menor: E#7 → A#7 → D#m.',
    );
  });

  it('en Sol# menor la armónica lleva F## y da D#', () => {
    expect(theoryReference(entrada('menor-armonica'), SOL_SOSTENIDO_MENOR)).toContain(
      'En G# menor: G# A# B C# D# E F##; da D# (V) y no D#m.',
    );
  });

  it('en Reb mayor lo prestado va con la letra del grado, y el sustituto tritonal no', () => {
    expect(theoryReference(entrada('prestado'), RE_BEMOL_MAYOR)).toContain(
      'En Db mayor: Gbm (iv), Fb (bIII), Bbb (bVI), Cb (bVII).',
    );
    // Como en la lección de sustituciones: en rigor sería Ebb7, y se cifra D7.
    expect(theoryReference(entrada('sustitucion-tritonal'), RE_BEMOL_MAYOR)).toContain(
      'En Db mayor: D7 → Db en vez de Ab7 → Db.',
    );
  });

  it('en Do mayor no cambia nada: ninguna letra pide alteración', () => {
    expect(theoryReference(entrada('disminuido'), DO_MAYOR)).toContain(
      'En C mayor: Bdim = B D F, el vii°.',
    );
    expect(theoryReference(entrada('prestado'), DO_MAYOR)).toContain(
      'En C mayor: Fm (iv), Eb (bIII), Ab (bVI), Bb (bVII).',
    );
  });
});

describe('qué entrada contesta a cada pregunta', () => {
  it.each([
    ['¿Qué es una cadencia perfecta?', ['cadencia-perfecta']],
    ['¿Qué es una cadencia auténtica?', ['cadencia-perfecta']],
    // La imperfecta es el mismo V → I con otra colocación, y vive en la misma
    // entrada: antes caía en la general de las cadencias, que no la nombra.
    ['¿Qué es una cadencia imperfecta?', ['cadencia-perfecta']],
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
    ['¿Qué es el V/V?', ['dominante-de-la-dominante']],
    ['¿Qué es una dominante secundaria?', ['dominante-secundaria']],
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
   * El glosario escribe cada fundamental con la letra de su grado —`E#dim` en Fa#
   * mayor, `Cb` como bVII de Reb—, así que el validador las lee por su altura,
   * como las notas: si no, rechazaría la respuesta que copia la referencia. Leídas
   * así, `Fb7 → Cb` en Do mayor es E7 → B, que no es ninguna cadencia.
   */
  it('un cifrado con la letra del grado se lee por lo que suena', () => {
    expect(comprueba('¿Qué es la cadencia perfecta?', 'La perfecta es Fb7 → Cb.')).not.toBeNull();
    expect(comprueba('¿Qué es una semicadencia?', 'La semicadencia: C → E#.')).not.toBeNull();
    expect(
      comprueba('¿Qué es la cadencia perfecta?', 'La perfecta es G → C; E# y Cb son otra cosa.'),
    ).toBeNull();

    const reSostenidoMenor: TheoryKey = { tonic: 3, mode: 'minor' };
    expect(
      comprueba('¿Qué es la dominante de la dominante?', 'Es E#7, que va a A#7.', reSostenidoMenor),
    ).toBeNull();
    expect(
      comprueba('¿Qué es la dominante de la dominante?', 'Es B7, que va a A#7.', reSostenidoMenor),
    ).not.toBeNull();

    const faSostenidoMayor: TheoryKey = { tonic: 6, mode: 'major' };
    expect(comprueba('x', 'El E#dim (vii°) tira a F#.', faSostenidoMayor)).toBeNull();
    // Suena igual, y el validador mira alturas: no es él quien enseña a escribir.
    expect(comprueba('x', 'El Fdim (vii°) tira a F#.', faSostenidoMayor)).toBeNull();
    expect(comprueba('x', 'El C#dim (vii°) tira a F#.', faSostenidoMayor)).toMatch(/vii°/);
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

describe('encontrar la pregunta escrita como se escribe', () => {
  it.each([
    // Singular y plural, en los dos sentidos.
    ['¿Qué son las cadencias perfectas?', 'cadencia-perfecta'],
    ['¿Qué es un acorde prestado?', 'prestado'],
    ['¿Y los acordes prestados?', 'prestado'],
    ['¿Cuántos compases tiene un blues?', 'blues-de-doce'],
    // Las abreviaturas de un mensaje.
    ['q es el circulo d quintas', 'circulo-de-quintas'],
    // Faltas de una letra, y de dos en una palabra larga.
    ['q es una kadencia perfeta', 'cadencia-perfecta'],
    ['que es el modo frijio', 'modo-frigio'],
    ['la pentatnica menor', 'pentatonica-menor'],
    ['una cadnecia plagal', 'cadencia-plagal'],
    // Los grados prestados, por su cifra.
    ['¿Qué es el bVII y de dónde sale?', 'prestado'],
  ])('%s', (pregunta, esperada) => {
    expect(findTheory(pregunta).map((item) => item.id)).toContain(esperada);
  });

  it('lo que está bien escrito no se corrige a otra cosa', () => {
    // «armonía» está en «armonía funcional», y a una letra de «armónica».
    expect(findTheory('¿Qué es la armonía funcional?').map((item) => item.id)).toEqual([
      'funciones',
    ]);
    expect(findTheory('¿Qué es la armonía?')).toEqual([]);
  });

  it('las palabras corrientes no se corrigen nunca: «tiempo» no es «tempo»', () => {
    expect(findTheory('¿Qué tiempo hará mañana?')).toEqual([]);
    expect(findTheory('¿Cuántas negras caben en un compás de 3/4?').map((item) => item.id)).toEqual(
      ['compas', 'figuras'],
    );
  });

  it('en una palabra corta, una letra es otra palabra y no se corrige', () => {
    expect(findTheory('¿Qué es una rata?')).toEqual([]);
  });
});

describe('las notas de un acorde escrito en la pregunta', () => {
  it.each([
    [
      '¿Qué notas tiene un G7?',
      'Notas de G7: G B D F (fundamental, 3.ª mayor, 5.ª justa, 7.ª menor).',
    ],
    ['q notas lleva el acorde de re mayor', 'Notas de D: D F# A'],
    ['¿Qué notas forman el acorde de la menor?', 'Notas de Am: A C E'],
    ['¿Cómo se forma el acorde de A menor?', 'Notas de Am: A C E'],
    ['¿Qué notas tiene sol7?', 'Notas de G7: G B D F'],
    ['¿Qué notas tiene el acorde de A mayor?', 'Notas de A: A C# E'],
    // El primero que se escribe.
    ['¿Qué notas tienen un C y un G7?', 'Notas de C: C E G'],
    ['¿Qué notas tiene el acorde de si bemol?', 'Notas de Bb: Bb D F'],
    ['¿Y las notas de un Bm7b5?', 'Notas de Bm7b5: B D F A'],
  ])('%s', (pregunta, esperada) => {
    const [primera] = findTheory(pregunta);

    expect(primera === undefined ? '' : theoryReference(primera, DO_MAYOR)).toContain(esperada);
  });

  it('sin preguntar notas no hay entrada del acorde', () => {
    expect(findTheory('¿Por qué suena tan bien un G7?').map((item) => item.id)).not.toContain(
      'notas-de-G7',
    );
  });

  it('«A menor» a secas es la tonalidad, y «mi canción» no es el acorde de Mi', () => {
    expect(
      findTheory('¿Qué notas tiene la escala de A menor?').filter((item) =>
        item.id.startsWith('notas-de'),
      ),
    ).toEqual([]);
    expect(findTheory('¿Qué notas lleva el acorde de mi canción?')).toEqual([]);
  });

  it('las especies que no se deletrean contando semitonos no tienen entrada', () => {
    expect(findTheory('¿Qué notas tiene un Bdim7?')).toEqual([]);
  });
});

describe('comprobar las notas que se preguntan', () => {
  it('las de un acorde tienen que estar todas, en letra o en castellano', () => {
    const pregunta = 'q notas lleva el acorde de re mayor';
    const enRe: TheoryKey = { tonic: 2, mode: 'major' };

    // Lo que contestó el modelo de casa: «sol» en vez de «la».
    expect(
      comprueba(pregunta, 'El acorde de re mayor lleva las notas re, fa#, sol.', enRe),
    ).not.toBeNull();
    expect(comprueba(pregunta, 'Lleva D, F# y A.', enRe)).toBeNull();
    expect(comprueba(pregunta, 'Lleva re, fa sostenido y la.', enRe)).toBeNull();
    // Valen igual dichas de otra tonalidad: las notas de un acorde no dependen de ella.
    expect(comprueba(pregunta, 'Lleva D, Gb y A.', DO_MAYOR)).toBeNull();
  });

  it('las de la escala de la tonalidad, también', () => {
    const enMi: TheoryKey = { tonic: 4, mode: 'minor' };
    const pregunta = '¿Qué notas tiene la pentatónica menor?';

    expect(
      comprueba(pregunta, 'E, G, A, B y D: la menor sin la segunda ni la sexta.', enMi),
    ).toBeNull();
    expect(comprueba(pregunta, 'E, G, A y B.', enMi)).not.toBeNull();
  });

  it('no comprueba la escala que puede ser de dos tónicas', () => {
    // En Do mayor, «la pentatónica menor» puede ser la de Do o la de La.
    expect(comprueba('¿Qué notas tiene la pentatónica menor?', 'C, Eb, F, G y Bb.')).toBeNull();
  });

  it('ni la escala si la pregunta es de otra tonalidad, ni nada si no pide notas', () => {
    expect(comprueba('¿Qué notas tiene la escala mayor de G mayor?', 'G y nada más.')).toBeNull();
    expect(comprueba('¿Qué es la escala mayor?', 'Siete notas: T T S T T T S.')).toBeNull();
  });
});

describe('comprobar los intervalos', () => {
  it('un intervalo no puede medir otros semitonos que los suyos', () => {
    expect(comprueba('¿Qué es un acorde mayor?', 'La tercera mayor tiene 3 semitonos.')).toMatch(
      /tercera mayor/,
    );
    expect(comprueba('x', 'Un tritono son cinco semitonos.')).not.toBeNull();
    expect(
      comprueba('x', 'La tercera mayor tiene cuatro semitonos y la quinta justa 7.'),
    ).toBeNull();
    expect(comprueba('x', 'Una octava de 12 semitonos.')).toBeNull();
  });

  it('lo que va separado del nombre no se lee', () => {
    expect(comprueba('x', 'La tercera mayor, de C a E, son cuatro semitonos.')).toBeNull();
  });
});

describe('comprobar la armadura', () => {
  const pregunta = '¿Cuántos sostenidos tiene la armadura?';

  it('la cuenta tiene que ser la suya', () => {
    const enMi: TheoryKey = { tonic: 4, mode: 'major' };

    // Lo que contestó el modelo de casa.
    expect(comprueba(pregunta, 'La armadura de Mi mayor tiene 1 sostenido: F#.', enMi)).toMatch(
      /armadura/,
    );
    expect(comprueba(pregunta, 'Lleva cuatro sostenidos: F#, C#, G# y D#.', enMi)).toBeNull();
    expect(comprueba(pregunta, 'Lleva F#, C#, G# y D#.', enMi)).toBeNull();
  });

  it('vale con que una cuenta sea la buena, y sin alteraciones se dice de varias maneras', () => {
    const enFa: TheoryKey = { tonic: 5, mode: 'major' };

    expect(comprueba(pregunta, 'Ningún sostenido: lleva un bemol, el Bb.', enFa)).toBeNull();
    expect(comprueba(pregunta, 'Tiene 0 sostenidos.', enFa)).toBeNull();
    expect(comprueba(pregunta, 'Tiene dos bemoles.', enFa)).not.toBeNull();
    expect(comprueba(pregunta, 'C mayor no lleva alteraciones.')).toBeNull();
    expect(comprueba(pregunta, 'C mayor no lleva ningún sostenido ni bemol.')).toBeNull();
    expect(comprueba(pregunta, 'Lleva un sostenido.')).not.toBeNull();
  });
});

describe('comprobar el acorde que se pregunta', () => {
  const enFa: TheoryKey = { tonic: 5, mode: 'major' };

  it('la dominante de la dominante tiene que ser la suya', () => {
    const pregunta = '¿Cuál es la dominante de la dominante?';

    // Las dos que contestó el modelo de casa en Fa mayor.
    expect(
      comprueba(
        pregunta,
        'La dominante de la dominante es el V/V, que en F mayor es C7. Lleva a la dominante C.',
        enFa,
      ),
    ).not.toBeNull();
    expect(comprueba(pregunta, 'Es el G7, que lleva a C7 y de ahí a F.', enFa)).toBeNull();
    // Sin un solo acorde explica sin equivocarse, y pasa.
    expect(comprueba(pregunta, 'Es el V del V: lleva a la dominante.', enFa)).toBeNull();
    // Por un alias, «el V de V», no se exige: puede contestar sin nombrarla.
    expect(
      comprueba('¿Qué es el V de V?', 'La dominante de la dominante lleva al C.', enFa),
    ).toBeNull();
  });

  it('la dominante dicha tiene que ser el V, y no la de otra tonalidad', () => {
    const bb: TheoryKey = { tonic: 10, mode: 'major' };

    expect(
      comprueba('¿Cuál es la dominante?', 'La dominante de Bb mayor es Eb.', bb),
    ).not.toBeNull();
    expect(comprueba('¿Cuál es la dominante?', 'La dominante de Bb mayor es F.', bb)).toBeNull();
    expect(comprueba('x', 'La dominante es Eb.', bb)).toMatch(/dominante es Eb/);
    expect(comprueba('x', 'La dominante de G mayor es D.', bb)).toBeNull();
    expect(comprueba('x', 'La dominante de la dominante es C7.', bb)).toBeNull();
  });

  it('los acordes de la tonalidad tienen que estar escritos', () => {
    const pregunta = 'ke acordes van bien en esta tonalidad, osea los q tiene';

    // Lo que contestó el modelo de casa: grados a secas.
    expect(
      comprueba(
        pregunta,
        'Los acordes que van bien son los de i, ii°, III, iv, v, VI y VII.',
        LA_MENOR,
      ),
    ).not.toBeNull();
    expect(comprueba(pregunta, 'Am, Bdim, C, Dm, Em, F y G, y el E.', LA_MENOR)).toBeNull();
  });
});

describe('comprobar los modos', () => {
  it('por los siete modos, hay que nombrarlos', () => {
    const pregunta = '¿Qué diferencia hay entre los siete modos?';

    expect(comprueba(pregunta, 'Cada uno tiene un sonido distinto.', LA_MENOR)).not.toBeNull();
    expect(
      comprueba(
        pregunta,
        'El jónico y el lidio son mayores; el dórico y el frigio, menores.',
        LA_MENOR,
      ),
    ).toBeNull();
  });

  it('por uno de ellos, no', () => {
    expect(comprueba('¿Qué modos hay como el dórico?', 'Es menor con la sexta mayor.')).toBeNull();
  });
});

describe('un acorde con su grado al lado', () => {
  const enFa: TheoryKey = { tonic: 5, mode: 'major' };

  it('tiene que ser ese grado', () => {
    expect(comprueba('x', 'Si usas D7 (V/vi), va a Dm.', enFa)).toMatch(/V\/vi/);
    expect(comprueba('x', 'Usa A7, que es el V/V.', enFa)).not.toBeNull();
    expect(comprueba('x', 'El V es G.', enFa)).not.toBeNull();
    expect(comprueba('x', 'A7 (V/vi) va a Dm, y C (V) a F.', enFa)).toBeNull();
    expect(comprueba('x', 'El bVII = Eb.', enFa)).toBeNull();
  });

  it('en menor, el VI y el VII pueden ser los subidos', () => {
    expect(comprueba('x', 'G (VII) o G#dim (vii°), y F (VI).', LA_MENOR)).toBeNull();
    expect(comprueba('x', 'Bb (VII).', LA_MENOR)).not.toBeNull();
  });

  it('lo de otra tonalidad, lo que va con «de» y los paréntesis con más de una pieza no se miran', () => {
    expect(comprueba('x', 'En su relativa, A menor: da E (V).')).toBeNull();
    expect(comprueba('x', 'G7 es el V de C.', enFa)).toBeNull();
    expect(comprueba('x', 'V → I (G → C).', enFa)).toBeNull();
    expect(comprueba('x', 'G (V de C).', enFa)).toBeNull();
  });
});

describe('contestar con el glosario', () => {
  it('nada si no casa, y las entradas resueltas si casa', () => {
    expect(respuestaDelGlosario('¿Cómo cambio las cuerdas?', DO_MAYOR)).toBeNull();
    expect(respuestaDelGlosario('¿Qué es una cadencia plagal?', DO_MAYOR)).toContain(
      'IV → I: F → C',
    );
  });

  /**
   * Lo que contesta el glosario tiene que pasar el mismo validador que la
   * respuesta del modelo, en las veinticuatro: si no, la ruta tiraría la referencia
   * que le da al modelo, y el respaldo diría algo que la aplicación da por falso.
   */
  it('pasa su propio validador en las veinticuatro tonalidades', () => {
    const preguntas = [
      ...GLOSSARY.map((item) => `¿Qué es ${item.names[0] ?? item.id}?`),
      ...GLOSSARY.filter((item) => item.notesOf !== undefined).map(
        (item) => `¿Qué notas tiene ${item.names[0] ?? item.id}?`,
      ),
      '¿Qué notas tiene un G7?',
      '¿Cuál es la dominante de la dominante?',
      '¿Qué diferencia hay entre los siete modos?',
      '¿Qué acordes tiene esta tonalidad?',
    ];
    for (const key of TONALIDADES) {
      for (const pregunta of preguntas) {
        const respuesta = respuestaDelGlosario(pregunta, key);
        if (respuesta !== null) {
          expect(
            checkAnswerAgainstTheory(pregunta, respuesta, key),
            `${pregunta} en ${keyName(key.tonic, key.mode)}`,
          ).toBeNull();
        }
      }
    }
    // Son unas dos mil comprobaciones: con el equipo cargado pasan de los cinco
    // segundos de serie.
  }, 30_000);

  it('la aplicación, con lo que de verdad hace: la afinación sale del mástil', () => {
    expect(respuestaDelGlosario('¿Cómo afino la guitarra?', DO_MAYOR)).toContain('E A D G B E');
    expect(respuestaDelGlosario('¿Puedo grabar un vídeo?', DO_MAYOR)).toContain('No graba vídeo');
  });
});
