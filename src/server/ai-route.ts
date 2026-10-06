/**
 * El cuerpo de una ruta de IA, en un solo sitio.
 *
 * `ai-gate.ts` ya había traído aquí **las puertas** —el límite por minuto, el
 * proveedor y el cupo—, que era lo que costaba dinero repetir. Lo que se quedó
 * copiado tres veces fue todo lo demás, y es más de la mitad de cada ruta: leer
 * el cuerpo, validarlo, pedirle al modelo con su reintento, comprobar lo que
 * conteste y decidir qué código HTTP sale de cada final. Cuarenta líneas
 * idénticas en ideas —ya retiradas—, profesor y salidas.
 *
 * No es solo escribir menos. Lo que se repetía eran **decisiones**, y repetidas
 * se separan: cuántos reintentos, qué estado devuelve un modelo que no contesta
 * —502 y no 500, porque el fallo es de un tercero—, qué devuelve uno que
 * contesta algo que no vale, y que la respuesta que se le enseña a nadie pasa
 * por el validador del dominio. Tres copias son tres oportunidades de que una se
 * quede atrás.
 *
 * Lo que cambia de una ruta a otra entra por parámetro, y es poco: cómo se lee
 * la petición, cómo se escribe el prompt, qué esquema se le exige al modelo,
 * cómo se valida lo que vuelve y —si la ruta lo tiene— **qué contestar cuando el
 * modelo no da nada que valga**, el `respaldo`. Con él, la ruta no devuelve los dos
 * 502 de después de la puerta: la pregunta ya está cobrada, y una respuesta
 * construida por el dominio, que diga que lo es, sirve más que la pantalla de
 * error. El bucle de los intentos vive en `ai-intentos.ts`, que es lo que usa
 * también el examen del profesor. Nada de eso vive aquí, y no puede: los
 * contratos están en `features/*​/contract.ts` y `server/` no importa de un
 * feature —la regla 5, que ESLint vigila en los dos sentidos—.
 */

import { NextResponse } from 'next/server';

import { abrirPuertaDeIa, frenarPorFrecuencia, type ConstructorDeError } from './ai-gate';
import { preguntarAlModelo, type PreguntaAlModelo } from './ai-intentos';
import type { PuertaDeIa } from './ai-gate';
import type { SlidingWindowRateLimiter } from './rate-limit';
import { readJsonBody } from './request-body';

/**
 * Lo que distingue a una ruta de otra.
 *
 * Lo que se le pregunta al modelo y cómo se comprueba —el prompt, el esquema, el
 * validador y el respaldo— está en `PreguntaAlModelo` (`ai-intentos.ts`), que es
 * lo que usa también el examen del profesor. Aquí se añade lo que es de HTTP: el
 * limitador, los errores, la puerta del cupo y cómo se lee el cuerpo.
 */
export interface RutaDeIa<Peticion, Respuesta> extends PreguntaAlModelo<Peticion, Respuesta> {
  /** En memoria y por instancia: cada ruta tiene el suyo. */
  readonly limiter: SlidingWindowRateLimiter;
  readonly error: ConstructorDeError;
  /** Qué se está pidiendo, para el cupo y para la frase del plan. */
  readonly puerta: Omit<PuertaDeIa, 'error'>;
  /** Reconstruye la petición campo a campo. Nulo si no vale. */
  readonly parse: (body: unknown) => Peticion | null;
  /**
   * Por qué no vale, cuando hay algo más concreto que decir que la frase de
   * `invalid_request`. Solo se pregunta si `parse` ha dicho que no.
   *
   * Opcional, y es para el caso en que la petición está bien formada y aun así no
   * hay nada que pedir: treinta y un compases y «Continuar» no son «nos falta la
   * progresión», son «ya no cabe otra parte».
   */
  readonly porQueNoVale?: (body: unknown) => string | null;
}

/**
 * Deja rastro de que el modelo no ha dado nada que valga.
 *
 * Sin esto, un modelo caído no se veía en ningún registro: el respaldo contesta un
 * 200 y desde fuera todo parece ir bien. **Solo el código, la ruta y el motivo**:
 * ni la pregunta ni las directrices, que son texto de quien lo escribe y un
 * registro no es sitio para él.
 */
function avisarDelFallo(ruta: string, codigo: number, motivo: string): void {
  console.warn(
    `[ia] el modelo no ha dado nada que valga: ruta=${ruta} codigo=${codigo} motivo=${motivo}`,
  );
}

/**
 * Contesta una petición de IA de principio a fin.
 *
 * El orden de las puertas no es un detalle: el límite por minuto va primero
 * porque es memoria y es gratis; leer el cuerpo, después; y el cupo, el último,
 * porque es una escritura en la base de datos. Al revés se pagaría una consulta
 * por cada pulsación de más.
 */
export async function responderConModelo<Peticion, Respuesta>(
  request: Request,
  ruta: RutaDeIa<Peticion, Respuesta>,
): Promise<NextResponse> {
  // Compartido entre instancias cuando hay base de datos; en memoria cuando no.
  const frenada = await frenarPorFrecuencia(request, ruta.limiter, ruta.error, Date.now());
  if (frenada !== null) {
    return frenada;
  }

  // Por el lector acotado: un cuerpo roto, vacío o de cincuenta megas llega como
  // objeto vacío, y `ruta.parse` contesta nulo, que es el mismo 400 que daba el
  // `catch`. Lo que cambia es que ya no se junta en memoria lo que no cabe.
  const body = await readJsonBody(request);

  const peticion = ruta.parse(body);
  if (peticion === null) {
    const motivo = ruta.porQueNoVale?.(body) ?? undefined;
    return NextResponse.json(ruta.error('invalid_request', motivo), { status: 400 });
  }

  const cerrada = await abrirPuertaDeIa({ ...ruta.puerta, error: ruta.error });
  if (cerrada !== null) {
    return cerrada;
  }

  const desenlace = await preguntarAlModelo(ruta, peticion);
  if (desenlace.kind === 'error') {
    avisarDelFallo(ruta.puerta.feature, 502, desenlace.fallo);
    return NextResponse.json(ruta.error(desenlace.fallo), { status: 502 });
  }
  if (desenlace.kind === 'respaldo') {
    avisarDelFallo(ruta.puerta.feature, 200, desenlace.fallo);
  }
  return NextResponse.json(desenlace.respuesta);
}
