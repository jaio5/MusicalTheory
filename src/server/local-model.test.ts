/**
 * Lo que se le manda al modelo de casa y lo que se le entiende.
 *
 * No se levanta ningún Ollama: eso sería una prueba de integración que pide cinco
 * gigas descargados y una gráfica, y ninguna de las dos cosas está en el CI. Lo
 * que sí se puede comprobar aquí es que la traducción de las decisiones de
 * `ask-model.ts` —no pienses, no te pases de tokens, cíñete al esquema— sigue
 * puesta, que es justo lo que se cae en un refactor sin que falle nada más.
 */

import { describe, expect, it } from 'vitest';

import { cuerpoOllama, leerRespuestaOllama } from './local-model';

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
