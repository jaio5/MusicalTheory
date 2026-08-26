/**
 * Quién contesta, según lo que haya en el entorno.
 *
 * Son cuatro `if`, y aun así se prueban: de esta función cuelgan dos cosas que se
 * rompen en silencio. Una, que una clave y un `OLLAMA_URL` olvidado puestos a la
 * vez sirvan un modelo pequeño a quien paga. Otra, que el identificador que sale
 * de aquí es el que `entitlements.ts` guarda en la cuenta y con el que
 * `core/billing/cost.ts` calcula los cupos de todos los planes.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { configuredModel, localModelUrl, modelProvider } from './ai-model';

const ANTES = { ...process.env };

afterEach(() => {
  process.env = { ...ANTES };
});

function entorno(valores: Record<string, string | undefined>): void {
  for (const [nombre, valor] of Object.entries(valores)) {
    if (valor === undefined) {
      delete process.env[nombre];
    } else {
      process.env[nombre] = valor;
    }
  }
}

describe('quién contesta', () => {
  it('sin nada configurado, nadie', () => {
    entorno({ ANTHROPIC_API_KEY: undefined, OLLAMA_URL: undefined });
    expect(modelProvider()).toBe('ninguno');
  });

  it('con clave, la API', () => {
    entorno({ ANTHROPIC_API_KEY: 'sk-ant-loquesea', OLLAMA_URL: undefined });
    expect(modelProvider()).toBe('anthropic');
  });

  it('sin clave y con Ollama, el modelo de casa', () => {
    entorno({ ANTHROPIC_API_KEY: undefined, OLLAMA_URL: 'http://localhost:11434' });
    expect(modelProvider()).toBe('local');
    expect(configuredModel()).toBe('qwen3:8b');
  });

  it('con las dos cosas gana la clave', () => {
    // Lo importante de esta prueba no es el `if`: es que un `OLLAMA_URL` puesto
    // para probar y olvidado en el `.env` no puede degradar en silencio lo que se
    // le sirve a quien ha pagado el plan Pro.
    entorno({ ANTHROPIC_API_KEY: 'sk-ant-loquesea', OLLAMA_URL: 'http://localhost:11434' });
    expect(modelProvider()).toBe('anthropic');
  });

  it('una variable vacía es una variable que no está', () => {
    // Compose escribe `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}`, así que sin
    // clave la variable existe y vale la cadena vacía. Tratarla como puesta hacía
    // que la aplicación creyera tener API y contestara 502 a todo.
    entorno({ ANTHROPIC_API_KEY: '', OLLAMA_URL: '' });
    expect(modelProvider()).toBe('ninguno');
  });
});

describe('el modelo que se le pide a cada uno', () => {
  it('el de casa se puede cambiar sin tocar el de la API', () => {
    entorno({
      ANTHROPIC_API_KEY: undefined,
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'gemma3:12b',
    });
    expect(configuredModel()).toBe('gemma3:12b');
  });

  it('sin proveedor local se lee el de Anthropic', () => {
    entorno({ ANTHROPIC_API_KEY: 'sk-ant-loquesea', ANTHROPIC_MODEL: 'claude-sonnet-5' });
    expect(configuredModel()).toBe('claude-sonnet-5');
  });

  it('la barra final de la URL se quita', () => {
    // Con ella la petición sale a `//api/chat` y Ollama contesta un 404 que no se
    // parece en nada a «te has dejado una barra en el .env».
    entorno({ OLLAMA_URL: 'http://localhost:11434/' });
    expect(localModelUrl()).toBe('http://localhost:11434');
  });
});
