/**
 * «He olvidado mi contraseña»: pedir el enlace, y usarlo.
 *
 * `POST` manda el correo con el vale. `PUT` lo gasta y pone la contraseña nueva.
 * Los dos en la misma ruta porque son el mismo recurso —el vale— y separarlos
 * obligaría a repetir el límite de intentos y la traducción de errores.
 *
 * **`POST` contesta lo mismo exista o no ese correo**, y esa es la decisión que
 * sostiene el fichero. Contestar «ese correo no tiene cuenta» convertiría esta
 * pantalla en un buscador de quién está registrado aquí, que es justo lo que la
 * pantalla de entrar ya evita al no decir cuál de los dos campos falló.
 */

import { NextResponse } from 'next/server';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { mailer } from '@server/mail';
import { pruneResets, requestReset, resetPassword } from '@server/password-reset';
import { limitRequest } from '@server/rate-limit-db';
import { requesterKey, SlidingWindowRateLimiter } from '@server/rate-limit';

export const runtime = 'nodejs';

/**
 * Tres por minuto y dirección.
 *
 * Menos que los demás: cada una manda un correo, y un correo que no pediste es
 * molestia para quien lo recibe y reputación quemada para quien lo manda. Con
 * tres no se puede usar esto para inundar el buzón de nadie.
 */
const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 60_000 });

/** La misma frase siempre, se haya mandado algo o no. */
const MANDADO =
  'Si ese correo tiene cuenta, le hemos mandado un enlace para poner una contraseña nueva. Caduca en una hora.';

function appUrl(): string {
  const url = process.env['APP_URL'];
  return typeof url === 'string' && url !== '' ? url.replace(/\/$/, '') : 'http://localhost:3000';
}

async function cuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function puerta(request: Request): Promise<NextResponse | null> {
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: limiter,
    key: `olvidada:${requesterKey(request.headers)}`,
    now: Date.now(),
    options: { limit: 3, windowMs: 60_000 },
  });

  return allowed
    ? null
    : NextResponse.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
          },
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
      );
}

export async function POST(request: Request): Promise<NextResponse> {
  const cerrada = await puerta(request);
  if (cerrada !== null) {
    return cerrada;
  }

  const correo = mailer();
  if (!correo.sends) {
    // Sin proveedor de correo no hay nada que prometer, y decirlo es mejor que
    // dejar a alguien esperando delante de un buzón vacío.
    return NextResponse.json(
      {
        error: {
          code: 'sin-correo',
          message:
            'Esta copia de la aplicación no manda correo, así que no se puede recuperar la contraseña desde aquí.',
        },
      },
      { status: 501 },
    );
  }

  const now = new Date();
  const vale = await requestReset((await cuerpo(request))['email'], now);

  if (vale !== null) {
    const enlace = `${appUrl()}/olvidada?vale=${encodeURIComponent(vale.token)}`;
    await correo.send({
      to: vale.email,
      subject: 'Poner una contraseña nueva en Caos ordenado',
      text: [
        'Alguien ha pedido poner una contraseña nueva en tu cuenta.',
        '',
        'Si has sido tú, abre este enlace. Caduca en una hora y solo vale una vez:',
        enlace,
        '',
        'Si no has sido tú, no hagas nada: tu contraseña de ahora sigue valiendo.',
      ].join('\n'),
    });
    // Se aprovecha para soltar los vales caducados. Una tarea programada más que
    // desplegar y vigilar para borrar unas filas no compensa.
    await pruneResets(now);
  }

  // La misma respuesta exista o no la cuenta.
  return NextResponse.json({ message: MANDADO });
}

const MENSAJES = {
  ok: '',
  'vale-no-vale':
    'Ese enlace ya no sirve: o ha caducado, o ya se usó. Pide uno nuevo desde la pantalla de entrar.',
  'contrasena-corta': `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  'sin-base-de-datos': 'Esta copia de la aplicación no tiene cuentas.',
  error: 'No hemos podido cambiar la contraseña. Vuelve a intentarlo en un minuto.',
} as const;

const ESTADOS = {
  ok: 200,
  'vale-no-vale': 400,
  'contrasena-corta': 400,
  'sin-base-de-datos': 501,
  error: 500,
} as const;

export async function PUT(request: Request): Promise<NextResponse> {
  const cerrada = await puerta(request);
  if (cerrada !== null) {
    return cerrada;
  }

  const record = await cuerpo(request);
  const result = await resetPassword(record['vale'], record['password'], new Date());

  if (result !== 'ok') {
    return NextResponse.json(
      { error: { code: result, message: MENSAJES[result] } },
      { status: ESTADOS[result] },
    );
  }

  // No se entra sola: la pantalla manda a entrar con la contraseña nueva. Y las
  // demás sesiones se han quedado fuera, que es lo que hace `resetPassword`.
  return NextResponse.json({ cambiada: true });
}
