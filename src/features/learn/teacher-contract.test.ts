import { describe, expect, it } from 'vitest';

import {
  MAX_ANSWER_LENGTH,
  MAX_QUESTION_LENGTH,
  parseTeacherRequest,
  validateTeacherAnswer,
  type TeacherRequest,
} from './teacher-contract';

const IN_C: TeacherRequest = { key: { tonic: 'C', mode: 'major' }, question: '¿Qué es el V?' };

describe('Petición al profesor', () => {
  it('acepta lo mínimo: tonalidad y pregunta', () => {
    expect(
      parseTeacherRequest({ key: { tonic: 'C', mode: 'major' }, question: '¿Y el V?' }),
    ).toEqual({ key: { tonic: 'C', mode: 'major' }, question: '¿Y el V?' });
  });

  it('rechaza lo que no trae tonalidad o pregunta', () => {
    expect(parseTeacherRequest({ question: 'hola' })).toBeNull();
    expect(parseTeacherRequest({ key: { tonic: 'C', mode: 'major' } })).toBeNull();
    expect(
      parseTeacherRequest({ key: { tonic: 'H', mode: 'major' }, question: 'hola' }),
    ).toBeNull();
    expect(parseTeacherRequest({ key: { tonic: 'C', mode: 'raro' }, question: 'hola' })).toBeNull();
    expect(parseTeacherRequest({ key: { tonic: 'C', mode: 'major' }, question: '   ' })).toBeNull();
    expect(parseTeacherRequest(null)).toBeNull();
  });

  it('recorta una pregunta larga en vez de rechazarla', () => {
    const parsed = parseTeacherRequest({
      key: { tonic: 'C', mode: 'major' },
      question: 'a'.repeat(500),
    });

    expect(parsed?.question).toHaveLength(MAX_QUESTION_LENGTH);
  });

  it('ignora los campos que no reconoce', () => {
    const parsed = parseTeacherRequest({
      key: { tonic: 'C', mode: 'major' },
      question: 'hola',
      scale: 'inventada',
      apiKey: 'no',
    });

    expect(parsed).toEqual({ key: { tonic: 'C', mode: 'major' }, question: 'hola' });
  });
});

describe('Respuesta del profesor', () => {
  it('acepta una respuesta de texto', () => {
    expect(validateTeacherAnswer({ answer: 'El V tira al I.' }, IN_C)).toEqual({
      answer: 'El V tira al I.',
    });
  });

  it('rechaza una respuesta vacía o sin texto', () => {
    expect(validateTeacherAnswer({ answer: '' }, IN_C)).toBeNull();
    expect(validateTeacherAnswer({ answer: 42 }, IN_C)).toBeNull();
    expect(validateTeacherAnswer(null, IN_C)).toBeNull();
  });

  it('recalcula los cifrados del ejemplo desde los grados', () => {
    const result = validateTeacherAnswer(
      { answer: 'Prueba esto.', example: { degrees: ['I', 'V', 'vi', 'IV'], chords: ['X', 'Y'] } },
      IN_C,
    );

    expect(result?.example?.chords).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('descarta un ejemplo con grados que no existen en ese modo', () => {
    const result = validateTeacherAnswer(
      { answer: 'Prueba esto.', example: { degrees: ['I', 'inventado'] } },
      IN_C,
    );

    expect(result?.answer).toBe('Prueba esto.');
    expect(result?.example).toBeUndefined();
  });

  it('recorta una respuesta larguísima', () => {
    const result = validateTeacherAnswer({ answer: 'a'.repeat(2000) }, IN_C);

    expect(result?.answer).toHaveLength(MAX_ANSWER_LENGTH);
  });
});
