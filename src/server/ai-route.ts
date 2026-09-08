/**
 * El cuerpo de una ruta de IA, en un solo sitio.
 *
 * `ai-gate.ts` ya había traído aquí **las puertas** —el límite por minuto, el
 * proveedor y el cupo—, que era lo que costaba dinero repetir. Lo que se quedó
 * copiado tres veces fue todo lo demás, y es más de la mitad de cada ruta: leer
 * el cuerpo, validarlo, pedirle al modelo con su reintento, comprobar lo que
 * conteste y decidir qué código HTTP sale de cada final. Cuarenta líneas
 * idénticas en ideas, profesor y salidas.
 *
 * No es solo escribir menos. Lo que se repetía eran **decisiones**, y repetidas
 * se separan: cuántos reintentos, qué estado devuelve un modelo que no contesta
 * —502 y no 500, porque el fallo es de un tercero—, qué devuelve uno que
 * contesta algo que no vale, y que la respuesta que se le enseña a nadie pasa
 * por el validador del dominio. Tres copias son tres oportunidades de que una se
 * quede atrás.
 *
 * Lo que cambia de una ruta a otra entra por parámetro, y es poco: cómo se lee
 * la petición, cómo se escribe el prompt, qué esquema se le exige al modelo y
 * cómo se valida lo que vuelve. Nada de eso vive aquí, y no puede: los
 * contratos están en `features/*​/contract.ts` y `server/` no importa de un
 * feature —la regla 5, que ESLint vigila en los dos sentidos—.
 */

import { NextResponse } from 'next/server';

import { MAX_MODEL_ATTEMPTS } from '@core/billing';

import { abrirPuertaDeIa, frenarPorFrecuencia, type ConstructorDeError } from './ai-gate';
import { askModel } from './ask-model';
import type { PuertaDeIa } from './ai-gate';
import type { SlidingWindowRateLimiter } from './rate-limit';

/**
 * Lo que distingue a una ruta de otra.
 *
 * `Peticion` es lo que sale de validar el cuerpo y `Respuesta` lo que se
 * devuelve como JSON cuando todo va bien.
 */
export interface RutaDeIa<Peticion, Respuesta> {
  /** En memoria y por instancia: cada ruta tiene el suyo. */
  readonly limiter: SlidingWindowRateLimiter;
  readonly error: ConstructorDeError;
  /** Qué se está pidiendo, para el cupo y para la frase del plan. */
  readonly puerta: Omit<PuertaDeIa, 'error'>;
  /** Reconstruye la petición campo a campo. Nulo si no vale. */
  readonly parse: (body: unknown) => Peticion | null;
  readonly prompt: (peticion: Peticion) => string;
  readonly system: string;
  /**
   * El esquema que se le exige a la respuesta.
   *
   * Es una función de la petición porque en dos de las tres rutas depende de
   * ella: los grados válidos no son los mismos en mayor que en menor, y con
   * `scale` hace falta un identificador de escala en vez de un grado.
   */
  readonly schema: (peticion: Peticion) => Record<string, unknown>;
  readonly maxTokens: number;
  /** Qué contestar sin clave, construido desde el dominio. */
  readonly sinClave: (peticion: Peticion) => unknown;
  /**
   * Comprueba contra el dominio lo que ha contestado el modelo y devuelve el
   * cuerpo de la respuesta, o nulo si no vale y hay que reintentar.
   *
   * Devuelve el cuerpo entero y no los datos sueltos porque cada ruta lo envuelve
   * distinto —`{ ideas }`, `{ versions }`, la respuesta a pelo— y eso es cosa
   * suya, no de aquí.
   */
  readonly validar: (payload: unknown, peticion: Peticion) => Respuesta | null;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(ruta.error('invalid_request'), { status: 400 });
  }

  const peticion = ruta.parse(body);
  if (peticion === null) {
    return NextResponse.json(ruta.error('invalid_request'), { status: 400 });
  }

  const cerrada = await abrirPuertaDeIa({ ...ruta.puerta, error: ruta.error });
  if (cerrada !== null) {
    return cerrada;
  }

  const prompt = ruta.prompt(peticion);

  // Un reintento y basta. Encadenar más cuesta dinero y tiempo, y quien está
  // delante prefiere un «no ha salido» rápido a treinta segundos de espera.
  for (let intento = 0; intento < MAX_MODEL_ATTEMPTS; intento += 1) {
    let payload: unknown;
    try {
      payload = await askModel({
        prompt,
        system: ruta.system,
        schema: ruta.schema(peticion),
        maxTokens: ruta.maxTokens,
        sinClave: () => ruta.sinClave(peticion),
      });
    } catch {
      // 502 y no 500: el que ha fallado es el modelo, no nosotros, y la
      // diferencia importa para quien mire los registros.
      return NextResponse.json(ruta.error('model_unavailable'), { status: 502 });
    }

    const respuesta = ruta.validar(payload, peticion);
    if (respuesta !== null) {
      return NextResponse.json(respuesta);
    }
  }

  return NextResponse.json(ruta.error('unparseable_response'), { status: 502 });
}
