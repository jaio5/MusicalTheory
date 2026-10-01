/**
 * El día de hoy en `AAAA-MM-DD`, en hora local.
 *
 * Vive aquí y no en el dominio porque leer el reloj es efecto, no teoría. En
 * local y no en UTC: la racha la cuenta quien toca, y para quien toca a las once
 * de la noche en Madrid el día es el suyo, no el de Greenwich.
 *
 * **Módulo propio, y no en `learn-progress.ts`**, porque aquel lee el avance
 * guardado y para eso importa el validador, que trae el temario entero. Componer
 * solo necesita la fecha, y pidiéndola allí se descargaba las unidades de un
 * curso que no enseña (adr/0058).
 */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
