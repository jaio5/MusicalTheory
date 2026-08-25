/**
 * La cuenta: quién eres, cómo se crea una y cómo se cambia lo tuyo.
 *
 * `GET` contesta lo mismo que el servidor le pasa a la portada al pintar, y
 * existe para después: cambiar de plan o gastar una pregunta cambia lo que aquí
 * se dice, y la pantalla lo vuelve a pedir sin recargar.
 *
 * `POST` registra. Los errores van con nombre y con frase en español, y ninguno
 * dice si un correo existe: el que ya está registrado y el que se acaba de
 * escribir mal se contestan distinto —hay que poder decir «ese correo ya
 * tiene cuenta»— pero eso solo pasa al registrarse, donde de todas formas se
 * sabría al intentar entrar.
 *
 * `PATCH` cambia el nombre o la contraseña de quien ya ha entrado. Las dos cosas
 * en la misma ruta porque son el mismo recurso —tu cuenta— y separarlas obligaría
 * a repetir la sesión, el límite de intentos y la traducción de errores.
 *
 * `DELETE` borra la cuenta y todo lo que cuelga de ella. Pide la contraseña, como
 * `PATCH`, y no tiene vuelta atrás.
 *
 * El correo **no se cambia aquí**, y no es un olvido: es el identificador de la
 * cuenta y cambiarlo pide confirmar la dirección nueva antes de mover nada. Sin
 * envío de correo eso no se puede hacer, y hacerlo a medias deja cuentas
 * apuntando a buzones que no existen.
 */

import { NextResponse } from 'next/server';

import { ANONYMOUS, MIN_PASSWORD_LENGTH } from '@core/billing';
import { isRecordOrEmpty } from '@core/parse';
import { configuredModel } from '@server/ai-model';
import { authAvailable } from '@server/auth';
import { currentAccount, currentSession } from '@server/entitlements';
import { readJsonBody } from '@server/request-body';
import { limitRequest } from '@server/rate-limit-db';
import { requesterKey, SlidingWindowRateLimiter } from '@server/rate-limit';
import { changePassword, createUser, deleteAccount, setName } from '@server/users';

export const runtime = 'nodejs';

/**
 * Cinco registros por minuto y dirección. Crear una cuenta cifra una contraseña,
 * y cifrar una contraseña cuesta cien milisegundos de procesador a propósito:
 * sin límite, esta ruta es la más fácil de usar para tumbar el servidor.
 */
const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 60_000 });

export async function GET(): Promise<NextResponse> {
  if (!authAvailable()) {
    // Sin cuentas, la anónima, pero con el modelo de verdad: de él salen los
    // cupos que enseña la pantalla de planes, y ahí no hay nada que ocultar.
    return NextResponse.json({
      account: { ...ANONYMOUS, aiModel: configuredModel() },
      accounts: false,
    });
  }
  return NextResponse.json({ account: await currentAccount(), accounts: true });
}

