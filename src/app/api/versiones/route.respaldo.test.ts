import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_DIRECTRICES_LENGTH } from '@core/billing';
import type * as Music from '@core/music';
import type * as AskModel from '@server/ask-model';

/**
 * **Lo que ve el modelo, y el porqué del respaldo**, con un menú fijo.
 *
 * El menú ocupa en el prompt lo que deja el resto (`menuDelPrompt`), así que con
 * una canción larga y las directrices enteras el modelo ve un principio de él. Lo
 * que se defiende aquí: que el esquema y el validador solo cuenten las que vio, y
 * que el respaldo sin IA elija entre esas y explique con los motivos del juez.
 * El generador es de mentira porque lo está afinando otra mano.
 */

const spendAi = vi.fn(async () => ({ kind: 'ok', account: {}, leftMonth: 10 }) as never);
const askModel = vi.fn();
const salidasPosibles = vi.fn();

// Una cuenta nueva en cada petición: el límite por minuto es de la cuenta
// (adr/0114), y aquí no es lo que se prueba.
vi.mock('@server/entitlements', () => ({
  spendAi: () => spendAi(),
  currentSession: async () => ({ userId: crypto.randomUUID(), account: {} }),
}));
vi.mock('@server/ask-model', async (original) => ({
  ...(await original<typeof AskModel>()),
  modelAvailable: () => true,
  askModel: (...args: unknown[]) => askModel(...args),
}));
vi.mock('@core/music', async (original) => ({
  ...(await original<typeof Music>()),
  salidasPosibles: (...args: unknown[]) => salidasPosibles(...args),
}));

const { POST } = await import('./route');
const { porqueDelJuez } = await import('./salidas');

/** Lo tuyo: treinta y dos compases de I, que es lo que más sitio se come. */
const TUYO = Array.from({ length: 32 }, () => ({ degree: 'I' as const, beats: 4 }));

/** Una salida que cambia el último compás, con lo que hace largo y dos motivos. */
function salida(i: number): Music.SalidaPosible {
  return {
    path: 'rearmonizar',
    nombre: `Retoque ${i + 1}`,
    // Larga, como las de verdad, y en minúscula: sin acordes que el validador lea.
    que: `retoque número ${i + 1}, ${'que cambia el último compás y nada más '.repeat(4)}`,
    colores: ['abierto'],
    secciones: [
      {
        name: 'Lo tuyo',
        yours: false,
        steps: TUYO.map((paso, j) => ({
          ...paso,
          degree:
            j === TUYO.length - 1
              ? (['IV', 'ii', 'vi', 'iii', 'V', 'V/V'] as const)[i]!
              : paso.degree,
          move: null,
        })),
      },
    ],
    encaje: {
      puntos: 90 - i,
      descarte: null,
      criterios: [
        { id: 'estilo', valor: 0.9, motivo: `el estilo de la ${i + 1} encaja con lo tuyo.` },
        { id: 'sintaxis', valor: 0.8, motivo: `el enlace de la ${i + 1} va adonde tiene que ir.` },
        { id: 'frase', valor: 1, motivo: 'la frase se cuenta de cuatro en cuatro.' },
      ],
    },
  };
}

const MENU = Array.from({ length: 6 }, (_, i) => salida(i));

let direccion = 0;
function pedir(body: unknown): Request {
  direccion += 1;
  return new Request('http://x/api/versiones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.5.0.${direccion}` },
    body: JSON.stringify(body),
  });
}

const CORTA = {
  key: { tonic: 'C', mode: 'major' },
  kind: 'retocar',
  progression: TUYO.slice(0, 4),
};

/** Treinta y dos compases con especie, pulsos desiguales, dudas y punteo, y las directrices enteras. */
const LARGA = {
  ...CORTA,
  role: 'pre-estribillo',
  estilo: 'jazz',
  progression: TUYO.map((_, i) => ({
    degree: (['bVII', 'V/iii', 'vii°', 'bIII'] as const)[i % 4],
    beats: i % 2 === 0 ? 16 : 15,
    especie: 'augmentedMajor7',
    heard: true,
    notas: Array.from({ length: 12 }, (_, nota) => ({ nota, fuerte: true })),
  })),
  directrices: 'x'.repeat(MAX_DIRECTRICES_LENGTH),
};

/**
 * Las líneas del menú del prompt de la primera llamada, el enumerado del esquema y
 * cuántas pide como poco.
 */
function loQueVio(): { lineas: string[]; enumerado: number[]; minimo: number } {
  const { prompt, schema } = askModel.mock.calls[0]![0] as {
    prompt: string;
    schema: {
      properties: {
        versions: { minItems: number; items: { properties: { opcion: { enum: number[] } } } };
      };
    };
  };
  return {
    lineas: prompt.split('\n').filter((linea) => /^\d+\. /u.test(linea)),
    enumerado: schema.properties.versions.items.properties.opcion.enum,
    minimo: schema.properties.versions.minItems,
  };
}

/** Lo mismo con algo pedido: el modelo elige del menú entero. */
const CORTA_CON_DIRECTRICES = { ...CORTA, directrices: 'más triste' };

beforeEach(() => {
  askModel.mockReset();
  salidasPosibles.mockReset();
  salidasPosibles.mockReturnValue(MENU);
});

