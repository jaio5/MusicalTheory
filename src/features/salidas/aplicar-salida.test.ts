import { describe, expect, it } from 'vitest';

import { MAX_PARTS, type Arrangement, type Block, type Part } from '@core/music';

import { aplicarSalida, type FuenteDeLasSalidas } from './aplicar-salida';
import type { SalidaPropuesta, SalidaStepOut } from './contract';

/**
 * Quedarse con una salida cambia la parte a la que se refiere y nada más.
 *
 * Pisaba la canción entera: todo pasaba a «Lo que llevas» y «Cierre», y se iban la
 * séptima, la duda, el papel, las vueltas y el punteo.
 */

let contador = 0;
const opciones = {
  pulsosPorCompas: 4,
  nuevoId: (prefijo: string) => {
    contador += 1;
    return `${prefijo}-${contador}`;
  },
};

function bloque(id: string, extra: Partial<Block> & Pick<Block, 'degree'>): Block {
  return { id, beats: 4, source: 'written', confidence: 1, alternatives: [], ...extra };
}

const ESTROFA: Part = {
  id: 'estrofa',
  name: 'Mi estrofa',
  role: 'estrofa',
  repeats: 2,
  bars: 8,
  blocks: [
    bloque('e1', { degree: 'I', source: 'heard', confidence: 0.01, alternatives: ['vi'] }),
    bloque('e2', { degree: 'V', especie: 'dominant7' }),
    bloque('e3', { degree: 'vi' }),
  ],
  notes: [{ id: 'n1', offset: 4, start: 0, length: 1 }],
};

const ESTRIBILLO: Part = {
  id: 'estribillo',
  name: 'Mi estribillo',
  bars: 4,
  blocks: [bloque('c1', { degree: 'IV' }), bloque('c2', { degree: 'I' })],
  notes: [],
};

const CANCION: Arrangement = { parts: [ESTROFA, ESTRIBILLO] };

function paso(extra: Partial<SalidaStepOut> & Pick<SalidaStepOut, 'degree'>): SalidaStepOut {
  return { beats: 4, symbol: '?', from: extra.degree, move: null, ...extra };
}

function retoque(steps: readonly SalidaStepOut[]): SalidaPropuesta {
  return {
    path: 'rearmonizar',
    title: 't',
    why: 'w',
    sections: [{ name: 'Lo que llevas', yours: false, steps }],
    steps,
  };
}

function continuacion(
  tuyos: readonly SalidaStepOut[],
  ...nuevas: SalidaStepOut[][]
): SalidaPropuesta {
  const sections = [
    { name: 'Lo que llevas', yours: true, steps: tuyos },
    ...nuevas.map((steps, i) => ({ name: i === 0 ? 'Cierre' : 'Puente', yours: false, steps })),
  ];
  return {
    path: 'seguir',
    title: 't',
    why: 'w',
    sections,
    steps: sections.flatMap((s) => s.steps),
  };
}

const DE_LA_ESTROFA: FuenteDeLasSalidas = { tipo: 'parte', partId: 'estrofa' };

