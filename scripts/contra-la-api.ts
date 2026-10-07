/**
 * La puerta de los dos exámenes de la IA: **contra quién se examina y cuánto va a
 * costar**, antes de mandar la primera pregunta.
 *
 * Los exámenes nacieron contra el modelo de casa y se negaban a correr con clave,
 * porque con `ANTHROPIC_API_KEY` contesta la API y se paga. Eso evitaba un gasto
 * por descuido y también impedía la medida que más falta hace —la del modelo de
 * pago— (`docs/MEDIR.md`). Ahora se puede, **pidiéndolo con `--api`**: lo explícito
 * sigue siendo pagar, no tener la clave puesta.
 *
 * El coste sale de `requestCostMicros`, el mismo que calcula los cupos: el peor
 * caso de tokens de la petición —con la reserva para pensar si el modelo no lo
 * apaga— y el reintento. Es un techo, no una previsión: lo normal es bastante
 * menos, porque casi nunca se gasta el tope de salida ni hace falta reintentar.
 */
import { requestCostMicros, type AiFeature } from '@core/billing';
import { configuredModel, modelProvider } from '@server/ai-model';

/** Dólares, con dos decimales: los micro-dólares no los lee nadie. */
function dolares(micros: number): string {
  return `${(micros / 1_000_000).toFixed(2)} $`;
}

/**
 * Deja pasar al examen, o lo para diciendo por qué.
 *
 * Con el modelo de casa pasa siempre. Con la API, solo con `--api`, y en los dos
 * casos dice antes el techo de lo que puede costar la pasada.
 */
export function puertaDelExamen(
  feature: AiFeature,
  peticiones: number,
  argumentos: readonly string[],
): void {
  const proveedor = modelProvider();
  if (proveedor === 'ninguno') {
    console.error(
      'No hay modelo que examinar: pon OLLAMA_URL (modelo de casa) o ANTHROPIC_API_KEY (con --api) en el .env.',
    );
    process.exit(1);
  }
  if (proveedor === 'local') {
    return;
  }

  const modelo = configuredModel();
  const techo = requestCostMicros(feature, modelo) * peticiones;
  const cifra = `${peticiones} peticiones a ${modelo}: como mucho ${dolares(techo)}`;
  if (!argumentos.includes('--api')) {
    console.error(
      `Con ANTHROPIC_API_KEY contesta la API de pago (${cifra}). Si es lo que quieres, añade --api; si no, deja la clave vacía y pon OLLAMA_URL.`,
    );
    process.exit(1);
  }
  console.log(`Contra la API: ${cifra}, contando el reintento y el tope de tokens.\n`);
}
