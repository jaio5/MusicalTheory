/**
 * Entrar y salir. Correo y contraseña, y nada más por ahora.
 *
 * Auth.js con sesión en cookie firmada (`jwt`) y sin tabla de sesiones: no hace
 * falta una consulta a la base de datos para saber quién eres en cada petición,
 * y la cookie solo lleva el identificador de la cuenta.
 *
 * **El plan no viaja en la cookie, a propósito.** Una cookie se firma una vez y
 * dura días; el plan cambia en el momento en que alguien lo cambia. Si el plan
 * fuese dentro, quien acaba de pagar seguiría viendo candados y quien acaba de
 * bajarse seguiría gastando llamadas al modelo hasta que caducara la cookie. El
 * plan se lee de la base de datos cada vez que se necesita, que es justo cuando
 * ya hay que ir a la base de datos de todos modos a mirar el cupo del día.
 *
 * Solo hay proveedor de correo y contraseña. Añadir Google mañana es añadir un
 * proveedor y el adaptador de tablas que pide Auth.js para enlazar cuentas; no
 * cambia nada de lo que hay aquí.
 */

import NextAuth, { CredentialsSignin, type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { verifyPassword } from './password';
import { findUserWithPassword } from './users';
import { hasDatabase } from './db/client';
import { DEMASIADOS_INTENTOS } from '@core/auth-errors';

import { requesterKey, SlidingWindowRateLimiter } from './rate-limit';
import { limitRequest } from './rate-limit-db';

declare module 'next-auth' {
  interface Session {
    readonly user: {
      readonly id: string;
      readonly sessionVersion: number;
    } & DefaultSession['user'];
  }
  interface User {
    /** La versión que tenía la cuenta al entrar. Ver `sessionVersion` en el esquema. */
    sessionVersion?: number;
  }
}

/**
 * Una contraseña cifrada que no es de nadie, con el formato bueno.
 *
 * Sirve para comprobar la contraseña también cuando el correo no existe. Sin
 * esto, entrar con un correo desconocido contesta en un milisegundo y entrar con
 * uno conocido tarda cien: la diferencia se mide desde fuera y regala una lista
 * de quién tiene cuenta aquí.
 */
const HASH_DE_NADIE = [
  'scrypt',
  16_384,
  8,
  1,
  Buffer.alloc(16).toString('base64'),
  Buffer.alloc(64).toString('base64'),
].join('$');

function secret(): string | null {
  const value = process.env['AUTH_SECRET'];
  return value === undefined || value === '' ? null : value;
}

/**
 * Si esta copia de la aplicación tiene cuentas.
 *
 * Hacen falta las dos cosas: una base de datos donde guardarlas y un secreto con
 * el que firmar la cookie. Sin alguna de las dos, la aplicación funciona entera
 * en modo anónimo y las pantallas de cuenta dicen que no están disponibles aquí,
 * en vez de fallar con un error de servidor que no explica nada.
 */
export function authAvailable(): boolean {
  return hasDatabase() && secret() !== null;
}

/**
 * Cuántos intentos de entrar se aceptan, y en cuánto tiempo.
 *
 * Cinco por minuto, el mismo que el registro. No es un número afinado contra
 * nada: es el que deja entrar a quien se equivoca dos veces al teclear y corta a
 * quien prueba contraseñas, que es toda la diferencia que hace falta.
 */
const LIMITE_ENTRAR = { limit: 5, windowMs: 60_000 } as const;

/** El de memoria, para las copias sin base de datos. */
const limitador = new SlidingWindowRateLimiter(LIMITE_ENTRAR);

/**
 * Se ha probado demasiadas veces.
 *
 * `CredentialsSignin` y no un `Error` cualquiera: es la que Auth.js deja pasar con
 * su `code` hasta el resultado de `signIn`. Cualquier otra se convierte en un
 * error genérico y la pantalla no podría distinguirla.
 */
class DemasiadosIntentos extends CredentialsSignin {
  override code = DEMASIADOS_INTENTOS;
}

/**
 * Si ya se ha probado demasiadas veces.
 *
 * Devuelve un sí o un no y no los segundos que faltan: la ventana es de un minuto
 * y eso es lo que dice el mensaje, así que el número exacto no se usa para nada y
 * pasarlo sería llevarlo hasta la pantalla para no enseñarlo.
 *
 * **Se cuenta por dos claves, y las dos hacen falta**: por dirección, que corta a
 * quien prueba muchas contraseñas desde un sitio; y por correo, que corta a quien
 * prueba la misma cuenta desde muchos sitios. Con una sola, la otra manera queda
 * abierta.
 *
 * Se cuenta **antes de saber si la cuenta existe y para cualquier correo**, así
 * que esto no dice si alguien tiene cuenta aquí: un correo inventado se limita
 * igual que uno de verdad.
 */
async function pasadoDeIntentos(request: Request | undefined, correo: unknown): Promise<boolean> {
  const claves: string[] = [];
  // Auth.js siempre pasa la petición; el `?.` es para no depender de ello, y si
  // algún día no llegara **sigue contando por correo**, que es la clave que para
  // a quien va a por una cuenta concreta.
  const direccion = request?.headers;
  if (direccion !== undefined) {
    claves.push(`entrar:${requesterKey(direccion)}`);
  }
  // En minúsculas y sin espacios, que es como se guarda: si no, «A@b.com» y
  // «a@b.com» serían dos cupos para la misma cuenta.
  if (typeof correo === 'string') {
    claves.push(`entrar:correo:${correo.trim().toLowerCase()}`);
  }

  for (const key of claves) {
    const { allowed } = await limitRequest({
      memoria: limitador,
      key,
      now: Date.now(),
      options: LIMITE_ENTRAR,
    });
    if (!allowed) {
      return true;
    }
  }
  return false;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Detrás de un proxy con certificado —que es como se sirve esto— la cabecera
  // del anfitrión la pone el proxy, y Auth.js necesita que se le diga que puede
  // creérsela.
  trustHost: true,
  /* v8 ignore next -- sin secreto no hay cuentas, y entonces esta configuracion no se usa */
  ...(secret() === null ? {} : { secret: secret()! }),
  session: { strategy: 'jwt' },
  pages: { signIn: '/cuenta' },
  providers: [
    Credentials({
      name: 'Correo y contraseña',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(raw, request) {
        const password = typeof raw?.['password'] === 'string' ? raw['password'] : '';

        // **El tope de intentos, antes de comprobar la contraseña.**
        //
        // Aquí no había ninguno, y lo tenían el registro, el cambio de cuenta y
        // las tres rutas de IA. Contra probar contraseñas solo estaba el coste de
        // `scrypt`, y eso es el problema al revés: **cada intento cuesta cien
        // milisegundos de procesador nuestros y nada de quien lo prueba**, así que
        // servía igual para tumbar el servidor que para adivinar una contraseña
        // ([adr/0054](../../docs/adr/0054-entrar-tiene-tope-de-intentos.md)).
        //
        // Antes de `verifyPassword` a propósito: comprobar primero gastaría el
        // `scrypt` que esto viene a evitar.
        if (await pasadoDeIntentos(request, raw?.['email'])) {
          throw new DemasiadosIntentos();
        }

        const found = await findUserWithPassword(raw?.['email']);

        const ok = await verifyPassword(password, found?.passwordHash ?? HASH_DE_NADIE);
        if (!ok || found === null) {
          // Nulo y no una excepción con motivo: al que se equivoca se le dice
          // «el correo o la contraseña no son correctos», sin aclarar cuál de
          // los dos, que es lo que evita usar la pantalla de entrar como
          // buscador de cuentas.
          return null;
        }

        return {
          id: found.user.id,
          email: found.user.email,
          name: found.user.name,
          // Se guarda la versión que tenía la cuenta en este momento. Cuando
          // alguien cambie la contraseña, la de la fila subirá y esta cookie
          // dejará de cuadrar: eso es echar a las demás sesiones.
          sessionVersion: found.user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id !== undefined) {
        token.sub = user.id;
        /* v8 ignore next -- quien entra trae su version de sesion: la pone el proveedor al validar */
        token['sv'] = user.sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub !== undefined) {
        const sv = token['sv'];
        return {
          ...session,
          user: {
            ...session.user,
            id: token.sub,
            // Una cookie vieja de antes de que existiera este número no lo
            // lleva. Se trata como cero, que es lo que tienen las cuentas que
            // nunca han cambiado la contraseña: así nadie se queda fuera por
            // haber entrado el día anterior al despliegue.
            sessionVersion: typeof sv === 'number' ? sv : 0,
          },
        };
      }
      return session;
    },
  },
});

/**
 * Quién pide y con qué versión de sesión, o nulo si no ha entrado.
 *
 * La versión sale de la cookie y **no se comprueba aquí**: quien la compara es
 * `currentSession`, que ya va a leer la fila de la cuenta para saber el plan y el
 * cupo. Comprobarla aquí añadiría una consulta a cada petición, que es
 * exactamente lo que se evitó al no tener tabla de sesiones.
 */
export async function currentCookie(): Promise<{ id: string; sessionVersion: number } | null> {
  if (!authAvailable()) {
    return null;
  }
  try {
    const session = await auth();
    const id = session?.user?.id;
    /* v8 ignore next -- si hay identificador hay version: las dos salen del mismo token */
    return id === undefined ? null : { id, sessionVersion: session?.user?.sessionVersion ?? 0 };
  } catch {
    // Una cookie firmada con otro secreto, o un secreto cambiado: se trata como
    // no haber entrado, que es lo que de hecho pasa.
    return null;
  }
}
