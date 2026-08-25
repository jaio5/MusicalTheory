/**
 * El que no manda correo.
 *
 * Es el que hay sin configurar nada, y por eso un clon recién bajado funciona
 * entero: sin proveedor de correo no hay «he olvidado mi contraseña», y la
 * pantalla lo dice en vez de prometer un correo que no va a llegar.
 *
 * Escribe en el registro del servidor lo que habría mandado. **Solo en
 * desarrollo**: en producción eso sería dejar un vale de recuperación escrito en
 * los registros, que es exactamente lo que la tabla evita guardando solo la
 * huella. En desarrollo es lo que permite probar el flujo entero sin dar de alta
 * un proveedor.
 */

import type { Mail, Mailer } from './port';

export const NoMailer: Mailer = {
  name: 'sin correo',
  sends: false,

  async send(mail: Mail): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[correo que no se manda] para ${mail.to}: ${mail.subject}\n${mail.text}`);
    }
    return false;
  },
};
