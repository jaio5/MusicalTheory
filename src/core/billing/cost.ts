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
 */
export interface ModelPrice {
  readonly inputPerToken: number;
  readonly outputPerToken: number;
}

/**
 * Qué hace cada modelo con el pensamiento, que es **lo que más cambia entre uno y
 * otro** y lo que más dinero mueve.
 *
 * - `se-apaga`: acepta `thinking: {type: 'disabled'}` (Opus 5, Sonnet 5, Sonnet
 *   4.6). En Opus 5 solo con esfuerzo `high` o menos, y aquí va en `low`.
 * - `entre-herramientas`: `disabled` da **400**; lo que lo apaga es
 *   `{type: 'between_tools'}`, que solo piensa entre llamadas a herramientas, y
 *   aquí no hay ninguna (Sonnet 5.5).
 * - `siempre`: no se puede apagar —`disabled` da 400 a cualquier esfuerzo— y lo
 *   único que lo modera es el esfuerzo (Opus 5.5, Fable 5 y 5.1). **Lo que piensa
 *   se cobra como salida y cuenta dentro de `max_tokens`**, así que el tope de
 *   esos modelos lleva una reserva para pensar (`RESERVA_PARA_PENSAR`) y el coste
 *   la paga.
 * - `no-piensa`: sin `thinking` no piensa (Haiku 4.5).
 *
 * Comprobado contra la documentación de la API el 7 de octubre de 2026
 * (`platform.claude.com/docs`: «Effort», «Steering thinking», «Structured
 * outputs»; adr/0103). Lo que decide qué se manda es `server/ask-model.ts`, que
 * lee esto: el coste y la petición no pueden separarse.
 */
export type Pensamiento = 'se-apaga' | 'entre-herramientas' | 'siempre' | 'no-piensa';

export interface Modelo extends ModelPrice {
  readonly pensamiento: Pensamiento;
  /**
   * Si acepta `output_config.effort`. **Haiku 4.5 no**: lo rechaza con 400, y
   * mandárselo dejaba todas las preguntas sin contestar.
   */
  readonly esfuerzo: boolean;
}

/**
 * Los modelos vigentes, con su precio y lo que aceptan.
 *
 * Precios comprobados contra la tabla de la API el 7 de octubre de 2026. Si
 * cambian, se cambian aquí y los cupos se recalculan solos. **Un modelo vigente
 * tiene que estar aquí**: el que no está se cobra como el peor caso
 * (`MODELO_DESCONOCIDO`) y sus cupos salen diminutos.
 */
export const MODEL_PRICES: Readonly<Record<string, Modelo>> = {
  'claude-fable-5-1': {
    inputPerToken: 10,
    outputPerToken: 50,
    pensamiento: 'siempre',
    esfuerzo: true,
  },
  'claude-fable-5': {
    inputPerToken: 10,
    outputPerToken: 50,
    pensamiento: 'siempre',
    esfuerzo: true,
  },
  // Más barato que Opus 5 —cuatro y veinte, no cinco y veinticinco— y sin forma
  // de apagar el pensamiento: con la reserva, una pregunta le sale más cara.
  'claude-opus-5-5': {
    inputPerToken: 4,
    outputPerToken: 20,
    pensamiento: 'siempre',
    esfuerzo: true,
  },
  'claude-opus-5': {
    inputPerToken: 5,
    outputPerToken: 25,
    pensamiento: 'se-apaga',
    esfuerzo: true,
  },
  // El de por defecto (adr/0103): el precio de Sonnet 5 y el pensamiento apagado
  // de otra manera.
  'claude-sonnet-5-5': {
    inputPerToken: 2,
    outputPerToken: 10,
    pensamiento: 'entre-herramientas',
    esfuerzo: true,
  },
  // Dos y diez, no tres y quince. El tres y quince es el de Sonnet 4.6, y estuvo
  // aquí puesto como si fuera el de Sonnet 5: no perdía dinero —erraba por el
  // lado caro— pero prometía cupos más pequeños de los que el dinero paga.
  'claude-sonnet-5': {
    inputPerToken: 2,
    outputPerToken: 10,
    pensamiento: 'se-apaga',
    esfuerzo: true,
  },
  'claude-sonnet-4-6': {
    inputPerToken: 3,
    outputPerToken: 15,
    pensamiento: 'se-apaga',
    esfuerzo: true,
  },
  // Con su alias y con su nombre fechado, que es como lo escribe la documentación
  // de salidas estructuradas: cualquiera de los dos en el entorno tiene que
  // encontrar su precio y no caer en el del peor caso.
  'claude-haiku-4-5': {
    inputPerToken: 1,
    outputPerToken: 5,
    pensamiento: 'no-piensa',
    esfuerzo: false,
  },
  'claude-haiku-4-5-20251001': {
    inputPerToken: 1,
    outputPerToken: 5,
    pensamiento: 'no-piensa',
    esfuerzo: false,
  },
};

