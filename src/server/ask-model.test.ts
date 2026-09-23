import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El reparto entre los tres que pueden contestar.
 *
 * Lo que se prueba aquí **no** es la calidad de ninguna respuesta: es que la
 * misma pregunta sale por la puerta que toca según lo que haya configurado, y
 * que lo que vuelve se lee igual venga de donde venga. Es justo lo que las rutas
 * dan por hecho para no tener que saber quién hay puesto.
 *
 * Dos cosas se sustituyen: el SDK de Anthropic —llamarlo de verdad costaría
 * dinero— y el modelo de casa, que ya tiene su propio test. Lo que queda en pie
 * es de este fichero: el `switch` del proveedor, apagar el pensamiento y qué se
 * hace con una respuesta que no trae texto o no es JSON.
 */

const crear = vi.fn();
/** Con qué se construyó el cliente, para poder mirarle el tope de espera. */
let comoSeMonto: Record<string, unknown> | undefined;

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor(opciones?: Record<string, unknown>) {
      comoSeMonto = opciones;
    }
    messages = { create: (...a: unknown[]) => crear(...a) };
  },
}));

const askLocalModel = vi.fn();
vi.mock('./local-model', () => ({
  askLocalModel: (...a: unknown[]) => askLocalModel(...a),
}));

const { MAX_MODEL_ATTEMPTS } = await import('@core/billing');
const { askModel, modelAvailable, RespuestaTruncada } = await import('./ask-model');

const sinClave = vi.fn(() => ({ delDominio: true }));

const pregunta = {
  prompt: 'dos compases en Do',
  system: 'eres un profesor de musica',
  schema: { type: 'object' },
  maxTokens: 400,
  sinClave,
};

/** Lo que devolvería la API. */
function contesta(texto: string, stop = 'end_turn') {
  return { stop_reason: stop, content: [{ type: 'text', text: texto }] };
}

const entorno = { ...process.env };

beforeEach(() => {
  crear.mockReset();
  askLocalModel.mockReset();
  sinClave.mockClear();
  delete process.env['ANTHROPIC_API_KEY'];
  delete process.env['OLLAMA_URL'];
  delete process.env['ANTHROPIC_MODEL'];
});

afterEach(() => {
  process.env = { ...entorno };
});

describe('si se puede preguntar algo', () => {
  it('fuera de produccion siempre, porque contesta el dominio', () => {
    // Es lo que permite abrir las pantallas de IA sin dar de alta un servicio ni
    // descargar cinco gigas.
    expect(modelAvailable()).toBe(true);
  });

  it('en produccion sin proveedor, no', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(modelAvailable()).toBe(false);

    vi.unstubAllEnvs();
  });

  it('en produccion con clave, si', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env['ANTHROPIC_API_KEY'] = 'sk-loquesea';

    expect(modelAvailable()).toBe(true);

    vi.unstubAllEnvs();
  });
});

describe('a quien se le pregunta', () => {
  it('sin proveedor contesta el dominio, y no se llama a nadie', async () => {
    expect(await askModel(pregunta)).toEqual({ delDominio: true });
    expect(crear).not.toHaveBeenCalled();
    expect(askLocalModel).not.toHaveBeenCalled();
  });

  it('con OLLAMA_URL contesta el modelo de casa', async () => {
    process.env['OLLAMA_URL'] = 'http://localhost:11434/';
    askLocalModel.mockResolvedValue({ deCasa: true });

    expect(await askModel(pregunta)).toEqual({ deCasa: true });

    const [peticion, url] = askLocalModel.mock.calls[0] as [Record<string, unknown>, string];
    // La barra final se quita antes de llegar aqui: con ella, Ollama contesta un
    // 404 que no se parece en nada a «te has dejado una barra en el .env».
    expect(url).toBe('http://localhost:11434');
    expect(peticion['maxTokens']).toBe(400);
    expect(peticion['model']).toBeTruthy();
  });

  it('la clave gana al modelo de casa', async () => {
    // OLLAMA_URL es una variable que se pone para probar y se olvida puesta. Si
    // ganara ella, un despliegue con las dos serviria en silencio respuestas de
    // un modelo pequeño a quien ha pagado el plan Pro.
    process.env['OLLAMA_URL'] = 'http://localhost:11434';
    process.env['ANTHROPIC_API_KEY'] = 'sk-loquesea';
    crear.mockResolvedValue(contesta('{"deLaApi":true}'));

    expect(await askModel(pregunta)).toEqual({ deLaApi: true });
    expect(askLocalModel).not.toHaveBeenCalled();
  });
});

