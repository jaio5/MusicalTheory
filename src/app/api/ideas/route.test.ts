import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La ruta de las ideas, de punta a punta.
 *
 * Lo que se prueba aquí es **lo que es suyo**: leer el cuerpo, construir el
 * esquema que toca, reintentar una vez y no devolver nunca nada sin validar. Las
 * cuatro ramas de la puerta —cuenta, plan, cupo, proveedor— se prueban una sola
 * vez en `server/ai-gate.test.ts`, porque desde que la puerta está en un sitio,
 * repetirlas aquí sería probar lo mismo con otro nombre.
 *
 * `entitlements` se sustituye porque arrastra `next-auth`, que en Node no
 * resuelve `next/server` y revienta al cargar: es la razón de que estas rutas
 * llevaran cero cobertura desde que existen. Lo demás es el código de verdad,
 * incluida la validación contra el dominio.
 */

const spendAi = vi.fn(async () => ({ kind: 'ok', account: {}, leftMonth: 10 }) as never);
const askModel = vi.fn();

vi.mock('@server/entitlements', () => ({ spendAi: () => spendAi() }));
vi.mock('@server/ask-model', () => ({
  modelAvailable: () => true,
  askModel: (...args: unknown[]) => askModel(...args),
}));

const { POST } = await import('./route');

const CUERPO = {
  kind: 'progression',
  key: { tonic: 'A', mode: 'minor' },
  currentDegree: 'i',
};

/** Una petición con la dirección que se le diga, para no chocar con el límite. */
function pedir(body: unknown, desde = '10.0.0.1'): Request {
  return new Request('http://x/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': desde },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

let direccion = 0;
/** Una dirección nueva por test: el limitador vive en memoria y es compartido. */
function nueva(): string {
  direccion += 1;
  return `10.1.0.${direccion}`;
}

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  askModel.mockReset();
  spendAi.mockClear();
});

describe('lo que entra', () => {
  it('un cuerpo que no es JSON es 400, y no gasta cupo', async () => {
    const { status, body } = await leer(await POST(pedir('{esto no', nueva())));

    expect(status).toBe(400);
    expect(body['error']).toMatchObject({ code: 'invalid_request' });
    expect(spendAi).not.toHaveBeenCalled();
  });

  it('sin tonalidad no hay petición', async () => {
    const { status } = await leer(await POST(pedir({ kind: 'progression' }, nueva())));

    expect(status).toBe(400);
  });

  it('una clase de idea inventada no vale', async () => {
    const { status } = await leer(await POST(pedir({ ...CUERPO, kind: 'loquesea' }, nueva())));

    expect(status).toBe(400);
  });

  it('lo que no está en el esquema se ignora en vez de tumbar la petición', async () => {
    // El cuerpo no se reenvía tal cual al modelo: se reconstruye desde los campos
    // que pasan, así que un campo de más no puede llegar al prompt.
    askModel.mockResolvedValue({
      ideas: [{ title: 'Una', why: 'Porque sí.', degrees: ['i', 'VII'] }],
    });

    const { status } = await leer(await POST(pedir({ ...CUERPO, loQueSea: 'ignórame' }, nueva())));

    expect(status).toBe(200);
  });
});

describe('lo que sale', () => {
  it('devuelve las ideas que pasan la validación', async () => {
    askModel.mockResolvedValue({
      ideas: [
        { title: 'Bajar por tonos', why: 'Mantiene el centro.', degrees: ['i', 'VII', 'VI'] },
      ],
    });

    const { status, body } = await leer(await POST(pedir(CUERPO, nueva())));

    expect(status).toBe(200);
    expect(body['ideas']).toHaveLength(1);
  });

  it('una idea con un grado que no existe en el modo se cae', async () => {
    // Si se colara, la pantalla pintaría un acorde que no está en esa tonalidad.
    askModel.mockResolvedValue({
      ideas: [{ title: 'Mala', why: 'No existe.', degrees: ['i', 'inventado'] }],
    });

    const { status, body } = await leer(await POST(pedir(CUERPO, nueva())));

    expect(status).toBe(502);
    expect(body['error']).toMatchObject({ code: 'unparseable_response' });
  });

  it('reintenta una vez, y solo una', async () => {
    // Encadenar más cuesta dinero y tiempo, y el usuario prefiere un «no ha
    // salido» rápido a treinta segundos de espera.
    askModel.mockResolvedValue({ ideas: [] });

    await POST(pedir(CUERPO, nueva()));

    expect(askModel).toHaveBeenCalledTimes(2);
  });

  it('el reintento no vuelve a gastar cupo', async () => {
    // `spendAi` se llama antes del bucle: lo que se cobra es una petición, y lo
    // que se puede llegar a pagar son dos llamadas.
    askModel.mockResolvedValue({ ideas: [] });

    await POST(pedir(CUERPO, nueva()));

    expect(spendAi).toHaveBeenCalledTimes(1);
  });

  it('si el modelo se cae, 502 y no se reintenta', async () => {
    askModel.mockRejectedValue(new Error('red'));

    const { status, body } = await leer(await POST(pedir(CUERPO, nueva())));

    expect(status).toBe(502);
    expect(body['error']).toMatchObject({ code: 'model_unavailable' });
    expect(askModel).toHaveBeenCalledTimes(1);
  });
});