/**
 * El precio que se supone cuando el configurado no está en la tabla.
 *
 * El más caro de la tabla, **calculado y no escrito**. Estuvo apuntando a Opus 5
 * a mano, y al entrar un modelo más caro que él ese respaldo pasó a cobrar de
 * menos sin que nadie lo tocara: exactamente el descuido que se quería evitar.
 *
 * Si mañana alguien pone en el entorno un modelo que aquí no figura, lo seguro es
 * cobrarlo como el peor caso conocido y que los cupos salgan pequeños. Suponer el
 * barato regalaría dinero en silencio.
 */
export function elMasCaro(precios: readonly ModelPrice[]): ModelPrice {
  return precios.reduce((caro, precio) =>
    precio.inputPerToken + precio.outputPerToken > caro.inputPerToken + caro.outputPerToken
      ? precio
      : caro,
  );
}

const MAS_CARO = elMasCaro(Object.values(MODEL_PRICES));

/**
 * Lo que se supone de un modelo que no está en la tabla: **el peor caso en todo**.
 *
 * El precio del más caro y un pensamiento que no se apaga, que es lo que hacen
 * los modelos nuevos de la API desde Opus 5.5. A la petición se le manda
 * `effort: 'low'` y nada de `thinking`, que es lo que aceptan todos los modelos
 * nuevos; uno viejo que no aceptara el esfuerzo contestaría 400, la ruta tiraría
 * del respaldo y el registro lo diría (adr/0103).
 */
export const MODELO_DESCONOCIDO: Modelo = {
  inputPerToken: MAS_CARO.inputPerToken,
  outputPerToken: MAS_CARO.outputPerToken,
  pensamiento: 'siempre',
  esfuerzo: true,
};

/** El precio de respaldo, con el nombre que tuvo. Es `MODELO_DESCONOCIDO`. */
export const FALLBACK_PRICE: Modelo = MODELO_DESCONOCIDO;

export function modeloDe(modelId: string | undefined): Modelo {
  return (modelId === undefined ? undefined : MODEL_PRICES[modelId]) ?? MODELO_DESCONOCIDO;
}

/** El precio de un modelo. Es `modeloDe`, con el nombre que ya usaban las pruebas. */
export function priceOf(modelId: string | undefined): Modelo {
  return modeloDe(modelId);
}

/**
 * Lo que se le deja pensar a un modelo que no puede dejar de hacerlo, en tokens.
 *
 * **Sale del mismo `max_tokens`**: el pensamiento cuenta dentro del tope de
 * salida y se cobra como salida. Sin esta reserva, un Opus 5.5 que piense
 * doscientos tokens en una pregunta con tope de cuatrocientos devolvía la
 * respuesta cortada —se paga y no se sirve— y el coste que suponían los cupos
 * era el de una salida sin pensar, que ese modelo no hace nunca.
 *
 * Mil veinticuatro: con esfuerzo `low` y la respuesta atada a un esquema, el
 * modelo piensa poco o nada, y esto deja sitio a una pasada corta sin que el
 * peor caso se dispare. Se paga entera en el peor caso, que es como se cuenta
 * todo aquí.
 */
export const RESERVA_PARA_PENSAR = 1024;

/** Cuántos tokens de más lleva el tope de salida para pensar con ese modelo. */
export function reservaParaPensar(modelId: string | undefined): number {
  return modeloDe(modelId).pensamiento === 'siempre' ? RESERVA_PARA_PENSAR : 0;
}

