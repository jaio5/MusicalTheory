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

import { after, NextResponse } from 'next/server';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { tooManyRequests } from '@server/api-response';
import { appUrl } from '@server/app-url';
import { mailer } from '@server/mail';
import { readJsonBody } from '@server/request-body';
import { pruneResets, requestReset, resetPassword } from '@server/password-reset';
import { limitRequest } from '@server/rate-limit-db';
import { MAX_PASSWORD_LENGTH } from '@server/password';
import { huellaDeCorreo, requesterKey, SlidingWindowRateLimiter } from '@server/rate-limit';

export const runtime = 'nodejs';

/**
 * Tres por minuto y dirección.
 *
 * Menos que los demás: cada una manda un correo, y un correo que no pediste es
 * molestia para quien lo recibe y reputación quemada para quien lo manda. Con
 * tres no se puede usar esto para inundar el buzón de nadie.
 */
const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 60_000 });

/**
 * Tres por cuarto de hora y correo, cuente desde donde cuente.
 *
 * El de la dirección no bastaba: cambiándola, se podía llenar de correos el buzón
 * de una persona concreta. Pasado este tope se contesta lo mismo y no se manda
 * nada, así que tampoco dice si ese correo tiene cuenta: el tope cuenta igual
 * para uno inventado.
 */
const LIMITE_POR_CORREO = { limit: 3, windowMs: 15 * 60_000 } as const;
const limiterPorCorreo = new SlidingWindowRateLimiter(LIMITE_POR_CORREO);

/** La misma frase siempre, se haya mandado algo o no. */
const MANDADO =
  'Si ese correo tiene cuenta, le hemos mandado un enlace para poner una contraseña nueva. Caduca en una hora.';

async function puerta(request: Request): Promise<NextResponse | null> {
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: limiter,
    key: `olvidada:${requesterKey(request.headers)}`,
    now: Date.now(),
    options: { limit: 3, windowMs: 60_000 },
  });

  return allowed ? null : tooManyRequests(retryAfterSeconds);
}

/**
 * Si a ese correo se le pueden mandar más enlaces ahora.
 *
 * La clave lleva la huella del correo y no el correo: entero, uno de 100 KB
 * —cabe en el cuerpo— reventaba el índice de la tabla de topes y el tope caía al
 * de memoria, que es por proceso (adr/0113).
 */
async function cabeOtroCorreo(email: unknown): Promise<boolean> {
  const { allowed } = await limitRequest({
    memoria: limiterPorCorreo,
    key: `olvidada:correo:${huellaDeCorreo(email)}`,
    now: Date.now(),
    options: LIMITE_POR_CORREO,
  });
  return allowed;
}

/**
 * Crea el vale y manda el correo, si ese correo tiene cuenta.
 *
 * Nunca lanza: corre cuando la respuesta ya se ha ido y no hay a quién contarle
 * un fallo. `requestReset` ya se traga los suyos; esto cubre el envío.
 */
async function mandarEnlace(email: unknown, correo: ReturnType<typeof mailer>): Promise<void> {
  const now = new Date();
  try {
    const vale = await requestReset(email, now);
    if (vale === null) {
      return;
    }
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
  } catch {
    // El proveedor de correo no contesta: no hay respuesta que cambiar, ya salió.
  }
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

  const email = (await readJsonBody(request))['email'];

  // **El trabajo va después de contestar** (`after`, de Next). Antes se esperaba
  // a crear el vale y a mandar el correo, y eso solo pasa cuando la cuenta existe:
  // la respuesta tardaba más con un correo registrado que con uno inventado, y
  // midiéndolo desde fuera se sacaba la lista de cuentas que la frase de abajo
  // se cuida de no dar. Ahora tarda lo mismo, porque lo que hace es lo mismo.
  if (await cabeOtroCorreo(email)) {
    after(() => mandarEnlace(email, correo));
  }

  // La misma respuesta exista o no la cuenta, y se haya mandado o no.
  return NextResponse.json({ message: MANDADO });
}

const MENSAJES = {
  ok: '',
  'vale-no-vale':
    'Ese enlace ya no sirve: o ha caducado, o ya se usó. Pide uno nuevo desde la pantalla de entrar.',
  'contrasena-corta': `La contraseña necesita entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`,
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

  const record = await readJsonBody(request);
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
