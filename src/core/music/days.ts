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

/**
 * `AAAA-MM-DD`, **y un día que exista**. Cualquier otra cosa se descarta.
 *
 * Mirar solo la forma dejaba pasar `9999-99-99`, y eso no era un descuido
 * inofensivo: la fusión del avance se queda con el último día mayor, así que una
 * fecha imposible subida una vez ganaba a todas las de verdad para siempre
 * ([adr/0116](../../../docs/adr/0116-el-avance-que-sube-se-comprueba.md)). Se
 * comprueba dando la vuelta por `Date`: si el 31 de febrero se convierte en el 3
 * de marzo, no era un día.
 */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const instante = Date.parse(`${value}T12:00:00Z`);
  return !Number.isNaN(instante) && new Date(instante).toISOString().slice(0, 10) === value;
}

/**
 * El día siguiente a uno dado, en `AAAA-MM-DD`.
 *
 * Es el tope de lo que puede decir un navegador: en UTC+14 ya es mañana cuando el
 * servidor todavía va por hoy, así que «mañana» es lo más lejos que llega una
 * fecha de verdad. Más allá, la fecha es inventada.
 */
export function diaSiguiente(day: string): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + UN_DIA_MS).toISOString().slice(0, 10);
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
