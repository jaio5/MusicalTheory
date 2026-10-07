/**
 * Qué proveedor de correo hay puesto.
 *
 * Un solo sitio donde se elige, igual que el cobrador: mira si están sus dos
 * variables y si no, devuelve el que no manda. Se comprueba en cada llamada y no
 * al arrancar, por lo mismo que la base de datos: en desarrollo se añade una
 * variable y se recarga en caliente.
 */

import { NoMailer } from './none';
import { HttpMailer, mailConfigured } from './resend';
import type { Mailer } from './port';

export type { Mail, Mailer } from './port';
export { mailConfigured } from './resend';

export function mailer(): Mailer {
  return mailConfigured() ? HttpMailer : NoMailer;
}
