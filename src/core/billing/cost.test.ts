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
  requestCostMicros,
  worstMonthlyCostMicros,
  worstMonthlyMarginMicros,
} from './cost';
import { PAID_PLANS, PLANS, planOf } from './plans';

const MODELOS = Object.keys(MODEL_PRICES);

describe('el precio del modelo', () => {
  it('conoce los tres modelos', () => {
    expect(MODELOS).toEqual(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
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

  it('sale de multiplicar tokens por precio, sin sorpresas', () => {
    // Profesor con Opus 5: 700 × 5 + 400 × 25.
    expect(requestCostMicros('profesor', 'claude-opus-5')).toBe(700 * 5 + 400 * 25);
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
