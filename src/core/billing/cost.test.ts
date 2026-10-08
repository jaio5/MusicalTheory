import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BURST_DAYS,
  DAYS_PER_MONTH,
  elMasCaro,
  FREE_MONTHLY_ALLOWANCE,
  MODEL_PRICES,
  MODEL_SPEND_SHARE,
  monthlyAiRequests,
  monthlyBudgetMicros,
  dailyAiRequests,
  priceOf,
  quotasFor,
  MAX_MODEL_ATTEMPTS,
  COMISION_FIJA_CENTS,
  COMISION_PUNTOS_BASICOS,
  costeDeUso,
  MAX_DIRECTRICES_LENGTH,
  MAX_QUESTION_LENGTH,
  peorLlamadaMicros,
  peorTextoLibreEnTokens,
  TEXTO_LIBRE,
  TOKENS_POR_CARACTER_LIBRE,
  ingresoMensualNetoMicros,
  IVA_POR_CIENTO,
  netoDeUnCobroMicros,
  modeloDe,
  MODELO_DESCONOCIDO,
  presupuestoDe,
  requestCostMicros,
  RESERVA_PARA_PENSAR,
  reservaParaPensar,
  TOKEN_BUDGETS,
  unidadesDe,
  worstMonthlyCostMicros,
  worstMonthlyMarginMicros,
} from './cost';
import { textoLibre } from '@core/marca';

import { DEFAULT_AI_MODEL } from './account';
import { PAID_PLANS, PLANS, planOf } from './plans';

const MODELOS = Object.keys(MODEL_PRICES);

describe('el precio del modelo', () => {
  it('conoce los modelos vigentes, del más caro al más barato', () => {
    expect(MODELOS).toEqual([
      'claude-fable-5-1',
      'claude-fable-5',
      'claude-opus-5-5',
      'claude-opus-5',
      'claude-sonnet-5-5',
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
      'claude-haiku-4-5-20251001',
    ]);
  });

  /**
   * Un modelo vigente que cayera en el respaldo se cobraría como Fable pensando,
   * y sus cupos saldrían de siete preguntas al mes. Los precios, de la tabla de la
   * API del 7 de octubre de 2026 (adr/0103).
   */
  it('ningún modelo vigente cae en el respaldo, y cada uno con su precio publicado', () => {
    const publicados: Record<string, [number, number]> = {
      'claude-fable-5-1': [10, 50],
      'claude-opus-5-5': [4, 20],
      'claude-sonnet-5-5': [2, 10],
      'claude-haiku-4-5-20251001': [1, 5],
      'claude-opus-5': [5, 25],
      'claude-sonnet-5': [2, 10],
      'claude-fable-5': [10, 50],
    };
    for (const [modelo, [entrada, salida]] of Object.entries(publicados)) {
      expect(modeloDe(modelo), modelo).not.toBe(MODELO_DESCONOCIDO);
      expect(modeloDe(modelo), modelo).toMatchObject({
        inputPerToken: entrada,
        outputPerToken: salida,
      });
    }
    expect(modeloDe(DEFAULT_AI_MODEL)).not.toBe(MODELO_DESCONOCIDO);
  });

  it('lo que no conoce lo supone pensando siempre, que es lo más caro', () => {
    expect(modeloDe('claude-lo-que-venga')).toBe(MODELO_DESCONOCIDO);
    expect(MODELO_DESCONOCIDO.pensamiento).toBe('siempre');
    expect(reservaParaPensar('claude-lo-que-venga')).toBe(RESERVA_PARA_PENSAR);
  });

  /**
   * Si mañana alguien pone en el entorno un modelo que no está en la tabla, lo
   * seguro es cobrarlo como el más caro que conocemos: los cupos saldrán pequeños
   * y no se regalará dinero en silencio.
   */
  it('lo que no conoce lo cobra como el más caro', () => {
    const desconocido = priceOf('claude-lo-que-venga');
    for (const model of MODELOS) {
      expect(desconocido.inputPerToken).toBeGreaterThanOrEqual(MODEL_PRICES[model]!.inputPerToken);
      expect(desconocido.outputPerToken).toBeGreaterThanOrEqual(
        MODEL_PRICES[model]!.outputPerToken,
      );
    }
    expect(priceOf(undefined)).toEqual(desconocido);
  });

  it('la salida cuesta más que la entrada en todos', () => {
    for (const model of MODELOS) {
      const price = MODEL_PRICES[model]!;
      expect(price.outputPerToken).toBeGreaterThan(price.inputPerToken);
    }
  });
});

