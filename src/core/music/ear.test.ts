import { describe, expect, it } from 'vitest';

import {
  EAR_KINDS,
  earExercises,
  gradoDe,
  nombreDelIntervalo,
  programaDe,
  sonidoDe,
  type EarExercise,
  type EarKind,
  type EarStep,
} from './ear';
import type { KeyMode } from './keys';
import { lessonNotes } from './lessons';
import { normalizePitchClass, pitchClassFromName, type PitchClass } from './notes';
import { scheduleProgression } from './playback';
import { degreesFor } from './progressions';
import { scaleNotes } from './scales';

const C = pitchClassFromName('C');
const Eb = pitchClassFromName('Eb');
const A = pitchClassFromName('A');

const CLASES = Object.keys(EAR_KINDS) as EarKind[];

/** Las veinticuatro tonalidades, que es donde se equivoca la teoría escrita a mano. */
const TONALIDADES = Array.from({ length: 12 }, (_, tonic) => tonic as PitchClass).flatMap((tonic) =>
  (['major', 'minor'] as const).map((mode) => [tonic, mode] as const),
);

function esNotas(paso: EarStep): paso is { readonly notes: readonly number[] } {
  return typeof paso === 'object' && 'notes' in paso;
}

/** La buena de una pregunta. */
function buena(ejercicio: EarExercise): string {
  return ejercicio.choices.find((choice) => choice.correct)!.text;
}

/** Las notas de un paso, como clases de altura sobre la tónica (0 a 11). */
function sobreLaTonica(paso: EarStep, tonic: PitchClass, mode: KeyMode): number[] {
  return sonidoDe(paso, tonic, mode).notes.map((nota) => normalizePitchClass(nota - tonic));
}

describe('los ejercicios de oído', () => {
  it.each(CLASES)('%s trae ejercicios con lo que suena y qué contestar', (kind) => {
    const ejercicios = earExercises(kind, C, 'major');

    expect(ejercicios.length).toBeGreaterThan(0);
    for (const ejercicio of ejercicios) {
      expect(ejercicio.degrees.length).toBeGreaterThan(0);
      expect(ejercicio.beats).toBeGreaterThan(0);
      expect(ejercicio.prompt).not.toBe('');
      expect(ejercicio.why).not.toBe('');
    }
  });

  // La misma regla que las preguntas de teoría: una y solo una es la buena, y
  // hay al menos otra con la que confundirse.
  it.each(CLASES)('%s tiene una respuesta buena y alguna mala', (kind) => {
    for (const ejercicio of earExercises(kind, C, 'major')) {
      expect(ejercicio.choices.filter((choice) => choice.correct)).toHaveLength(1);
      expect(ejercicio.choices.length).toBeGreaterThan(1);
    }
  });

  /**
   * Los grados tienen que existir en el modo, o `resolveDegree` lanza un
   * `RangeError` al ir a hacerlos sonar. Es el mismo filtro que se pusieron las
   * canciones, y por el mismo motivo: un error en el sitio equivocado.
   */
  it.each([
    ['major' as const, C],
    ['minor' as const, A],
  ])('en %s solo suenan grados que existen', (mode, tonic) => {
    const conocidos = new Set<string>(degreesFor(mode));
    for (const kind of CLASES) {
      for (const ejercicio of earExercises(kind, tonic, mode)) {
        for (const paso of ejercicio.degrees) {
          // Las notas sueltas no son grados de acorde: son de la escala, del 1 al 8.
          if (esNotas(paso)) {
            for (const nota of paso.notes) {
              expect(nota, `${kind}: nota ${nota}`).toBeGreaterThanOrEqual(1);
              expect(nota, `${kind}: nota ${nota}`).toBeLessThanOrEqual(8);
            }
            continue;
          }
          const grado = gradoDe(paso);
          expect(conocidos.has(grado), `${kind}: ${grado} en ${mode}`).toBe(true);
        }
      }
    }
  });

  /**
   * Un acorde suelto no tiene grado: lo tiene dentro de una tonalidad. Por eso
   * las preguntas de grado hacen sonar la casa antes, y lo dicen.
   */
  it('preguntar por un grado hace sonar la tónica primero', () => {
    for (const ejercicio of earExercises('degree', C, 'major')) {
      expect(ejercicio.reference).toBe(1);
      expect(ejercicio.degrees[0]).toBe('I');
      expect(ejercicio.degrees.length).toBeGreaterThan(ejercicio.reference);
    }
  });

  it('lo demás se pregunta sin referencia', () => {
    for (const kind of ['interval', 'quality', 'cadence'] as const) {
      for (const ejercicio of earExercises(kind, C, 'major')) {
        expect(ejercicio.reference).toBe(0);
      }
    }
  });

  // Cambiar de tonalidad cambia lo que suena sin tocar el ejercicio, y quien
  // practica en Mi bemol oye sus acordes.
  it('el porqué habla de los acordes de tu tonalidad', () => {
    const enDo = earExercises('quality', C, 'major')[0]!;
    const enMib = earExercises('quality', Eb, 'major')[0]!;

    expect(enDo.why).toContain('C');
    expect(enMib.why).toContain('Eb');
    expect(enDo.degrees).toEqual(enMib.degrees);
  });

  // Sin reloj ni sorteo: el mismo tono da los mismos ejercicios, que es lo que
  // permite probarlos comparando estructuras.
  it('no hay azar', () => {
    expect(earExercises('degree', C, 'major')).toEqual(earExercises('degree', C, 'major'));
  });

  it('cada clase se presenta con su nombre y su frase', () => {
    for (const kind of CLASES) {
      expect(EAR_KINDS[kind].name).not.toBe('');
      expect(EAR_KINDS[kind].lead).not.toBe('');
    }
  });
});