describe('retocar una parte', () => {
  const salida = retoque([
    paso({ degree: 'I' }),
    paso({ degree: 'V', especie: 'dominant7' }),
    paso({ degree: 'IV', from: 'vi' }),
  ]);
  const puesta = aplicarSalida(CANCION, salida, DE_LA_ESTROFA, opciones)!;
  const [estrofa, estribillo] = puesta.montaje.parts as [Part, Part];

  it('la otra parte no se toca', () => {
    expect(estribillo).toBe(ESTRIBILLO);
  });

  it('la parte conserva nombre, papel, vueltas, compases y punteo', () => {
    expect(estrofa).toMatchObject({
      id: 'estrofa',
      name: 'Mi estrofa',
      role: 'estrofa',
      repeats: 2,
      bars: 8,
    });
    expect(estrofa.notes).toBe(ESTROFA.notes);
  });

  /**
   * Que la salida no lo toque no es haberlo confirmado: el acorde dudoso sigue
   * dudoso, y el G7 sigue con su séptima.
   */
  it('lo que no cambia se queda como estaba, con su duda y su especie', () => {
    expect(estrofa.blocks[0]).toBe(ESTROFA.blocks[0]);
    expect(estrofa.blocks[1]).toBe(ESTROFA.blocks[1]);
    expect(estrofa.blocks[2]).toMatchObject({ degree: 'IV', source: 'written', confidence: 1 });
  });

  it('el punteo se queda, y se dice que debajo ha cambiado algo', () => {
    expect(puesta.punteoSinRevisar).toBe(true);
  });

  it('si solo cambia lo que dura, se estira el mismo bloque', () => {
    const estirada = aplicarSalida(
      CANCION,
      retoque([
        paso({ degree: 'I', beats: 8 }),
        paso({ degree: 'V', especie: 'dominant7' }),
        paso({ degree: 'vi' }),
      ]),
      DE_LA_ESTROFA,
      opciones,
    )!;

    expect(estirada.montaje.parts[0]?.blocks[0]).toEqual({ ...ESTROFA.blocks[0], beats: 8 });
  });

  it('con la dominante partida, cada bloque se compara con el suyo por pulsos', () => {
    const partida = aplicarSalida(
      CANCION,
      retoque([
        paso({ degree: 'I' }),
        paso({ degree: 'ii', beats: 2, from: 'V', move: 'ii-v' }),
        paso({ degree: 'V', beats: 2, especie: 'dominant7', move: 'ii-v' }),
        paso({ degree: 'vi' }),
      ]),
      DE_LA_ESTROFA,
      opciones,
    )!;
    const [uno, ii, v, seis] = partida.montaje.parts[0]!.blocks;

    // El I y el vi de detrás siguen siendo los suyos, con su duda: por posición, el
    // vi se comparaba con el V y se escribía de nuevo.
    expect(uno).toBe(ESTROFA.blocks[0]);
    expect(ii).toMatchObject({ degree: 'ii', beats: 2, source: 'written' });
    expect(v).toEqual({ ...ESTROFA.blocks[1], beats: 2 });
    expect(seis).toBe(ESTROFA.blocks[2]);
  });

  it('cambiar la especie es cambiar el bloque, y lo nuevo va con la suya', () => {
    const { montaje } = aplicarSalida(
      CANCION,
      retoque([
        paso({ degree: 'I', especie: 'major7' }),
        paso({ degree: 'V' }),
        paso({ degree: 'vi' }),
      ]),
      DE_LA_ESTROFA,
      opciones,
    )!;

    expect(montaje.parts[0]?.blocks[0]).toMatchObject({
      degree: 'I',
      especie: 'major7',
      source: 'written',
    });
    // El V sin especie ya no es el G7 que había: se escribe como tríada.
    expect(montaje.parts[0]?.blocks[1]).not.toHaveProperty('especie');
  });

  it('una salida que no cambia nada no avisa del punteo', () => {
    const igual = aplicarSalida(
      CANCION,
      retoque([
        paso({ degree: 'I' }),
        paso({ degree: 'V', especie: 'dominant7' }),
        paso({ degree: 'vi' }),
      ]),
      DE_LA_ESTROFA,
      opciones,
    )!;

    expect(igual.punteoSinRevisar).toBe(false);
    expect(igual.montaje.parts[0]?.blocks).toEqual(ESTROFA.blocks);
  });

  it('un otro final que acorta o alarga cambia lo que hay, y sin punteo no avisa', () => {
    const { montaje, punteoSinRevisar } = aplicarSalida(
      CANCION,
      retoque([paso({ degree: 'IV' }), paso({ degree: 'I' }), paso({ degree: 'V', from: null })]),
      { tipo: 'parte', partId: 'estribillo' },
      opciones,
    )!;

    expect(montaje.parts[1]?.blocks.map((b) => b.degree)).toEqual(['IV', 'I', 'V']);
    expect(punteoSinRevisar).toBe(false);
  });
});

