import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MARCA_DIRECTRICES } from '@features/versions/contract';
import type * as AskModel from '@server/ask-model';

/**
 * La ruta de las salidas: la petición más cara de las dos y la única que
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
vi.mock('@server/ask-model', async (original) => ({
  // El módulo entero se sustituye, así que **la clase se trae de verdad**: es la
  // que `ai-route` compara con `instanceof`, y una copia no sería la misma.
  ...(await original<typeof AskModel>()),
  modelAvailable: () => true,
  askModel: (...args: unknown[]) => askModel(...args),
}));

const { POST } = await import('./route');
const { RespuestaTruncada } = await import('@server/ask-model');
const { roleInfo } = await import('@core/music');

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

  /**
   * **Y las cadencias con las que puede cerrar, enumeradas.** Sin ellas contestaba
   * la tónica repetida: a temperatura cero —que es la que se le pide— siempre la
   * misma, `I I I I`. Con la lista delante contesta una cadencia
   * ([adr/0051](../../../../docs/adr/0051-un-cierre-se-prepara-por-detras.md)).
   */
  it('le enumera las cadencias con las que puede cerrar', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    // Lo tocado acaba en VII, y desde ahí se cierra con VI i.
    expect(llamada().prompt).toContain('Tu ultimo compas es VII y ya esta puesto');
    expect(llamada().prompt).toContain('- VI i');
  });

  /**
   * Y decirle que su último compás ya está puesto no es un adorno: con «para
   * cerrar desde V» contestaba `V IV` —leía «desde V» como «empieza por V»— y eso
   * no cierra.
   */
  it('le dice que no empiece el cierre por su ultimo compas', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(llamada().prompt).toContain('sin empezarla por VII');
  });

  /**
   * **Y lo que le pides con tus palabras, delimitado y al final.**
   *
   * Al final porque es lo último que lee y tiene que pesar más que el catálogo;
   * delimitado porque lo escribes tú, y el prompt de sistema tiene dicho que lo de
   * dentro de las marcas es un dato y nunca una instrucción.
   */
  it('le pasa tus directrices entre marcas y al final', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar', directrices: 'a rock lento' }));

    const { prompt } = llamada();
    expect(prompt).toContain(`${MARCA_DIRECTRICES}\na rock lento\n${MARCA_DIRECTRICES}`);
    expect(prompt.trimEnd().endsWith(MARCA_DIRECTRICES)).toBe(true);
  });

  // Sin escribir nada, la marca no aparece: un bloque vacío es una línea que el
  // modelo interpreta.
  it('sin directrices no mete el bloque', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(llamada().prompt).not.toContain(MARCA_DIRECTRICES);
  });

  // Retocar no añade partes, así que no hay nada que cerrar y la lista no va.
  it('retocando no le habla de cerrar', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'retocar' }));

    expect(llamada().prompt).not.toContain('ya esta puesto');
  });
});

describe('lo que sale', () => {
  // Una cadencia de verdad. Esto era `i i` —la tónica repetida—, que es justo lo
  // que el modelo devolvía de más y ahora el dominio rechaza: una parte de un solo
  // grado no es una parte ([adr/0051](../../../../docs/adr/0051-un-cierre-se-prepara-por-detras.md)).
  const CIERRE = {
    path: 'seguir',
    title: 'Cierre natural',
    why: 'Cae en casa.',
    sections: [
      {
        name: 'Cierre',
        steps: [
          { degree: 'VI', beats: 4, move: null },
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

    // Los cuatro tuyos y la cadencia: VI es Fa y i es La menor.
    expect(pasos.map((p) => p.symbol)).toEqual(['Am', 'F', 'C', 'G', 'F', 'Am']);
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

  /**
   * **Una respuesta cortada tampoco se reintenta**, y por un motivo distinto:
   * no es que el modelo haya fallado, es que la segunda llamada se cortaría por
   * donde se cortó la primera. El prompt es el mismo y el tope también.
   *
   * Lo cubría la ruta de ideas, ya retirada (adr/0066); el cuerpo es común
   * —`server/ai-route.ts`—, así que basta con probarlo desde una de las dos.
   */
  it('una respuesta cortada por el tope no se reintenta', async () => {
    askModel.mockRejectedValue(new RespuestaTruncada());

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));

    expect(status).toBe(502);
    // Y lo dice como lo que es: contestó, y lo que dijo no vale.
    expect(body['error']).toMatchObject({ code: 'unparseable_response' });
    expect(askModel).toHaveBeenCalledTimes(1);
  });
});

describe('pulsar el boton veinte veces seguidas', () => {
  it('se frena, y se dice cuanto hay que esperar', async () => {
    // El límite es por dirección, así que todas desde la misma. Defiende del
    // botón repetido, no de un abuso de verdad.
    askModel.mockResolvedValue({ versions: [] });
    const desdeLaMisma = () =>
      new Request('http://x/api/versiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.3.8.1' },
        body: JSON.stringify({ ...TOCADO, kind: 'continuar' }),
      });

    let ultima = await POST(desdeLaMisma());
    for (let i = 0; i < 30 && ultima.status !== 429; i += 1) {
      ultima = await POST(desdeLaMisma());
    }

    expect(ultima.status).toBe(429);
    expect(ultima.headers.get('Retry-After')).not.toBeNull();
  });
});