const MENSAJES = {
  'sin-base-de-datos':
    'Esta copia de la aplicación no tiene cuentas. Todo lo demás funciona igual, y tu avance se guarda en este navegador.',
  'correo-invalido': 'Ese correo no parece un correo. Revísalo y vuelve a probar.',
  'contrasena-corta': `La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  'ya-existe': 'Ese correo ya tiene cuenta. Entra con ella o usa otro correo.',
  error: 'No hemos podido crear la cuenta. Vuelve a intentarlo en un minuto.',
} as const;

const ESTADOS = {
  'sin-base-de-datos': 501,
  'correo-invalido': 400,
  'contrasena-corta': 400,
  'ya-existe': 409,
  error: 500,
} as const;

export async function POST(request: Request): Promise<NextResponse> {
  if (!authAvailable()) {
    return NextResponse.json(
      { error: { code: 'sin-cuentas', message: MENSAJES['sin-base-de-datos'] } },
      { status: 501 },
    );
  }

  const now = Date.now();
  // La clave lleva para qué es: registrar y cambiar la cuenta son dos límites
  // distintos, y con la misma clave gastar los intentos de uno gastaría los del
  // otro. En memoria eran dos objetos; compartidos, son dos claves.
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: limiter,
    key: `registro:${requesterKey(request.headers)}`,
    now,
    options: { limit: 5, windowMs: 60_000 },
  });
  if (!allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
        },
      },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'correo-invalido', message: MENSAJES['correo-invalido'] } },
      { status: 400 },
    );
  }

  const record = isRecordOrEmpty(body);
  const result = await createUser({
    email: record['email'],
    password: record['password'],
    name: record['name'],
  });

  if (result.kind !== 'ok') {
    return NextResponse.json(
      { error: { code: result.kind, message: MENSAJES[result.kind] } },
      { status: ESTADOS[result.kind] },
    );
  }

  // No se entra sola: la pantalla llama a `signIn` después, con las mismas
  // credenciales. Firmar la cookie aquí a mano sería reimplementar la mitad de
  // Auth.js para ahorrar una petición.
  return NextResponse.json({ email: result.user.email, plan: result.user.plan }, { status: 201 });
}

/**
 * Diez cambios por minuto y dirección.
 *
 * Su propio contador y no el de registrar: cambiar la contraseña comprueba la
 * actual, y comprobar una contraseña es exactamente lo que hace quien las prueba
 * a lo bruto. Que gastar los intentos de una cosa no gaste los de la otra es lo
 * que evita que probar contraseñas deje sin poder registrarse a quien comparte
 * salida a internet.
 */
const patchLimiter = new SlidingWindowRateLimiter({ limit: 10, windowMs: 60_000 });

const MENSAJES_PATCH = {
  'sin-base-de-datos': MENSAJES['sin-base-de-datos'],
  'contrasena-corta': MENSAJES['contrasena-corta'],
  'no-coincide': 'La contraseña de ahora no es esa. Vuelve a escribirla.',
  error: 'No hemos podido guardar el cambio. Vuelve a intentarlo en un minuto.',
} as const;

const ESTADOS_PATCH = {
  'sin-base-de-datos': 501,
  'contrasena-corta': 400,
  'no-coincide': 403,
  error: 500,
} as const;

export async function PATCH(request: Request): Promise<NextResponse> {
  const session = await currentSession();
  if (session === null) {
    return NextResponse.json(
      {
        error: {
          code: 'sin-sesion',
          message: 'Entra con tu cuenta para cambiar esto.',
        },
      },
      { status: 401 },
    );
  }

  const now = Date.now();
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: patchLimiter,
    key: `cuenta:${requesterKey(request.headers)}`,
    now,
    options: { limit: 10, windowMs: 60_000 },
  });
  if (!allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
        },
      },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  const record = await readJsonBody(request);

  // La contraseña primero: si se piden las dos cosas a la vez y la contraseña
  // actual no es la que dice, no se guarda tampoco el nombre. Quien no sabe la
  // contraseña no cambia nada de la cuenta, ni siquiera lo inofensivo.
  if ('passwordNueva' in record) {
    const result = await changePassword(
      session.userId,
      record['passwordActual'],
      record['passwordNueva'],
    );
    if (result.kind !== 'ok') {
      return NextResponse.json(
        { error: { code: result.kind, message: MENSAJES_PATCH[result.kind] } },
        { status: ESTADOS_PATCH[result.kind] },
      );
    }
  }

  if ('name' in record) {
    const user = await setName(session.userId, record['name']);
    if (user === null) {
      return NextResponse.json(
        { error: { code: 'error', message: MENSAJES_PATCH.error } },
        { status: 500 },
      );
    }
  }

  // La cuenta entera y recién leída, para que la pantalla se pinte con lo que hay
  // guardado y no con lo que acaba de escribir quien la usa.
  return NextResponse.json({ account: await currentAccount() });
}

const MENSAJES_DELETE = {
  'sin-base-de-datos': MENSAJES['sin-base-de-datos'],
  'no-coincide': 'La contraseña no es esa. Sin ella no se borra nada.',
  error: 'No hemos podido borrar la cuenta. Vuelve a intentarlo en un minuto.',
} as const;

const ESTADOS_DELETE = { 'sin-base-de-datos': 501, 'no-coincide': 403, error: 500 } as const;

/**
 * Borrar la cuenta.
 *
 * Comparte el contador de `PATCH` a propósito: las dos comprueban la contraseña
 * actual, y comprobar contraseñas es justo lo que hace quien las prueba a lo
 * bruto. Dos contadores separados para lo mismo darían el doble de intentos.
 *
 * Se va con ella el avance, las canciones y el contador de IA. Lo que no se va es
 * lo que nunca estuvo aquí: no hay audio ni vídeo que borrar, porque no sale del
 * equipo.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await currentSession();
  if (session === null) {
    return NextResponse.json(
      { error: { code: 'sin-sesion', message: 'Entra con tu cuenta para borrarla.' } },
      { status: 401 },
    );
  }

  const now = Date.now();
  const { allowed, retryAfterSeconds } = await limitRequest({
    memoria: patchLimiter,
    key: `cuenta:${requesterKey(request.headers)}`,
    now,
    options: { limit: 10, windowMs: 60_000 },
  });
  if (!allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
        },
      },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  const record = await readJsonBody(request);

  const result = await deleteAccount(session.userId, record['password']);
  if (result !== 'ok') {
    return NextResponse.json(
      { error: { code: result, message: MENSAJES_DELETE[result] } },
      { status: ESTADOS_DELETE[result] },
    );
  }

  // La cookie sigue firmada y viva, así que la pantalla tiene que cerrar sesión
  // después. Si no, quien acaba de borrarse se queda con una sesión que apunta a
  // una fila que ya no existe: `currentSession` devuelve nulo y todo parece roto
  // en vez de parecer cerrado.
  return NextResponse.json({ borrada: true });
}
