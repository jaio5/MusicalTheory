/**
 * Lo que cuesta servir la IA, y cuánto se puede dejar gastar sin perder dinero.
 *
 * Este fichero existe porque los cupos estaban escritos a mano y **perdían
 * dinero**: cuarenta peticiones al día son mil doscientas al mes, y a dos
 * céntimos la petición eso son veintiséis euros de coste para un plan de 4,99 €.
 * Nadie lo había multiplicado.
 *
 * Ahora no hay cupos escritos a mano: se **calculan** desde el precio del plan,
 * el precio del modelo y el peor caso de tokens de cada petición. Cambiar el
 * precio de un plan cambia su cupo sola; cambiar de modelo también. Y un test
 * comprueba que ningún plan puede perder dinero ni gastándose el cupo entero.
 *
 * El peor caso y no el caso típico. Esto es la decisión de fondo: quien quiera
 * gastar va a gastar el máximo, así que el cupo tiene que cuadrar con el máximo.
 * Calcularlo sobre el gasto medio funciona hasta que aparece el primer usuario
 * que aprieta, y entonces ya se ha perdido el dinero.
 */

import { PLANS, planOf, type Plan, type PlanId } from './plans';

/**
 * Lo que cobra Anthropic, en **micro-dólares por token** —millonésimas de dólar—.
 *
 * En micro-dólares por token y no en dólares por millón porque el número sale el
 * mismo (5 $/millón son 5 µ$/token) y así todo son enteros: los precios en coma
 * flotante multiplicados por miles de peticiones acumulan céntimos de error justo
 * en la cuenta que no puede tenerlos.
 *
 * Comprobado contra la tabla de precios de la API el 25 de agosto de 2026. Si
 * cambian, se cambian aquí y los cupos se recalculan solos.
 */
export interface ModelPrice {
  readonly inputPerToken: number;
  readonly outputPerToken: number;
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'claude-fable-5': { inputPerToken: 10, outputPerToken: 50 },
  'claude-opus-5': { inputPerToken: 5, outputPerToken: 25 },
  // Dos y diez, no tres y quince. El tres y quince es el de Sonnet 4.6, y estuvo
  // aquí puesto como si fuera el de Sonnet 5: no perdía dinero —erraba por el
  // lado caro— pero prometía cupos más pequeños de los que el dinero paga.
  'claude-sonnet-5': { inputPerToken: 2, outputPerToken: 10 },
  'claude-sonnet-4-6': { inputPerToken: 3, outputPerToken: 15 },
  'claude-haiku-4-5': { inputPerToken: 1, outputPerToken: 5 },
};

/**
 * El modelo que se supone cuando el configurado no está en la tabla.
 *
 * El más caro de la tabla, **calculado y no escrito**. Estuvo apuntando a Opus 5
 * a mano, y al entrar un modelo más caro que él ese respaldo pasó a cobrar de
 * menos sin que nadie lo tocara: exactamente el descuido que se quería evitar.
 *
 * Si mañana alguien pone en el entorno un modelo que aquí no figura, lo seguro es
 * cobrarlo como el peor caso conocido y que los cupos salgan pequeños. Suponer el
 * barato regalaría dinero en silencio.
 */
export const FALLBACK_PRICE: ModelPrice = Object.values(MODEL_PRICES).reduce((caro, precio) =>
  precio.inputPerToken + precio.outputPerToken > caro.inputPerToken + caro.outputPerToken
    ? precio
    : caro,
);

export function priceOf(modelId: string | undefined): ModelPrice {
  return (modelId === undefined ? undefined : MODEL_PRICES[modelId]) ?? FALLBACK_PRICE;
}

/** Las tres cosas que llaman al modelo. Cada una cuesta distinto. */
export type AiFeature = 'profesor' | 'ideas' | 'versiones';

/**
 * El peor caso de tokens de cada petición.
 *
 * `input` es lo que se manda: el prompt de sistema, los datos de la tonalidad y
 * el esquema de salida. `output` es el tope que se le pone al modelo —el
 * `max_tokens` de la ruta sale de aquí—, así que el peor caso de salida no es una
 * estimación: es un límite que el servidor impone.
 *
 * Los de entrada sí son estimación, medidos por longitud de los prompts reales
 * —unos 3,6 caracteres por token en español— con holgura de sobra. Un test en
 * `src/app/api/ai-cost.test.ts` falla si los prompts crecen hasta comerse esa
 * holgura, que es lo que evita que el modelo de coste se quede mintiendo cuando
 * alguien alargue el prompt de sistema.
 */
export interface TokenBudget {
  readonly input: number;
  readonly output: number;
}

export const TOKEN_BUDGETS: Readonly<Record<AiFeature, TokenBudget>> = {
  profesor: { input: 700, output: 400 },
  ideas: { input: 900, output: 700 },
  // La más cara de las tres, y con motivo: la entrada lleva la progresión entera
  // —hasta treinta y dos grados— más el catálogo de movimientos, y la salida son
  // tres progresiones completas en vez de cuatro frases.
  versiones: { input: 1400, output: 900 },
};

