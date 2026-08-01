/**
 * Lo que se le dice a quien se topa con un candado.
 *
 * Está en el dominio porque lo dicen los dos lados: las rutas cuando rechazan
 * una llamada al modelo y la pantalla cuando enseña el candado antes de
 * pulsarlo. Escrito dos veces, acabarían diciendo cosas distintas del mismo
 * plan, y eso se lee como que la aplicación no sabe lo que cuesta.
 *
 * Regla de escritura, la misma que en el resto: decir qué pasa y qué hacer. «No
 * tienes permiso» no es ninguna de las dos cosas.
 */

import { dailyAiRequests, monthlyAiRequests } from './cost';
import { PLANS, priceLabel, type Plan, type PlanId } from './plans';

/**
 * Qué plan hace falta y cuánto cuesta.
 *
 * `what` es el sujeto de la frase y se escribe entero por quien llama —«Las ideas
 * de la IA», «El Grado Profesional»— porque el verbo cambia con el número y una
 * frase armada a trozos suena a formulario.
 */
export function needsPlanMessage(needed: Plan | null, what: string): string {
  if (needed === null) {
    return `${what} no está disponible.`;
  }
  return `${what} entra en el plan ${needed.name}: ${priceLabel(needed.id).toLowerCase()}.`;
}

/** El plan siguiente al que se tiene, o nulo si ya es el último. */
export function planAfter(id: PlanId): Plan | null {
  const at = PLANS.findIndex((plan) => plan.id === id);
  return at < 0 ? null : (PLANS[at + 1] ?? null);
}

/**
 * Se ha acabado el cupo.
 *
 * Dice **cuál de los dos topes** se ha tocado y con qué número, porque no se
 * arreglan igual: el del día se espera a mañana y el del mes se arregla subiendo
 * de plan o esperando al mes que viene. Un «has alcanzado el límite» sin decir
 * cuál obliga a adivinar.
 *
 * Y dice el número. Saber que eran ciento cincuenta explica lo que ha pasado;
 * ofrecer el plan siguiente con el suyo explica qué hacer. Al que ya está en el
 * último no se le ofrece nada: no hay nada que ofrecerle.
 */
export function quotaMessage(current: Plan, modelId: string, scope: 'dia' | 'mes'): string {
  const next = planAfter(current.id);

  if (scope === 'dia') {
    const hoy = dailyAiRequests(current.id, modelId);
    return `Se te han acabado las ${hoy} peticiones a la IA de hoy. Se renuevan mañana.`;
  }

  const mes = monthlyAiRequests(current.id, modelId);
  const base = `Se te han acabado las ${mes} peticiones a la IA de este mes`;
  if (next === null) {
    return `${base}. Se renuevan el día uno.`;
  }
  return `${base}: se renuevan el día uno, y con el plan ${next.name} son ${monthlyAiRequests(next.id, modelId)} al mes.`;
}