/**
 * **Un ejercicio de oído tiene que poder contestarse de oído.**
 *
 * La unidad de cuatríadas decía «el mismo acorde, y luego con una nota más» y
 * sus dos pasos eran el mismo grado a secas: `resolveDegree` devuelve tríadas,
 * así que sonaba dos veces lo mismo y la nota por la que preguntaba no llegaba
 * a oírse nunca. Se contestaba razonando el enunciado, que es justo lo
 * contrario de lo que esta unidad entrena.
 */
describe('lo que se pregunta es lo que suena', () => {
  it('cuando la pregunta dice «una nota más», hay una nota más', () => {
    const [primero] = earExercises('sevenths', C, 'major');
    const [tríada, cuatríada] = primero!.degrees;

    const suenaLaTríada = sonidoDe(tríada!, C, 'major');
    const suenaLaCuatríada = sonidoDe(cuatríada!, C, 'major');

    expect(suenaLaTríada.notes).toHaveLength(3);
    expect(suenaLaCuatríada.notes).toHaveLength(4);
    // La misma fundamental, y las tres de antes dentro: lo único que cambia es
    // la de más, que es lo que hay que oír.
    expect(suenaLaCuatríada.root).toBe(suenaLaTríada.root);
    for (const nota of suenaLaTríada.notes) {
      expect(suenaLaCuatríada.notes).toContain(nota);
    }
  });

  it('ningun ejercicio de septimas suena dos veces igual seguidas', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const ejercicio of earExercises('sevenths', C, mode)) {
        const sonidos = ejercicio.degrees.map((paso) => sonidoDe(paso, C, mode));
        for (let i = 1; i < sonidos.length; i += 1) {
          expect(
            sonidos[i]!.notes,
            `${mode}: «${ejercicio.prompt}» repite ${sonidos[i]!.symbol}`,
          ).not.toEqual(sonidos[i - 1]!.notes);
        }
      }
    }
  });

  /**
   * El cifrado de una cuatríada se escribía pegándole el sufijo al de la tríada,
   * y en las doce tonalidades menores salía «Ammaj7».
   */
  it('el cifrado de una cuatriada no se pega al de la triada', () => {
    const enMenor = earExercises('sevenths', A, 'minor');
    for (const ejercicio of enMenor) {
      expect(ejercicio.why).not.toMatch(/[A-G][#b]?mm/);
      expect(ejercicio.why).not.toContain('mmaj7');
    }
    // En La menor el primer grado con séptima es Am7, no «Ammaj7».
    expect(sonidoDe({ degree: 'i', especie: 'minor7' }, A, 'minor').symbol).toBe('Am7');
  });

  it('una séptima sobre un grado bemol se escribe con bemol, como su tríada', () => {
    // Con la grafía de la armadura salía A#7 en Do mayor: la de Do es de sostenidos.
    expect(sonidoDe({ degree: 'bVII', especie: 'dominant7' }, C, 'major').symbol).toBe('Bb7');
  });
});