describe('lo que ve el modelo', () => {
  it('con directrices y poco resto ve las seis, y cada una con su porqué', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir(CORTA_CON_DIRECTRICES));

    const { lineas, enumerado, minimo } = loQueVio();
    expect(lineas).toHaveLength(6);
    expect(enumerado).toEqual([1, 2, 3, 4, 5, 6]);
    // Elige: con una basta.
    expect(minimo).toBe(1);
    // Los dos que la distinguen; el que tienen todas no ayuda a elegir.
    expect(lineas[0]).toContain(
      'Por qué: el estilo de la 1 encaja con lo tuyo. el enlace de la 1 va adonde tiene que ir.',
    );
    expect(lineas[0]).not.toContain('la frase se cuenta');
  });

  /**
   * **Sin directrices no elige: explica las tres mejores.** Eligiendo entre seis,
   * `qwen3:8b` sacaba menos nota que el juez solo; ahora ve esas tres y las tiene
   * que contar todas.
   */
  it('sin directrices ve las tres mejores, y tiene que contarlas todas', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir(CORTA));

    const { lineas, enumerado, minimo } = loQueVio();
    expect(lineas).toHaveLength(3);
    expect(lineas[2]).toContain('retoque número 3');
    expect(enumerado).toEqual([1, 2, 3]);
    expect(minimo).toBe(3);
  });

  it('con una canción larga y las directrices enteras ve menos, y solo puede elegir esas', async () => {
    askModel.mockResolvedValue({
      versions: [
        { opcion: 6, title: 'La que no vio', why: 'Sin verla.' },
        { opcion: 1, title: 'La primera', why: 'Encaja.' },
      ],
    });

    const res = await POST(pedir(LARGA));
    const body = (await res.json()) as { versions: { title: string }[] };

    const { lineas, enumerado } = loQueVio();
    expect(lineas.length).toBeGreaterThanOrEqual(3);
    expect(lineas.length).toBeLessThan(6);
    expect(enumerado).toEqual(lineas.map((_, i) => i + 1));
    expect(body.versions.map((v) => v.title)).toEqual(['La primera']);
  });

  it('lo que no es una lista de salidas pasa tal cual al validador, que no saca nada', async () => {
    askModel.mockResolvedValue({ versions: 'ninguna' });

    const res = await POST(pedir(CORTA));
    const body = (await res.json()) as { origen?: string };

    // Dos intentos sin nada que valga: contesta el dominio.
    expect(body.origen).toBe('dominio');
  });
});

describe('el respaldo sin IA', () => {
  it('elige entre las que se ven y explica con los motivos del juez', async () => {
    askModel.mockImplementation(async (input: { sinClave: () => unknown }) => input.sinClave());

    const res = await POST(pedir(CORTA));
    const body = (await res.json()) as { versions: { title: string; why: string }[] };

    expect(body.versions.map((v) => v.title)).toEqual([
      'Sin IA · Retoque 1',
      'Sin IA · Retoque 2',
      'Sin IA · Retoque 3',
    ]);
    expect(body.versions[1]!.why).toBe(
      'el estilo de la 2 encaja con lo tuyo. el enlace de la 2 va adonde tiene que ir.',
    );
  });

  /**
   * **Lo mismo que explicaría el modelo sin directrices**: las tres mejores con
   * variedad. Con una variante de la primera en el segundo puesto, el modelo sin
   * directrices ve la 1, la 3 y la 4, y el respaldo da esas mismas, se pida lo que
   * se pida.
   */
  it('da las tres que el modelo explica sin directrices, con directrices o sin ellas', async () => {
    // Lo que pone la primera, y un compás más: la misma idea, más larga.
    const variante: Music.SalidaPosible = {
      ...salida(0),
      nombre: 'Retoque 1, más largo',
      secciones: [
        {
          name: 'Lo tuyo',
          yours: false,
          steps: salida(0).secciones[0]!.steps.map((paso, j) =>
            j === TUYO.length - 2 ? { ...paso, degree: 'V' } : paso,
          ),
        },
      ],
    };
    // Las de detrás, de otros caminos: tres retoques no son tres ideas.
    salidasPosibles.mockReturnValue([
      MENU[0],
      variante,
      { ...MENU[1]!, path: 'otro-final' },
      { ...MENU[2]!, path: 'estirar' },
      ...MENU.slice(3),
    ]);
    const entera = { ...CORTA, progression: TUYO };

    askModel.mockResolvedValue({ versions: [] });
    await POST(pedir(entera));
    expect(loQueVio().lineas.map((linea) => linea.match(/retoque número \d/u)![0])).toEqual([
      'retoque número 1',
      'retoque número 2',
      'retoque número 3',
    ]);

    askModel.mockImplementation(async (input: { sinClave: () => unknown }) => input.sinClave());
    for (const peticion of [entera, { ...entera, directrices: 'más triste' }]) {
      const res = await POST(pedir(peticion));
      const body = (await res.json()) as { versions: { title: string }[] };
      expect(body.versions.map((v) => v.title)).toEqual([
        'Sin IA · Retoque 1',
        'Sin IA · Retoque 2',
        'Sin IA · Retoque 3',
      ]);
    }
  });

  it('el porqué del juez: los dos motivos si caben, el primero si no, y nada sin ellos', () => {
    expect(porqueDelJuez(['Uno.', 'Dos.'])).toBe('Uno. Dos.');
    expect(porqueDelJuez(['a'.repeat(150), 'b'.repeat(100)])).toBe('a'.repeat(150));
    expect(porqueDelJuez([])).toBe('');
  });
});
