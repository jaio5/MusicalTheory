import { describe, expect, it } from 'vitest';

import {
  MAX_IDEAS,
  MAX_QUESTION_LENGTH,
  MAX_RECENT_CHORDS,
  MAX_RECENT_NOTES,
  TOKEN_BUDGETS,
} from '@core/billing';

import { ANSWER_SCHEMA, IDEAS_SCHEMA, IDEAS_SYSTEM_PROMPT, TEACHER_SYSTEM_PROMPT } from './prompts';

/**
 * El guardián del modelo de coste.
 *
 * Los cupos de todos los planes se calculan dividiendo el presupuesto del plan
 * entre el peor caso de una petición, y ese peor caso incluye una **estimación**
 * de los tokens de entrada: el prompt de sistema, los datos de la tonalidad y el
 * esquema de salida. La estimación está en `core/billing/cost.ts`.
 *
 * El día que alguien alargue un prompt de sistema, esa estimación se queda corta y
 * los cupos empiezan a prometer más de lo que hay dinero para pagar, en silencio y
 * sin que nada falle. Este test es lo que hace ruido: mide los prompts de verdad y
 * comprueba que siguen cabiendo.
 *
 * No cuenta tokens de verdad —para eso hace falta llamar a `count_tokens`, y eso
 * pide clave y red—: cuenta caracteres y divide. Es una aproximación, y por eso el
 * presupuesto lleva holgura de sobra; lo que este test detecta no es un carácter de
 * más, es un prompt que ha doblado de tamaño.
 */

/**
 * Caracteres por token en español, a la baja.
 *
 * El tokenizador saca entre 3,5 y 4 caracteres por token en texto español normal.
 * Se usa 3,2 —menos caracteres por token, o sea más tokens— porque equivocarse a
 * favor del gasto es lo que no puede pasar aquí.
 */
const CHARS_PER_TOKEN = 3.2;

function estimatedTokens(...texts: readonly string[]): number {
  const chars = texts.reduce((total, text) => total + text.length, 0);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/** El esquema de salida también viaja como entrada, y también se paga. */
function schemaText(schema: unknown): string {
  return JSON.stringify(schema);
}

describe('el presupuesto de tokens del profesor', () => {
  it('el prompt de sistema, el esquema y la pregunta más larga caben', () => {
    // Lo que la ruta manda como mucho: sistema + esquema + los datos de la
    // tonalidad (unos 300 caracteres entre grados, escala y tema) + la pregunta.
    const datos = 'x'.repeat(300 + MAX_QUESTION_LENGTH);
    const estimado = estimatedTokens(TEACHER_SYSTEM_PROMPT, schemaText(ANSWER_SCHEMA), datos);

    expect(estimado).toBeLessThanOrEqual(TOKEN_BUDGETS.profesor.input);
  });

  // Si esto falla, no es que el test esté mal: es que el prompt ha crecido tanto
  // que el modelo de coste está mintiendo y hay que recalcular los cupos.
  it('queda holgura, para que un retoque del prompt no descuadre los cupos', () => {
    const estimado = estimatedTokens(TEACHER_SYSTEM_PROMPT, schemaText(ANSWER_SCHEMA));

    expect(estimado).toBeLessThan(TOKEN_BUDGETS.profesor.input * 0.7);
  });
});

describe('el presupuesto de tokens de las ideas', () => {
  it('el prompt de sistema, el esquema y el contexto más largo caben', () => {
    // Lo peor: notas y acordes recientes hasta su tope, más los grados válidos.
    const notas = 'Ab '.repeat(MAX_RECENT_NOTES);
    const acordes = 'Cmaj7 '.repeat(MAX_RECENT_CHORDS);
    const grados = 'bVII, '.repeat(20);
    const estimado = estimatedTokens(
      IDEAS_SYSTEM_PROMPT,
      schemaText(IDEAS_SCHEMA),
      notas,
      acordes,
      grados,
    );

    expect(estimado).toBeLessThanOrEqual(TOKEN_BUDGETS.ideas.input);
  });

  it('queda holgura', () => {
    const estimado = estimatedTokens(IDEAS_SYSTEM_PROMPT, schemaText(IDEAS_SCHEMA));

    expect(estimado).toBeLessThan(TOKEN_BUDGETS.ideas.input * 0.7);
  });
});

describe('los topes de salida', () => {
  /**
   * El tope de salida no es una estimación: es el `max_tokens` que la ruta impone,
   * así que el peor caso del modelo de coste es exacto por construcción. Lo único
   * que hay que comprobar es que sigue habiendo sitio para lo que se promete.
   */
  it('el profesor tiene sitio para una respuesta de tres frases con ejemplo', () => {
    // Tres frases largas en español son unas 90 palabras; con el JSON y el ejemplo
    // en grados, unos 200 tokens. El tope deja margen para el doble.
    expect(TOKEN_BUDGETS.profesor.output).toBeGreaterThanOrEqual(400);
  });

  it('las ideas tienen sitio para las cuatro que como mucho se piden', () => {
    // Cada idea son un título corto, una frase y unos grados: unos 60 tokens.
    expect(TOKEN_BUDGETS.ideas.output).toBeGreaterThanOrEqual(MAX_IDEAS * 60);
  });

  // Una idea cuesta más que una pregunta, y el reparto de topes tiene que
  // reflejarlo o el cupo del plan con ideas saldría mal.
  it('una tanda de ideas puede ser más larga que una respuesta del profesor', () => {
    expect(TOKEN_BUDGETS.ideas.output).toBeGreaterThan(TOKEN_BUDGETS.profesor.output);
  });
});