/**
 * La unidad de sustituciones afirma algo comprobable, y por eso se comprueba: que
 * las dos dominantes **llevan el mismo tritono**. Es lo único que justifica poner
 * una donde iba la otra, y con las tríadas a secas sería falso —un `bII` sin
 * séptima no tiene tritono ninguno—.
 */
describe('el sustituto tritonal lleva el tritono', () => {
  /** El par de notas separadas por seis semitonos, si lo hay. */
  function tritonoDe(notes: readonly number[]): string | null {
    for (const a of notes) {
      for (const b of notes) {
        if ((b - a + 12) % 12 === 6) {
          return [a, b].sort((x, y) => x - y).join('-');
        }
      }
    }
    return null;
  }

  it('las dos dominantes comparten el mismo par de notas', () => {
    for (const mode of ['major', 'minor'] as const) {
      const ejercicios = earExercises('substitutions', C, mode);
      const último = ejercicios.at(-1)!;
      const [dominante, , tritonal] = último.degrees;

      const unaSuena = sonidoDe(dominante!, C, mode);
      const otraSuena = sonidoDe(tritonal!, C, mode);

      // Fundamentales distintas, y a un tritono la una de la otra.
      expect(otraSuena.root).not.toBe(unaSuena.root);
      expect((otraSuena.root - unaSuena.root + 12) % 12).toBe(6);

      // Y el mismo tritono dentro, que es lo que el ejercicio dice que se oye.
      const suyo = tritonoDe(unaSuena.notes);
      expect(suyo, `${mode}: ${unaSuena.symbol} no lleva tritono`).not.toBeNull();
      expect(tritonoDe(otraSuena.notes), `${mode}: ${otraSuena.symbol}`).toBe(suyo);
    }
  });
});

/**
 * La unidad de la rueda afirma dos cosas comprobables, y si alguna fuera falsa el
 * ejercicio enseñaría lo contrario de lo que dice: que la relativa **no trae
 * ninguna nota de fuera**, y que la dominante de la vecina **sí trae una**.
 */
describe('la relativa se queda en casa y la vecina no', () => {
  it('lo que suena en cada pregunta es lo que la pregunta dice', () => {
    for (const mode of ['major', 'minor'] as const) {
      const escala = new Set(scaleNotes(C, mode === 'major' ? 'major' : 'naturalMinor'));
      const [relativa, vecina] = earExercises('circle', C, mode);

      const deLaRelativa = sonidoDe(relativa!.degrees[1]!, C, mode).notes;
      expect(
        deLaRelativa.every((nota) => escala.has(nota)),
        `${mode}: la relativa trae notas de fuera`,
      ).toBe(true);

      const deLaVecina = sonidoDe(vecina!.degrees[1]!, C, mode).notes;
      expect(
        deLaVecina.some((nota) => !escala.has(nota)),
        `${mode}: la vecina no trae ninguna nota de fuera`,
      ).toBe(true);
    }
  });
});

/**
 * La buena salía siempre la primera: `opciones` la escribe delante y nadie la
 * movía, así que una unidad de oído se aprobaba pulsando a la izquierda sin
 * escuchar. Se mira en las veinticuatro tonalidades y en todas las clases.
 */
