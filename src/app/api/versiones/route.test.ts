import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La ruta de las salidas: la petición más cara de las tres y la única que
 * verifica el razonamiento del modelo, no solo el resultado.
 *
 * Lo que se prueba aquí es lo suyo: que el esquema y el catálogo dependan de lo
 * que se pida —continuar o retocar—, que tus compases los ponga el servidor y no
 * el modelo, y que una salida que declara un camino y toma otro no llegue a la
 * pantalla. Las ramas de la puerta, en `server/ai-gate.test.ts`.
 */

const spendAi = vi.fn(async () => ({ kind: 'ok', account: {}, leftMonth: 10 }) as never);
const askModel = vi.fn();

vi.mock('@server/entitlements', () => ({ spendAi: () => spendAi() }));
vi.mock('@server/ask-model', () => ({
  modelAvailable: () => true,
  askModel: (...args: unknown[]) => askModel(...args),
}));

const { POST } = await import('./route');

let direccion = 0;
function pedir(body: unknown): Request {
  direccion += 1;
  return new Request('http://x/api/versiones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.3.0.${direccion}` },
    body: JSON.stringify(body),
  });
}

/** Cuatro compases en A menor, la vuelta de siempre. */
const TOCADO = {
  key: { tonic: 'A', mode: 'minor' },
  progression: [
    { degree: 'i', beats: 4 },
    { degree: 'VI', beats: 4 },
    { degree: 'III', beats: 4 },
    { degree: 'VII', beats: 4 },
  ],
};

/** La primera llamada al modelo: con qué prompt y con qué esquema. */
function llamada(): { prompt: string; schema: Record<string, unknown> } {
  return askModel.mock.calls[0]![0] as { prompt: string; schema: Record<string, unknown> };
}

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  askModel.mockReset();
  spendAi.mockClear();
});

describe('lo que entra', () => {
  it('sin decir qué se pide no hay petición', async () => {
    // De la clase depende el esquema que se le manda, así que no se puede
    // suponer: quien no la manda no ha pedido nada concreto.
    const { status } = await leer(await POST(pedir(TOCADO)));

    expect(status).toBe(400);
    expect(spendAi).not.toHaveBeenCalled();
  });

  it('con un solo acorde no hay por dónde tirar', async () => {
    const { status } = await leer(
      await POST(pedir({ ...TOCADO, kind: 'retocar', progression: [{ degree: 'i', beats: 4 }] })),
    );

    expect(status).toBe(400);
  });
});

describe('el esquema y el catálogo dependen de lo que se pida', () => {
  it('al continuar solo se ofrecen los caminos que continúan', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    const { prompt, schema } = llamada();
    const caminos = (
      schema['properties'] as {
        versions: { items: { properties: { path: { enum: string[] } } } };
      }
    ).versions.items.properties.path.enum;

    expect(caminos.sort()).toEqual(['contraste', 'seguir']);
    expect(prompt).toContain('seguir');
    expect(prompt).not.toContain('- estirar:');
  });

  it('al retocar se ofrecen los otros tres, y una sola parte', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'retocar' }));

    const { schema } = llamada();
    const versions = (schema['properties'] as Record<string, unknown>)['versions'] as {
      items: { properties: { path: { enum: string[] }; sections: { maxItems: number } } };
    };

    expect(versions.items.properties.path.enum.sort()).toEqual([
      'estirar',
      'otro-final',
      'rearmonizar',
    ]);
    expect(versions.items.properties.sections.maxItems).toBe(1);
  });

  it('le enseña el mapa de saltos, generado desde el dominio', async () => {
    // Es lo que convierte «inventa algo» en «elige por dónde», y lo que impide
    // que el prompt ofrezca un salto que el validador no sabe comprobar.
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(llamada().prompt).toContain('Mapa de saltos');
    expect(llamada().prompt).toContain('i: VII VI iv III bII V');
  });
});

describe('lo que sale', () => {
  const CIERRE = {
    path: 'seguir',
    title: 'Cierre natural',
    why: 'Cae en casa.',
    sections: [
      {
        name: 'Cierre',
        steps: [
          { degree: 'i', beats: 4, move: null },
          { degree: 'i', beats: 4, move: null },
        ],
      },
    ],
  };

  it('tus compases los pone el servidor, no el modelo', async () => {
    // Pedirle que los copiara era la causa de que se descartara todo, y no había
    // ninguna razón para pedírselos: ya los tenemos.
    askModel.mockResolvedValue({ versions: [CIERRE] });

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));
    const salida = (body['versions'] as { sections: { name: string; yours: boolean }[] }[])[0]!;

    expect(status).toBe(200);
    expect(salida.sections[0]).toMatchObject({ name: 'Lo que llevas', yours: true });
    expect(salida.sections[1]).toMatchObject({ name: 'Cierre', yours: false });
  });

  it('una salida que declara un camino y toma otro se descarta', async () => {
    // Dice que continúa y no añade nada: es la regla que sostiene la función.
    askModel.mockResolvedValue({
      versions: [
        {
          ...CIERRE,
          sections: [
            { name: 'Nada', steps: TOCADO.progression.map((p) => ({ ...p, move: null })) },
          ],
        },
      ],
    });

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));

    expect(status).toBe(502);
    expect(body['error']).toMatchObject({ code: 'unparseable_response' });
  });

  it('un camino de la otra clase no vale, aunque en sí mismo sea válido', async () => {
    askModel.mockResolvedValue({
      versions: [
        {
          path: 'estirar',
          title: 'Otro reparto',
          why: 'Dura más.',
          sections: [
            {
              name: 'Lo que llevas',
              steps: TOCADO.progression.map((p, i) => ({
                ...p,
                beats: i === 0 ? 8 : 4,
                move: null,
              })),
            },
          ],
        },
      ],
    });

    const { status } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));

    expect(status).toBe(502);
  });

  it('los cifrados se recalculan desde los grados', async () => {
    askModel.mockResolvedValue({ versions: [CIERRE] });

    const { body } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));
    const pasos = (body['versions'] as { steps: { symbol: string }[] }[])[0]!.steps;

    expect(pasos.map((p) => p.symbol)).toEqual(['Am', 'F', 'C', 'G', 'Am', 'Am']);
  });

  it('reintenta una vez y gasta cupo una sola', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(askModel).toHaveBeenCalledTimes(2);
    expect(spendAi).toHaveBeenCalledTimes(1);
  });
});

describe('lo que no llega al modelo', () => {
  it('un cuerpo que no es JSON es un 400, no un 500', async () => {
    const peticion = new Request('http://x/api/versiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.3.9.1' },
      body: '{esto no es json',
    });

    const respuesta = await POST(peticion);

    expect(respuesta.status).toBe(400);
    expect(askModel).not.toHaveBeenCalled();
  });

  it('sin nada tocado no hay de donde salir', async () => {
    const { status } = await leer(await POST(pedir({ ...TOCADO, progression: [] })));

    expect(status).toBe(400);
    expect(askModel).not.toHaveBeenCalled();
  });

  it('un fallo del proveedor es un 502, y no se reintenta', async () => {
    // Cada intento es la petición más cara que hay: reintentar sobre un
    // proveedor caído es gastar dos veces para no servir nada.
    askModel.mockRejectedValue(new Error('sin red'));

    const { status } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));

    expect(status).toBe(502);
    expect(askModel).toHaveBeenCalledTimes(1);
  });
});
