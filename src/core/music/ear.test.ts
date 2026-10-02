import { describe, expect, it } from 'vitest';

import { EAR_KINDS, earExercises, gradoDe, sonidoDe, type EarKind } from './ear';
import { pitchClassFromName, type PitchClass } from './notes';
import { degreesFor } from './progressions';
import { scaleNotes } from './scales';

const C = pitchClassFromName('C');
const Eb = pitchClassFromName('Eb');
const A = pitchClassFromName('A');

const CLASES = Object.keys(EAR_KINDS) as EarKind[];

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
    for (const kind of ['quality', 'cadence'] as const) {
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
  const TONALIDADES = Array.from({ length: 12 }, (_, tonic) => tonic as PitchClass).flatMap(
    (tonic) => (['major', 'minor'] as const).map((mode) => [tonic, mode] as const),
  );

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