/** Las dos cosas que llaman al modelo. Cada una cuesta distinto. */
export type AiFeature = 'profesor' | 'versiones';

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
  // La más cara de las dos, y con motivo: la entrada lleva la progresión entera
  // —hasta treinta y dos grados— más el catálogo de movimientos, y la salida son
  // tres progresiones completas en vez de cuatro frases.
  versiones: { input: 1400, output: 900 },
};

/**
 * El peor caso de una petición **con ese modelo**: el de `TOKEN_BUDGETS` más la
 * reserva para pensar si el modelo no puede dejar de hacerlo.
 *
 * El `max_tokens` que manda `server/ask-model.ts` es la salida de aquí, y el
 * coste también: el peor caso que suponen los cupos es el tope que impone el
 * servidor, también cuando una parte se va en pensar.
 */
export function presupuestoDe(feature: AiFeature, modelId: string | undefined): TokenBudget {
  const base = TOKEN_BUDGETS[feature];
  return {
    input: base.input + peorTextoLibreEnTokens(feature),
    output: base.output + reservaParaPensar(modelId),
  };
}

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

/** Lo más larga que puede ser una pregunta al profesor, en caracteres. */
export const MAX_QUESTION_LENGTH = 240;

/**
 * Lo más largas que pueden ser las directrices de una salida, en caracteres.
 *
 * Lo mismo que una pregunta al profesor, y por lo mismo: es una o dos frases
 * —«que suene a rock lento», «con un punteo en el estribillo»—, no un guion. Con
 * más, lo que se gana es que el modelo tenga más de donde desviarse.
 */
export const MAX_DIRECTRICES_LENGTH = 240;

/**
 * Cuántos tokens puede llegar a costar **cada uno de los caracteres** que deja
 * pasar el texto libre, en el peor caso.
 *
 * Los prompts se miden en `server/prompts.test.ts` a 3,2 caracteres por token, y
 * para el castellano es verdad. **Para el texto libre no**: lo escribe quien
 * pregunta, y 240 caracteres chinos o del silabario yi eran hasta 587 tokens, no
 * 75. Contado a 3,2, una pregunta de esas costaba más de lo que suponía su cupo
 * (adr/0114).
 *
 * **Dos**, y sale de los bytes. El tokenizador trabaja por bytes, así que un
 * texto no puede costar más tokens que bytes UTF-8 tiene. Y el contrato
 * (`textoLibre` en `core/marca.ts`, adr/0115) recorta a lo que pesaría como 240
 * letras latinas: lo que más bytes deja pasar son 240 letras latinas con tilde
 * —dos bytes cada una—, porque un carácter chino ya cuenta sus tres bytes y de
 * ésos solo caben veinticinco. Lo vigila `cost.test.ts` con el recorte de verdad:
 * si el contrato deja pasar más bytes, falla ahí y no en la factura.
 */
export const TOKENS_POR_CARACTER_LIBRE = 2;

/** Cuánto texto libre deja pasar cada petición, en caracteres. */
export const TEXTO_LIBRE: Readonly<Record<'profesor' | 'versiones', number>> = {
  profesor: MAX_QUESTION_LENGTH,
  versiones: MAX_DIRECTRICES_LENGTH,
};

/**
 * Lo que el texto libre puede pesar **de más** sobre lo que ya cuenta
 * `TOKEN_BUDGETS`, que lo mide como si fuera castellano.
 *
 * Se suma entero y no la diferencia: contar dos veces los setenta y cinco tokens
 * del castellano es error a favor del gasto, y restarlos ataría este número a la
 * medida de un test.
 */
export function peorTextoLibreEnTokens(feature: 'profesor' | 'versiones'): number {
  return TEXTO_LIBRE[feature] * TOKENS_POR_CARACTER_LIBRE;
}

/**
 * Cuántas versiones de una canción se piden de una vez.
 *
 * Tres y no cinco: cada una es una progresión entera, así que subirlo encarece
 * la petición mucho más deprisa que cualquier otro tope de aquí. Y tres es lo que se puede
 * comparar de un vistazo con la guitarra en las manos; con cinco hay que
 * desplazarse, y desplazarse es soltar las cuerdas.
 */
export const MAX_VERSIONS = 3;

/** Lo más larga que puede ser la progresión que se manda a rearmonizar. */
export const MAX_VERSION_DEGREES = 32;

