/**
 * Dónde va la tarjeta del recorrido para **no tapar lo que explica**.
 *
 * Es la queja de siempre con estos recorridos: la tarjeta cae encima de la pieza
 * que señala y hay que leer la explicación de algo que no se ve. Aquí se prueba
 * por orden debajo, encima, a la derecha y a la izquierda, y se queda el primer
 * sitio donde cabe entera sin pisarla. En un teléfono casi nunca hay sitio al
 * lado, así que en la práctica es arriba o abajo **según dónde quede más hueco**.
 *
 * Cuando la pieza es más grande que lo que deja la pantalla —la rueda abierta en
 * un teléfono ocupa casi todo— no hay sitio limpio, y entonces se pega al borde
 * de arriba o al de abajo, el que menos tape. Es cálculo puro, sin `window`, y
 * por eso se prueba con números.
 */

export interface Caja {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface Medida {
  readonly ancho: number;
  readonly alto: number;
}

export type Lado = 'centro' | 'debajo' | 'encima' | 'derecha' | 'izquierda' | 'abajo' | 'arriba';

export interface Sitio {
  readonly x: number;
  readonly y: number;
  readonly lado: Lado;
}

/** Lo que se deja libre contra el borde de la pantalla: el margen de la casa. */
export const MARGEN = 16;
/** Entre la pieza y la tarjeta, para que se vea que una habla de la otra. */
export const HUECO = 12;

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(valor, maximo));
}

function solape(a: Caja, b: Caja): number {
  const ancho = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
  const alto = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y);
  return ancho > 0 && alto > 0 ? ancho * alto : 0;
}

export function colocarTarjeta(objetivo: Caja | null, tarjeta: Medida, ventana: Medida): Sitio {
  const xMax = Math.max(MARGEN, ventana.ancho - MARGEN - tarjeta.ancho);
  const yMax = Math.max(MARGEN, ventana.alto - MARGEN - tarjeta.alto);

  if (objetivo === null) {
    return {
      x: acotar((ventana.ancho - tarjeta.ancho) / 2, MARGEN, xMax),
      y: acotar((ventana.alto - tarjeta.alto) / 2, MARGEN, yMax),
      lado: 'centro',
    };
  }

  const centroX = objetivo.x + objetivo.ancho / 2;
  const centroY = objetivo.y + objetivo.alto / 2;
  const enColumna = acotar(centroX - tarjeta.ancho / 2, MARGEN, xMax);
  const enFila = acotar(centroY - tarjeta.alto / 2, MARGEN, yMax);

  const candidatos: ReadonlyArray<Sitio> = [
    { x: enColumna, y: objetivo.y + objetivo.alto + HUECO, lado: 'debajo' },
    { x: enColumna, y: objetivo.y - HUECO - tarjeta.alto, lado: 'encima' },
    { x: objetivo.x + objetivo.ancho + HUECO, y: enFila, lado: 'derecha' },
    { x: objetivo.x - HUECO - tarjeta.ancho, y: enFila, lado: 'izquierda' },
  ];

  const cabe = (sitio: Sitio) =>
    sitio.x >= MARGEN &&
    sitio.y >= MARGEN &&
    sitio.x + tarjeta.ancho <= ventana.ancho - MARGEN &&
    sitio.y + tarjeta.alto <= ventana.alto - MARGEN;

  const limpio = candidatos.find(cabe);
  if (limpio !== undefined) {
    return limpio;
  }

  // Sin sitio limpio: contra un borde, el que menos tape. A igualdad, abajo, que
  // es donde llega el pulgar.
  const abajo: Sitio = { x: enColumna, y: yMax, lado: 'abajo' };
  const arriba: Sitio = { x: enColumna, y: MARGEN, lado: 'arriba' };
  const tapa = (sitio: Sitio) => solape({ ...sitio, ...tarjeta }, objetivo);
  return tapa(arriba) < tapa(abajo) ? arriba : abajo;
}

/**
 * La caja que se ilumina: la de la pieza con un poco de aire, y **recortada a la
 * pantalla**. Una pieza más alta que la ventana daría un aro que se sale por los
 * bordes y no se ve dónde acaba.
 */
export function cajaIluminada(objetivo: Caja, ventana: Medida, aire = 6): Caja {
  const x = Math.max(0, objetivo.x - aire);
  const y = Math.max(0, objetivo.y - aire);
  const derecha = Math.min(ventana.ancho, objetivo.x + objetivo.ancho + aire);
  const abajo = Math.min(ventana.alto, objetivo.y + objetivo.alto + aire);
  return { x, y, ancho: Math.max(0, derecha - x), alto: Math.max(0, abajo - y) };
}

/** La caja que abarca varias: la pieza y lo que flota fuera de ella. */
export function union(cajas: readonly Caja[]): Caja | null {
  const llenas = cajas.filter((caja) => caja.ancho > 0 && caja.alto > 0);
  if (llenas.length === 0) {
    return null;
  }
  const x = Math.min(...llenas.map((caja) => caja.x));
  const y = Math.min(...llenas.map((caja) => caja.y));
  const derecha = Math.max(...llenas.map((caja) => caja.x + caja.ancho));
  const abajo = Math.max(...llenas.map((caja) => caja.y + caja.alto));
  return { x, y, ancho: derecha - x, alto: abajo - y };
}
