/**
 * La analítica: `POST` apunta un evento del navegador y `GET` lo lee quien
 * administra ([adr/0110](../../../../docs/adr/0110-contar-sin-seguir.md)).
 *
 * `POST` contesta 204 casi siempre —también cuando no apunta nada— porque al
 * navegador no le sirve de nada saber por qué: sin base de datos, con `DNT` o con
 * `Sec-GPC` no se cuenta, y ninguna de las tres cosas es un error.
 *
 * `GET` no existe si no hay `METRICAS_CLAVE`: no hay papel de administrador en las
 * cuentas, y una clave en el entorno es lo más corto que no deja la retención a
 * la vista de cualquiera. Se pide con `Authorization: Bearer <clave>`.
 */

import { createHash, createHmac, randomBytes } from 'node:crypto';

import { NextResponse } from 'next/server';

import { parseBrowserReport, utcDay } from '@core/analytics';
import { tooManyRequests } from '@server/api-response';
import { sameHex } from '@server/constant-time';
import { hasDatabase } from '@server/db/client';
import { currentSession } from '@server/entitlements';
import { leerMetricas, noQuiereQueLeSigan, registrarEvento, seudonimo } from '@server/metricas';
import { limitRequest } from '@server/rate-limit-db';
import { requesterKey, SlidingWindowRateLimiter } from '@server/rate-limit';
import { readJsonBody } from '@server/request-body';

export const runtime = 'nodejs';

/**
 * Sesenta por minuto y dirección. Una visita por pantalla abierta, y nadie abre
 * una por segundo; lo que se defiende es que alguien llene la tabla a mano.
 */
const LIMITE = { limit: 60, windowMs: 60_000 } as const;
const limiter = new SlidingWindowRateLimiter(LIMITE);

/** Lo mismo para leer: con diez intentos por minuto adivinar la clave no tiene fin. */
const LIMITE_LECTURA = { limit: 10, windowMs: 60_000 } as const;
const limiterLectura = new SlidingWindowRateLimiter(LIMITE_LECTURA);

/**
 * Diez visitantes nuevos al día por dirección —una IPv6 cuenta por su /64—.
 *
 * Un seudónimo de navegador es un UUID que el navegador inventa, así que cualquiera
 * puede inventar otro en cada petición: con el tope de arriba eran sesenta
 * «primera vez» por minuto y por dirección, y la retención decía lo que quisiera
 * quien los mandaba. Diez al día deja contar a una casa o una oficina con varios
 * aparatos; lo que pase de ahí se suma igual, sin nadie dentro
 * ([adr/0113](../../../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 */
const LIMITE_NUEVOS = { limit: 10, windowMs: 24 * 60 * 60_000 } as const;
const limiterNuevos = new SlidingWindowRateLimiter(LIMITE_NUEVOS);

const NADA = () => new NextResponse(null, { status: 204 });

const huella = (texto: string) => createHash('sha256').update(texto).digest('hex');

// **La dirección, con clave.** Un SHA-256 a secas de una IPv4 se deshace
// recorriendo las 2³² posibles en segundos, y entonces «no guardamos la IP» sería
// mentira. Con la clave de las cuentas, o una al azar por proceso si no la hay:
// el contador vive un minuto, y que dos procesos no compartan clave solo parte
// un tope que ya era aproximado.
const CLAVE_DEL_PROCESO = randomBytes(32);
const huellaDeLaDireccion = (direccion: string) =>
  createHmac('sha256', process.env['AUTH_SECRET'] || CLAVE_DEL_PROCESO)
    .update(direccion)
    .digest('hex')
    .slice(0, 16);

export async function POST(request: Request): Promise<NextResponse> {
  if (noQuiereQueLeSigan(request.headers) || !hasDatabase()) {
    return NADA();
  }

  // **La dirección, con huella.** El tope cuenta por dirección y su contador se
  // guarda en `rate_limits`; los demás topes guardan la dirección tal cual
  // durante su minuto, y este no tiene por qué: es la ruta que promete no
  // guardar ninguna.
  const ahora = Date.now();
  const direccion = huellaDeLaDireccion(requesterKey(request.headers));
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: limiter,
    key: `metricas:${direccion}`,
    now: ahora,
    options: LIMITE,
  });
  if (!allowed) {
    return tooManyRequests(retryAfterSeconds);
  }

  const informe = parseBrowserReport(await readJsonBody(request));
  if (informe === null) {
    return new NextResponse(null, { status: 400 });
  }

  // La cuenta gana al navegador: es la misma persona en el móvil y en el
  // portátil, y así cuenta como una. **Con `currentSession` y no con la cookie a
  // secas**: la cookie de una cuenta borrada sigue firmada hasta que caduca, y con
  // ella se volvía a crear el seudónimo que borrar la cuenta acababa de olvidar.
  // La sesión comprueba que la cuenta existe y que la cookie no es de antes de
  // cambiar la contraseña (adr/0113).
  const sesion = await currentSession();
  const dia = utcDay(ahora);

  if (sesion !== null) {
    await registrarEvento(
      { evento: informe.event, ruta: informe.route, visitante: seudonimo('cuenta', sesion.userId) },
      dia,
    );
    return NADA();
  }

  // Un navegador nuevo gasta del tope de nuevos de su dirección; uno que ya
  // existía, no: `registrarEvento` solo pregunta por los que no están.
  const admitirNuevo = async () =>
    (
      await limitRequest({
        memoria: limiterNuevos,
        key: `metricas-nuevos:${direccion}`,
        now: ahora,
        options: LIMITE_NUEVOS,
      })
    ).allowed;
  await registrarEvento(
    {
      evento: informe.event,
      ruta: informe.route,
      visitante: informe.deviceId === null ? null : seudonimo('navegador', informe.deviceId),
      admitirNuevo,
    },
    dia,
  );
  return NADA();
}

export async function GET(request: Request): Promise<NextResponse> {
  const clave = process.env['METRICAS_CLAVE'];
  if (clave === undefined || clave === '') {
    return new NextResponse(null, { status: 404 });
  }

  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: limiterLectura,
    key: `metricas-lectura:${huellaDeLaDireccion(requesterKey(request.headers))}`,
    now: Date.now(),
    options: LIMITE_LECTURA,
  });
  if (!allowed) {
    return tooManyRequests(retryAfterSeconds);
  }

  const dada = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  // Con huella las dos, para comparar en tiempo constante cosas del mismo largo.
  if (!sameHex(huella(dada), huella(clave))) {
    return new NextResponse(null, { status: 401 });
  }

  const metricas = await leerMetricas(utcDay(Date.now()));
  if (metricas === null) {
    return NextResponse.json(
      {
        error: {
          code: 'sin-base',
          message: 'Esta copia no tiene base de datos: no hay nada que leer.',
        },
      },
      { status: 503 },
    );
  }
  return NextResponse.json(metricas, { headers: { 'Cache-Control': 'no-store' } });
}
