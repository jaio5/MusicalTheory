/**
 * Lo que se le manda al modelo de casa y lo que se le entiende.
 *
 * No se levanta ningún Ollama: eso sería una prueba de integración que pide cinco
 * gigas descargados y una gráfica, y ninguna de las dos cosas está en el CI. Lo
 * que sí se puede comprobar aquí es que la traducción de las decisiones de
 * `ask-model.ts` —no pienses, no te pases de tokens, cíñete al esquema— sigue
 * puesta, que es justo lo que se cae en un refactor sin que falle nada más.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { askLocalModel, cuerpoOllama, leerRespuestaOllama } from './local-model';

const PETICION = {
  prompt: 'La tonalidad es A menor.',
  system: 'Contesta en español.',
  schema: { type: 'object', properties: { ideas: { type: 'array' } } },
  maxTokens: 700,
  model: 'qwen3:8b',
} as const;

describe('lo que se le manda a Ollama', () => {
  it('no le deja pensar', () => {
    // Es la misma decisión que `thinking: { type: 'disabled' }` en la API. Allí
    // el motivo es el dinero; aquí, los segundos y el tope de tokens: un modelo
    // pensando se gasta el `num_predict` razonando y devuelve JSON truncado.
    expect(cuerpoOllama(PETICION).think).toBe(false);
  });

  it('le pone el mismo tope de tokens que impone el presupuesto', () => {
    // El número sale de `core/billing/cost.ts` y llega hasta aquí sin tocarse. Si
    // se perdiera por el camino, el peor caso que supone la aritmética de los
    // cupos dejaría de ser el que impone el servidor.
    expect(cuerpoOllama(PETICION).options).toEqual({ num_predict: 700, temperature: 0 });
  });

  it('le pasa el esquema tal cual, para que constriña la generación', () => {
    expect(cuerpoOllama(PETICION).format).toBe(PETICION.schema);
  });

  it('manda el prompt de sistema separado del de usuario', () => {
    expect(cuerpoOllama(PETICION).messages).toEqual([
      { role: 'system', content: 'Contesta en español.' },
      { role: 'user', content: 'La tonalidad es A menor.' },
    ]);
  });

  it('no pide la respuesta a trozos', () => {
    // Con `stream: true` la respuesta llega en líneas sueltas de JSON y
    // `leerRespuestaOllama` no encontraría nada. Es un fallo silencioso: no da
    // error, simplemente no hay ideas nunca.
    expect(cuerpoOllama(PETICION).stream).toBe(false);
  });
});

describe('lo que se le entiende a Ollama', () => {
  it('devuelve el JSON que venga dentro del mensaje', () => {
    const datos = { message: { role: 'assistant', content: '{"ideas":[{"title":"Bajar"}]}' } };
    expect(leerRespuestaOllama(datos)).toEqual({ ideas: [{ title: 'Bajar' }] });
  });

  it('es nulo cuando el contenido no es JSON', () => {
    // Pasa cuando el modelo se sale del esquema, y es el caso que las rutas
    // reintentan una vez antes de contestar `unparseable_response`.
    expect(
      leerRespuestaOllama({ message: { content: 'Pues mira, yo pondría un Fa.' } }),
    ).toBeNull();
  });

  it('es nulo cuando no viene mensaje, o viene vacío', () => {
    for (const datos of [null, {}, { message: null }, { message: { content: '' } }, 'nada']) {
      expect(leerRespuestaOllama(datos)).toBeNull();
    }
  });
});

describe('la llamada al contenedor', () => {
  const fetchFalso = vi.fn();

  beforeEach(() => {
    fetchFalso.mockReset();
    vi.stubGlobal('fetch', fetchFalso);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('va a /api/chat con el cuerpo de arriba', () => {
    fetchFalso.mockResolvedValue(
      new Response(JSON.stringify({ message: { content: '{"ideas":[]}' } }), { status: 200 }),
    );

    return askLocalModel(PETICION, 'http://ollama:11434').then((leido) => {
      const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://ollama:11434/api/chat');
      expect(JSON.parse(init.body as string)).toEqual(cuerpoOllama(PETICION));
      expect(leido).toEqual({ ideas: [] });
    });
  });

  it('se espera, pero no para siempre', () => {
    // La **primera** petición después de levantar el contenedor carga cinco
    // gigas de pesos en la gráfica antes de generar un solo token. Un tope de
    // treinta segundos hacía fallar siempre la primera y funcionar las demás,
    // que es la clase de fallo que se persigue media hora.
    fetchFalso.mockResolvedValue(new Response(JSON.stringify({ message: { content: '{}' } })));

    return askLocalModel(PETICION, 'http://ollama:11434').then(() => {
      const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  it('un error de Ollama se lanza, y su texto se queda en el servidor', async () => {
    // El texto dice cuál es el problema —modelo sin descargar, sin memoria— y no
    // sale de aquí: al cliente le llega el 502 de siempre, nunca el error crudo
    // del proveedor.
    fetchFalso.mockResolvedValue(new Response('model "qwen3:8b" not found', { status: 404 }));

    await expect(askLocalModel(PETICION, 'http://ollama:11434')).rejects.toThrow(/ollama 404/);
  });

  it('si el contenedor no está, tambien se lanza', async () => {
    fetchFalso.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(askLocalModel(PETICION, 'http://ollama:11434')).rejects.toThrow();
  });
});
