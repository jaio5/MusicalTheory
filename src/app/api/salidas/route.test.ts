import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_MESSAGES } from '@features/salidas/contract';
import type * as AskModel from '@server/ask-model';

/**
 * La ruta de las salidas: la petición más cara de las dos.
 *
 * Lo que se prueba aquí es lo suyo: que el menú y el esquema dependan de lo que se
 * pida —continuar o retocar—, que tus compases los ponga el servidor, y que si el
 * modelo no da nada que valga conteste el dominio diciéndolo. Las ramas de la
 * puerta, en `server/ai-gate.test.ts`.
 */

const spendAi = vi.fn(async () => ({ kind: 'ok', account: {}, leftMonth: 10 }) as never);
const askModel = vi.fn();

// Una cuenta nueva en cada petición: el límite por minuto es de la cuenta
// (adr/0114), y aquí no es lo que se prueba.
let siempreLaMisma: string | null = null;
vi.mock('@server/entitlements', () => ({
  spendAi: () => spendAi(),
  currentSession: async () => ({ userId: siempreLaMisma ?? crypto.randomUUID(), account: {} }),
}));
vi.mock('@server/ask-model', async (original) => ({
  // El módulo entero se sustituye, así que **la clase se trae de verdad**: es la
  // que `ai-route` compara con `instanceof`, y una copia no sería la misma.
  ...(await original<typeof AskModel>()),
  modelAvailable: () => true,
  askModel: (...args: unknown[]) => askModel(...args),
}));

const { POST } = await import('./route');
const { RespuestaTruncada } = await import('@server/ask-model');
const { blockChord, pitchClassFromName, roleInfo, writtenBlock } = await import('@core/music');
const { parseSalidasRequest } = await import('@features/salidas/contract');
const { salidasDe } = await import('@features/salidas/menu');

let direccion = 0;
function pedir(body: unknown): Request {
  direccion += 1;
  return new Request('http://x/api/salidas', {
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

  /**
   * **Un acorde ya es una canción**: el dominio la sigue y la parte para
   * retocarla, y aquí se rechazaba con «nos falta la progresión». Sin ninguno sí.
   */
  it('con un solo acorde se pide, y sin ninguno no', async () => {
    askModel.mockResolvedValue({ versions: [] });
    for (const kind of ['retocar', 'continuar']) {
      const { status } = await leer(
        await POST(pedir({ ...TOCADO, kind, progression: [{ degree: 'i', beats: 4 }] })),
      );
      expect(status, kind).toBe(200);
    }

    const { status, body } = await leer(
      await POST(pedir({ ...TOCADO, kind: 'retocar', progression: [] })),
    );
    expect(status).toBe(400);
    expect((body['error'] as { message: string }).message).toBe(ERROR_MESSAGES.invalid_request);
  });
});

describe('el menú y el esquema dependen de lo que se pida', () => {
  /** El enumerado del número que elige el modelo. */
  function opciones(): number[] {
    const versions = (llamada().schema['properties'] as Record<string, unknown>)['versions'] as {
      items: { properties: { opcion: { enum: number[] } } };
    };
    return versions.items.properties.opcion.enum;
  }

  it('al continuar el menú son caminos que continúan, numerados como el esquema', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    const { prompt } = llamada();
    const lineas = prompt.split('\n').filter((linea) => /^\d+\. /u.test(linea));
    expect(lineas.length).toBeGreaterThan(0);
    expect(opciones()).toEqual(lineas.map((_, i) => i + 1));
    expect(lineas.every((linea) => /^\d+\. (seguir|contraste): /u.test(linea))).toBe(true);
  });

  it('al retocar, los otros tres', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'retocar' }));

    const lineas = llamada()
      .prompt.split('\n')
      .filter((linea) => /^\d+\. /u.test(linea));
    expect(lineas.every((linea) => /^\d+\. (rearmonizar|estirar|otro-final): /u.test(linea))).toBe(
      true,
    );
    expect(llamada().prompt).toContain('de 4 pulsos cada uno: 1:i | 2:VI | 3:III | 4:VII');
  });

  /**
   * **Y lo que le pides con tus palabras, delimitado y al final.**
   *
   * Al final porque es lo último que lee y tiene que pesar al elegir; delimitado
   * porque lo escribes tú, y el prompt de sistema tiene dicho que lo de dentro de
   * las marcas es un dato y nunca una instrucción.
   */
  it('le pasa tus directrices entre marcas y al final', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar', directrices: 'a rock lento' }));

    const { prompt } = llamada();
    // Con la clave de cada petición, la misma en las dos (adr/0115).
    expect(prompt).toMatch(/(###DIRECTRICES-[0-9a-f]{6}###)\na rock lento\n\1$/u);
  });

  // Sin escribir nada, la marca no aparece: un bloque vacío es una línea que el
  // modelo interpreta.
  it('sin directrices no mete el bloque', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(llamada().prompt).not.toContain('###DIRECTRICES');
  });
});

