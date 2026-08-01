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

import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { verifyPassword } from './password';
import { findUserWithPassword } from './users';
import { hasDatabase } from './db/client';

declare module 'next-auth' {
  interface Session {
    readonly user: { readonly id: string } & DefaultSession['user'];
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Detrás de un proxy con certificado —que es como se sirve esto— la cabecera
  // del anfitrión la pone el proxy, y Auth.js necesita que se le diga que puede
  // creérsela.
  trustHost: true,
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
      async authorize(raw) {
        const password = typeof raw?.['password'] === 'string' ? raw['password'] : '';
        const found = await findUserWithPassword(raw?.['email']);

        const ok = await verifyPassword(password, found?.passwordHash ?? HASH_DE_NADIE);
        if (!ok || found === null) {
          // Nulo y no una excepción con motivo: al que se equivoca se le dice
          // «el correo o la contraseña no son correctos», sin aclarar cuál de
          // los dos, que es lo que evita usar la pantalla de entrar como
          // buscador de cuentas.
          return null;
        }

        return { id: found.user.id, email: found.user.email, name: found.user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id !== undefined) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub !== undefined) {
        return { ...session, user: { ...session.user, id: token.sub } };
      }
      return session;
    },
  },
});

/** El identificador de quien pide, o nulo si no ha entrado. */
export async function currentUserId(): Promise<string | null> {
  if (!authAvailable()) {
    return null;
  }
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch {
    // Una cookie firmada con otro secreto, o un secreto cambiado: se trata como
    // no haber entrado, que es lo que de hecho pasa.
    return null;
  }
}