/**
 * Cuántas veces se le puede preguntar al modelo por **una** petición del cupo.
 *
 * Las dos rutas reintentan una vez cuando lo que vuelve no pasa la validación
 * contra el dominio, y el cupo se gasta una sola vez —`spendAi` se llama antes
 * del bucle—. Así que una petición contada puede costar dos llamadas pagadas.
 *
 * Estuvo sin contar, y era el mismo fallo que este fichero vino a arreglar en la
 * fase 11: no multiplicar. No llegaba a perder dinero, pero el 60 % de margen
 * que promete `MODEL_SPEND_SHARE` se quedaba en la mitad en el peor caso. Las
 * rutas leen esta constante, para que el número que reintentan y el número con
 * el que se calcula el dinero no puedan separarse.
 *
 * **Y por debajo no hay más.** El SDK reintentaba una vez por su cuenta, y con
 * él una petición podían ser cuatro llamadas: ahora va con `maxRetries: 0`
 * (`server/ask-model.ts`) y el reintento de un 429 o un 5xx es uno de estos dos
 * (adr/0114).
 */
export const MAX_MODEL_ATTEMPTS = 2;

/**
 * Lo que cuesta, como máximo, una petición de esa clase con ese modelo.
 *
 * **Incluye el reintento.** Lo que se cobra del cupo es una petición; lo que se
 * puede llegar a pagar son dos llamadas. Y la reserva para pensar de los modelos
 * que no lo apagan (`presupuestoDe`).
 */
export function requestCostMicros(feature: AiFeature, modelId: string | undefined): number {
  const price = modeloDe(modelId);
  const budget = presupuestoDe(feature, modelId);
  const unaLlamada = budget.input * price.inputPerToken + budget.output * price.outputPerToken;
  return unaLlamada * MAX_MODEL_ATTEMPTS;
}

/**
 * Lo que ha gastado de verdad una llamada, según el `usage` que devuelve la API.
 *
 * Los tokens de caché se cobran como entrada —escribirla sale algo más cara y
 * leerla mucho más barata—: aquí no se usa caché, y si un día se usara, contarla
 * al precio de entrada erraría por poco y casi siempre hacia arriba.
 */
export interface UsoDelModelo {
  readonly entrada: number;
  readonly salida: number;
}

export function costeDeUso(uso: UsoDelModelo, modelId: string | undefined): number {
  const precio = modeloDe(modelId);
  return uso.entrada * precio.inputPerToken + uso.salida * precio.outputPerToken;
}

/**
 * Lo que se cuenta de una llamada que **no ha devuelto `usage`**: un tiempo
 * agotado o una conexión cortada, en que la API pudo haber trabajado y cobrado
 * sin que lo sepamos. El peor caso de una llamada, que es lo que se reservó.
 */
export function peorLlamadaMicros(feature: AiFeature, modelId: string | undefined): number {
  return requestCostMicros(feature, modelId) / MAX_MODEL_ATTEMPTS;
}

/**
 * Qué parte de lo que **de verdad entra** puede irse en llamadas al modelo.
 *
 * El 40 %, o sea un **60 % de margen sobre el ingreso neto**: lo que queda del
 * precio después de quitarle el IVA y la comisión de la pasarela. Con ese 60 % se
 * pagan el servidor y la base de datos, y queda beneficio. Subirlo aprieta el
 * margen; bajarlo hace los cupos más pequeños. Es el único número de este fichero
 * que es una decisión de negocio y no una medida, y por eso está solo y con
 * nombre.
 *
 * **Estuvo contado sobre el precio con IVA**, y el «60 %» era mentira: de 4,99 €
 * se van 0,87 de IVA y hasta 0,68 de comisión, y el margen real en el peor mes
 * quedaba entre el 43 y el 45 % (adr/0106). Ahora el 60 % es sobre lo que entra,
 * y un test lo comprueba con cada modelo de la tabla.
 */
export const MODEL_SPEND_SHARE = 0.4;

/**
 * El IVA que se supone incluido en el precio, en tanto por ciento.
 *
 * **El 21 % de España, y es un supuesto.** La pasarela es la vendedora oficial
 * (adr/0105) y cobra el IVA del país de quien paga, que en la Unión va del 17 %
 * de Luxemburgo al 27 % de Hungría: con el precio igual en todas partes, una
 * venta en Hungría deja algo menos de lo que cuenta esto y una en Luxemburgo algo
 * más. Las cifras del caso húngaro están en `docs/CUENTAS-Y-PLANES.md`.
 */
