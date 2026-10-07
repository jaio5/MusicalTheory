/**
 * Dónde vive esta copia de la aplicación, vista desde fuera.
 *
 * La necesitan dos cosas que no se conocen entre sí: a dónde devuelve la pasarela
 * a quien acaba de pagar, y qué enlace lleva el correo de contraseña olvidada.
 * Estaba leída dos veces, y una variable de entorno leída en dos sitios acaba
 * normalizándose de dos formas distintas: uno le quita la barra final y el otro
 * no, y salen enlaces con doble barra.
 *
 * **Sin `APP_URL` se supone el equipo de quien desarrolla.** En producción eso
 * manda a la gente a su propio ordenador, así que está dicho en
 * `docs/DESPLIEGUE.md` al lado de la variable. Fallar al arrancar sería peor:
 * dejaría sin aplicación a quien solo quiere el afinador, que no necesita nada
 * de esto.
 */

const EN_TU_EQUIPO = 'http://localhost:3000';

export function appUrl(): string {
  const url = process.env['APP_URL'];
  // Sin la barra final: todo lo que se le pega detrás la lleva delante, y dos
  // barras seguidas en un enlace de correo lo rompen en algunos clientes.
  return typeof url === 'string' && url !== '' ? url.replace(/\/$/, '') : EN_TU_EQUIPO;
}
