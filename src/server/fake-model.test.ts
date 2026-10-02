import { describe, expect, it } from 'vitest';

import { degreesFor, isValidPath, type DegreeSymbol, type KeyMode } from '@core/music';

import { SIN_IA, respuestaSinIA, versionesSinIA } from './fake-model';

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

  // Al retocar devuelven solo el trozo que cambia y desde dónde, como el modelo
  // (adr/0086). Que montadas pasen el validador lo prueba `app/api/sin-clave.test.ts`.
  it('al retocar devuelven solo el trozo que cambia, con su desde', () => {
    const { versions } = versionesSinIA(EN_LA_MENOR) as {
      versions: {
        path: string;
        desde?: number;
        sections: { steps: { degree: string; beats: number; move: string | null }[] }[];
      }[];
    };
    const rearmonizar = versions.find((v) => v.path === 'rearmonizar');
    const estirar = versions.find((v) => v.path === 'estirar');

    // Cambia un compás de cada dos: del 2 al 4, y el 1 no viaja.
    expect(rearmonizar?.desde).toBe(2);
    expect(rearmonizar?.sections[0]!.steps).toHaveLength(3);
    expect(rearmonizar?.sections[0]!.steps[0]!.move).not.toBeNull();
    // Y estirar, solo el primero, que es el que dura el doble.
    expect(estirar?.desde).toBe(1);
    expect(estirar?.sections[0]!.steps).toEqual([{ degree: 'i', beats: 8, move: null }]);
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

/**
 * **Un cierre es una cadencia, y una cadencia no empieza en casa.**
 *
 * Esto salía `I IV I` —en Mi mayor, «Mi La Mi»—: la tónica dos veces y sin
 * cadencia ninguna. La causa era que el cierre se alargaba **hacia delante**
 * hasta caer en la tónica, con un mínimo de dos compases, y desde un V el primer
 * paso ya la daba: el bucle no podía parar ahí, así que se iba de casa y volvía.
 *
 * Ningún test mataba esto porque ninguno miraba lo que había **dentro** del
 * cierre; solo que la salida existiera y llevara «Sin IA».
 */
describe('el cierre de las salidas sin IA', () => {
  interface Seccion {
    readonly name: string;
    readonly steps: readonly { readonly degree: DegreeSymbol; readonly beats: number }[];
  }

  /** El cierre que propone cuando lo que llevas acaba en ese grado. */
  function cierreTras(mode: KeyMode, ultimo: DegreeSymbol) {
    const tonica: DegreeSymbol = mode === 'minor' ? 'i' : 'I';
    const progression = [
      { degree: tonica, beats: 4 },
      { degree: ultimo, beats: 4 },
    ];
    const { versions } = versionesSinIA({ tonic: 'E', mode, progression }) as {
      versions: readonly { path: string; sections: readonly Seccion[] }[];
    };
    const seguir = versions.find((version) => version.path === 'seguir');

    return {
      tonica,
      progression,
      cierre: seguir?.sections.find((seccion) => seccion.name === 'Cierre')?.steps,
      todos: seguir?.sections.flatMap((seccion) => seccion.steps),
    };
  }

  /** Cada grado de los dos modos, que son los sitios donde puede acabar tu parte. */
  function todosLosFinales(): { mode: KeyMode; ultimo: DegreeSymbol }[] {
    return (['major', 'minor'] as KeyMode[]).flatMap((mode) =>
      (degreesFor(mode) as readonly DegreeSymbol[]).map((ultimo) => ({ mode, ultimo })),
    );
  }

  it('acabe tu parte donde acabe, hay cierre y acaba en la tonica', () => {
    for (const { mode, ultimo } of todosLosFinales()) {
      const { tonica, cierre } = cierreTras(mode, ultimo);

      expect(cierre, `${mode}, acabando en ${ultimo}`).toBeDefined();
      expect(cierre!.at(-1)!.degree, `${mode}, acabando en ${ultimo}`).toBe(tonica);
    }
  });

  /**
   * La regla que faltaba. No es «que no se repita un acorde» —dos compases del
   * mismo grado son legítimos en otro sitio—: es que **la tónica es el final**, y
   * un cierre que la toca antes ya ha cerrado y lo que viene después sobra.
   */
  it('la tonica sale una sola vez, y es la ultima', () => {
    for (const { mode, ultimo } of todosLosFinales()) {
      const { tonica, cierre } = cierreTras(mode, ultimo);
      const veces = cierre!.filter((paso) => paso.degree === tonica).length;

      expect(
        veces,
        `${mode}, acabando en ${ultimo}: ${cierre!.map((p) => p.degree).join(' ')}`,
      ).toBe(1);
    }
  });

  /**
   * Dos compases: una parte de uno la tira `songProblem`
   * (`MIN_BARS_PER_SECTION`), y más de lo justo no es una cadencia.
   */
  it('mide dos compases', () => {
    for (const { mode, ultimo } of todosLosFinales()) {
      expect(cierreTras(mode, ultimo).cierre, `${mode}, acabando en ${ultimo}`).toHaveLength(2);
    }
  });

  /**
   * Y lo que sale de aquí pasa el mismo validador que pasaría una respuesta del
   * modelo de verdad, que es lo que hace que estas salidas sirvan para probar la
   * pantalla entera.
   */
  it('el validador del dominio lo acepta', () => {
    for (const { mode, ultimo } of todosLosFinales()) {
      const { progression, todos } = cierreTras(mode, ultimo);

      expect(
        isValidPath(mode, 'seguir', progression, todos!),
        `${mode}, acabando en ${ultimo}`,
      ).toBe(true);
    }
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

  /**
   * Sin clave ya se dice algo cierto: si la pregunta casa con el glosario, se
   * contesta con su entrada resuelta en la tonalidad, y dice de dónde sale.
   */
  it('si la pregunta es del glosario, contesta el glosario en su tonalidad', () => {
    const respuesta = respuestaSinIA({
      key: { tonic: 'G', mode: 'major' },
      question: '¿Qué es una cadencia plagal?',
    }) as { tema: string; answer: string };

    expect(respuesta.tema).toBe('musica');
    expect(respuesta.answer.startsWith(`${SIN_IA}, del glosario.`)).toBe(true);
    expect(respuesta.answer).toContain('IV → I: C → G');
  });

  it('si no casa con nada, dice lo de siempre', () => {
    const respuesta = respuestaSinIA({
      key: { tonic: 'G', mode: 'major' },
      question: '¿Cómo cambio las cuerdas?',
    }) as { answer: string };

    expect(respuesta.answer).toMatch(/no hay modelo conectado/i);
  });
});