describe('las opciones de oído salen repartidas', () => {
  it('la buena no cae siempre en el mismo sitio', () => {
    const sitios = new Map<number, number>();
    let total = 0;

    for (const kind of CLASES) {
      for (const [tonic, mode] of TONALIDADES) {
        for (const ejercicio of earExercises(kind, tonic, mode)) {
          const donde = ejercicio.choices.findIndex((choice) => choice.correct);
          sitios.set(donde, (sitios.get(donde) ?? 0) + 1);
          total += 1;
        }
      }
    }

    expect([...sitios.keys()].sort()).toEqual([0, 1, 2]);
    // Con dos opciones en casi todas, la primera rondaría la mitad; lo que no
    // puede es quedarse con casi todas, que es lo que pasaba.
    expect(sitios.get(0)!).toBeLessThan(total * 0.65);
  });

  /**
   * Y dentro de una misma unidad: con dos opciones y tres preguntas, la unidad de
   * modos salía «la primera, la primera, la primera» en las veinticuatro
   * tonalidades aun barajando, porque sus textos no cambian con la tonalidad.
   */
  it('en ninguna unidad y ninguna tonalidad la buena cae siempre en el mismo sitio', () => {
    for (const kind of CLASES) {
      for (const [tonic, mode] of TONALIDADES) {
        const sitios = new Set(
          earExercises(kind, tonic, mode).map((ejercicio) =>
            ejercicio.choices.findIndex((choice) => choice.correct),
          ),
        );
        expect(sitios.size, `${kind} en ${tonic} ${mode}`).toBeGreaterThan(1);
      }
    }
  });

  it('el reparto es el mismo cada vez que se pide la misma unidad', () => {
    for (const kind of CLASES) {
      const textos = () =>
        earExercises(kind, Eb, 'major').map((ejercicio) =>
          ejercicio.choices.map((choice) => choice.text),
        );
      expect(textos(), kind).toEqual(textos());
    }
  });
});

/**
 * Lo que vale para todas las preguntas de oído en las veinticuatro tonalidades:
 * una buena, y ninguna opción repetida. Una opción repetida es una pregunta con
 * dos botones iguales, y si uno es el bueno, otra que se acierta por casualidad.
 */
describe('en las veinticuatro tonalidades', () => {
  it('cada pregunta tiene una sola buena y ninguna opción repetida', () => {
    for (const kind of CLASES) {
      for (const [tonic, mode] of TONALIDADES) {
        for (const ejercicio of earExercises(kind, tonic, mode)) {
          const donde = `${kind} en ${tonic} ${mode}: «${ejercicio.prompt}»`;
          const textos = ejercicio.choices.map((choice) => choice.text);
          expect(
            ejercicio.choices.filter((choice) => choice.correct),
            donde,
          ).toHaveLength(1);
          expect(new Set(textos).size, `${donde} repite ${textos.join(' / ')}`).toBe(textos.length);
        }
      }
    }
  });

  /**
   * `programaDe` existe por los intervalos, y las demás clases no pueden notarlo:
   * lo que suena tiene que ser exactamente lo que sonaba cuando la pantalla
   * pasaba cada paso por `scheduleProgression`.
   */
  it('los acordes suenan igual que antes de que existiera programaDe', () => {
    for (const kind of CLASES.filter((clase) => clase !== 'interval')) {
      for (const [tonic, mode] of TONALIDADES) {
        for (const ejercicio of earExercises(kind, tonic, mode)) {
          const antes = scheduleProgression(
            ejercicio.degrees.map((paso) => ({
              ...sonidoDe(paso, tonic, mode),
              beats: ejercicio.beats,
            })),
            100,
          );
          expect(programaDe(ejercicio, tonic, mode, 100), `${kind} en ${tonic} ${mode}`).toEqual(
            antes,
          );
        }
      }
    }
  });
});

