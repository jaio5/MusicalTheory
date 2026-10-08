import { describe, expect, it } from 'vitest';

import { degreesFor, salidasPosibles, type DegreeSymbol, type KeyMode } from '@core/music';

import { SIN_IA, respuestaSinIA, salidasSinIA } from './fake-model';

/**
 * El modelo que no piensa.
 *
 * Contesta como el modelo: **un número del menú, un título y un porqué**. El menú
 * se lo da la ruta, el mismo que se le enseña al modelo, y la ruta decide también
 * cuáles contesta (`lasTresMejores`). Que montado pase el contrato lo prueba
 * `app/api/sin-clave.test.ts`, que es la capa que ve los dos lados.
 *
 * Y todo lo que sale de aquí lo dice en su propio texto: en pantalla se lee «Sin
 * IA» y no un título que parezca escrito por alguien.
 */
const MENU = salidasPosibles('minor', 'retocar', [
  { degree: 'i', beats: 4 },
  { degree: 'VI', beats: 4 },
  { degree: 'III', beats: 4 },
  { degree: 'VII', beats: 4 },
]);

function versiones(peticion: Parameters<typeof salidasSinIA>[0] = { menu: MENU }) {
  return salidasSinIA(peticion).versions;
}

describe('las salidas sin IA', () => {
  it('sin decir cuáles, las tres primeras del menú, en su orden', () => {
    expect(MENU.length).toBeGreaterThan(3);
    expect(versiones().map((v) => v.opcion)).toEqual([1, 2, 3]);
  });

  it('las que le dicen, por su número, y nunca una que el menú no tiene', () => {
    expect(versiones({ menu: MENU, elegidas: [1, 3, 4] }).map((v) => v.opcion)).toEqual([1, 3, 4]);
    expect(
      versiones({ menu: MENU.slice(0, 3), elegidas: [1, 3, 4, 9] }).map((v) => v.opcion),
    ).toEqual([1, 3]);
  });

  it('cada una lleva escrito que no las ha escrito nadie, y lo que hace', () => {
    versiones().forEach((version, i) => {
      expect(version.title).toBe(`${SIN_IA} · ${MENU[i]!.nombre}`);
      expect(version.why).toBe(MENU[i]!.que);
    });
  });

  it('el porqué es el del juez, y si no hay ninguno, lo que hace', () => {
    const elegidas = versiones({
      menu: MENU,
      elegidas: [1, 3, 4],
      porques: ['V I: cierra.', 'x', ''],
    });

    expect(elegidas.map((v) => v.why)).toEqual([
      'V I: cierra.',
      // La tercera no tiene motivo, y la cuarta ni siquiera viene.
      MENU[2]!.que,
      MENU[3]!.que,
    ]);
  });

  it('sin menú no sale ninguna', () => {
    expect(versiones({ menu: [] })).toEqual([]);
  });
});

/**
 * **Un cierre es una cadencia, y una cadencia no empieza en casa.**
 *
 * Esto salía `I IV I` —en Mi mayor, «Mi La Mi»—: la tónica dos veces y sin
 * cadencia ninguna (adr/0051). Ningún test lo mataba porque ninguno miraba lo que
 * había **dentro** del cierre. Lo que elige sin IA sale del menú, y el menú lo
 * ordena el juez, así que se mira cada cierre que hay en él y no solo el primero.
 */
describe('el cierre de las salidas sin IA', () => {
  /** Cada grado de los dos modos, que son los sitios donde puede acabar tu parte. */
  function todosLosFinales(): { mode: KeyMode; ultimo: DegreeSymbol }[] {
    return (['major', 'minor'] as KeyMode[]).flatMap((mode) =>
      (degreesFor(mode) as readonly DegreeSymbol[]).map((ultimo) => ({ mode, ultimo })),
    );
  }

  it('acabe tu parte donde acabe, cada cierre acaba en la tonica y la toca una sola vez', () => {
    for (const { mode, ultimo } of todosLosFinales()) {
      const tonica: DegreeSymbol = mode === 'minor' ? 'i' : 'I';
      const progression = [
        { degree: tonica, beats: 4 },
        { degree: ultimo, beats: 4 },
      ];
      const cierres = salidasPosibles(mode, 'continuar', progression)
        .flatMap((salida) => salida.secciones)
        .filter((seccion) => seccion.name === 'Cierre');

      for (const cierre of cierres) {
        const donde = `${mode}, acabando en ${ultimo}: ${cierre.steps.map((p) => p.degree).join(' ')}`;
        expect(cierre.steps.at(-1)!.degree, donde).toBe(tonica);
        expect(
          cierre.steps.filter((paso) => paso.degree === tonica),
          donde,
        ).toHaveLength(1);
      }
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
