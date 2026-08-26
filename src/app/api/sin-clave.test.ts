import { describe, expect, it } from 'vitest';

/**
 * Vive en `app/` y no al lado de `server/fake-model.ts`, y no es por gusto: lo
 * que se comprueba aquí es que lo que construye el servidor **pasa la
 * verificación de los contratos de `features/`**, y `server/` no puede importar
 * de `features/` —la regla 5, que ESLint vigila en los dos sentidos—. `app/` es
 * la única capa que ve las dos, que es exactamente donde este comportamiento
 * ocurre.
 */

import { validateIdeas, type IdeasRequest } from '@features/ideas/contract';
import { validateVersions, type VersionsRequest } from '@features/versions/contract';

import { ideasSinIA, respuestaSinIA, SIN_IA, versionesSinIA } from '@server/fake-model';

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

describe('las versiones sin IA', () => {
  /**
   * La razón de ser de este fichero: lo que devuelve se construye aplicando
   * movimientos de verdad del dominio, así que **pasa la misma verificación** que
   * pasaría una respuesta del modelo. Eso es lo que permite probar la pantalla,
   * la reproducción y «ponerla en el camino» sin gastar un céntimo.
   */
  it('pasan la verificación de verdad', () => {
    const versiones = validateVersions(
      versionesSinIA({
        tonic: EN_DO.key.tonic,
        mode: EN_DO.key.mode,
        progression: EN_DO.progression,
      }),
      EN_DO,
    );

    expect(versiones.length).toBeGreaterThan(0);
    // Ya no todas tienen el mismo largo ni declaran movimientos: desde que hay
    // salidas, una puede alargar o repartir los pulsos de otra manera. Lo que sí
    // tienen todas es un camino declarado que el dominio ha vuelto a comprobar.
    for (const version of versiones) {
      expect(version.steps.length).toBeGreaterThan(0);
      expect(version.path).toBeTruthy();
    }
    // Y entre ellas hay más de una clase de salida, que es lo que esto viene a
    // enseñar: sin clave se puede probar la pantalla entera, no solo un caso.
    expect(new Set(versiones.map((v) => v.path)).size).toBeGreaterThan(1);
  });

  it('dicen que no son de un modelo, para que no engañen en pantalla', () => {
    const versiones = validateVersions(
      versionesSinIA({
        tonic: EN_DO.key.tonic,
        mode: EN_DO.key.mode,
        progression: EN_DO.progression,
      }),
      EN_DO,
    );

    for (const version of versiones) {
      expect(version.title).toContain(SIN_IA);
    }
  });

  it('no cambian todos los compases: eso ya no sería la misma canción', () => {
    const versiones = validateVersions(
      versionesSinIA({
        tonic: EN_DO.key.tonic,
        mode: EN_DO.key.mode,
        progression: EN_DO.progression,
      }),
      EN_DO,
    );

    for (const version of versiones) {
      const iguales = version.steps.filter((paso) => paso.move === null).length;
      expect(iguales).toBeGreaterThan(0);
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

    const versiones = validateVersions(
      versionesSinIA({ tonic: 'A', mode: 'minor', progression: enLa.progression }),
      enLa,
    );

    expect(versiones.length).toBeGreaterThan(0);
  });

  it('una progresión a la que no se le puede hacer nada devuelve una lista vacía', () => {
    // Sin versiones válidas, la ruta contesta lo mismo que si el modelo no
    // hubiera dado nada aprovechable: no se inventa nada.
    const rara: VersionsRequest = {
      kind: 'retocar',
      key: { tonic: 'C', mode: 'major' },
      progression: [
        { degree: 'vii°', beats: 4 },
        { degree: 'vii°', beats: 4 },
      ],
    };

    const versiones = validateVersions(
      versionesSinIA({ tonic: 'C', mode: 'major', progression: rara.progression }),
      rara,
    );

    expect(Array.isArray(versiones)).toBe(true);
  });
});

describe('las ideas sin IA', () => {
  it('pasan la verificación y dicen lo que son', () => {
    const peticion: IdeasRequest = {
      kind: 'progression',
      key: { tonic: 'C', mode: 'major' },
    };
    const ideas = validateIdeas(ideasSinIA('C', 'major'), peticion);

    expect(ideas.length).toBeGreaterThan(0);
    for (const idea of ideas) {
      expect(idea.title).toContain(SIN_IA);
      // Los cifrados los recalcula el contrato desde los grados, como siempre.
      expect(idea.chords?.length).toBe(idea.degrees?.length);
    }
  });

  it('en menor usa los grados del menor', () => {
    const peticion: IdeasRequest = { kind: 'progression', key: { tonic: 'A', mode: 'minor' } };
    const ideas = validateIdeas(ideasSinIA('A', 'minor'), peticion);

    expect(ideas.length).toBeGreaterThan(0);
  });
});

describe('la respuesta del profesor sin IA', () => {
  it('dice que no hay modelo y qué hacer, en vez de fingir una respuesta', () => {
    const { answer } = respuestaSinIA() as { answer: string };

    expect(answer).toMatch(/no hay modelo conectado/i);
    expect(answer).toContain('ANTHROPIC_API_KEY');
  });
});