describe('el dictado de intervalos', () => {
  /** Lo que se pregunta, en orden. Es lo mismo en las veinticuatro tonalidades. */
  const PREGUNTADOS = (mode: KeyMode) => [
    'Segunda mayor',
    'Segunda menor',
    'Tercera mayor',
    'Tercera menor',
    'Cuarta justa',
    'Quinta justa',
    'Sexta mayor',
    'Octava justa',
    'Quinta justa',
    // La armónica es de la tónica a la mediante: la que decide el modo.
    mode === 'major' ? 'Tercera mayor' : 'Tercera menor',
  ];

  /** Semitonos de cada intervalo, escritos aparte para no medir con la misma regla. */
  const SEMITONOS: Readonly<Record<string, number>> = {
    'Segunda menor': 1,
    'Segunda mayor': 2,
    'Tercera menor': 3,
    'Tercera mayor': 4,
    'Cuarta justa': 5,
    'Quinta justa': 7,
    'Sexta mayor': 9,
    'Octava justa': 12,
  };

  it('en Do mayor, de C a E es una tercera mayor y suena C4 y luego E4', () => {
    const ejercicios = earExercises('interval', C, 'major');
    const tercera = ejercicios.find(
      (ejercicio) =>
        ejercicio.degrees.length === 2 &&
        ejercicio.degrees.map((paso) => sonidoDe(paso, C, 'major').symbol).join('-') === 'C-E',
    )!;

    expect(buena(tercera)).toBe('Tercera mayor');
    expect(tercera.why).toContain('De C a E hay 3 nombres —C, D, E— y 4 semitonos');
    expect(programaDe(tercera, C, 'major', 120).map((paso) => paso.midis)).toEqual([[60], [64]]);
  });

  it('en La menor, de A a C es una tercera menor', () => {
    const tercera = earExercises('interval', A, 'minor').find(
      (ejercicio) =>
        ejercicio.degrees.map((paso) => sonidoDe(paso, A, 'minor').symbol).join('-') === 'A-C',
    )!;
    expect(buena(tercera)).toBe('Tercera menor');
  });

  it('pregunta lo mismo en las veinticuatro tonalidades, y lo que suena mide eso', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const ejercicios = earExercises('interval', tonic, mode);
      expect(ejercicios.map(buena), `${tonic} ${mode}`).toEqual(PREGUNTADOS(mode));

      for (const ejercicio of ejercicios) {
        const alturas = programaDe(ejercicio, tonic, mode, 100).flatMap((paso) => paso.midis);
        expect(alturas, `${tonic} ${mode}: «${ejercicio.prompt}»`).toHaveLength(2);
        const [primera, segunda] = alturas as [number, number];
        expect(Math.abs(segunda - primera), `${tonic} ${mode}: «${ejercicio.prompt}»`).toBe(
          SEMITONOS[buena(ejercicio)],
        );
      }
    }
  });

  /**
   * Las notas salen de la escala de la tonalidad, no de una lista de semitonos
   * sobre la tónica: quien practica en Mi bemol oye notas de Mi bemol, y en menor
   * las de la menor natural, que es la de la armadura.
   */
  it('todas las notas son de la escala de la tonalidad', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const escala = new Set(scaleNotes(tonic, mode === 'major' ? 'major' : 'naturalMinor'));
      for (const ejercicio of earExercises('interval', tonic, mode)) {
        for (const paso of ejercicio.degrees) {
          for (const nota of sonidoDe(paso, tonic, mode).notes) {
            expect(escala.has(nota), `${tonic} ${mode}: «${ejercicio.prompt}»`).toBe(true);
          }
        }
      }
    }
  });

  it('suena una nota detrás de otra, menos la última, que las da a la vez', () => {
    const ejercicios = earExercises('interval', C, 'major');
    const programas = ejercicios.map((ejercicio) => programaDe(ejercicio, C, 'major', 100));

    for (const programa of programas.slice(0, -1)) {
      expect(programa.map((paso) => paso.midis.length)).toEqual([1, 1]);
      expect(programa[1]!.startMs).toBe(programa[0]!.durationMs);
    }
    expect(programas.at(-1)!.map((paso) => paso.midis)).toEqual([[60, 64]]);
  });

  // La octava son dos clases de altura iguales: colocadas en la misma octava,
  // como se colocan los acordes, sonaba una nota sola.
  it('la octava suena a doce semitonos, no como una nota sola', () => {
    const octava = earExercises('interval', C, 'major').find(
      (ejercicio) => buena(ejercicio) === 'Octava justa',
    )!;
    expect(programaDe(octava, C, 'major', 100).map((paso) => paso.midis)).toEqual([[60], [72]]);
  });

  // Colocadas en una octava fija, de A a F# —una sexta mayor subiendo— caía el
  // F# por debajo y sonaba una tercera menor bajando.
  it('la sexta de La sube, aunque su nota esté por debajo en la octava de los acordes', () => {
    const sexta = earExercises('interval', A, 'major').find(
      (ejercicio) => buena(ejercicio) === 'Sexta mayor',
    )!;
    expect(programaDe(sexta, A, 'major', 100).map((paso) => paso.midis)).toEqual([[69], [78]]);
  });

  it('la que baja, baja, y se cuenta desde la primera nota', () => {
    const bajando = earExercises('interval', C, 'major').find((ejercicio) =>
      ejercicio.prompt.includes('bajando'),
    )!;
    expect(programaDe(bajando, C, 'major', 100).map((paso) => paso.midis)).toEqual([[67], [60]]);
    expect(buena(bajando)).toBe('Quinta justa');
    expect(bajando.why).toContain('De G a C hay 5 nombres —G, F, E, D, C—');
  });

  /**
   * Un intervalo se cuenta por nombres, así que las notas se escriben con su
   * letra: en Fa sostenido mayor la sensible es Mi sostenido, y con los doce
   * nombres de siempre salía «F», que es otra letra y por tanto otro intervalo.
   */
  it('cada nota se escribe con la letra que le toca en su tonalidad', () => {
    const segunda = earExercises('interval', pitchClassFromName('F#'), 'major').find(
      (ejercicio) => buena(ejercicio) === 'Segunda menor',
    )!;
    expect(segunda.why).toContain('De E# a F# hay 2 nombres —E#, F#— y un semitono');

    const enMib = earExercises('interval', Eb, 'major')[0]!;
    expect(enMib.why).toContain('De Eb a F');
  });

  it('una nota suelta se escribe con su nombre, y dos a la vez con los dos', () => {
    expect(sonidoDe({ notes: [1, 3] }, C, 'major')).toEqual({
      root: C,
      notes: [0, 4],
      symbol: 'C y E',
    });
    expect(sonidoDe({ notes: [8] }, C, 'major').symbol).toBe('C');
  });
});

