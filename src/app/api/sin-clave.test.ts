import { describe, expect, it } from 'vitest';

/**
 * Vive en `app/` y no al lado de `server/fake-model.ts`, y no es por gusto: lo
 * que se comprueba aquí es que lo que construye el servidor **pasa la
 * verificación de los contratos de `features/`**, y `server/` no puede importar
 * de `features/` —la regla 5, que ESLint vigila en los dos sentidos—. `app/` es
 * la única capa que ve las dos, que es exactamente donde este comportamiento
 * ocurre.
 */

import { validateTeacherAnswer } from '@features/learn/teacher-contract';
import { validateVersions, type VersionsRequest } from '@features/versions/contract';
import { lasTresMejores, salidasDe } from '@features/versions/menu';

import { respuestaSinIA, SIN_IA, versionesSinIA } from '@server/fake-model';

const EN_DO: VersionsRequest = {
  key: { tonic: 'C', mode: 'major' },
  kind: 'retocar',
  progression: [
    { degree: 'I', beats: 4 },
    { degree: 'V', beats: 4 },
    { degree: 'vi', beats: 4 },
    { degree: 'IV', beats: 4 },
  ],
};

/** Lo que contesta el modelo que no piensa, ya validado contra el contrato. */
function sinIA(request: VersionsRequest) {
  return validateVersions(
    versionesSinIA({
      menu: salidasDe(request),
      elegidas: lasTresMejores(salidasDe(request), request.progression).map((i) => i + 1),
    }),
    request,
  );
}

describe('las versiones sin IA', () => {
  /**
   * La razón de ser de este fichero: lo que devuelve son salidas del mismo menú
   * que se le da al modelo, elegidas por número igual que él, así que **pasa la
   * misma verificación**. Eso es lo que permite probar la pantalla, la
   * reproducción y «ponerla en el camino» sin gastar un céntimo.
   */
  it('pasan la verificación de verdad, y son de más de un camino', () => {
    for (const kind of ['retocar', 'continuar'] as const) {
      const versiones = sinIA({ ...EN_DO, kind });

      expect(versiones.length, kind).toBeGreaterThan(1);
      expect(new Set(versiones.map((v) => v.path)).size, kind).toBeGreaterThan(1);
    }
  });

  it('dicen que no son de un modelo, para que no engañen en pantalla', () => {
    for (const version of sinIA(EN_DO)) {
      expect(version.title).toContain(SIN_IA);
    }
  });

  it('en menor también salen, y también pasan', () => {
    const enLa: VersionsRequest = {
      kind: 'retocar',
      key: { tonic: 'A', mode: 'minor' },
      progression: [
        { degree: 'i', beats: 4 },
        { degree: 'VI', beats: 4 },
        { degree: 'iv', beats: 4 },
        { degree: 'V', beats: 4 },
      ],
    };

    expect(sinIA(enLa).length).toBeGreaterThan(0);
  });

  it('una progresión con poco que hacer da lo que haya, sin inventar', () => {
    const rara: VersionsRequest = {
      kind: 'retocar',
      key: { tonic: 'C', mode: 'major' },
      progression: [
        { degree: 'vii°', beats: 4 },
        { degree: 'vii°', beats: 4 },
      ],
    };

    expect(Array.isArray(sinIA(rara))).toBe(true);
  });
});

describe('la respuesta del profesor sin IA', () => {
  it('dice que no hay modelo y qué hacer, en vez de fingir una respuesta', () => {
    const { answer } = respuestaSinIA() as { answer: string };

    expect(answer).toMatch(/no hay modelo conectado/i);
    expect(answer).toContain('ANTHROPIC_API_KEY');
  });

  /**
   * Lo que contesta el glosario pasa el mismo validador que la respuesta de un
   * modelo, en todas las cadencias y en los dos modos: es la misma teoría que va
   * en el prompt, así que si no lo pasara, el validador estaría rechazando la
   * referencia que se le da al modelo.
   */
  it('lo que contesta el glosario pasa la comprobación del profesor', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const question of [
        '¿Qué es una cadencia perfecta?',
        '¿Qué es una cadencia plagal?',
        '¿Qué es una cadencia rota?',
        '¿Qué es una semicadencia?',
        '¿Cuál es la relativa?',
      ]) {
        const peticion = { key: { tonic: 'E' as const, mode }, question };
        const validada = validateTeacherAnswer(respuestaSinIA(peticion), peticion);

        expect(validada?.answer, `${question} en ${mode}`).toContain(SIN_IA);
      }
    }
  });
});
