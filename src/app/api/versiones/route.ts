import type { NextResponse } from 'next/server';

import {
  parseVersionsRequest,
  porQueNoValeLaPeticion,
  versionsError,
} from '@features/versions/contract';
import { responderConModelo } from '@server/ai-route';
import { SlidingWindowRateLimiter } from '@server/rate-limit';

import { SALIDAS } from './salidas';

/**
 * Route handler de versiones. Como el del profesor: el SDK y la clave solo se
 * importan aquí, porque desde un componente el bundler se los llevaría al
 * navegador.
 *
 * **Lo que sube son grados y pulsos**, y su contexto en símbolos: la especie de
 * cada compás, las alturas del punteo que suenan encima, el estilo y el compás. Ni
 * una muestra de audio, aunque lo que hay
 * detrás se llame «grabar un trozo»: la aplicación ya sabe qué acorde suena, así
 * que grabar es apuntar símbolos. Es lo que mantiene en pie la regla 4 de la
 * arquitectura y lo que hace que esto cueste céntimos en vez de euros.
 *
 * Es la petición más cara de las dos, y entra en el plan Medio (adr/0066). El contrato
 * completo está en docs/AI.md.
 *
 * **Las salidas las construye el dominio y el modelo elige**: el prompt lleva el
 * menú numerado (`salidasPosibles`) y lo que vuelve es un número, un título y un
 * porqué por salida. Eso está en `salidas.ts`; aquí queda lo que es de HTTP.
 */

export const runtime = 'nodejs';

/** En memoria y por instancia, con la misma limitación que la otra ruta. */
const limiter = new SlidingWindowRateLimiter();

export async function POST(request: Request): Promise<NextResponse> {
  return responderConModelo(request, {
    limiter,
    error: versionsError,
    puerta: { feature: 'versiones', loQueEs: 'Las salidas de lo que tocas', plural: true },
    parse: parseVersionsRequest,
    // Treinta y un compases y «Continuar» no son «nos falta la progresión».
    porQueNoVale: porQueNoValeLaPeticion,
    // El prompt, el esquema, el validador y el respaldo, en `salidas.ts`: los usa
    // tal cual un examen de las salidas, como el del profesor usa `PROFESOR`.
    ...SALIDAS,
  });
}