describe('continuar desde una parte', () => {
  it('las partes nuevas van justo detras, y las demas siguen donde estaban', () => {
    const { montaje } = aplicarSalida(
      CANCION,
      continuacion(
        [],
        [
          paso({ degree: 'IV', from: null }),
          paso({ degree: 'V', from: null, especie: 'dominant7' }),
        ],
        [paso({ degree: 'I', from: null, beats: 2 })],
      ),
      DE_LA_ESTROFA,
      opciones,
    )!;

    expect(montaje.parts.map((part) => part.name)).toEqual([
      'Mi estrofa',
      'Cierre',
      'Puente',
      'Mi estribillo',
    ]);
    expect(montaje.parts[0]).toBe(ESTROFA);
    expect(montaje.parts[3]).toBe(ESTRIBILLO);
    expect(montaje.parts[1]?.blocks[1]).toMatchObject({ degree: 'V', especie: 'dominant7' });
    // Los compases que ocupa y ninguno más: dos, y medio de uno.
    expect(montaje.parts[1]?.bars).toBe(2);
    expect(montaje.parts[2]?.bars).toBe(1);
  });

  it('si no caben, nulo, y nada a medias', () => {
    const llena: Arrangement = {
      parts: Array.from({ length: MAX_PARTS }, (_, i) => ({ ...ESTRIBILLO, id: `p${i}` })),
    };

    expect(
      aplicarSalida(
        llena,
        continuacion([], [paso({ degree: 'V', from: null })]),
        { tipo: 'parte', partId: 'p0' },
        opciones,
      ),
    ).toBeNull();
  });
});