describe('el nombre de un intervalo', () => {
  it.each([
    [2, 1, 'Segunda menor'],
    [3, 4, 'Tercera mayor'],
    [4, 5, 'Cuarta justa'],
    [4, 6, 'Cuarta aumentada'],
    [5, 6, 'Quinta disminuida'],
    [6, 8, 'Sexta menor'],
    [7, 10, 'Séptima menor'],
    [7, 9, 'Séptima disminuida'],
    [8, 12, 'Octava justa'],
  ])('%i nombres y %i semitonos es una %s', (numero, semitonos, nombre) => {
    expect(nombreDelIntervalo(numero, semitonos)).toBe(nombre);
  });

  // Los justos no tienen mayor ni menor, y un número que no es simple no tiene nombre aquí.
  it('no inventa intervalos que no existen', () => {
    expect(() => nombreDelIntervalo(4, 3)).toThrow(RangeError);
    expect(() => nombreDelIntervalo(3, 7)).toThrow(RangeError);
    expect(() => nombreDelIntervalo(1, 0)).toThrow(RangeError);
    expect(() => nombreDelIntervalo(9, 14)).toThrow(RangeError);
  });
});

/**
 * Lo que los porqués afirman, comprobado en lo que suena. Casi todo lo que estaba
 * mal estaba mal **solo en menor**: se escribió pensando en Do mayor y la
 * tonalidad menor heredaba frases que en ella eran falsas.
 */
