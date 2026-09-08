/**
 * Las puertas por las que pasa toda petición a la IA, en un solo sitio.
 *
 * Las tres rutas —ideas, profesor y salidas— tenían escritas las mismas cuarenta
 * líneas: el límite por minuto, la comprobación de que hay quien conteste, el
 * cupo, y las cuatro ramas de lo que puede salir mal. Solo cambiaban en dos
 * cosas: qué constructor de errores usar y cómo se llama en castellano lo que se
 * está pidiendo.
 *
 * **Y el orden importa de verdad**, que es la razón de fondo para traerlo aquí.
 * `spendAi` cuenta la petición **antes** de hablar con el modelo, así que
 * comprobar el proveedor después de gastar cupo deja a alguien sin sus peticiones
 * del mes por una variable de entorno que faltaba. Eso ya pasó una vez. Estaba
 * vigilado por un test que **leía el código de las tres rutas y buscaba en qué
 * línea aparecía cada llamada**: funcionaba, pero era un test de texto, y bastaba
 * mover una línea al refactorizar para perderlo. Aquí el orden es estructural: no
 * hay forma de llamar al cupo sin haber pasado antes por el proveedor, porque es
 * la misma función.
 *
 * El constructor de errores entra como parámetro y no se importa: vive en
 * `features/*​/contract.ts` y `server/` no importa de un feature —la regla 5, que
 * ESLint vigila en los dos sentidos—. Lo que sí se comparte es el tipo, que está
 * en `core/`.
 */

import { NextResponse } from 'next/server';

import type { AiError, AiErrorCode } from '@core/ai-errors';
import { needsPlanMessage, planOf, quotaMessage, type AiFeature } from '@core/billing';

import { modelAvailable } from './ask-model';
import { spendAi } from './entitlements';
import { esperaPorFrecuencia } from './rate-limit-db';
import type { SlidingWindowRateLimiter } from './rate-limit';

/** Lo que cada ruta sabe construir con su propia lista de frases. */
export type ConstructorDeError = (code: AiErrorCode, message?: string) => AiError;

/**
 * El límite por minuto y dirección.
 *
 * Devuelve la respuesta cuando hay que frenar, y nulo cuando se puede seguir. Va
 * antes de leer el cuerpo porque es la puerta más barata que hay: no toca ni la
 * base de datos ni la sesión.
 *
 * **Las tres rutas de IA comparten cubo**, y por eso comparten prefijo: veinte
 * pulsaciones seguidas son veinte pulsaciones seguidas aunque se repartan entre
 * pedir ideas y preguntarle al profesor. La cuenta tiene los suyos —`registro` y
 * `cuenta`— porque son otra cosa.
 */
export async function frenarPorFrecuencia(
  request: Request,
  limiter: SlidingWindowRateLimiter,
  error: ConstructorDeError,
  now: number,
): Promise<NextResponse | null> {
  const espera = await esperaPorFrecuencia(request, limiter, 'ia', undefined, now);
  if (espera === null) {
    return null;
  }
  return NextResponse.json(error('rate_limited'), {
    status: 429,
    // La cabecera es la parte que se olvida al copiar, y sin ella un cliente
    // educado no sabe cuánto esperar y vuelve a probar en seguida.
    headers: { 'Retry-After': String(espera) },
  });
}

export interface PuertaDeIa {
  readonly feature: AiFeature;
  readonly error: ConstructorDeError;
  /**
   * Cómo se llama lo que se pide, para la frase del plan: «Las ideas de la IA».
   * Se escribe entero y no se compone, porque lleva artículo y género.
   */
  readonly loQueEs: string;
  /** Si `loQueEs` va en plural, que cambia el verbo de la frase. */
  readonly plural: boolean;
}

/**
 * Comprueba que hay quien conteste y gasta una petición del cupo.
 *
 * Devuelve la respuesta que hay que dar cuando no se puede seguir, y nulo cuando
 * sí. Las cuatro razones por las que no se puede son distintas y se contestan
 * distinto a propósito: un 402 se arregla cambiando de plan y un 429 esperando a
 * mañana, y quien lee la pantalla necesita saber cuál de las dos le toca.
 */
export async function abrirPuertaDeIa(puerta: PuertaDeIa): Promise<NextResponse | null> {
  // Antes de tocar el cupo. `askModel` fallaría igual unas líneas más abajo, pero
  // para entonces la petición ya está contada.
  if (!modelAvailable()) {
    return NextResponse.json(puerta.error('model_unavailable'), { status: 503 });
  }

  // Después del límite por minuto: comprobar memoria es gratis y escribir en la
  // base de datos no.
  const permiso = await spendAi(puerta.feature);

  switch (permiso.kind) {
    case 'sin-cuenta':
      return NextResponse.json(puerta.error('account_required'), { status: 401 });
    case 'plan':
      return NextResponse.json(
        puerta.error(
          'plan_required',
          needsPlanMessage(permiso.needed, puerta.loQueEs, puerta.plural),
        ),
        { status: 402 },
      );
    case 'cupo':
      return NextResponse.json(
        puerta.error(
          'quota_exhausted',
          quotaMessage(planOf(permiso.account.plan), permiso.account.aiModel, permiso.scope),
        ),
        { status: 429 },
      );
    case 'sin-contador':
      // No se ha podido contar, así que no se sirve. Servir sin contar es la
      // única forma de que el gasto se dispare sin que nadie se entere.
      return NextResponse.json(puerta.error('model_unavailable'), { status: 503 });
    case 'ok':
      return null;
  }

  // Sin `default`, y a propósito: si mañana `AiVerdict` gana una forma nueva de
  // decir que no, esto deja de compilar en vez de dejarla pasar. Un `default`
  // que devuelve «adelante» convierte cualquier caso que nadie ha escrito
  // todavía en una llamada al modelo servida gratis.
}