describe('lo que sale', () => {
  it('tus compases los pone el servidor, y la salida es la del menú', async () => {
    askModel.mockResolvedValue({ versions: [{ opcion: 1, title: 'Cierre', why: 'Cae en casa.' }] });

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));
    const salida = (body['versions'] as { sections: { name: string; yours: boolean }[] }[])[0]!;

    expect(status).toBe(200);
    expect(body).not.toHaveProperty('origen');
    expect(salida.sections[0]).toMatchObject({ name: 'Lo que llevas', yours: true });
    // Cómo se llama lo que sigue lo decide el dominio con el papel; que no es tuyo, no.
    expect(salida.sections[1]).toMatchObject({ yours: false });
  });

  it('los cifrados se recalculan desde los grados', async () => {
    askModel.mockResolvedValue({ versions: [{ opcion: 1, title: 'Cierre', why: 'Cae en casa.' }] });

    const peticion = { ...TOCADO, kind: 'continuar' };
    const { body } = await leer(await POST(pedir(peticion)));
    const pasos = (body['versions'] as { steps: { symbol: string }[] }[])[0]!.steps;
    const [elegida] = salidasDe(parseSalidasRequest(peticion)!);
    const grados = elegida!.secciones.flatMap((seccion) => seccion.steps);

    // Los cuatro tuyos, y lo nuevo escrito desde su grado y su especie en La menor.
    expect(pasos.slice(0, 4).map((p) => p.symbol)).toEqual(['Am', 'F', 'C', 'G']);
    expect(pasos.map((p) => p.symbol)).toEqual(
      grados.map(
        (paso) =>
          blockChord(
            pitchClassFromName('A'),
            'minor',
            writtenBlock('', paso.degree, paso.beats, paso.especie ?? undefined),
          ).symbol,
      ),
    );
  });

  it('reintenta una vez y gasta cupo una sola', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(askModel).toHaveBeenCalledTimes(2);
    expect(spendAi).toHaveBeenCalledTimes(1);
  });
});

/**
 * **Que nunca se quede sin salida.** Si el modelo no da nada que valga en los dos
 * intentos, contesta el dominio con su menú, y lo dice: `origen: 'dominio'` y
 * «Sin IA» en cada título.
 */
describe('cuando el modelo no da nada que valga', () => {
  it('dos respuestas que no valen: contesta el dominio, y lo dice', async () => {
    askModel.mockResolvedValue({ versions: [{ opcion: 99, title: 'x', why: 'y' }] });

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));
    const titulos = (body['versions'] as { title: string }[]).map((v) => v.title);

    expect(status).toBe(200);
    expect(askModel).toHaveBeenCalledTimes(2);
    expect(body['origen']).toBe('dominio');
    expect(body['motivo']).toBe('unparseable_response');
    expect(titulos.length).toBeGreaterThan(0);
    expect(titulos.every((titulo) => titulo.startsWith('Sin IA · '))).toBe(true);
  });

  it('un fallo del proveedor no se reintenta, y también contesta el dominio', async () => {
    // Cada intento es la petición más cara que hay: reintentar sobre un
    // proveedor caído es gastar dos veces para no servir nada.
    askModel.mockRejectedValue(new Error('sin red'));

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'retocar' })));

    expect(status).toBe(200);
    expect(body['origen']).toBe('dominio');
    // Lo dice, para que la pantalla no pida volver a intentarlo como si fuera
    // culpa de lo que se mandó.
    expect(body['motivo']).toBe('model_unavailable');
    expect(askModel).toHaveBeenCalledTimes(1);
  });

  /**
   * **Una respuesta cortada tampoco se reintenta**: la segunda llamada se cortaría
   * por donde se cortó la primera, porque el prompt es el mismo y el tope también.
   */
  it('una respuesta cortada por el tope no se reintenta', async () => {
    askModel.mockRejectedValue(new RespuestaTruncada());

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'continuar' })));

    expect(status).toBe(200);
    expect(body['origen']).toBe('dominio');
    expect(askModel).toHaveBeenCalledTimes(1);
  });
});

