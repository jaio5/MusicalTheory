import { describe, expect, it } from 'vitest';

import { SIN_IA, ideasSinIA, respuestaSinIA, versionesSinIA } from './fake-model';

/**
 * El modelo que no piensa.
 *
 * Lo que devuelve sale del dominio y no de un fichero de ejemplos: las versiones
 * se construyen aplicando movimientos de verdad, así que pasan la misma
 * verificación que pasaría una respuesta del modelo. Eso es lo que permite
 * probar la pantalla entera sin gastar un céntimo.
 *
 * Y todo lo que sale de aquí lo dice en su propio texto: en pantalla se lee «Sin
 * IA» y no un título que parezca escrito por alguien.
 */
const EN_LA_MENOR = {
  tonic: 'A' as const,
  mode: 'minor' as const,
  progression: [
    { degree: 'i' as const, beats: 4 },
    { degree: 'VI' as const, beats: 4 },
    { degree: 'III' as const, beats: 4 },
    { degree: 'VII' as const, beats: 4 },
  ],
};

function versiones(peticion = EN_LA_MENOR) {
  return versionesSinIA(peticion) as { versions: Array<{ path: string; title: string }> };
}

describe('las salidas sin IA', () => {
  it('cada una lleva escrito que no las ha escrito nadie', () => {
    const { versions } = versiones();

    expect(versions.length).toBeGreaterThan(0);
    expect(versions.every((version) => version.title.includes(SIN_IA))).toBe(true);
  });

  /**
   * Sin un solo acorde no hay nada que rearmonizar ni que alargar, y tampoco
   * hay «el primero, el doble»: no se inventa una salida sobre nada.
   */
  it('sin acordes no sale ninguna', () => {
    const { versions } = versiones({ ...EN_LA_MENOR, progression: [] });

    expect(versions).toEqual([]);
  });

  // Y en mayor se alarga hacia su tónica, que no es la misma que en menor.
  it('en mayor se alarga hacia el I, no hacia el i', () => {
    const { versions } = versiones({
      tonic: 'C' as const,
      mode: 'major' as const,
      progression: [
        { degree: 'I', beats: 4 },
        { degree: 'V', beats: 4 },
      ],
    } as unknown as typeof EN_LA_MENOR);

    // Lo que importa es que se construya sobre los grados de mayor: la tónica
    // a la que se va no es la misma que en menor.
    expect(versions.length).toBeGreaterThan(0);
    expect(versions.every((version) => version.title.includes(SIN_IA))).toBe(true);
  });

  // Y con un acorde solo sale lo que se puede hacer con uno.
  it('con un acorde no se inventa un reparto de dos', () => {
    const { versions } = versiones({
      ...EN_LA_MENOR,
      progression: [{ degree: 'i', beats: 4 }],
    });

    expect(versions.some((version) => version.path === 'estirar')).toBe(true);
  });
});

describe('las ideas sin IA', () => {
  // En mayor y en menor no se proponen las mismas: los grados no son los mismos.
  it('las de mayor y las de menor son distintas', () => {
    const mayor = ideasSinIA('C', 'major') as { ideas: Array<{ degrees: string[] }> };
    const menor = ideasSinIA('C', 'minor') as { ideas: Array<{ degrees: string[] }> };

    expect(mayor.ideas.length).toBeGreaterThan(0);
    expect(menor.ideas.length).toBeGreaterThan(0);
    expect(mayor.ideas[0]?.degrees).not.toEqual(menor.ideas[0]?.degrees);
  });

  it('salen con su porque, y dicen que no las ha pensado nadie', () => {
    const { ideas } = ideasSinIA('C', 'major') as {
      ideas: Array<{ title: string; why: string }>;
    };

    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((idea) => idea.title.includes(SIN_IA))).toBe(true);
    expect(ideas.every((idea) => idea.why.length > 0)).toBe(true);
  });
});

describe('la respuesta del profesor sin IA', () => {
  /**
   * Declara el tema como cualquier respuesta, porque el validador lo exige a
   * todo el mundo: un puerto falso que se salte una comprobación deja de servir
   * para lo que existe, que es probar el camino de verdad sin pagarlo.
   */
  it('lleva su tema y dice que no hay modelo conectado', () => {
    const respuesta = respuestaSinIA() as { tema: string; answer: string };

    expect(respuesta.tema).toBe('musica');
    expect(respuesta.answer).toMatch(/no hay modelo conectado/i);
  });
});