describe('el coste de una petición', () => {
  it('una tanda de salidas cuesta más que una pregunta al profesor', () => {
    for (const model of MODELOS) {
      expect(requestCostMicros('salidas', model)).toBeGreaterThan(
        requestCostMicros('profesor', model),
      );
    }
  });

  it('sale de multiplicar tokens por precio, y por los intentos', () => {
    // Profesor con Opus 5: (1.180 × 5 + 400 × 25) por cada intento —700 del
    // prompt y 480 del peor texto libre—. El reintento se paga aunque el cupo
    // solo cuente una petición.
    expect(requestCostMicros('profesor', 'claude-opus-5')).toBe(
      (1180 * 5 + 400 * 25) * MAX_MODEL_ATTEMPTS,
    );
  });

  /**
   * Opus 5.5 no deja apagar el pensamiento, y lo que piensa se cobra como salida
   * dentro de `max_tokens`. Contar solo la respuesta era suponer un modelo que
   * no piensa: los cupos prometían más de lo que paga el dinero.
   */
  it('el pensamiento que no se apaga se paga, con su reserva', () => {
    expect(requestCostMicros('profesor', 'claude-opus-5-5')).toBe(
      (1180 * 4 + (400 + RESERVA_PARA_PENSAR) * 20) * MAX_MODEL_ATTEMPTS,
    );
    expect(presupuestoDe('profesor', 'claude-opus-5-5').output).toBe(400 + RESERVA_PARA_PENSAR);
    // Los que lo apagan no llevan reserva.
    for (const modelo of ['claude-sonnet-5-5', 'claude-opus-5', 'claude-haiku-4-5']) {
      expect(presupuestoDe('salidas', modelo).output, modelo).toBe(TOKEN_BUDGETS.salidas.output);
    }
  });

  it('por eso Opus 5.5, más barato por token, sale más caro por pregunta que Opus 5', () => {
    expect(requestCostMicros('profesor', 'claude-opus-5-5')).toBeGreaterThan(
      requestCostMicros('profesor', 'claude-opus-5'),
    );
  });

  it('el mismo trabajo con Haiku cuesta bastante menos', () => {
    const opus = requestCostMicros('salidas', 'claude-opus-5');
    const haiku = requestCostMicros('salidas', 'claude-haiku-4-5');
    expect(haiku * 4).toBeLessThan(opus);
  });
});

/**
 * Este es el test que justifica el fichero entero. Si falla, la aplicación está
 * perdiendo dinero con alguien que se gasta su cupo, que es exactamente lo que
 * pasaba con los cupos escritos a mano.
 */
