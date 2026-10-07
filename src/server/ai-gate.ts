/**
 * Las puertas por las que pasa toda petición a la IA, en un solo sitio.
 *
 * Las rutas de IA —eran tres: ideas, ya retiradas, profesor y salidas— tenían
 * escritas las mismas cuarenta líneas: el límite por minuto, la comprobación de que hay quien conteste, el
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
import {
  needsPlanMessage,
  planOf,
  quotaMessage,
  type Account,
  type AiFeature,
} from '@core/billing';

import { segundosHastaQueAbra, type Reserva, type TopeAlcanzado } from './ai-gasto';
import { modelAvailable } from './ask-model';
import { spendAi } from './entitlements';
import { esperaPorFrecuencia, limitRequest } from './rate-limit-db';
import {
  DEFAULT_RATE_LIMIT,
  requesterKey,
  SIN_DIRECCION,
  SlidingWindowRateLimiter,
} from './rate-limit';

/** Lo que cada ruta sabe construir con su propia lista de frases. */
export type ConstructorDeError = (code: AiErrorCode, message?: string) => AiError;

/** El 429 de frenar, con la cabecera que dice cuánto esperar. */
function frenado(error: ConstructorDeError, espera: number): NextResponse {
  return NextResponse.json(error('rate_limited'), {
    status: 429,
    // La cabecera es la parte que se olvida al copiar, y sin ella un cliente
    // educado no sabe cuánto esperar y vuelve a probar en seguida.
    headers: { 'Retry-After': String(espera) },
  });
}

/**
 * El límite por dirección: **una capa barata, y nada más** (adr/0114).
 *
 * Fue el único límite de la IA, y frenaba antes de saber quién pedía: sin
 * `TRUSTED_PROXY_HOPS` todas las peticiones comparten dirección, y diez
 * anónimas seguidas dejaban sin IA a todas las cuentas a la vez. Ahora el que
 * importa es el de la cuenta (`frenarPorCuenta`), y éste queda delante para
 * parar a quien aporrea desde una dirección **sin leer la sesión**:
 *
 * - **Con su propia clave** (`ia-ip`), así que no gasta el cubo de nadie.
 * - **Más ancho**, sesenta por minuto: detrás de una dirección puede haber una
 *   clase entera de conservatorio.
 * - **Y solo cuando hay dirección.** Sin proxy de confianza todo el mundo es la
 *   misma, y un tope común es justo el fallo que se quitó.
 */
export const LIMITE_POR_DIRECCION = { limit: 60, windowMs: 60_000 } as const;
const porDireccion = new SlidingWindowRateLimiter(LIMITE_POR_DIRECCION);

export async function frenarPorDireccion(
  request: Request,
  error: ConstructorDeError,
  now: number,
): Promise<NextResponse | null> {
  if (requesterKey(request.headers) === SIN_DIRECCION) {
    return null;
  }
  const espera = await esperaPorFrecuencia(
    request,
    porDireccion,
    'ia-ip',
    LIMITE_POR_DIRECCION,
    now,
  );
  return espera === null ? null : frenado(error, espera);
}

/**
 * El límite por minuto **de cada cuenta**, después de leer la sesión.
 *
 * **Las rutas de IA comparten cubo**, y por eso comparten prefijo: veinte
 * pulsaciones seguidas son veinte pulsaciones seguidas aunque se repartan entre
 * pedir salidas y preguntarle al profesor. La cuenta tiene los suyos —`registro` y
 * `cuenta`— porque son otra cosa. Compartido entre instancias cuando hay base de
 * datos; en memoria —el limitador de la ruta— cuando no.
 */
export async function frenarPorCuenta(
  userId: string,
  limiter: SlidingWindowRateLimiter,
  error: ConstructorDeError,
  now: number,
): Promise<NextResponse | null> {
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: limiter,
    key: `ia:${userId}`,
    now,
    options: DEFAULT_RATE_LIMIT,
  });
  return allowed ? null : frenado(error, retryAfterSeconds);
}

/** La misma frase empezando en minúscula, para meterla dentro de otra. */
function enMinuscula(frase: string): string {
  return frase.charAt(0).toLowerCase() + frase.slice(1);
}

export interface PuertaDeIa {
  readonly feature: AiFeature;
  readonly error: ConstructorDeError;
  /**
   * Cómo se llama lo que se pide, para la frase del plan: «Las salidas de lo que
   * tocas».
   * Se escribe entero y no se compone, porque lleva artículo y género.
   */
  readonly loQueEs: string;
  /** Si `loQueEs` va en plural, que cambia el verbo de la frase. */
  readonly plural: boolean;
}