describe('la teoría de las unidades de oído es verdad en los dos modos', () => {
  const TRIADA_DE_LA_TONICA = (mode: KeyMode) => (mode === 'major' ? [0, 4, 7] : [0, 3, 7]);
  const comunes = (a: readonly number[], b: readonly number[]) =>
    a.filter((nota) => b.includes(nota)).length;

  it('la última de especies es una tríada disminuida', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const ultima = earExercises('quality', tonic, mode).at(-1)!;
      const { root, notes } = sonidoDe(ultima.degrees[0]!, tonic, mode);
      const desdeLaFundamental = notes.map((nota) => normalizePitchClass(nota - root)).sort();
      expect(desdeLaFundamental, `${tonic} ${mode}`).toEqual([0, 3, 6]);
      expect(buena(ultima)).toBe('Disminuido');
    }
  });

  it('el acorde de la relativa es el de la relativa', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const [, , relativa] = earExercises('degree', tonic, mode);
      const { root } = sonidoDe(relativa!.degrees[1]!, tonic, mode);
      // La relativa menor está una sexta mayor arriba; la mayor, una tercera menor.
      expect(normalizePitchClass(root - tonic), `${tonic} ${mode}`).toBe(mode === 'major' ? 9 : 3);
    }
  });

  it('la cadencia rota cae en un acorde que comparte dos notas con la tónica', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const rota = earExercises('cadence', tonic, mode).at(-1)!;
      const ultimo = sobreLaTonica(rota.degrees.at(-1)!, tonic, mode);
      expect(comunes(ultimo, TRIADA_DE_LA_TONICA(mode)), `${tonic} ${mode}`).toBe(2);
      expect(rota.degrees.at(-2)).toBe('V');
    }
  });

  it('la séptima del primer grado está a medio tono en mayor y a un tono en menor', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const [primero] = earExercises('sevenths', tonic, mode);
      const notas = sobreLaTonica(primero!.degrees[1]!, tonic, mode);
      const septima = mode === 'major' ? 11 : 10;
      expect(notas, `${tonic} ${mode}`).toContain(septima);
      expect(primero!.why).toContain(mode === 'major' ? 'medio tono' : 'un tono');
    }
  });

  it('lo que es de casa es de la escala, y lo que viene de fuera trae una nota que no está', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const escala = new Set(scaleNotes(tonic, mode === 'major' ? 'major' : 'naturalMinor'));
      const [deCasa, deFuera, delParalelo] = earExercises('borrowed', tonic, mode);
      const fuera = (ejercicio: EarExercise) =>
        sonidoDe(ejercicio.degrees[1]!, tonic, mode).notes.filter((nota) => !escala.has(nota));

      expect(fuera(deCasa!), `${tonic} ${mode}`).toEqual([]);
      expect(fuera(deFuera!), `${tonic} ${mode}`).toHaveLength(1);
      expect(fuera(delParalelo!).length, `${tonic} ${mode}`).toBeGreaterThan(0);
    }
  });

  /**
   * Del paralelo se trae la tercera contraria: en mayor la menor, que oscurece; en
   * menor la mayor, que aclara. La respuesta tiene que seguir a lo que suena.
   */
  it('lo traído del paralelo aclara u oscurece según lo que le pasa a la tercera', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const delParalelo = earExercises('borrowed', tonic, mode)[2]!;
      const notas = sobreLaTonica(delParalelo.degrees[1]!, tonic, mode);
      const aclara = notas.includes(4) && mode === 'minor';
      const oscurece = notas.includes(3) && mode === 'major';
      expect(aclara || oscurece, `${tonic} ${mode}`).toBe(true);
      expect(buena(delParalelo)).toBe(aclara ? 'Aclara' : 'Oscurece');
    }
  });

  it('con sensible es con sensible, y sin ella es sin ella', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const [conSensible, sinSensible, plagal] = earExercises('modes', tonic, mode);
      const lleva = (ejercicio: EarExercise) =>
        sobreLaTonica(ejercicio.degrees[1]!, tonic, mode).includes(11);

      expect(lleva(conSensible!), `${tonic} ${mode}`).toBe(true);
      expect(lleva(sinSensible!), `${tonic} ${mode}`).toBe(false);
      expect(lleva(plagal!), `${tonic} ${mode}`).toBe(false);
      // Cada modo se nombra a sí mismo, no al de otro.
      expect(conSensible!.why).not.toContain(mode === 'major' ? 'armónico' : 'jónico');
      expect(sinSensible!.why).toContain(mode === 'major' ? 'mixolidio' : 'eólico');
    }
  });

  it('la dominante que «contiene el tritono» lo contiene', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const tensa = earExercises('functions', tonic, mode)[1]!;
      const notas = sobreLaTonica(tensa.degrees[1]!, tonic, mode);
      expect(tensa.why).toContain('tritono');
      // La sensible y el cuarto grado: seis semitonos.
      expect(notas, `${tonic} ${mode}`).toEqual(expect.arrayContaining([11, 5]));
    }
  });

  it('el sexto grado reposa, y el enunciado dice bien cómo suena', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const sexto = earExercises('functions', tonic, mode)[2]!;
      const { root, notes } = sonidoDe(sexto.degrees[1]!, tonic, mode);
      const esMenor = notes.includes(normalizePitchClass(root + 3));
      expect(sexto.prompt, `${tonic} ${mode}`).toContain(esMenor ? 'triste' : 'alegre');
      expect(
        comunes(sobreLaTonica(sexto.degrees[1]!, tonic, mode), TRIADA_DE_LA_TONICA(mode)),
      ).toBe(2);
    }
  });

  it('el sustituto de la tónica llega del V y comparte dos notas con ella', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const sustituto = earExercises('substitutions', tonic, mode)[1]!;
      const ultimo = sobreLaTonica(sustituto.degrees.at(-1)!, tonic, mode);
      expect(comunes(ultimo, TRIADA_DE_LA_TONICA(mode)), `${tonic} ${mode}`).toBe(2);
      // Del V al VI: el sexto grado, mayor o menor según el modo.
      const { root } = sonidoDe(sustituto.degrees.at(-1)!, tonic, mode);
      expect(normalizePitchClass(root - tonic), `${tonic} ${mode}`).toBe(mode === 'major' ? 9 : 8);
      expect(sustituto.degrees.at(-2)).toBe('V');
    }
  });

  it('el plagal nombra el cuarto grado como se escribe en su modo', () => {
    const plagal = earExercises('cadence', A, 'minor')[2]!;
    expect(buena(plagal)).toBe('Con el iv, Dm');
  });
});