describe('el margen', () => {
  it('ningún plan de pago pierde dinero aunque se gaste el cupo entero, con cualquier modelo', () => {
    for (const model of MODELOS) {
      for (const plan of PAID_PLANS) {
        const margen = worstMonthlyMarginMicros(plan.id, model);
        expect(margen, `${plan.name} con ${model}`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * **Sobre lo que entra, no sobre el precio.** Contado sobre el precio con IVA
   * este test pasaba y el margen de verdad era del 43 al 45 % (adr/0106).
   */
  it('deja al menos el margen que dice dejar, sin IVA ni comisión', () => {
    for (const model of [...MODELOS, 'claude-vete-a-saber']) {
      for (const plan of PAID_PLANS) {
        const ingreso = ingresoMensualNetoMicros(plan.id);
        const gasto = worstMonthlyCostMicros(plan.id, model);
        expect(gasto / ingreso, `${plan.name} con ${model}`).toBeLessThanOrEqual(MODEL_SPEND_SHARE);
      }
    }
  });

  // Tampoco con un modelo que no esté en la tabla, que es el caso en que más
  // fácil sería colarse.
  it('aguanta un modelo desconocido', () => {
    for (const plan of PAID_PLANS) {
      expect(worstMonthlyMarginMicros(plan.id, 'claude-vete-a-saber')).toBeGreaterThan(0);
    }
  });

  /**
   * **Las cuentas, hechas a mano**, para que un signo cambiado no pase. Los tests
   * de arriba solo miran que el margen sea positivo y el gasto no se pase del 40 %:
   * sumar el gasto al ingreso en vez de restarlo, o quedarse con la petición que
   * menos cuesta en vez de la que más, los dejaba en verde.
   *
   * Medio con Sonnet 5.5 (2 µ$ el token de entrada, 10 el de salida):
   *
   * - Una pregunta al profesor: (1180 × 2 + 400 × 10) × 2 intentos = 12.720 µ$.
   * - Unas salidas: (1880 × 2 + 900 × 10) × 2 = 25.520 µ$, que gastan
   *   ⌈25.520 / 12.720⌉ = 3 preguntas del cupo.
   * - El cupo: 2.455.687 µ$ de presupuesto / 12.720 = 193 preguntas.
   * - Gastado en el profesor: 193 × 12.720 = 2.454.960 µ$. En salidas:
   *   ⌊193 / 3⌋ = 64 × 25.520 = 1.633.280 µ$. El peor mes es el del profesor.
   * - Lo que entra: 99,90 € al año (diez meses de 9,99), sin el 21 % de IVA y sin
   *   la comisión (8,65 % y 25 céntimos), entre doce: 6.139.219 µ$.
   */
  describe('Medio con Sonnet 5.5, a mano', () => {
    const MODELO = 'claude-sonnet-5-5';

    it('una pregunta, unas salidas y el cupo', () => {
      expect(requestCostMicros('profesor', MODELO)).toBe(12_720);
      expect(requestCostMicros('salidas', MODELO)).toBe(25_520);
      expect(unidadesDe('salidas', MODELO)).toBe(3);
      expect(monthlyBudgetMicros('medio')).toBe(2_455_687);
      expect(monthlyAiRequests('medio', MODELO)).toBe(193);
    });

    it('el peor mes es el cupo entero en preguntas al profesor', () => {
      expect(worstMonthlyCostMicros('medio', MODELO)).toBe(193 * 12_720);
    });

    it('y el margen es lo que entra menos eso', () => {
      expect(ingresoMensualNetoMicros('medio')).toBe(6_139_219);
      expect(worstMonthlyMarginMicros('medio', MODELO)).toBe(6_139_219 - 193 * 12_720);
    });
  });

  /**
   * Y una cota por abajo, con todos los modelos: el peor mes no puede costar
   * menos que gastarse el cupo entero en el profesor, que es algo que cualquiera
   * puede hacer. Por arriba ya lo acota el test del 40 %.
   */
  it('el peor mes cuesta al menos el cupo entero en preguntas', () => {
    for (const model of [...MODELOS, 'claude-vete-a-saber']) {
      for (const plan of PAID_PLANS) {
        const cupoEnPreguntas =
          monthlyAiRequests(plan.id, model) * requestCostMicros('profesor', model);
        expect(
          worstMonthlyCostMicros(plan.id, model),
          `${plan.name} con ${model}`,
        ).toBeGreaterThanOrEqual(cupoEnPreguntas);
      }
    }
  });
});

describe('los cupos', () => {
  it('el presupuesto es la parte de lo que entra que se puede gastar', () => {
    expect(monthlyBudgetMicros('basico')).toBe(
      Math.floor(ingresoMensualNetoMicros('basico') * MODEL_SPEND_SHARE),
    );
    expect(monthlyBudgetMicros('gratis')).toBe(0);
  });

  it('el gratis no sale del presupuesto: es un regalo con tope', () => {
    for (const model of MODELOS) {
      expect(monthlyAiRequests('gratis', model)).toBe(FREE_MONTHLY_ALLOWANCE);
    }
  });

  // Un plan más caro que diera menos cupo sería una trampa.
  it('cada plan de pago da más cupo que el anterior', () => {
    for (const model of MODELOS) {
      for (let i = 1; i < PAID_PLANS.length; i += 1) {
        const antes = PAID_PLANS[i - 1]!;
        const ahora = PAID_PLANS[i]!;
        expect(
          monthlyAiRequests(ahora.id, model),
          `${ahora.name} vs ${antes.name} con ${model}`,
        ).toBeGreaterThan(monthlyAiRequests(antes.id, model));
      }
    }
  });

  it('un modelo más barato da más cupo por el mismo precio', () => {
    for (const plan of PAID_PLANS) {
      expect(monthlyAiRequests(plan.id, 'claude-haiku-4-5')).toBeGreaterThan(
        monthlyAiRequests(plan.id, 'claude-opus-5'),
      );
    }
  });

  it('el cupo del día es una parte del mes, no el mes entero', () => {
    for (const plan of PLANS) {
      const mes = monthlyAiRequests(plan.id, 'claude-opus-5');
      const dia = dailyAiRequests(plan.id, 'claude-opus-5');
      expect(dia).toBeLessThanOrEqual(mes);
      expect(dia).toBeGreaterThanOrEqual(1);
    }
  });

  // Es lo que evita que alguien se funda el mes el día uno y se quede treinta
  // días sin profesor.
  it('vaciar el mes cuesta al menos los días previstos', () => {
    for (const plan of PAID_PLANS) {
      const mes = monthlyAiRequests(plan.id, 'claude-opus-5');
      const dia = dailyAiRequests(plan.id, 'claude-opus-5');
      const dias = Math.ceil(mes / dia);

      // Con el cupo diario puesto a cinco días de gasto medio, gastarse el mes
      // entero lleva al menos treinta y uno entre cinco: seis días.
      expect(dias, plan.name).toBeGreaterThanOrEqual(Math.floor(DAYS_PER_MONTH / BURST_DAYS));
      expect(dia, plan.name).toBeLessThan(mes);
    }
  });

  it('nunca deja un cupo diario de cero mientras quede mes', () => {
    for (const plan of PLANS) {
      expect(dailyAiRequests(plan.id, 'claude-opus-5')).toBeGreaterThan(0);
    }
  });

  it('quotasFor devuelve los cuatro planes con sus dos números', () => {
    const quotas = quotasFor('claude-opus-5');

    expect(quotas).toHaveLength(PLANS.length);
    for (const { plan, monthly, daily } of quotas) {
      expect(monthly).toBe(monthlyAiRequests(plan.id, 'claude-opus-5'));
      expect(daily).toBe(dailyAiRequests(plan.id, 'claude-opus-5'));
    }
  });

  /**
   * El cupo se cuenta en preguntas al profesor, en todos los planes (adr/0067).
   * Dividir entre la petición más cara dejó a Medio con menos que Básico en
   * cuanto las salidas bajaron a Medio; lo caro se paga gastando más de una.
   */
  it.each(['basico', 'medio'] as const)(
    'el plan %s se calcula contra el coste de una pregunta',
    (id) => {
      const esperado = Math.floor(
        monthlyBudgetMicros(id) / requestCostMicros('profesor', 'claude-opus-5'),
      );

      expect(monthlyAiRequests(id, 'claude-opus-5')).toBe(esperado);
    },
  );
});

describe('lo caro gasta más de una pregunta', () => {
  it('una pregunta gasta una', () => {
    for (const model of MODELOS) {
      expect(unidadesDe('profesor', model)).toBe(1);
    }
  });

  it('una tanda de salidas gasta lo que cuesta, redondeado hacia arriba', () => {
    for (const model of MODELOS) {
      const k = unidadesDe('salidas', model);
      const proporcion = requestCostMicros('salidas', model) / requestCostMicros('profesor', model);

      expect(k, model).toBe(Math.ceil(proporcion));
      expect(k, model).toBeGreaterThanOrEqual(proporcion);
    }
    // Con los precios de hoy, tres con cualquier modelo de la tabla.
    expect(unidadesDe('salidas', 'claude-opus-5')).toBe(3);
  });

  /**
   * Lo que el redondeo hacia arriba tiene que garantizar: quien se gaste el cupo
   * entero en salidas no pasa del presupuesto del plan.
   */
  it('con el cupo entero gastado en salidas, el gasto no pasa del presupuesto', () => {
    for (const model of [...MODELOS, 'claude-vete-a-saber']) {
      for (const id of ['medio'] as const) {
        const tandas = Math.floor(monthlyAiRequests(id, model) / unidadesDe('salidas', model));
        const gasto = tandas * requestCostMicros('salidas', model);

        expect(gasto, `${id} con ${model}`).toBeLessThanOrEqual(monthlyBudgetMicros(id));
      }
    }
  });
});

describe('lo que cuesta el plan gratis, multiplicado', () => {
  /**
   * El fallo que este fichero vino a arreglar fue no multiplicar. El plan gratis
   * es el único sitio que pierde dinero a propósito, así que lo que hay que
   * vigilar no es que no pierda —pierde— sino que se sepa **cuánto**.
   */
  it('mil cuentas gratis cuestan unos cuatrocientos ochenta dólares al mes con Opus 5', () => {
    // El doble de lo que decía este test al principio, y no porque haya subido el
    // precio: porque se cuenta el reintento, que siempre se pagó. Y algo más
    // desde que el texto libre se cuenta en su peor alfabeto (adr/0114).
    const porCuenta = FREE_MONTHLY_ALLOWANCE * requestCostMicros('profesor', 'claude-opus-5');
    const mil = (porCuenta * 1000) / 1_000_000;

    expect(mil).toBeGreaterThan(450);
    expect(mil).toBeLessThan(500);
  });

  // Las cifras de la tabla de `FREE_MONTHLY_ALLOWANCE`: con el de por defecto,
  // 190,8 $ las mil cuentas; con uno desconocido, 2.490 $.
  it('las cifras del comentario son las de la cuenta', () => {
    const milCuentas = (modelo: string) =>
      (FREE_MONTHLY_ALLOWANCE * requestCostMicros('profesor', modelo) * 1000) / 1_000_000;

    expect(milCuentas(DEFAULT_AI_MODEL)).toBe(190.8);
    expect(milCuentas('claude-opus-5')).toBe(477);
    expect(milCuentas('claude-vete-a-saber')).toBe(2490);
  });

  it('el plan gratis solo puede gastar en lo más barato que hay', () => {
    // Si algún día entrara en el plan gratis algo más caro que el profesor, el
    // coste de captación se multiplicaría sin que nadie tocara este número.
    expect(planOf('gratis').capabilities).toEqual(['profesor']);
  });
});

describe('el reintento también se paga', () => {
  /**
   * Las dos rutas reintentan una vez cuando lo que vuelve no pasa la
   * validación, y el cupo se gasta una sola vez. Estuvo sin contar: el 60 % de
   * margen que promete `MODEL_SPEND_SHARE` se quedaba en la mitad en el peor
   * caso, que es el mismo fallo de no multiplicar que este fichero vino a
   * arreglar en la fase 11.
   */
  it('el coste de una petición son los dos intentos', () => {
    const price = MODEL_PRICES['claude-opus-5']!;
    const budget = presupuestoDe('salidas', 'claude-opus-5');
    const unaLlamada = budget.input * price.inputPerToken + budget.output * price.outputPerToken;

    expect(requestCostMicros('salidas', 'claude-opus-5')).toBe(unaLlamada * MAX_MODEL_ATTEMPTS);
  });

  /**
   * Si se reintentara más veces que esto, el cupo estaría calculado con un peor
   * caso que no es el peor caso.
   *
   * Esto miraba las rutas una a una, porque el bucle estaba copiado en cada
   * una. Ahora hay uno solo —`server/ai-intentos.ts`, que salió de
   * `ai-route.ts` para que el examen del profesor lo use sin arrastrar
   * `next/server`— y ni las rutas ni el cuerpo común pueden separarse de él: la
   * garantía es que solo haya un sitio donde decirlo.
   */
  it('el bucle de los intentos reintenta lo que dice la constante, y nadie más reintenta', () => {
    const leer = (fichero: string) =>
      readFileSync(fileURLToPath(new URL(fichero, import.meta.url)), 'utf8');

    expect(leer('../../server/ai-intentos.ts'), 'el bucle no usa la constante').toContain(
      'intento < MAX_MODEL_ATTEMPTS',
    );
    expect(
      leer('../../server/ai-route.ts'),
      'el cuerpo común se escribe su reintento',
    ).not.toContain('MAX_MODEL_ATTEMPTS');

    for (const ruta of ['teacher', 'salidas']) {
      const codigo = leer(`../../app/api/${ruta}/route.ts`);
      expect(codigo, `${ruta} se escribe su propio reintento`).not.toContain('MAX_MODEL_ATTEMPTS');
    }
  });
});

describe('los precios de los modelos', () => {
  it('Sonnet 5 cuesta dos y diez, no tres y quince', () => {
    // Tres y quince es Sonnet 4.6, y estuvo aquí como si fuera Sonnet 5.
    expect(MODEL_PRICES['claude-sonnet-5']).toMatchObject({ inputPerToken: 2, outputPerToken: 10 });
    expect(MODEL_PRICES['claude-sonnet-4-6']).toMatchObject({
      inputPerToken: 3,
      outputPerToken: 15,
    });
  });

  it('cada modelo cuesta menos que el de encima', () => {
    const orden = ['claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];
    const costes = orden.map((modelo) => requestCostMicros('salidas', modelo));

    for (let i = 1; i < costes.length; i += 1) {
      expect(costes[i]!, `${orden[i]} no es más barato que ${orden[i - 1]}`).toBeLessThan(
        costes[i - 1]!,
      );
    }
  });
});

/**
 * El precio de respaldo es el más caro de la tabla, y no el primero.
 *
 * Suponer barato cuando no se sabe qué modelo hay puesto regalaría dinero en
 * silencio. Se prueba la cuenta aparte porque, tal y como está escrita la tabla
 * hoy, el más caro ya es el primero: sin esto, el día que alguien añada uno más
 * caro al final nadie se enteraría de si la cuenta lo coge.
 */
describe('el precio de respaldo', () => {
  it('coge el mas caro, este donde este en la lista', () => {
    const barato = { inputPerToken: 1, outputPerToken: 5 };
    const caro = { inputPerToken: 10, outputPerToken: 50 };

    expect(elMasCaro([caro, barato])).toBe(caro);
    expect(elMasCaro([barato, caro])).toBe(caro);
    expect(elMasCaro([caro])).toBe(caro);
  });

  it('y el de la tabla de verdad es el mas caro de la tabla de verdad', () => {
    for (const precio of Object.values(MODEL_PRICES)) {
      expect(precio.inputPerToken + precio.outputPerToken).toBeLessThanOrEqual(
        MODELO_DESCONOCIDO.inputPerToken + MODELO_DESCONOCIDO.outputPerToken,
      );
    }
  });
});

/**
 * Lo que entra de verdad: el precio sin IVA y sin la comisión de la pasarela
 * (adr/0105, adr/0106). Contado sobre el precio con IVA, el «60 % de margen» era
 * un 43–45 %.
 */
describe('lo que entra de un cobro', () => {
  it('quita el IVA y la comisión del peor caso', () => {
    // 4,99 € con IVA: 4,1239 sin él, menos el 8,65 % de 4,99 y 0,25 fijos.
    expect(IVA_POR_CIENTO).toBe(21);
    expect(netoDeUnCobroMicros(499)).toBe(
      Math.floor((4_990_000 * 100) / 121) - Math.ceil((4_990_000 * 865) / 10_000) - 250_000,
    );
    expect(netoDeUnCobroMicros(0)).toBe(0);
  });

  it('el mes de un plan es lo que menos deja: el anual, con dos meses gratis', () => {
    for (const plan of PAID_PLANS) {
      const mensual = netoDeUnCobroMicros(plan.monthlyCents);
      const anual = Math.floor(netoDeUnCobroMicros(plan.annualCents) / 12);
      expect(anual, plan.name).toBeLessThan(mensual);
      expect(ingresoMensualNetoMicros(plan.id), plan.name).toBe(anual);
    }
    expect(ingresoMensualNetoMicros('gratis')).toBe(0);
  });

  it('la comisión es la del peor caso: tarjeta de fuera y cambio de divisa', () => {
    // 3,5 % de vendedora oficial + 3,15 % de tarjeta internacional + 2 % de cambio.
    expect(COMISION_PUNTOS_BASICOS).toBe(350 + 315 + 200);
    expect(COMISION_FIJA_CENTS).toBe(25);
  });
});

/**
 * Las cifras que dicen los documentos y el ADR: con Sonnet 5.5, 96 preguntas al
 * mes en Básico y 193 en Medio —eran 113 y 227 antes de contar el texto libre en
 * su peor alfabeto (adr/0114)—. Si cambian, cambian los documentos.
 */
describe('los cupos con el modelo de por defecto', () => {
  it('Básico y Medio', () => {
    expect(DEFAULT_AI_MODEL).toBe('claude-sonnet-5-5');
    expect(monthlyAiRequests('basico', DEFAULT_AI_MODEL)).toBe(96);
    expect(monthlyAiRequests('medio', DEFAULT_AI_MODEL)).toBe(193);
  });
});

/**
 * **El texto libre en su peor alfabeto** (adr/0114). Contado a 3,2 caracteres
 * por token, 240 caracteres chinos o yi eran hasta 587 tokens que el cupo no
 * pagaba. Un token es al menos un byte, así que el techo son los bytes que el
 * contrato deja pasar, y eso se mide aquí **con el recorte de verdad**
 * (`textoLibre`), alfabeto por alfabeto.
 */
describe('el texto libre, en su peor alfabeto', () => {
  const ALFABETOS = {
    ascii: 'x',
    'latino con tilde': 'ȸ',
    griego: 'λ',
    chino: '的',
    yi: 'ꀀ',
    emoji: '🎸',
    'latino y chino': 'ȸ的',
  };

  it('lo que deja pasar el contrato nunca pasa de los tokens que paga el cupo', () => {
    for (const [feature, letras] of Object.entries(TEXTO_LIBRE) as [
      'profesor' | 'salidas',
      number,
    ][]) {
      for (const [nombre, trozo] of Object.entries(ALFABETOS)) {
        const pasa = textoLibre(trozo.repeat(2000), 'PREGUNTA', letras);
        const bytes = new TextEncoder().encode(pasa).length;
        expect(bytes, `${feature}, ${nombre}`).toBeLessThanOrEqual(peorTextoLibreEnTokens(feature));
      }
    }
  });

  it('y el peor caso es de verdad el peor: lo latino con tilde lo llena entero', () => {
    const pasa = textoLibre('ȸ'.repeat(2000), 'PREGUNTA', MAX_QUESTION_LENGTH);
    expect(new TextEncoder().encode(pasa).length).toBe(peorTextoLibreEnTokens('profesor'));
  });

  it('se suma a la entrada de cada petición, y con él sube el coste', () => {
    expect(TOKENS_POR_CARACTER_LIBRE).toBe(2);
    expect(TEXTO_LIBRE).toEqual({
      profesor: MAX_QUESTION_LENGTH,
      salidas: MAX_DIRECTRICES_LENGTH,
    });
    for (const feature of ['profesor', 'salidas'] as const) {
      expect(presupuestoDe(feature, 'claude-sonnet-5-5').input).toBe(
        TOKEN_BUDGETS[feature].input + peorTextoLibreEnTokens(feature),
      );
    }
  });
});

describe('lo gastado de verdad', () => {
  it('son los tokens de la respuesta al precio del modelo', () => {
    expect(costeDeUso({ entrada: 1000, salida: 100 }, 'claude-sonnet-5-5')).toBe(
      1000 * 2 + 100 * 10,
    );
    // Un modelo que no está en la tabla, al precio del más caro.
    expect(costeDeUso({ entrada: 1, salida: 1 }, 'claude-vete-a-saber')).toBe(10 + 50);
  });

  it('una llamada sin respuesta cuenta como el peor caso de una llamada', () => {
    expect(peorLlamadaMicros('profesor', 'claude-sonnet-5-5') * MAX_MODEL_ATTEMPTS).toBe(
      requestCostMicros('profesor', 'claude-sonnet-5-5'),
    );
  });
});
