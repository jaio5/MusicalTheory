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
  /**
   * **En desarrollo cuenta como que manda**, y en producción no.
   *
   * El comentario de arriba prometía poder probar el flujo entero sin dar de
   * alta un proveedor, y era mentira: la ruta comprueba esto antes de crear el
   * vale, así que con `false` no llegaba a llamarse nunca y el correo del
   * registro no se escribía jamás. Se vio al ejecutarlo por primera vez.
   *
   * En desarrollo, escribir el correo en el registro **es** mandarlo: quien
   * desarrolla lo lee ahí. En producción no, y entonces la pantalla dice que
   * aquí no se puede recuperar la contraseña en vez de prometer un correo que no
   * va a llegar.
   */
  sends: process.env.NODE_ENV !== 'production',

  async send(mail: Mail): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[correo que no se manda] para ${mail.to}: ${mail.subject}\n${mail.text}`);
    }
    return false;
  },
};