describe('la llamada a la API', () => {
  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-loquesea';
  });

  it('pensar va apagado, y es una decision de coste', async () => {
    // El pensamiento se cobra como tokens de salida y puede comerse el
    // `max_tokens` para devolver una respuesta truncada: se paga y no se sirve.
    crear.mockResolvedValue(contesta('{}'));

    await askModel(pregunta);

    const cuerpo = crear.mock.calls[0]![0] as Record<string, never>;
    expect(cuerpo['thinking']).toEqual({ type: 'disabled' });
    expect(cuerpo['output_config']).toMatchObject({ effort: 'low' });
  });

  it('el esquema y el tope de tokens viajan tal cual', async () => {
    // El tope sale de `core/billing/cost.ts`: es el mismo numero con el que se
    // calculan los cupos, asi que el peor caso que supone la aritmetica es el
    // que impone el servidor.
    crear.mockResolvedValue(contesta('{}'));

    await askModel(pregunta);

    const cuerpo = crear.mock.calls[0]![0] as Record<string, never>;
    expect(cuerpo['max_tokens']).toBe(400);
    expect(cuerpo['output_config']).toMatchObject({
      format: { type: 'json_schema', schema: { type: 'object' } },
    });
    expect(cuerpo['system']).toBe('eres un profesor de musica');
  });

  it('el modelo se puede cambiar por entorno', async () => {
    process.env['ANTHROPIC_MODEL'] = 'claude-otro';
    crear.mockResolvedValue(contesta('{}'));

    await askModel(pregunta);

    expect((crear.mock.calls[0]![0] as Record<string, never>)['model']).toBe('claude-otro');
  });
});

describe('lo que vuelve', () => {
  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-loquesea';
  });

  it('negarse a contestar se lanza, para que se distinga de una respuesta mala', async () => {
    // Quien llama reintenta con «ha contestado algo que no vale» y contesta 502
    // con «el proveedor ha fallado». Confundirlas reintentaria una negativa.
    crear.mockResolvedValue(contesta('{}', 'refusal'));

    await expect(askModel(pregunta)).rejects.toThrow('refusal');
  });

  it('una respuesta sin texto es nula, no un error', async () => {
    crear.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'tool_use' }] });

    expect(await askModel(pregunta)).toBeNull();
  });

  it('una respuesta vacia tambien', async () => {
    crear.mockResolvedValue({ stop_reason: 'end_turn', content: [] });

    expect(await askModel(pregunta)).toBeNull();
  });

  it('un texto que no es JSON tambien, y no revienta', async () => {
    // Un modelo constreñido por esquema no deberia hacerlo, pero un truncado por
    // `max_tokens` deja JSON a medias.
    crear.mockResolvedValue(contesta('{"grados": ["I", "V"'));

    expect(await askModel(pregunta)).toBeNull();
  });

  it('si la red falla, se lanza', async () => {
    crear.mockRejectedValue(new Error('sin red'));

    await expect(askModel(pregunta)).rejects.toThrow('sin red');
  });
});

/**
 * **La espera está acotada, y no lo estaba.**
 *
 * El modelo de casa tenía su tope de dos minutos; la API se quedaba con el del
 * SDK, que son diez. Con los reintentos de dentro y el de la ruta, una pregunta
 * al profesor podía tener a alguien esperando casi una hora contra una pantalla
 * parada — y `docs/AI.md` llevaba desde el principio diciendo que aquí había
 * tiempo máximo.
 */
describe('cuánto se espera', () => {
  it('la llamada a la API lleva tope de espera y reintentos contados', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-de-mentira';
    crear.mockResolvedValue(contesta('{"vale":true}'));

    await askModel(pregunta);

    expect(comoSeMonto).toBeDefined();
    // Treinta segundos por llamada y un reintento: sesenta por `askModel`, y con
    // el reintento de la ruta, los mismos dos minutos que el modelo de casa.
    expect(comoSeMonto!['timeout']).toBe(30_000);
    expect(comoSeMonto!['maxRetries']).toBe(1);
    // Y el peor caso cabe en el tope que este proyecto se ha puesto para las dos
    // ramas: si alguien sube uno de los dos números, esto avisa.
    const peorCaso =
      (comoSeMonto!['timeout'] as number) * ((comoSeMonto!['maxRetries'] as number) + 1);
    expect(peorCaso * MAX_MODEL_ATTEMPTS).toBeLessThanOrEqual(120_000);
  });
});

/**
 * **Una respuesta cortada no se reintenta.**
 *
 * El reintento de `ai-route.ts` está para una respuesta que no valida, donde
 * otra tirada puede salir distinta. Una cortada por el tope de tokens no: el
 * prompt es el mismo y el tope también, así que la segunda llamada se corta por
 * donde se cortó la primera. Sin distinguirla se gastaba una llamada a la API
 * que no tenía ninguna posibilidad.
 */
describe('una respuesta cortada por el tope', () => {
  it('se distingue de cualquier otro fallo', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-de-mentira';
    // JSON a medias, que es justo lo que devuelve una respuesta cortada.
    crear.mockResolvedValue(contesta('{"ideas":[{"symbol":"C', 'max_tokens'));

    await expect(askModel(pregunta)).rejects.toBeInstanceOf(RespuestaTruncada);
  });

  it('y no se confunde con una negativa del modelo', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-de-mentira';
    crear.mockResolvedValue(contesta('', 'refusal'));

    await expect(askModel(pregunta)).rejects.not.toBeInstanceOf(RespuestaTruncada);
  });
});