/**
 * Los topes de tamaño de una petición.
 *
 * Viven aquí, con el modelo de coste, y no solo en los contratos, porque **son
 * palancas de gasto**: cada uno de estos números entra en el presupuesto de tokens
 * de arriba, y subir cualquiera encarece la petición y baja el cupo de todos los
 * planes. Puestos al lado del presupuesto, la relación se ve; escondidos en un
 * contrato, se suben sin pensar.
 *
 * Los contratos de `features/` los reexportan, así que quien lea un contrato no
 * tiene que saber nada de esto.
 */

/** Cuántas ideas se piden como mucho en una tanda. Unos 60 tokens cada una. */
export const MAX_IDEAS = 4;

/** Lo más larga que puede ser una pregunta al profesor, en caracteres. */
export const MAX_QUESTION_LENGTH = 240;

/** Cuántas notas recientes se le mandan como contexto. */
export const MAX_RECENT_NOTES = 32;

/** Cuántos acordes recientes se le mandan como contexto. */
export const MAX_RECENT_CHORDS = 16;

/**
 * Cuántas versiones de una canción se piden de una vez.
 *
 * Tres y no cinco: cada una es una progresión entera, así que subirlo encarece
 * la petición mucho más deprisa que subir `MAX_IDEAS`. Y tres es lo que se puede
 * comparar de un vistazo con la guitarra en las manos; con cinco hay que
 * desplazarse, y desplazarse es soltar las cuerdas.
 */
export const MAX_VERSIONS = 3;

/** Lo más larga que puede ser la progresión que se manda a rearmonizar. */
export const MAX_VERSION_DEGREES = 32;

/**
 * Cuántas veces se le puede preguntar al modelo por **una** petición del cupo.
 *
 * Las tres rutas reintentan una vez cuando lo que vuelve no pasa la validación
 * contra el dominio, y el cupo se gasta una sola vez —`spendAi` se llama antes
 * del bucle—. Así que una petición contada puede costar dos llamadas pagadas.
 *
 * Estuvo sin contar, y era el mismo fallo que este fichero vino a arreglar en la
 * fase 11: no multiplicar. No llegaba a perder dinero, pero el 60 % de margen
 * que promete `MODEL_SPEND_SHARE` se quedaba en la mitad en el peor caso. Las
 * rutas leen esta constante, para que el número que reintentan y el número con
 * el que se calcula el dinero no puedan separarse.
 */
export const MAX_MODEL_ATTEMPTS = 2;

/**
 * Lo que cuesta, como máximo, una petición de esa clase con ese modelo.
 *
 * **Incluye el reintento.** Lo que se cobra del cupo es una petición; lo que se
 * puede llegar a pagar son dos llamadas.
 */
export function requestCostMicros(feature: AiFeature, modelId: string | undefined): number {
  const price = priceOf(modelId);
  const budget = TOKEN_BUDGETS[feature];
  const unaLlamada = budget.input * price.inputPerToken + budget.output * price.outputPerToken;
  return unaLlamada * MAX_MODEL_ATTEMPTS;
}

/**
 * Qué parte del precio puede irse en llamadas al modelo.
 *
 * El 40 %, o sea un **60 % de margen**. Con eso se pagan el resto de las cosas
 * —servidor, base de datos, la comisión de la pasarela cuando la haya, el IVA— y
 * queda beneficio. Subirlo aprieta el margen; bajarlo hace los cupos más
 * pequeños. Es el único número de este fichero que es una decisión de negocio y
 * no una medida, y por eso está solo y con nombre.
 */
export const MODEL_SPEND_SHARE = 0.4;

/**
 * Cuánto se puede gastar al mes en modelo por cada cuenta de ese plan, en
 * micro-dólares.
 *
 * **Un euro se cuenta como un dólar.** Es falso y es falso a nuestro favor: el
 * euro vale más, así que suponerlo a la par deja margen de sobra y, sobre todo,
 * hace que una bajada del euro no se coma el beneficio sin que nadie se entere.
 * Un cambio de divisa metido aquí sería un número que hay que vigilar cada mes.
 */
export function monthlyBudgetMicros(planId: PlanId): number {
  const cents = planOf(planId).monthlyCents;
  return Math.floor(cents * 10_000 * MODEL_SPEND_SHARE);
}

