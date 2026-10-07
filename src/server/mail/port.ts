/**
 * Por dónde se manda el correo. La interfaz, no el proveedor.
 *
 * Mismo patrón que `billing/port.ts`, y por la misma razón: se puede tener el
 * flujo entero de recuperar la contraseña escrito, probado y funcionando **antes**
 * de elegir proveedor, y enchufar uno después sin tocar ni las rutas ni las
 * pantallas.
 *
 * Lo que hay detrás por defecto es `NoMailer`, que no manda nada y lo declara.
 * `sends` es lo que hace que la pantalla diga la verdad: sin envío, «te hemos
 * mandado un correo» es mentira, y una pantalla que promete un correo que no
 * llega deja a alguien esperando delante de un buzón vacío.
 */

export interface Mail {
  readonly to: string;
  readonly subject: string;
  /** Texto llano. Sin HTML: un correo de un enlace no necesita maquetarse. */
  readonly text: string;
}

export interface Mailer {
  /** Cómo se llama, para poder decirlo en un registro o en una pantalla. */
  readonly name: string;
  /** Si esto manda correo de verdad. */
  readonly sends: boolean;
  /** Manda el correo. Devuelve si salió. */
  send(mail: Mail): Promise<boolean>;
}