describe('lo que no estaba en la cancion', () => {
  const GRABADO: FuenteDeLasSalidas = {
    tipo: 'grabado',
    pasos: [
      { degree: 'I', beats: 3, confidence: 0.01, alternatives: ['vi'] },
      { degree: 'V', beats: 5, confidence: 0.9, alternatives: [] },
    ],
  };

  /** Lo que la salida no cambia entra oído, con su duda: el lienzo sigue preguntando. */
  it('lo grabado entra al final, oido donde no cambia', () => {
    const { montaje } = aplicarSalida(
      CANCION,
      retoque([paso({ degree: 'I', beats: 3 }), paso({ degree: 'IV', from: 'V' })]),
      GRABADO,
      opciones,
    )!;

    const nueva = montaje.parts[2]!;
    expect(montaje.parts.slice(0, 2)).toEqual(CANCION.parts);
    expect(nueva.name).toBe('Lo que llevas');
    expect(nueva.blocks[0]).toMatchObject({
      degree: 'I',
      beats: 3,
      source: 'heard',
      confidence: 0.01,
      alternatives: ['vi'],
    });
    expect(nueva.blocks[1]).toMatchObject({ degree: 'IV', source: 'written' });
  });

  /**
   * Como desde una parte: con la dominante partida se empareja por pulsos. Por
   * posición, la `I` dudosa del final se comparaba con el `V` y entraba escrita con
   * confianza uno —la duda confirmada sin que nadie la mirase—, y el `V` perdía que
   * se había oído.
   */
  it('con la dominante partida, lo grabado se empareja por pulsos', () => {
    const grabado: FuenteDeLasSalidas = {
      tipo: 'grabado',
      pasos: [
        { degree: 'I', beats: 4, confidence: 0.9, alternatives: [] },
        { degree: 'V', beats: 4, confidence: 0.8, alternatives: ['iii'] },
        { degree: 'I', beats: 4, confidence: 0.3, alternatives: ['vi'] },
      ],
    };
    const { montaje } = aplicarSalida(
      { parts: [] },
      retoque([
        paso({ degree: 'I' }),
        paso({ degree: 'ii', beats: 2, from: 'V', move: 'ii-v' }),
        paso({ degree: 'V', beats: 2, move: 'ii-v' }),
        paso({ degree: 'I' }),
      ]),
      grabado,
      opciones,
    )!;

    expect(
      montaje.parts[0]?.blocks.map(({ degree, beats, source, confidence, alternatives }) => ({
        degree,
        beats,
        source,
        confidence,
        alternatives,
      })),
    ).toEqual([
      { degree: 'I', beats: 4, source: 'heard', confidence: 0.9, alternatives: [] },
      // La primera mitad es otro acorde, y se escribe; la segunda sigue siendo el V
      // oído, con su duda y lo que dura ahora.
      { degree: 'ii', beats: 2, source: 'written', confidence: 1, alternatives: [] },
      { degree: 'V', beats: 2, source: 'heard', confidence: 0.8, alternatives: ['iii'] },
      { degree: 'I', beats: 4, source: 'heard', confidence: 0.3, alternatives: ['vi'] },
    ]);
  });

  /** Lo grabado es la tríada: si la salida le pone séptima, ya no es lo que se oyó. */
  it('una especie nueva sobre lo grabado lo cambia, y entra escrito con ella', () => {
    const { montaje } = aplicarSalida(
      { parts: [] },
      retoque([
        paso({ degree: 'I', beats: 3, especie: 'major7' }),
        paso({ degree: 'V', beats: 5 }),
      ]),
      GRABADO,
      opciones,
    )!;

    expect(montaje.parts[0]?.blocks[0]).toMatchObject({
      degree: 'I',
      especie: 'major7',
      source: 'written',
      confidence: 1,
    });
    expect(montaje.parts[0]?.blocks[1]).toMatchObject({ degree: 'V', source: 'heard' });
  });

  it('al continuar entra lo grabado y detras lo nuevo', () => {
    const { montaje } = aplicarSalida(
      { parts: [] },
      continuacion(
        [paso({ degree: 'I', beats: 3 }), paso({ degree: 'V', beats: 5 })],
        [paso({ degree: 'I', from: null })],
      ),
      GRABADO,
      opciones,
    )!;

    expect(montaje.parts.map((part) => part.name)).toEqual(['Lo que llevas', 'Cierre']);
    expect(montaje.parts[0]?.blocks.map((b) => b.source)).toEqual(['heard', 'heard']);
    expect(montaje.parts[1]?.blocks[0]?.source).toBe('written');
  });

  it('lo del camino entra escrito', () => {
    const { montaje } = aplicarSalida(
      { parts: [] },
      retoque([paso({ degree: 'I' }), paso({ degree: 'bII', from: 'V' })]),
      { tipo: 'camino' },
      opciones,
    )!;

    expect(montaje.parts[0]?.blocks.map((b) => [b.degree, b.source])).toEqual([
      ['I', 'written'],
      ['bII', 'written'],
    ]);
  });

  /** Si la parte se borró entre pedir y quedársela, lo suyo entra al final. */
  it('una parte que ya no esta se trata como lo de fuera', () => {
    const { montaje } = aplicarSalida(
      CANCION,
      retoque([paso({ degree: 'I' }), paso({ degree: 'V' })]),
      { tipo: 'parte', partId: 'borrada' },
      opciones,
    )!;

    expect(montaje.parts).toHaveLength(3);
  });

  it('tampoco desde fuera se pasa del tope de partes', () => {
    const llena: Arrangement = {
      parts: Array.from({ length: MAX_PARTS }, (_, i) => ({ ...ESTRIBILLO, id: `p${i}` })),
    };

    expect(
      aplicarSalida(llena, retoque([paso({ degree: 'I' })]), { tipo: 'camino' }, opciones),
    ).toBeNull();
  });
});
