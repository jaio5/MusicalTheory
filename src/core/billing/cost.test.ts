import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BURST_DAYS,
  DAYS_PER_MONTH,
  FREE_MONTHLY_ALLOWANCE,
  MODEL_PRICES,
  MODEL_SPEND_SHARE,
  monthlyAiRequests,
  monthlyBudgetMicros,
  dailyAiRequests,
  priceOf,
  quotasFor,
  MAX_MODEL_ATTEMPTS,
  requestCostMicros,
  TOKEN_BUDGETS,
  worstMonthlyCostMicros,
  worstMonthlyMarginMicros,
} from './cost';
import { PAID_PLANS, PLANS, planOf } from './plans';

const MODELOS = Object.keys(MODEL_PRICES);

describe('el precio del modelo', () => {
  it('conoce los cinco modelos, del más caro al más barato', () => {
    expect(MODELOS).toEqual([
      'claude-fable-5',
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
    ]);
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
  it('una idea cuesta más que una pregunta al profesor', () => {
    for (const model of MODELOS) {
      expect(requestCostMicros('ideas', model)).toBeGreaterThan(
        requestCostMicros('profesor', model),
      );
    }
  });

  it('sale de multiplicar tokens por precio, y por los intentos', () => {
    // Profesor con Opus 5: (700 × 5 + 400 × 25) por cada intento. El reintento
    // se paga aunque el cupo solo cuente una petición.
    expect(requestCostMicros('profesor', 'claude-opus-5')).toBe(
      (700 * 5 + 400 * 25) * MAX_MODEL_ATTEMPTS,
    );
  });

  it('el mismo trabajo con Haiku cuesta bastante menos', () => {
    const opus = requestCostMicros('ideas', 'claude-opus-5');
    const haiku = requestCostMicros('ideas', 'claude-haiku-4-5');
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

  it('deja al menos el margen que dice dejar', () => {
    for (const model of MODELOS) {
      for (const plan of PAID_PLANS) {
        const ingreso = plan.monthlyCents * 10_000;
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
});

describe('los cupos', () => {
  it('el presupuesto es la parte del precio que se puede gastar', () => {
    expect(monthlyBudgetMicros('basico')).toBe(Math.floor(499 * 10_000 * MODEL_SPEND_SHARE));
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
   * El cupo es uno y compartido, así que quien tiene ideas puede gastárselo entero
   * en ideas: su cupo tiene que calcularse con la petición más cara que puede
   * hacer, no con la más barata.
   */
  it('un plan con ideas se calcula contra el coste de una idea', () => {
    const medio = planOf('medio');
    const esperado = Math.floor(
      monthlyBudgetMicros(medio.id) / requestCostMicros('ideas', 'claude-opus-5'),
    );

    expect(monthlyAiRequests('medio', 'claude-opus-5')).toBe(esperado);
  });

  it('un plan sin ideas se calcula contra el coste de una pregunta', () => {
    const basico = planOf('basico');
    const esperado = Math.floor(
      monthlyBudgetMicros(basico.id) / requestCostMicros('profesor', 'claude-opus-5'),
    );

    expect(monthlyAiRequests('basico', 'claude-opus-5')).toBe(esperado);
  });
});

describe('lo que cuesta el plan gratis, multiplicado', () => {
  /**
   * El fallo que este fichero vino a arreglar fue no multiplicar. El plan gratis
   * es el único sitio que pierde dinero a propósito, así que lo que hay que
   * vigilar no es que no pierda —pierde— sino que se sepa **cuánto**.
   */
  it('mil cuentas gratis cuestan unos cuatrocientos dólares al mes con Opus 5', () => {
    // El doble de lo que decía este test antes, y no porque haya subido el
    // precio: porque ahora se cuenta el reintento, que siempre se pagó.
    const porCuenta = FREE_MONTHLY_ALLOWANCE * requestCostMicros('profesor', 'claude-opus-5');
    const mil = (porCuenta * 1000) / 1_000_000;

    expect(mil).toBeGreaterThan(380);
    expect(mil).toBeLessThan(450);
  });

  it('el plan gratis solo puede gastar en lo más barato que hay', () => {
    // Si algún día entrara en el plan gratis algo más caro que el profesor, el
    // coste de captación se multiplicaría sin que nadie tocara este número.
    expect(planOf('gratis').capabilities).toEqual(['profesor']);
  });
});

describe('el reintento también se paga', () => {
  /**
   * Las tres rutas reintentan una vez cuando lo que vuelve no pasa la
   * validación, y el cupo se gasta una sola vez. Estuvo sin contar: el 60 % de
   * margen que promete `MODEL_SPEND_SHARE` se quedaba en la mitad en el peor
   * caso, que es el mismo fallo de no multiplicar que este fichero vino a
   * arreglar en la fase 11.
   */
  it('el coste de una petición son los dos intentos', () => {
    const price = MODEL_PRICES['claude-opus-5']!;
    const budget = TOKEN_BUDGETS.versiones;
    const unaLlamada = budget.input * price.inputPerToken + budget.output * price.outputPerToken;

    expect(requestCostMicros('versiones', 'claude-opus-5')).toBe(unaLlamada * MAX_MODEL_ATTEMPTS);
  });

  it('las tres rutas reintentan lo que dice la constante', () => {
    // Si una ruta reintentara más veces que esto, el cupo estaría calculado con
    // un peor caso que no es el peor caso.
    for (const ruta of ['ideas', 'teacher', 'versiones']) {
      const codigo = readFileSync(
        fileURLToPath(new URL(`../../app/api/${ruta}/route.ts`, import.meta.url)),
        'utf8',
      );
      expect(codigo, `${ruta} no usa la constante`).toContain('attempt < MAX_MODEL_ATTEMPTS');
    }
  });
});

describe('los precios de los modelos', () => {
  it('Sonnet 5 cuesta dos y diez, no tres y quince', () => {
    // Tres y quince es Sonnet 4.6, y estuvo aquí como si fuera Sonnet 5.
    expect(MODEL_PRICES['claude-sonnet-5']).toEqual({ inputPerToken: 2, outputPerToken: 10 });
    expect(MODEL_PRICES['claude-sonnet-4-6']).toEqual({ inputPerToken: 3, outputPerToken: 15 });
  });

  it('cada modelo cuesta menos que el de encima', () => {
    const orden = ['claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];
    const costes = orden.map((modelo) => requestCostMicros('versiones', modelo));

    for (let i = 1; i < costes.length; i += 1) {
      expect(costes[i]!, `${orden[i]} no es más barato que ${orden[i - 1]}`).toBeLessThan(
        costes[i - 1]!,
      );
    }
  });
});
