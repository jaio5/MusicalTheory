import { describe, expect, it } from 'vitest';

import { needsPlanMessage, planAfter, quotaMessage } from './messages';
import { planOf } from './plans';

const MEDIO = planOf('medio');

/**
 * Estas frases las leen dos sitios distintos —la pantalla al pintar el candado y
 * la ruta al rechazar la petición— así que un fallo aquí sale por partida doble.
 */
describe('qué plan hace falta', () => {
  it('dice el plan y el precio', () => {
    expect(needsPlanMessage(MEDIO, 'El Grado Profesional')).toBe(
      'El Grado Profesional entra en el plan Medio: 9,99 € al mes.',
    );
  });

  /**
   * Se leyó en pantalla «Las ideas de la IA **entra** en el plan Medio». El verbo
   * estaba fijo en singular mientras la mitad de los sujetos son plurales.
   */
  it('concuerda el verbo con un sujeto plural', () => {
    expect(needsPlanMessage(MEDIO, 'Las ideas de la IA', true)).toBe(
      'Las ideas de la IA entran en el plan Medio: 9,99 € al mes.',
    );
  });

  it('sin plan que lo incluya, lo dice y también concuerda', () => {
    expect(needsPlanMessage(null, 'Esto')).toBe('Esto no está disponible.');
    expect(needsPlanMessage(null, 'Las ideas', true)).toBe('Las ideas no están disponibles.');
  });
});

describe('el plan siguiente', () => {
  it('es el de arriba, y al último no le queda ninguno', () => {
    expect(planAfter('basico')?.id).toBe('medio');
    expect(planAfter('pro')).toBeNull();
  });
});

describe('cupo gastado', () => {
  // Los dos topes no se arreglan igual: el del día se espera y el del mes se
  // sube de plan, así que la frase tiene que decir cuál de los dos ha saltado.
  it('distingue el del día del del mes', () => {
    const hoy = quotaMessage(MEDIO, 'claude-opus-5', 'dia');
    const mes = quotaMessage(MEDIO, 'claude-opus-5', 'mes');

    expect(hoy).toMatch(/de hoy/);
    expect(hoy).toMatch(/mañana/);
    expect(mes).toMatch(/de este mes/);
    expect(mes).toMatch(/día uno/);
  });

  it('al que ya está en el último plan no le ofrece otro', () => {
    expect(quotaMessage(planOf('pro'), 'claude-opus-5', 'mes')).not.toMatch(/con el plan/);
  });
});
