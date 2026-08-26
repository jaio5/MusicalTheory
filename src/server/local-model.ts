/**
 * El modelo de casa: Ollama en un contenedor.
 *
 * Cuarto puerto con la misma forma que el cobrador que no cobra, el correo que no
 * manda y el modelo que no piensa (`fake-model.ts`), pero este sí contesta de
 * verdad: hay un modelo generando texto, solo que en tu gráfica y sin factura.
 * Sirve para lo que el dominio no puede probar —si un modelo suelto acierta con
 * los grados, si la verificación de las versiones aguanta— sin dar de alta un
 * servicio.
 *
 * **Sin dependencias.** Ollama habla JSON por HTTP y `fetch` está en el runtime,
 * así que meter un SDK aquí solo añadiría una versión que mantener. El SDK de
 * Anthropic sigue estando en un único fichero del proyecto, `ask-model.ts`, que
 * es la regla que evita que la clave acabe en el bundle del navegador.
 *
 * Lo que **no** es: un proveedor de producción. La calidad de un modelo de ocho
 * mil millones de parámetros no es la de la API, y las tres rutas lo notan de
 * forma desigual —el profesor bien, las ideas regular, las versiones mal, porque
 * son las que se verifican contra el dominio movimiento a movimiento—. Está en
 * `docs/AI.md` y en `docs/adr/0014`.
 */

/**
 * Lo que se espera como mucho a que conteste.
 *
 * Dos minutos, que para una API sería una barbaridad y aquí es lo justo: la
 * **primera** petición después de levantar el contenedor carga cinco gigas de
 * pesos en la gráfica antes de generar un solo token. Las siguientes tardan
 * segundos. Un tope de treinta segundos hacía fallar siempre la primera y
 * funcionar todas las demás, que es la clase de fallo que se persigue media hora.
 */
export const TIEMPO_MAXIMO_MS = 120_000;

export interface PeticionLocal {
  readonly prompt: string;
  readonly system: string;
  readonly schema: Record<string, unknown>;
  readonly maxTokens: number;
  /** El modelo, tal y como lo nombra Ollama: `qwen3:8b`. */
  readonly model: string;
}

/**
 * El cuerpo de `POST /api/chat`.
 *
 * Aparte de la llamada para poder probarlo: lo que se le manda a un modelo es
 * media decisión de coste y media de calidad, y comprobarlo pidiendo una red
 * falsa cuesta más que separar cuatro líneas.
 *
 * Tres cosas traducen lo que `ask-model.ts` decidió para Anthropic:
 *
 * - **`think: false`** es el `thinking: { type: 'disabled' }` de allí, y por el
 *   mismo motivo: la respuesta la fija un esquema, no hay nada que razonar, y un
 *   modelo pensando se come el tope de tokens para devolver algo truncado. Aquí
 *   no cuesta dinero pero cuesta segundos, que con la guitarra en las manos es
 *   peor. Aviso: los modelos que **no** saben pensar rechazan este campo en
 *   algunas versiones de Ollama; por eso el que viene puesto por defecto es uno
 *   que sabe.
 * - **`num_predict`** es el `max_tokens`, y sale del mismo sitio: el presupuesto
 *   de `core/billing/cost.ts`.
 * - **`format`** es el `output_config.format`. Ollama acepta el esquema JSON tal
 *   cual y constriñe la generación, igual que la salida estructurada de la API.
 *
 * `temperature: 0` porque la variedad se pide en el prompt. Un modelo pequeño con
 * temperatura alta se inventa grados que no existen en el modo, y eso el
 * validador lo tira: es gastar segundos para no servir nada.
 */
export function cuerpoOllama(peticion: PeticionLocal): Record<string, unknown> {
  return {
    model: peticion.model,
    stream: false,
    think: false,
    format: peticion.schema,
    options: { num_predict: peticion.maxTokens, temperature: 0 },
    messages: [
      { role: 'system', content: peticion.system },
      { role: 'user', content: peticion.prompt },
    ],
  };
}

/**
 * Lo que conteste, ya interpretado. Nulo si no trae texto o no es JSON.
 *
 * Misma regla que en `ask-model.ts`: nulo es «ha contestado algo que no vale» y
 * lo distingue de un error, que se lanza. Quien llama reintenta una vez con lo
 * primero y contesta 502 con lo segundo.
 */
export function leerRespuestaOllama(datos: unknown): unknown {
  if (typeof datos !== 'object' || datos === null) {
    return null;
  }

  const mensaje = (datos as { message?: unknown }).message;
  if (typeof mensaje !== 'object' || mensaje === null) {
    return null;
  }

  const contenido = (mensaje as { content?: unknown }).content;
  if (typeof contenido !== 'string' || contenido === '') {
    return null;
  }

  try {
    return JSON.parse(contenido) as unknown;
  } catch {
    return null;
  }
}

/**
 * Le pregunta al modelo de casa.
 *
 * Lanza cuando el contenedor no contesta, cuando tarda más de la cuenta o cuando
 * el modelo que se le pide no está descargado —Ollama devuelve 404 con el nombre
 * dentro—. Las tres son «el proveedor ha fallado», que es el 502 de las rutas.
 */
export async function askLocalModel(peticion: PeticionLocal, url: string): Promise<unknown> {
  const respuesta = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpoOllama(peticion)),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });

  if (!respuesta.ok) {
    // El texto de Ollama dice cuál es el problema —modelo sin descargar, sin
    // memoria— y se queda en el registro del servidor. Al cliente le llega el
    // 502 de siempre: nunca el error crudo del proveedor.
    throw new Error(`ollama ${respuesta.status}: ${await respuesta.text()}`);
  }

  return leerRespuestaOllama(await respuesta.json());
}
