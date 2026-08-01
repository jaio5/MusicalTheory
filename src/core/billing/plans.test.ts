import { describe, expect, it } from 'vitest';

import {
  can,
  cheapestPlanWith,
  DEFAULT_PLAN,
  PAID_PLANS,
  planOf,
  PLANS,
  priceLabel,
  remaining,
  type Capability,
} from './plans';

describe('planOf', () => {
  it('encuentra los cuatro: el gratis y los tres de pago', () => {
    expect(PLANS.map((plan) => plan.id)).toEqual(['gratis', 'basico', 'medio', 'pro']);
    expect(PAID_PLANS.map((plan) => plan.id)).toEqual(['basico', 'medio', 'pro']);
  });

  /**
   * Los dos planes de pago se llamaron Estudiante y Conservatorio antes de ser
   * tres. Sin los alias, una fila vieja caería al plan gratis y le cerraría la
   * puerta a alguien que había pagado, en silencio.
   */
  it('sigue reconociendo los nombres viejos', () => {
    expect(planOf('estudiante').id).toBe('basico');
    expect(planOf('conservatorio').id).toBe('pro');
  });

  // Lo que llega de la base de datos puede ser cualquier cosa. Fallar abierto
  // aquí sería regalar llamadas al modelo, así que se cae al plan gratis.
  it('trata como gratis lo que no reconoce', () => {
    for (const raro of ['premium', '', null, undefined, 7, {}]) {
      expect(planOf(raro).id).toBe(DEFAULT_PLAN);
    }
  });
});

describe('can', () => {
  it('deja preguntar al profesor en todos los planes', () => {
    for (const plan of PLANS) {
      expect(can(plan.id, 'profesor')).toBe(true);
    }
  });

  it('guarda el Grado Profesional para quien paga', () => {
    expect(can('gratis', 'grado-profesional')).toBe(false);
    expect(can('basico', 'grado-profesional')).toBe(true);
  });

  // Cada plan de pago trae una cosa que el anterior no: un escalón que solo suba
  // el cupo no se entiende, y quien lo mira no sabría por qué pagarlo.
  it('cada escalón trae algo nuevo y no solo más cupo', () => {
    expect(can('basico', 'ideas')).toBe(false);
    expect(can('medio', 'ideas')).toBe(true);

    expect(can('medio', 'profesor-con-progreso')).toBe(false);
    expect(can('pro', 'profesor-con-progreso')).toBe(true);
  });

  // Un plan más caro que quitase algo sería una trampa: quien sube de plan no
  // puede perder nada por el camino.
  it('cada plan incluye todo lo del anterior', () => {
    for (let i = 1; i < PLANS.length; i += 1) {
      const antes = PLANS[i - 1]!;
      const ahora = PLANS[i]!;
      for (const capability of antes.capabilities) {
        expect(ahora.capabilities).toContain(capability);
      }
      expect(ahora.monthlyCents).toBeGreaterThan(antes.monthlyCents);
    }
  });
});

describe('cheapestPlanWith', () => {
  it('propone el más barato que sirve, para que el candado diga cómo se abre', () => {
    expect(cheapestPlanWith('ideas')?.id).toBe('medio');
    expect(cheapestPlanWith('grado-profesional')?.id).toBe('basico');
    expect(cheapestPlanWith('profesor-con-progreso')?.id).toBe('pro');
    expect(cheapestPlanWith('profesor')?.id).toBe('gratis');
  });

  it('devuelve nulo si no lo incluye ninguno', () => {
    expect(cheapestPlanWith('inventada' as Capability)).toBeNull();
  });
});

describe('remaining', () => {
  it('descuenta lo gastado', () => {
    expect(remaining(10, 0)).toBe(10);
    expect(remaining(10, 4)).toBe(6);
  });

  it('no baja de cero ni con un contador estropeado', () => {
    expect(remaining(10, 99)).toBe(0);
    expect(remaining(10, Number.NaN)).toBe(10);
    expect(remaining(10, -5)).toBe(10);
  });
});

// El cupo ya no está en la tabla de planes: se calcula desde el precio. Lo que
// hace ese cálculo, y el test de que ningún plan pierde dinero, están en
// `cost.test.ts`.
describe('el cupo ya no se escribe a mano', () => {
  it('ningún plan lleva un número de peticiones dentro', () => {
    for (const plan of PLANS) {
      expect(Object.keys(plan)).not.toContain('dailyAiRequests');
    }
  });
});

describe('priceLabel', () => {
  it('escribe el precio como se escribe en español', () => {
    expect(priceLabel('gratis')).toBe('Gratis');
    expect(priceLabel('basico')).toBe('4,99 € al mes');
    expect(priceLabel('medio')).toBe('9,99 € al mes');
    expect(priceLabel('pro')).toBe('19,99 € al mes');
  });
});