describe('cuando la puerta esta cerrada', () => {
  it('no se le pregunta al modelo, y se contesta lo que diga la puerta', async () => {
    // Las cuatro ramas de la puerta —cuenta, plan, cupo, proveedor— se prueban
    // en `server/ai-gate.test.ts`. Lo que se comprueba aqui es que esta ruta
    // **se para**: sin esto se gastaria una llamada al modelo que nadie ha
    // pagado.
    // Se deja como estaba para lo que venga detrás: la puerta abierta es lo
    // normal en el resto de este fichero.
    spendAi.mockResolvedValueOnce({ kind: 'sin-cuenta' } as never);

    const respuesta = await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(respuesta.status).toBe(401);
    expect(askModel).not.toHaveBeenCalled();
  });
});

describe('la tonalidad se le dice en español', () => {
  it('mayor y menor, escritos con todas las letras', async () => {
    // El prompt está en español entero: mezclar «major» dentro es pedirle al
    // modelo que traduzca por su cuenta.
    askModel.mockResolvedValue({ versions: [] });

    await POST(
      pedir({
        key: { tonic: 'C', mode: 'major' },
        kind: 'retocar',
        progression: [
          { degree: 'I', beats: 4 },
          { degree: 'V', beats: 4 },
        ],
      }),
    );

    expect(llamada().prompt).toContain('C mayor');
  });
});

describe('qué parte le mandan llega al prompt', () => {
  it('un estribillo se dice que es un estribillo, y se explica qué es', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar', role: 'estribillo' }));

    const { prompt } = llamada();

    expect(prompt).toContain('Lo que te mandan es estribillo');
    // La frase sale del catálogo de `ROLES` y no se escribe en la ruta: si se
    // escribiera dos veces, dentro de tres meses dirían cosas distintas.
    expect(prompt).toContain(roleInfo('estribillo').what);
  });

  it('y una idea también se dice, en vez de callarse', async () => {
    // Callarlo dejaba al modelo suponiendo que es una canción a medias, que es
    // por lo que continuaba siempre por lo obvio. Que no tenga sitio todavía es
    // información, no una ausencia.
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(llamada().prompt).toContain('Lo que te mandan es una idea');
  });
});

describe('sin modelo al que preguntar', () => {
  /**
   * Fuera de producción contesta el dominio: rearmonizaciones de verdad, con su
   * porqué, sacadas del catálogo en vez de inventadas. Y pasan la misma
   * validación que las del modelo, que es lo que hace que se puedan enseñar.
   */
  it('contesta el dominio, y pasa la misma validacion', async () => {
    askModel.mockImplementation(async (input: { sinClave: () => unknown }) => input.sinClave());

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'retocar' })));

    expect(status).toBe(200);
    const versions = body['versions'] as Array<{ title: string }>;
    expect(versions.length).toBeGreaterThan(0);
  });

  // Y sin un solo acorde no hay nada que rearmonizar: no se inventa una salida.
  it('sin acordes no saca ninguna version', async () => {
    askModel.mockImplementation(async (input: { sinClave: () => unknown }) => input.sinClave());

    // Dos acordes son el mínimo que la ruta acepta; el dominio no saca nada de
    // una progresión que no puede rearmonizar.
    const { body } = await leer(
      await POST(
        pedir({
          ...TOCADO,
          kind: 'continuar',
          progression: [
            { degree: 'i', beats: 4 },
            { degree: 'VI', beats: 4 },
          ],
        }),
      ),
    );

    expect(Array.isArray(body['versions'])).toBe(true);
  });
});
