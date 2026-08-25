/**
 * Un día, como lo entiende este proyecto: `AAAA-MM-DD` y nada más.
 *
 * La racha, la meta diaria y la cola de repaso cuentan días, y ninguno de los
 * tres lee el reloj: el día entra por parámetro desde arriba, que es lo que
 * permite probar una racha de cuarenta días sin esperar cuarenta días.
 *
 * Está aquí porque `daysBetween` estaba escrita **letra por letra en dos
 * ficheros** —`progress.ts` y `review.ts`—, y una diferencia de un día entre las
 * dos copias saldría como una racha que no cuadra con lo que dice el repaso, que
 * es de los fallos que más tardan en verse.
 */

/** Milisegundos de un día. Ni bisiestos ni horarios de verano: ver abajo. */
const UN_DIA_MS = 86_400_000;

/** `AAAA-MM-DD` y nada más. Cualquier otra cosa se descarta. */
export function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Días entre dos fechas, o `NaN` si alguna no lo es.
 *
 * **Se interpretan al mediodía en UTC**, y esa es toda la gracia de la función.
 * A medianoche, un cambio de hora de verano mueve la fecha un día entero en
 * media Europa: alguien que estudió el sábado vería su racha rota el domingo. Al
 * mediodía sobran doce horas de margen por cada lado y ninguna zona horaria del
 * mundo llega a tanto.
 *
 * `Math.round` por lo mismo: si algo colara una diferencia de 23 o 25 horas,
 * sigue siendo un día.
 */
export function daysBetween(from: string, to: string): number {
  const parse = (day: string): number => Date.parse(`${day}T12:00:00Z`);
  const start = parse(from);
  const end = parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Number.NaN;
  }
  return Math.round((end - start) / UN_DIA_MS);
}