describe('lo que no llega al modelo', () => {
  it('un cuerpo que no es JSON es un 400, no un 500', async () => {
    const peticion = new Request('http://x/api/salidas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.3.9.1' },
      body: '{esto no es json',
    });

    const respuesta = await POST(peticion);

    expect(respuesta.status).toBe(400);
    expect(askModel).not.toHaveBeenCalled();
  });

  it('sin nada tocado no hay de donde salir', async () => {
    const { status, body } = await leer(await POST(pedir({ ...TOCADO, progression: [] })));

    expect(status).toBe(400);
    expect((body['error'] as { message: string }).message).toBe(ERROR_MESSAGES.invalid_request);
    expect(askModel).not.toHaveBeenCalled();
  });

  /**
   * Sin salidas, la respuesta decía «nos falta la progresión», y después una frase
   * fija sobre el sitio. **Ahora dice por qué con las palabras del dominio**
   * (`porQueNoHaySalidas`), con el código que la pantalla ya mira. Retocar, en
   * cambio, sí tiene.
   */
  it('con la canción llena, continuar dice por qué no hay salida, y retocar sigue pudiendo', async () => {
    const llena = Array.from({ length: 31 }, (_, i) => ({
      degree: ['i', 'VI', 'III', 'VII'][i % 4],
      beats: 4,
    }));

    const continuar = await leer(
      await POST(pedir({ ...TOCADO, progression: llena, kind: 'continuar' })),
    );
    expect(continuar.status).toBe(400);
    expect(continuar.body['error']).toEqual({
      code: 'invalid_request',
      message:
        'Detrás de tus 31 acordes solo cabe uno más, y con uno no se llega a casa desde tu III. Prueba a retocarla.',
    });
    expect(askModel).not.toHaveBeenCalled();
    expect(spendAi).not.toHaveBeenCalled();

    askModel.mockResolvedValue({ versions: [] });
    const retocar = await leer(
      await POST(pedir({ ...TOCADO, progression: llena, kind: 'retocar' })),
    );
    expect(retocar.status).toBe(200);
  });
});

describe('pulsar el boton veinte veces seguidas', () => {
  it('se frena, y se dice cuanto hay que esperar', async () => {
    // El límite es por cuenta (adr/0114), así que todas desde la misma. Defiende
    // del botón repetido; del abuso, el cupo y el techo de gasto.
    siempreLaMisma = 'la-de-siempre';
    askModel.mockResolvedValue({ versions: [] });
    const desdeLaMisma = () =>
      new Request('http://x/api/salidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.3.8.1' },
        body: JSON.stringify({ ...TOCADO, kind: 'continuar' }),
      });

    let ultima = await POST(desdeLaMisma());
    for (let i = 0; i < 30 && ultima.status !== 429; i += 1) {
      ultima = await POST(desdeLaMisma());
    }

    siempreLaMisma = null;
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
  it('un estribillo se dice que es un estribillo, con el nombre del catálogo', async () => {
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar', role: 'estribillo' }));

    const { prompt } = llamada();

    // El nombre sale del catálogo de `ROLES` y no se escribe en la ruta: si se
    // escribiera dos veces, dentro de tres meses dirían cosas distintas.
    expect(prompt).toContain(`Parte: ${roleInfo('estribillo').name.toLowerCase()}.`);
    // La frase que lo explica es para quien compone: el modelo sabe qué es un
    // estribillo, y eran noventa caracteres de cada petición.
    expect(prompt).not.toContain(roleInfo('estribillo').what);
  });

  it('y una idea también se dice, en vez de callarse', async () => {
    // Callarlo dejaba al modelo suponiendo que es una canción a medias, que es
    // por lo que continuaba siempre por lo obvio. Que no tenga sitio todavía es
    // información, no una ausencia.
    askModel.mockResolvedValue({ versions: [] });

    await POST(pedir({ ...TOCADO, kind: 'continuar' }));

    expect(llamada().prompt).toContain('Parte: una idea.');
  });
});

describe('sin modelo al que preguntar', () => {
  /**
   * Fuera de producción contesta el dominio: las salidas de su menú, elegidas por
   * número como las elegiría el modelo. Y pasan la misma validación que las del
   * modelo, que es lo que hace que se puedan enseñar.
   */
  it('contesta el dominio, y pasa la misma validacion', async () => {
    askModel.mockImplementation(async (input: { sinClave: () => unknown }) => input.sinClave());

    const { status, body } = await leer(await POST(pedir({ ...TOCADO, kind: 'retocar' })));

    expect(status).toBe(200);
    const versions = body['versions'] as Array<{ title: string }>;
    expect(versions.length).toBeGreaterThan(0);
  });

  // Con dos acordes también sale algo, y es una lista.
  it('con dos acordes contesta una lista', async () => {
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
