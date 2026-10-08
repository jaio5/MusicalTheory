/**
 * Un número para leerlo en español: con coma decimal y sin «-0».
 *
 * Vive en `core/` porque lo piden **dos features que no se conocen**: el
 * afinador y el micro de la barra, que enseñan los mismos cents en dos sitios.
 * `toFixed` escribía «329.6 Hz» con punto, y redondeando hacia cero dejaba un
 * «-0.0 cents» con la cuerda clavada: un signo que no dice nada y que se lee
 * como «un pelín baja».
 */

const FORMATOS = new Map<number, Intl.NumberFormat>();

function formato(decimales: number): Intl.NumberFormat {
  let hecho = FORMATOS.get(decimales);
  if (hecho === undefined) {
    hecho = new Intl.NumberFormat('es', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
      // Sin separador de miles: «1.200 Hz» se confundiría con un decimal.
      useGrouping: false,
    });
    FORMATOS.set(decimales, hecho);
  }
  return hecho;
}

/**
 * Redondeado a esos decimales, y el cero siempre sin signo.
 *
 * Se redondea antes de mirar el signo: −0,04 con un decimal es «0,0», y si se
 * mirase el signo del valor sin redondear saldría «−0,0».
 */
function redondeado(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  const exacto = Math.round(valor * factor) / factor;
  return exacto === 0 ? 0 : exacto;
}

/** «329,6», «82», «0,0». */
export function cifra(valor: number, decimales = 0): string {
  return formato(decimales).format(redondeado(valor, decimales));
}

/**
 * Con su signo cuando lo tiene: «+3,2», «−1», «0».
 *
 * El menos es el signo de restar (U+2212) y no el guion: mide lo mismo que el
 * más, así que la cifra no baila al cruzar el cero.
 */
export function cifraConSigno(valor: number, decimales = 0): string {
  const exacto = redondeado(valor, decimales);
  const texto = formato(decimales).format(Math.abs(exacto));
  return exacto > 0 ? `+${texto}` : exacto < 0 ? `−${texto}` : texto;
}

const CORTA = new Intl.NumberFormat('es', { maximumFractionDigits: 2, useGrouping: false });

/**
 * Sin decimales de relleno: «4», «0,5», «2,75».
 *
 * Para lo que casi siempre es entero y a veces no —una duración en pulsos—,
 * donde «4,00» diría una precisión que nadie ha pedido.
 */
export function cifraCorta(valor: number): string {
  return CORTA.format(redondeado(valor, 2));
}

/**
 * «1 pulso», «2 pulsos», «0,5 pulsos».
 *
 * Estaba escrito a mano en cada etiqueta, y en tres de ellas sin singular: el
 * lector de pantalla decía «1 pulsos» en cada negra de la partitura.
 */
export function enPulsos(pulsos: number): string {
  return `${cifraCorta(pulsos)} ${pulsos === 1 ? 'pulso' : 'pulsos'}`;
}

/**
 * «una vez», «2 veces».
 *
 * Las salidas lo decían igual en tres jueces, cada uno con su copia de la
 * condición: el día que una cambiase, la misma cuenta se diría de dos maneras.
 */
export function veces(cuantas: number): string {
  return cuantas === 1 ? 'una vez' : `${cifraCorta(cuantas)} veces`;
}

const LISTA = new Intl.ListFormat('es', { type: 'conjunction' });

/**
 * «el 3, el 19 y el 23»: las palabras unidas como se dicen, con la «y» delante
 * de la última.
 *
 * Con `Intl.ListFormat` y no a mano: hacerlo con `join` pedía tratar aparte la
 * lista de uno, y cada sitio que lo copiaba lo trataba a su manera.
 */
export function enLista(palabras: readonly string[]): string {
  return LISTA.format(palabras);
}
