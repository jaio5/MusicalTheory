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

import { dailyAiRequests, monthlyAiRequests, unidadesDe, type AiFeature } from './cost';
import { can, PLANS, priceLabel, type Plan, type PlanId } from './plans';

/**
 * Qué plan hace falta y cuánto cuesta.
 *
 * `what` es el sujeto de la frase y se escribe entero por quien llama —«Las
 * salidas de lo que tocas», «El Grado Profesional»— porque una frase armada a trozos suena a
 * formulario.
 *
 * Y por eso hay `plural`: el verbo concuerda con ese sujeto, y estuvo fijo en
 * singular hasta que se leyó en pantalla «Las ideas de la IA **entra** en el plan
 * Medio», cuando aún existía esa función (retirada en adr/0066). El comentario de aquí ya avisaba de que el verbo cambia con el número;
 * lo que faltaba era poder cambiarlo.
 */
export function needsPlanMessage(needed: Plan | null, what: string, plural = false): string {
  if (needed === null) {
    return plural ? `${what} no están disponibles.` : `${what} no está disponible.`;
  }
  const entra = plural ? 'entran' : 'entra';
  return `${what} ${entra} en el plan ${needed.name}: ${priceLabel(needed.id).toLowerCase()}.`;
}

/** El plan siguiente al que se tiene, o nulo si ya es el último. */
export function planAfter(id: PlanId): Plan | null {
  const at = PLANS.findIndex((plan) => plan.id === id);
  return at < 0 ? null : (PLANS[at + 1] ?? null);
}

/**
 * Cuántas preguntas gasta una salida, dicho para leerse: «una salida gasta 3».
 *
 * El cupo se cuenta en preguntas al profesor (adr/0067), y sin esta frase al
 * lado el número de un plan con salidas promete más de lo que da: quien solo
 * pide salidas hace un tercio de esas peticiones.
 */
export function gastoDeUnaSalida(modelId: string | undefined): string {
  return `una salida gasta ${unidadesDe('salidas', modelId)}`;
}

/**
 * El cupo de un plan en una frase: «148 preguntas al profesor al mes; una salida
 * gasta 3». La segunda mitad solo si el plan tiene salidas: a quien no puede
 * pedirlas no le dice nada.
 */
export function cupoEnPalabras(planId: PlanId, modelId: string | undefined): string {
  const base = `${monthlyAiRequests(planId, modelId)} preguntas al profesor al mes`;
  return can(planId, 'salidas') ? `${base}; ${gastoDeUnaSalida(modelId)}` : base;
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
 *
 * Y si lo que se pedía gasta más de una pregunta, lo dice: con dos preguntas
 * restantes no cabe una salida que gasta tres, y «se te han acabado» sin más se
 * leería como mentira teniendo dos (adr/0067).
 */
export function quotaMessage(
  current: Plan,
  modelId: string,
  scope: 'dia' | 'mes',
  feature: AiFeature = 'profesor',
): string {
  const next = planAfter(current.id);
  const caro = unidadesDe(feature, modelId) > 1 ? ` (${gastoDeUnaSalida(modelId)})` : '';

  if (scope === 'dia') {
    const hoy = dailyAiRequests(current.id, modelId);
    return `No te quedan preguntas suficientes de las ${hoy} de hoy${caro}. Se renuevan mañana.`;
  }

  const mes = monthlyAiRequests(current.id, modelId);
  const base = `No te quedan preguntas suficientes de las ${mes} de este mes${caro}`;
  if (next === null) {
    return `${base}. Se renuevan el día uno.`;
  }
  return `${base}: se renuevan el día uno, y con el plan ${next.name} son ${monthlyAiRequests(next.id, modelId)} al mes.`;
}