/**
 * El oído dice los acordes como los dicen las lecciones de teoría: con la letra
 * de su grado. Con los doce nombres de `resolveDegree`, el vii° de F# mayor era
 * «Fdim» aquí y «E#dim» en la unidad de los grados, y el bVII de Db mayor, «B»
 * aquí y «Cb» en la de intercambio modal.
 */
describe('cada acorde con la letra de su grado', () => {
  const nombre = (name: Parameters<typeof pitchClassFromName>[0]) => pitchClassFromName(name);
  const simbolo = (kind: EarKind, indice: number, paso: number, tonic: PitchClass, mode: KeyMode) =>
    sonidoDe(earExercises(kind, tonic, mode)[indice]!.degrees[paso]!, tonic, mode).symbol;

  it('el disminuido, el prestado, el napolitano y la dominante de la dominante', () => {
    expect(simbolo('quality', 3, 0, nombre('F#'), 'major')).toBe('E#dim');
    expect(simbolo('quality', 3, 0, nombre('D#'), 'minor')).toBe('E#dim');
    expect(simbolo('borrowed', 1, 1, nombre('Db'), 'major')).toBe('Cb');
    expect(simbolo('borrowed', 2, 1, nombre('Db'), 'major')).toBe('Bbb');
    expect(simbolo('borrowed', 1, 1, nombre('Bb'), 'minor')).toBe('Cb');
    expect(simbolo('circle', 1, 1, nombre('D#'), 'minor')).toBe('E#');
    // Lo de siempre no cambia.
    expect(simbolo('quality', 3, 0, C, 'major')).toBe('Bdim');
    expect(simbolo('borrowed', 1, 1, C, 'major')).toBe('Bb');
    expect(simbolo('circle', 1, 1, A, 'minor')).toBe('B');
  });

  it('en las veinticuatro, el disminuido de oído es el de la lista de grados', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const disminuido = simbolo('quality', 3, 0, tonic, mode);
      expect(lessonNotes('degrees', tonic, mode).points[0], `${tonic} ${mode}`).toContain(
        ` ${disminuido}`,
      );
    }
  });

  it('el sustituto tritonal se queda con el nombre que le da la lección de sustituciones', () => {
    // En Db mayor sería en rigor Ebb7, y la lección lo escribe D7: el oído también.
    expect(simbolo('substitutions', 2, 2, nombre('Db'), 'major')).toBe('D7');
  });
});

/** Los porqués que decían algo que no es verdad, o que no se ha explicado todavía. */
describe('lo que explican los porqués', () => {
  it('el mayor y el menor no comparten la quinta: comparten que es justa', () => {
    expect(earExercises('quality', C, 'major')[1]!.why).toContain('la quinta es justa en los dos');
  });

  it('la relativa y la vecina se explican sin dominantes secundarias, que son de Profesional', () => {
    for (const [tonic, mode] of TONALIDADES) {
      const [, , paseo] = earExercises('circle', tonic, mode);
      expect(paseo!.why, `${tonic} ${mode}`).not.toContain('secundaria');
    }
    expect(earExercises('circle', C, 'major')[2]!.why).toContain('su tercera es la sensible de G');
  });

  it('el napolitano se anuncia en el oído, que va un curso antes que su lección', () => {
    expect(earExercises('borrowed', A, 'minor')[1]!.why).toContain(
      'En el curso que viene se estudia como napolitana',
    );
  });
});
