import { describe, expect, it } from 'vitest';

import {
  can,
  cheapestPlanWith,
  DEFAULT_PLAN,
  DIAS_DE_GRACIA,
  MESES_GRATIS_AL_AÑO,
  MESES_QUE_SE_PAGAN_AL_AÑO,
  PAID_PLANS,
  PERIODOS,
  planEnVigor,
  planOf,
  PLANS,
  priceCents,
  priceLabel,
  remaining,
  type Capability,
} from './plans';

describe('planOf', () => {
  it('encuentra los tres: el gratis y los dos de pago', () => {
    expect(PLANS.map((plan) => plan.id)).toEqual(['gratis', 'basico', 'medio']);
    expect(PAID_PLANS.map((plan) => plan.id)).toEqual(['basico', 'medio']);
  });

  /**
   * Los dos planes de pago se llamaron Estudiante y Conservatorio antes de ser
   * tres, y el tercero, Pro, se fundió en Medio (adr/0104). Sin los alias, una
   * fila vieja caería al plan gratis y le cerraría la puerta a alguien que había
   * pagado, en silencio.
   */
  it('sigue reconociendo los nombres viejos', () => {
    expect(planOf('estudiante').id).toBe('basico');
    expect(planOf('conservatorio').id).toBe('medio');
    expect(planOf('pro').id).toBe('medio');
  });

  // Fundir no puede degradar: quien tenía Pro tiene en Medio todo lo que tenía.
  it('quien tenía Pro no pierde nada en Medio', () => {
    expect(planOf('pro').capabilities).toEqual(
      expect.arrayContaining([
        'profesor',
        'grado-profesional',
        'sincronizar',
        'repaso',
        'canciones',
        'versiones',
        'profesor-con-progreso',
      ]),
    );
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
    expect(can('basico', 'versiones')).toBe(false);
    expect(can('medio', 'versiones')).toBe(true);

    expect(can('basico', 'profesor-con-progreso')).toBe(false);
    expect(can('medio', 'profesor-con-progreso')).toBe(true);
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
    expect(cheapestPlanWith('versiones')?.id).toBe('medio');
    expect(cheapestPlanWith('grado-profesional')?.id).toBe('basico');
    expect(cheapestPlanWith('profesor-con-progreso')?.id).toBe('medio');
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
  });

  it('y al año, con su periodo', () => {
    expect(priceLabel('basico', 'anual')).toBe('49,90 € al año');
    expect(priceLabel('medio', 'anual')).toBe('99,90 € al año');
    expect(priceLabel('gratis', 'anual')).toBe('Gratis');
  });
});

describe('el pago anual', () => {
  // «Dos meses gratis» tiene que ser verdad en la tabla, no solo en la pantalla.
  it('son diez meses: dos gratis', () => {
    expect(MESES_QUE_SE_PAGAN_AL_AÑO).toBe(10);
    expect(MESES_GRATIS_AL_AÑO).toBe(2);
    for (const plan of PLANS) {
      expect(plan.annualCents).toBe(plan.monthlyCents * MESES_QUE_SE_PAGAN_AL_AÑO);
    }
  });

  it('el precio de cada periodo sale de la tabla', () => {
    expect(priceCents('basico')).toBe(499);
    expect(priceCents('basico', 'mensual')).toBe(499);
    expect(priceCents('basico', 'anual')).toBe(4990);
    // Un nombre viejo resuelve como su plan, también al año.
    expect(priceCents('pro', 'anual')).toBe(9990);
  });

  it('se paga al mes o al año, y nada más', () => {
    expect(PERIODOS).toEqual(['mensual', 'anual']);
  });
});

describe('guardar canciones', () => {
  it('lo abre el plan más barato de pago, y sin pagar no', () => {
    expect(can('gratis', 'canciones')).toBe(false);
    expect(can('basico', 'canciones')).toBe(true);
    expect(can('medio', 'canciones')).toBe(true);
  });

  it('el candado dice cuál es y cuánto cuesta', () => {
    // Es un permiso propio y no `sincronizar` a pesar de coincidir hoy en los
    // mismos planes: sincronizar es que el avance viaje entre aparatos, y
    // guardar canciones es otra cosa. Reutilizarlo haría que separarlos mañana
    // fuese una migración en vez de una línea.
    expect(cheapestPlanWith('canciones')?.id).toBe('basico');
  });
});

/**
 * **El plazo de gracia** (adr/0114): con el cobro fallando (`past_due`), el plan
 * se conserva `DIAS_DE_GRACIA` y después se lee como gratis. Antes se conservaba
 * sin plazo.
 */
describe('el plan con el cobro fallando', () => {
  const desde = new Date('2026-10-01T00:00:00Z');
  const dia = 24 * 60 * 60 * 1000;

  it('al corriente, el guardado', () => {
    expect(planEnVigor('medio', null)).toBe('medio');
    expect(planEnVigor('nada-que-exista', null)).toBe('gratis');
  });

  it('dentro del plazo se conserva; pasado, gratis', () => {
    const justo = new Date(desde.getTime() + DIAS_DE_GRACIA * dia);
    expect(planEnVigor('medio', desde, justo)).toBe('medio');
    expect(planEnVigor('medio', desde, new Date(justo.getTime() + 1))).toBe('gratis');
  });

  it('una semana, no más', () => {
    expect(DIAS_DE_GRACIA).toBe(7);
  });
});