export const IVA_POR_CIENTO = 21;

/**
 * La comisión de la pasarela por cobro, en **puntos básicos** (centésimas de
 * punto): 865 son el 8,65 %.
 *
 * Es el **peor caso** de Stripe Managed Payments (adr/0105): 3,5 % de ser la
 * vendedora oficial, más 3,15 % de una tarjeta de fuera del Espacio Económico
 * Europeo, más 2 % de cambio de divisa. Con una tarjeta europea son 5 puntos;
 * se cuenta el peor porque los cupos son el mismo número para todos. Tarifas de
 * `stripe.com/es/pricing`, 7 de octubre de 2026.
 */
export const COMISION_PUNTOS_BASICOS = 865;

/** La parte fija de la comisión, en céntimos por cobro: 0,25 €. */
export const COMISION_FIJA_CENTS = 25;

/**
 * Lo que entra de un cobro de esos céntimos, en micro-unidades, **sin IVA y sin
 * comisión**.
 *
 * La comisión se calcula sobre el importe cobrado, IVA incluido, que es como la
 * cobra la pasarela. Redondeado hacia abajo en cada paso: el error de redondeo
 * va contra nosotros, no contra el margen.
 */
export function netoDeUnCobroMicros(cents: number): number {
  if (cents <= 0) {
    return 0;
  }
  const bruto = cents * 10_000;
  const sinIva = Math.floor((bruto * 100) / (100 + IVA_POR_CIENTO));
  const comision =
    Math.ceil((bruto * COMISION_PUNTOS_BASICOS) / 10_000) + COMISION_FIJA_CENTS * 10_000;
  return sinIva - comision;
}

/**
 * Lo que deja un mes de ese plan, en micro-unidades: el **menor** entre pagarlo
 * al mes y pagarlo al año dividido entre doce.
 *
 * El menor y no el de cada uno porque el cupo es uno por plan: quien paga al año
 * tiene dos meses gratis y deja menos al mes, y el cupo tiene que cuadrar con él.
 * Quien paga al mes deja más y recibe lo mismo; el anual es un descuento, no
 * otro producto (adr/0106).
 */
export function ingresoMensualNetoMicros(planId: PlanId): number {
  const plan = planOf(planId);
  const mensual = netoDeUnCobroMicros(plan.monthlyCents);
  const anual = Math.floor(netoDeUnCobroMicros(plan.annualCents) / 12);
  return Math.max(0, Math.min(mensual, anual));
}

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
  return Math.floor(ingresoMensualNetoMicros(planId) * MODEL_SPEND_SHARE);
}

/**
 * Lo que se le regala a quien no paga, en peticiones al mes.
 *
 * El plan gratis no tiene presupuesto porque no ingresa nada: cada petición suya
 * es dinero perdido a cambio de que pruebe el profesor y decida si le sirve. Es
 * gasto de captación, y es el **único sitio de la aplicación que pierde dinero a
 * propósito**.
 *
 * Quince preguntas al mes, **con su reintento**, que es lo que se paga: cada una
 * puede ser dos llamadas (`MAX_MODEL_ATTEMPTS`). La tabla de aquí decía veinte
 * céntimos por cuenta con Opus 5 y era la mitad de la verdad, porque no contaba
 * el reintento; eran cuarenta. Multiplicado, que es la operación que este fichero
 * existe para no olvidar:
 *
 * | Cuentas gratis | Con Sonnet 5.5 (el de por defecto) | Con Opus 5 | Con un modelo desconocido |
 * | -------------- | ---------------------------------- | ---------- | ------------------------- |
 * | 100            | 19 $                               | 48 $       | 249 $                     |
 * | 1.000          | 191 $                              | 477 $      | 2.490 $                   |
 * | 10.000         | 1.908 $                            | 4.770 $    | 24.900 $                  |
 *
 * El peor caso de verdad es la última columna: un modelo que no está en la tabla
 * se cobra como Fable y pensando (`MODELO_DESCONOCIDO`). Lo vigila un test.
 *
 * A partir de unos cientos de cuentas deja de ser captación y pasa a ser una
 * factura. **Y las cuentas se fabrican**: el registro no confirma el correo, así
 * que la tabla de arriba no tiene techo por sí sola. El techo es aparte y en
 * dinero: el tope de gasto del plan gratis, más bajo que el de todos y
 * configurable (`server/ai-gasto.ts`, adr/0114). Esta tabla dice cuándo ese tope
 * empieza a cerrar lo gratis a gente de verdad.
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
 * La unidad del cupo: **una pregunta al profesor**.
 *
 * El cupo de cada plan se cuenta en preguntas, y lo que cuesta más gasta más de
 * una (adr/0067). Antes se dividía el presupuesto entre la petición más cara que
 * el plan podía hacer, y en cuanto las salidas bajaron a Medio (adr/0066) Medio
 * prometía menos peticiones que Básico costando el doble: el número era honrado
 * con el dinero y engañoso para quien lo leía. Contando en preguntas, el número
 * sube con el precio y el dinero sigue acotado, porque cada petición paga lo suyo.
 */