/**
 * Lo que se le regala a quien no paga, en peticiones al mes.
 *
 * El plan gratis no tiene presupuesto porque no ingresa nada: cada petición suya
 * es dinero perdido a cambio de que pruebe el profesor y decida si le sirve. Es
 * gasto de captación, y es el **único sitio de la aplicación que pierde dinero a
 * propósito**.
 *
 * Quince al mes con el modelo más caro son unos veinte céntimos por cuenta.
 * Multiplicado, que es la operación que este fichero existe para no olvidar:
 *
 * | Cuentas gratis | Coste al mes con Opus 5 |
 * | -------------- | ----------------------- |
 * | 100            | 20 $                    |
 * | 1.000          | 203 $                   |
 * | 10.000         | 2.033 $                 |
 *
 * A partir de unos cientos de cuentas deja de ser captación y pasa a ser una
 * factura, y entonces hay que **decidir**: bajar el número, quitarle la IA al
 * plan gratis o poner un tope de gasto global. Lo que no se puede es descubrirlo
 * en la factura, y esa tabla está aquí para que no haya que multiplicar nada
 * cuando llegue el momento.
 *
 * Es una constante del dominio y no una variable de entorno, igual que el precio
 * de un plan: las dos son decisiones que se toman una vez y se despliegan, no
 * palancas que se mueven en caliente. Y sobre todo, el navegador la usa para
 * decir cuántas peticiones te quedan: si el servidor pudiera tener otro número,
 * la pantalla prometería lo que la ruta niega.
 *
 * Cero es un valor válido y significa «sin IA sin pagar».
 */
export const FREE_MONTHLY_ALLOWANCE = 15;

/**
 * La cosa más cara que ese plan puede pedirle al modelo.
 *
 * El cupo es uno y compartido, así que el peor caso de un plan es el de su
 * petición más cara: quien tiene ideas puede gastarse el cupo entero en ideas.
 * Calcularlo con el profesor —que es más barato— dejaría un agujero del tamaño de
 * la diferencia.
 */
function worstFeature(plan: Plan): AiFeature {
  if (plan.capabilities.includes('versiones')) {
    return 'versiones';
  }
  return plan.capabilities.includes('ideas') ? 'ideas' : 'profesor';
}

/**
 * Cuántas peticiones al mes da un plan con el modelo que haya puesto.
 *
 * Es una división: presupuesto entre coste del peor caso. Nada más, y eso es lo
 * bueno: no hay forma de que el número prometido y el dinero disponible se
 * separen, porque el número **es** el dinero disponible.
 */
export function monthlyAiRequests(planId: PlanId, modelId: string | undefined): number {
  const plan = planOf(planId);
  if (plan.monthlyCents === 0) {
    return FREE_MONTHLY_ALLOWANCE;
  }
  const cost = requestCostMicros(worstFeature(plan), modelId);
  return cost <= 0 ? 0 : Math.floor(monthlyBudgetMicros(plan.id) / cost);
}

/**
 * Los días que se le suponen a un mes para repartir el cupo.
 *
 * Treinta y uno y no treinta: con treinta, un mes de treinta y un días se pasa
 * del presupuesto por un día entero de cupo.
 */
export const DAYS_PER_MONTH = 31;

/**
 * Cuántos días de un mes se pueden gastar de golpe.
 *
 * El cupo mensual es el que protege el dinero; este es el que evita que alguien
 * se lo funda el día uno y se quede veintinueve días sin profesor, que es una
 * forma rara de cumplir lo prometido. Cinco días de cupo medio: deja margen para
 * una tarde de estudio de verdad sin permitir vaciar el mes en una.
 */
export const BURST_DAYS = 5;

export function dailyAiRequests(planId: PlanId, modelId: string | undefined): number {
  const monthly = monthlyAiRequests(planId, modelId);
  // Al menos una al día mientras quede cupo mensual: un cupo diario de cero
  // convertiría el plan en «no puedes usarlo nunca».
  return Math.max(1, Math.ceil((monthly * BURST_DAYS) / DAYS_PER_MONTH));
}

/** Lo que costaría, como máximo, un mes de ese plan. Lo usa el test del margen. */
export function worstMonthlyCostMicros(planId: PlanId, modelId: string | undefined): number {
  const plan = planOf(planId);
  return monthlyAiRequests(planId, modelId) * requestCostMicros(worstFeature(plan), modelId);
}

/**
 * Lo que queda de beneficio en el peor mes posible, en micro-dólares.
 *
 * Negativo significa que ese plan pierde dinero si alguien se gasta el cupo. Hay
 * un test que lo comprueba para los tres planes y los tres modelos.
 */
export function worstMonthlyMarginMicros(planId: PlanId, modelId: string | undefined): number {
  const cents = planOf(planId).monthlyCents;
  return cents * 10_000 - worstMonthlyCostMicros(planId, modelId);
}

/** El precio en dólares con dos decimales, para escribirlo en un documento. */
export function microsToDollars(micros: number): string {
  return (micros / 1_000_000).toFixed(4);
}

/** Todos los planes con sus cupos para un modelo. Lo usa la pantalla de planes. */
export function quotasFor(
  modelId: string | undefined,
): ReadonlyArray<{ readonly plan: Plan; readonly monthly: number; readonly daily: number }> {
  return PLANS.map((plan) => ({
    plan,
    monthly: monthlyAiRequests(plan.id, modelId),
    daily: dailyAiRequests(plan.id, modelId),
  }));
}
