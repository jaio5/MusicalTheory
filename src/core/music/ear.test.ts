import { describe, expect, it } from 'vitest';

import { EAR_KINDS, earExercises, type EarKind } from './ear';
import { pitchClassFromName } from './notes';
import { degreesFor } from './progressions';

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
        for (const grado of ejercicio.degrees) {
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