describe('el esquema que se le manda depende de lo que se pida', () => {
  it('con kind scale se le exige un identificador de escala', async () => {
    // Es la lección que costó una vez: lo que el esquema no exige, el modelo no
    // lo pone, y el validador lo barre entero.
    askModel.mockResolvedValue({ ideas: [{ title: 'x', why: 'y', scale: 'minorPentatonic' }] });

    const { status } = await leer(await POST(pedir({ ...CUERPO, kind: 'scale' }, nueva())));

    const esquema = askModel.mock.calls[0]?.[0] as { schema: Record<string, never> };
    const idea = (
      esquema.schema['properties'] as unknown as { ideas: { items: { required: string[] } } }
    ).ideas.items.required;

    expect(status).toBe(200);
    expect(idea).toContain('scale');
    expect(idea).not.toContain('degrees');
  });

  it('con kind progression se le exigen grados del modo que toca', async () => {
    askModel.mockResolvedValue({
      ideas: [{ title: 'x', why: 'y', degrees: ['i', 'VII'] }],
    });

    await POST(pedir(CUERPO, nueva()));

    const esquema = askModel.mock.calls[0]?.[0] as { schema: Record<string, never> };
    const grados = (
      esquema.schema['properties'] as unknown as {
        ideas: { items: { properties: { degrees: { items: { enum: string[] } } } } };
      }
    ).ideas.items.properties.degrees.items.enum;

    // Los de menor, no los de mayor: un enumerado es lo único que impide que
    // escriba un grado que no existe ahí.
    expect(grados).toContain('VII');
    expect(grados).not.toContain('vii°');
  });
});

describe('lo que se le cuenta al modelo', () => {
  it('lo que se esta tocando entra en la pregunta, y solo como simbolos', () => {
    // A la IA solo viajan símbolos: la tonalidad, la escala, notas y cifrados.
    // Ni audio ni nada de lo que suene.
    askModel.mockResolvedValue({ ideas: [{ title: 'x', why: 'y', degrees: ['i'] }] });

    return POST(
      pedir(
        {
          ...CUERPO,
          scale: 'minorPentatonic',
          recentNotes: ['A', 'C', 'E'],
          recentChords: ['Am', 'F'],
        },
        nueva(),
      ),
    ).then(() => {
      const prompt = (askModel.mock.calls[0]?.[0] as { prompt: string }).prompt;

      expect(prompt).toContain('minorPentatonic');
      expect(prompt).toContain('A C E');
      expect(prompt).toContain('Am F');
    });
  });

  it('cada tipo de idea pide una cosa distinta', async () => {
    askModel.mockResolvedValue({ ideas: [{ title: 'x', why: 'y', degrees: ['i'] }] });

    await POST(pedir({ ...CUERPO, kind: 'twist' }, nueva()));
    const giro = (askModel.mock.calls[0]?.[0] as { prompt: string }).prompt;

    askModel.mockResolvedValue({ ideas: [{ title: 'x', why: 'y', scale: 'dorian' }] });
    await POST(pedir({ ...CUERPO, kind: 'scale' }, nueva()));
    const escala = (askModel.mock.calls[1]?.[0] as { prompt: string }).prompt;

    expect(giro).toMatch(/romper el bucle/);
    expect(escala).toMatch(/escalas para tocar encima/);
  });
});

describe('cuando el modelo no contesta', () => {
  it('un fallo del proveedor es un 502, y no se reintenta', async () => {
    // Encadenar reintentos sobre un proveedor caído cuesta dinero y tiempo, y
    // quien mira prefiere un «no ha salido» rápido.
    askModel.mockRejectedValue(new Error('sin red'));

    const respuesta = await POST(pedir(CUERPO, nueva()));

    expect(respuesta.status).toBe(502);
    expect(askModel).toHaveBeenCalledTimes(1);
  });
});

describe('pulsar el boton veinte veces seguidas', () => {
  it('se frena, y se dice cuanto hay que esperar', async () => {
    // El límite es por dirección: diez por minuto. Defiende del botón repetido,
    // no de un abuso de verdad —para eso haría falta el contador compartido—.
    askModel.mockResolvedValue({ ideas: [{ title: 'x', why: 'y', degrees: ['i'] }] });
    const misma = nueva();

    let ultima = await POST(pedir(CUERPO, misma));
    for (let i = 0; i < 12 && ultima.status !== 429; i += 1) {
      ultima = await POST(pedir(CUERPO, misma));
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
    spendAi.mockResolvedValue({ kind: 'sin-cuenta' } as never);

    const respuesta = await POST(pedir(CUERPO, nueva()));

    expect(respuesta.status).toBe(401);
    expect(askModel).not.toHaveBeenCalled();
  });
});
