/**
 * Un tiempo en minutos y segundos, para leerlo de un vistazo.
 *
 * Vive en `core/` porque lo piden **dos features que no se conocen**: la
 * grabadora y componer tocando, que enseñan la misma toma en dos sitios. Un
 * feature no importa de otro (regla 2), así que lo compartido sube aquí.
 */
export function reloj(segundos: number): string {
  const enteros = Math.max(0, Math.round(segundos));
  const minutos = Math.floor(enteros / 60);
  return `${minutos}:${String(enteros % 60).padStart(2, '0')}`;
}
