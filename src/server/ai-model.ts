/**
 * Qué modelo hay puesto, en un solo sitio.
 *
 * Lo leían las dos rutas de IA por su cuenta, cada una con su `?? 'claude-opus-5'`.
 * Ahora lo lee esto, porque el modelo dejó de ser un detalle de cada ruta: **de su
 * precio salen los cupos de todos los planes** (`core/billing/cost.ts`). Dos
 * lecturas con dos valores por defecto distintos serían dos aplicaciones cobrando
 * cosas distintas.
 *
 * Y desde que hay un modelo de casa —Ollama en un contenedor— aquí no se decide
 * solo cuál, sino **quién**: la API de Anthropic, el modelo local o nadie. Es la
 * misma forma que el cobrador y el correo, que también son puertos con más de una
 * implementación y un «no hay ninguna» que no rompe la aplicación.
 */

import { DEFAULT_AI_MODEL } from '@core/billing';

/**
 * El modelo de casa por defecto.
 *
 * `qwen3:8b` porque de su tamaño es el que mejor respeta un esquema JSON
 * estricto, que es lo único que se le pide aquí: las tres rutas constriñen la
 * salida a un esquema y validan lo que vuelve contra el dominio. Ocupa unos 5 GB
 * en cuatro bits, así que entra entero en una gráfica de 8 GB.
 */
export const DEFAULT_LOCAL_MODEL = 'qwen3:8b';

/** Quién contesta. */
export type ModelProvider = 'anthropic' | 'local' | 'ninguno';

/** Una variable de entorno vacía es una variable que no está. */
function entorno(nombre: string): string | undefined {
  const valor = process.env[nombre];
  return valor === undefined || valor === '' ? undefined : valor;
}

/** Si hay clave para hablar con la API de Anthropic. */
export function hasModelKey(): boolean {
  return entorno('ANTHROPIC_API_KEY') !== undefined;
}

/**
 * Dónde escucha el Ollama de casa, sin la barra final.
 *
 * La barra se quita aquí y no en quien lo usa porque el error que provoca
 * —`//api/chat`— sale como un 404 del propio Ollama, que no se parece en nada a
 * «te has dejado una barra en el `.env`».
 */
export function localModelUrl(): string | undefined {
  const url = entorno('OLLAMA_URL');
  return url === undefined ? undefined : url.replace(/\/+$/, '');
}

/**
 * Quién contesta hoy.
 *
 * **La clave gana al modelo local**, y a propósito: `OLLAMA_URL` es una variable
 * que se pone para probar y se olvida puesta. Si ganara ella, un despliegue con
 * las dos configuradas serviría en silencio respuestas de un modelo de ocho mil
 * millones de parámetros a quien ha pagado el plan Pro. Para probar en local se
 * quita la clave, que es lo explícito.
 */
export function modelProvider(): ModelProvider {
  if (hasModelKey()) {
    return 'anthropic';
  }
  return localModelUrl() === undefined ? 'ninguno' : 'local';
}

/**
 * El identificador del modelo que va a contestar.
 *
 * Depende del proveedor porque **de aquí salen los cupos**: `entitlements.ts` lo
 * guarda en la cuenta y `core/billing/cost.ts` le busca precio. Un modelo local
 * no figura en la tabla de precios, así que se cobra al precio del más caro
 * conocido y los cupos salen pequeños. Es lo que hay que hacer: el cupo defiende
 * de un gasto, y suponer cero gasto sería dividir entre cero.
 */
export function configuredModel(): string {
  if (modelProvider() === 'local') {
    return entorno('OLLAMA_MODEL') ?? DEFAULT_LOCAL_MODEL;
  }
  return entorno('ANTHROPIC_MODEL') ?? DEFAULT_AI_MODEL;
}