export const UNIDAD_DEL_CUPO: AiFeature = 'profesor';

/**
 * Cuántas preguntas del cupo gasta una petición de esa clase con ese modelo.
 *
 * **Hacia arriba, siempre.** Con el redondeo hacia abajo, gastarse el cupo entero
 * en salidas pagaría más que el presupuesto; hacia arriba, nunca llega. Una
 * salida con un modelo que apaga el pensamiento cuesta algo más de dos preguntas, así que
 * gasta tres: el redondeo regala algo de margen, y es margen nuestro, no del
 * cliente. Con uno que piensa siempre gasta dos, porque la reserva para pensar
 * pesa lo mismo en las dos peticiones y acerca su coste.
 */
export function unidadesDe(feature: AiFeature, modelId: string | undefined): number {
  return Math.ceil(
    requestCostMicros(feature, modelId) / requestCostMicros(UNIDAD_DEL_CUPO, modelId),
  );
}

/**
 * Cuántas preguntas al mes da un plan con el modelo que haya puesto.
 *
 * Es una división: presupuesto entre lo que cuesta una pregunta. Nada más, y eso
 * es lo bueno: no hay forma de que el número prometido y el dinero disponible se
 * separen, porque lo que cuesta más que una pregunta gasta más de una
 * (`unidadesDe`).
 */
export function monthlyAiRequests(planId: PlanId, modelId: string | undefined): number {
  const plan = planOf(planId);
  if (plan.monthlyCents === 0) {
    return FREE_MONTHLY_ALLOWANCE;
  }
  const cost = requestCostMicros(UNIDAD_DEL_CUPO, modelId);
  /* v8 ignore next -- ningun precio de la tabla es cero, y lo que no esta en ella cae en el mas caro */
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

/** Las clases de petición que un plan puede hacer: las que su plan abre. */
function featuresOf(plan: Plan): readonly AiFeature[] {
  return (['profesor', 'versiones'] as const).filter((feature) =>
    plan.capabilities.includes(feature),
  );
}

/**
 * Lo que costaría, como máximo, un mes de ese plan. Lo usa el test del margen.
 *
 * El peor mes es el que se gasta el cupo entero en la petición que peor sale por
 * pregunta gastada. Con el redondeo hacia arriba de `unidadesDe` eso es siempre
 * el profesor, pero se calcula para todas en vez de suponerlo: si mañana entra
 * una petición cuya proporción redondea mal, este número lo dice.
 */
export function worstMonthlyCostMicros(planId: PlanId, modelId: string | undefined): number {
  const plan = planOf(planId);
  const cupo = monthlyAiRequests(planId, modelId);
  return Math.max(
    ...featuresOf(plan).map(
      (feature) =>
        Math.floor(cupo / unidadesDe(feature, modelId)) * requestCostMicros(feature, modelId),
    ),
  );
}

/**
 * Lo que queda de beneficio en el peor mes posible, en micro-dólares: lo que
 * entra **sin IVA ni comisión** menos lo que se gasta en modelo.
 *
 * Negativo significa que ese plan pierde dinero si alguien se gasta el cupo. Hay
 * un test que lo comprueba para los tres planes y los tres modelos.
 */
export function worstMonthlyMarginMicros(planId: PlanId, modelId: string | undefined): number {
  return ingresoMensualNetoMicros(planId) - worstMonthlyCostMicros(planId, modelId);
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