/**
 * Que haya quien conteste, **antes que nada que cueste**: antes de leer la
 * sesión y mucho antes de tocar el cupo.
 *
 * `askModel` fallaría igual más abajo, pero para entonces la petición ya estaba
 * contada.
 *
 * **Y se dice lo que pasa, que no es lo mismo que lo de abajo.** La frase de
 * serie —«no hemos podido contactar con el modelo, vuelve a intentarlo en un
 * minuto»— es mentira aquí: nadie ha intentado contactar con nada, porque no hay
 * ninguno puesto. Además invita a reintentar algo que no va a funcionar nunca,
 * por muchos minutos que pasen. Es el caso de una copia levantada sin clave y sin
 * modelo de casa, que es exactamente lo que hace `docker compose up` a secas.
 */
export function comprobarProveedor(puerta: PuertaDeIa): NextResponse | null {
  if (modelAvailable()) {
    return null;
  }
  return NextResponse.json(
    puerta.error(
      'model_unavailable',
      // Solo la primera letra en minúscula, no toda la frase: `loQueEs` lleva
      // dentro «la IA», y bajarla entera la convertía en «la ia».
      `Esta copia no tiene ningún modelo configurado, así que ${enMinuscula(puerta.loQueEs)} no ${
        puerta.plural ? 'están disponibles' : 'está disponible'
      } aquí. Todo lo demás funciona igual.`,
    ),
    { status: 503 },
  );
}

/**
 * La frase del techo de gasto (adr/0114). Dice de quién es el tope y hasta
 * cuándo, porque «vuelve en un minuto» haría reintentar algo que no va a abrir
 * hasta mañana, y porque a quien paga hay que decirle que no es su cupo.
 */
export function fraseDelTope(tope: TopeAlcanzado, loQueEs: string, plural: boolean): string {
  const hasta = tope.cuando === 'dia' ? 'hasta mañana' : 'hasta el mes que viene';
  const disponible = plural ? 'están disponibles' : 'está disponible';
  return tope.quien === 'gratis'
    ? `En el plan gratis, ${enMinuscula(loQueEs)} no ${disponible} para nadie ${hasta}: se ha llegado al tope de gasto que esta copia reserva para lo gratis. Tu cupo sigue igual, y con un plan de pago no hay que esperar.`
    : `${loQueEs} no ${disponible} para nadie ${hasta}: esta copia ha llegado a su tope de gasto en el modelo. No es tu cupo, que sigue igual. Todo lo demás funciona.`;
}

/** La puerta abierta, con lo reservado del techo de gasto para asentarlo después. */
export interface PuertaAbierta {
  readonly reserva: Reserva | null;
}

/**
 * Comprueba el plan, el techo de gasto y el cupo, y gasta una petición.
 *
 * Devuelve la respuesta que hay que dar cuando no se puede seguir, o la puerta
 * abierta. Las razones por las que no se puede son distintas y se contestan
 * distinto a propósito: un 402 se arregla cambiando de plan, un 429 esperando a
 * mañana y un 503 no depende de quien pide, y quien lee la pantalla necesita
 * saber cuál le toca.
 *
 * Que haya proveedor lo ha comprobado ya `comprobarProveedor`; aquí se vuelve a
 * mirar por si alguien abre la puerta sin pasar por la ruta: el cupo es dinero, y
 * gastarlo sin modelo ya pasó una vez.
 */
export async function abrirPuertaDeIa(
  puerta: PuertaDeIa,
  session?: { userId: string; account: Account } | null,
): Promise<NextResponse | PuertaAbierta> {
  const sinModelo = comprobarProveedor(puerta);
  if (sinModelo !== null) {
    return sinModelo;
  }

  const permiso = await spendAi(puerta.feature, session);

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
          quotaMessage(
            planOf(permiso.account.plan),
            permiso.account.aiModel,
            permiso.scope,
            puerta.feature,
          ),
        ),
        { status: 429 },
      );
    case 'tope-global':
      return NextResponse.json(
        puerta.error('model_unavailable', fraseDelTope(permiso, puerta.loQueEs, puerta.plural)),
        {
          status: 503,
          headers: { 'Retry-After': String(segundosHastaQueAbra(permiso.cuando)) },
        },
      );
    case 'sin-contador':
      // No se ha podido contar, así que no se sirve. Servir sin contar es la
      // única forma de que el gasto se dispare sin que nadie se entere.
      return NextResponse.json(puerta.error('model_unavailable'), { status: 503 });
    case 'ok':
      return { reserva: permiso.reserva };
  }

  // Sin `default`, y a propósito: si mañana `AiVerdict` gana una forma nueva de
  // decir que no, esto deja de compilar en vez de dejarla pasar. Un `default`
  // que devuelve «adelante» convierte cualquier caso que nadie ha escrito
  // todavía en una llamada al modelo servida gratis.
}
