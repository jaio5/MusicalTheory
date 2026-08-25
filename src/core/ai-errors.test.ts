import { describe, expect, it } from 'vitest';

import { AI_ERROR_CODES, aiError, type AiErrorCode } from './ai-errors';

const MENSAJES: Readonly<Record<AiErrorCode, string>> = Object.fromEntries(
  AI_ERROR_CODES.map((code) => [code, `frase de ${code}`]),
) as Record<AiErrorCode, string>;

describe('los errores de la IA', () => {
  it('pone la frase que le toca al código', () => {
    expect(aiError('quota_exhausted', MENSAJES)).toEqual({
      error: { code: 'quota_exhausted', message: 'frase de quota_exhausted' },
    });
  });

  it('deja reescribirla con lo concreto', () => {
    // El candado dice qué plan hace falta y cuánto cuesta; el cupo, cuántas
    // peticiones eran. Un mensaje genérico obligaría a adivinar.
    expect(aiError('plan_required', MENSAJES, 'Entra en el plan Pro: 19,99 € al mes.')).toEqual({
      error: { code: 'plan_required', message: 'Entra en el plan Pro: 19,99 € al mes.' },
    });
  });

  it('los siete tienen frase, sin huecos', () => {
    for (const code of AI_ERROR_CODES) {
      expect(aiError(code, MENSAJES).error.message, `${code} sin frase`).not.toBe('');
    }
  });
});

describe('las tres rutas hablan el mismo idioma', () => {
  /**
   * Los siete códigos estuvieron declarados tres veces idénticos, y el tercero
   * se escribió copiando el primero. Ahora son un alias del compartido, así que
   * esto no puede separarse; lo que sí puede es que a una le falte una frase.
   */
  it('las tres traen una frase por código', async () => {
    const contratos = await Promise.all([
      import('../features/ideas/contract'),
      import('../features/versions/contract'),
      import('../features/learn/teacher-contract'),
    ]);
    const mensajes = [
      contratos[0].ERROR_MESSAGES,
      contratos[1].ERROR_MESSAGES,
      contratos[2].TEACHER_ERROR_MESSAGES,
    ];

    for (const tabla of mensajes) {
      expect(Object.keys(tabla).sort()).toEqual([...AI_ERROR_CODES].sort());
      for (const frase of Object.values(tabla)) {
        expect(frase.length).toBeGreaterThan(20);
      }
    }
  });

  it('cada una explica lo suyo, y no las tres la misma frase', async () => {
    // El vocabulario se comparte; lo que se dice con él, no. Si las tres tablas
    // acabaran siendo la misma, compartirlas sería lo correcto y este fichero
    // estaría a medias.
    const contratos = await Promise.all([
      import('../features/ideas/contract'),
      import('../features/versions/contract'),
      import('../features/learn/teacher-contract'),
    ]);

    const suyas = [
      contratos[0].ERROR_MESSAGES.plan_required,
      contratos[1].ERROR_MESSAGES.plan_required,
      contratos[2].TEACHER_ERROR_MESSAGES.plan_required,
    ];

    expect(new Set(suyas).size).toBe(3);
  });
});
