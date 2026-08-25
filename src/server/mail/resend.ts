/**
 * Un proveedor de correo por HTTP.
 *
 * Sin SDK, como Stripe: mandar un correo es un `POST` con cuatro campos, y meter
 * una librería entera por eso sería una dependencia más que actualizar y
 * auditar. Es la misma razón que hay detrás de `scrypt` en vez de bcrypt.
 *
 * Está escrito contra la API de Resend porque hay que elegir una y esa es la que
 * menos ceremonia pide. **Cambiar de proveedor es este fichero**: la dirección,
 * los nombres de los cuatro campos y la cabecera de autenticación. Nada más lo
 * conoce.
 */

import type { Mail, Mailer } from './port';

const API = 'https://api.resend.com/emails';

function apiKey(): string {
  return process.env['MAIL_API_KEY'] ?? '';
}

/** De quién viene. Sin esto no se puede mandar nada: el proveedor lo exige. */
function from(): string {
  return process.env['MAIL_FROM'] ?? '';
}

/** Si están las dos variables que hacen falta para mandar correo de verdad. */
export function mailConfigured(): boolean {
  return apiKey() !== '' && from() !== '';
}

export const HttpMailer: Mailer = {
  name: 'correo por HTTP',
  sends: true,

  async send(mail: Mail): Promise<boolean> {
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from(),
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};
