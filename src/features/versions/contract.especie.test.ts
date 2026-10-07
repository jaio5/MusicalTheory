import { describe, expect, it, vi } from 'vitest';

import type * as Music from '@core/music';

import type { VersionsRequest } from './contract';

/**
 * La especie de lo que vuelve, con un menú fijo.
 *
 * El generador de salidas se está enseñando a poner especies, y lo que hay que
 * defender aquí no depende de qué ponga: que **lo que diga el menú mande**, que
 * **lo tuyo sin tocar no pierda la suya** si el menú no dice nada, y que el
 * cifrado se escriba con ella. Por eso el menú es de mentira.
 */

const salidasPosibles = vi.fn();

vi.mock('@core/music', async (original) => ({
  ...(await original<typeof Music>()),
  salidasPosibles: (...args: unknown[]) => salidasPosibles(...args),
}));

const { loQueNoEsta, validateVersions } = await import('./contract');
const { MAX_CARACTERES_DEL_MENU, salidasDe } = await import('./menu');

const PETICION: VersionsRequest = {
  key: { tonic: 'C', mode: 'major' },
  kind: 'retocar',
  progression: [
    { degree: 'I', beats: 4, especie: 'major7' },
    { degree: 'V', beats: 4, especie: 'dominant7' },
    { degree: 'IV', beats: 4 },
    { degree: 'ii', beats: 4, especie: 'minor7' },
  ],
};

const MENU: Music.SalidaPosible[] = [
  {
    path: 'rearmonizar',
    nombre: 'Del menú',
    que: 'Lo que hace.',
    colores: [],
    secciones: [
      {
        name: 'Lo que llevas',
        yours: false,
        steps: [
          // Sin decir nada: es tuyo y no cambia, así que se queda con la suya.
          { degree: 'I', beats: 4, move: null },
          // Dicho que es la tríada: manda el menú.
          { degree: 'V', beats: 4, move: null, especie: null },
          // Una especie nueva sobre lo tuyo.
          { degree: 'IV', beats: 4, move: null, especie: 'major7' },
          // Otro grado: la especie de antes no es de este acorde.
          { degree: 'vi', beats: 4, move: null },
        ],
      },
    ],
  },
];

describe('la especie de lo que vuelve', () => {
  salidasPosibles.mockReturnValue(MENU);
  const [version] = validateVersions(
    { versions: [{ opcion: 1, title: 'Bien', why: 'Porque sí.' }] },
    PETICION,
  );

  it('manda lo que dice el menú, y lo tuyo sin tocar se queda con la suya', () => {
    expect(version?.steps.map((paso) => paso.especie)).toEqual([
      'major7',
      undefined,
      'major7',
      undefined,
    ]);
  });

  it('el cifrado se escribe con la especie, el de ahora y el de antes', () => {
    expect(version?.steps.map((paso) => [paso.fromSymbol, paso.symbol])).toEqual([
      ['Cmaj7', 'Cmaj7'],
      ['G7', 'G'],
      ['F', 'Fmaj7'],
      ['Dm7', 'Am'],
    ]);
  });

  /**
   * Nombrar un acorde con su especie es verdad si suena así, o si sonaba así en lo
   * tuyo; y con séptima o sin ella es el mismo acorde.
   */
  it('el porqué puede nombrar los cifrados con su especie', () => {
    expect(loQueNoEsta('El Cmaj7 abre y el Fmaj7 respira.', version!, PETICION)).toBeNull();
    expect(loQueNoEsta('El G7 de antes ahora es un G.', version!, PETICION)).toBeNull();
    expect(loQueNoEsta('El Dm7 pasa a Am.', version!, PETICION)).toBeNull();
    expect(loQueNoEsta('Mete un Em7.', version!, PETICION)).toBe('nombra Em7');
  });

  it('el menú se construye con el contexto de la petición', () => {
    expect(salidasPosibles).toHaveBeenCalledWith(
      'major',
      'retocar',
      PETICION.progression,
      expect.objectContaining({
        papel: 'idea',
        especies: ['major7', 'dominant7', null, 'minor7'],
      }),
    );
  });
});

/**
 * El menú tiene sitio en el prompt, y lo que no cabe no entra: ni se le enseña al
 * modelo ni se valida, que son la misma lista.
 */
describe('lo que cabe en el menú', () => {
  it('se cortan las que no caben, y las que caben van en su orden', () => {
    const larga: Music.SalidaPosible = { ...MENU[0]!, que: 'x'.repeat(190) };
    salidasPosibles.mockReturnValue(Array.from({ length: 9 }, () => larga));

    const caben = salidasDe(PETICION);

    expect(caben.length).toBeGreaterThan(0);
    expect(caben.length).toBeLessThan(9);
    expect(caben.length * 200).toBeLessThanOrEqual(MAX_CARACTERES_DEL_MENU + 200);
  });
});
