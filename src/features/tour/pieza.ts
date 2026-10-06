import { union, type Caja } from './colocar';

/**
 * Encontrar en la pantalla la pieza que señala un paso, medirla y traerla a la
 * vista. Lo único del recorrido que mira el DOM, y por eso va aparte.
 */

function cajaDe(elemento: Element): Caja {
  const caja = elemento.getBoundingClientRect();
  return { x: caja.left, y: caja.top, ancho: caja.width, alto: caja.height };
}

/**
 * Si se ve: que el navegador no la tenga escondida y que mida algo.
 *
 * `checkVisibility` es lo que distingue lo que está dentro de un `<details>`
 * cerrado o de un `hidden`, que siguen dando medidas; donde no existe basta con
 * la caja, que un `display: none` deja a cero.
 */
function seVe(elemento: Element): boolean {
  if (typeof elemento.checkVisibility === 'function' && !elemento.checkVisibility()) {
    return false;
  }
  const caja = elemento.getBoundingClientRect();
  return caja.width > 0 && caja.height > 0;
}

/**
 * La primera pieza **que se vea**, probando los selectores por orden.
 *
 * Componer pinta en el mismo árbol lo del banco y lo del teléfono y esconde lo
 * que no toca con clases ([adr/0083](../../../docs/adr/0083-componer-pinta-lo-de-escritorio-y-las-clases-lo-esconden.md)),
 * así que de muchas piezas hay dos en el documento y solo una a la vista.
 */
export function buscarPieza(selector: string): Element | null {
  for (const uno of partirSelector(selector)) {
    const visible = [...document.querySelectorAll(uno)].find(seVe);
    if (visible !== undefined) {
      return visible;
    }
  }
  return null;
}

/**
 * Los selectores de una lista, **por orden de preferencia** y no de documento.
 *
 * Con `querySelectorAll` de la lista entera manda el orden del documento, y un
 * contenedor va antes que lo que lleva dentro: el área entera del ensayo ganaba
 * a su contenido, que es lo que se quería señalar. Se parte por las comas de
 * fuera, sin romper las que van dentro de comillas —`aria-label="Pantallas,
 * abajo"`—.
 */
export function partirSelector(lista: string): readonly string[] {
  const partes: string[] = [];
  let actual = '';
  let comilla: string | null = null;
  for (const letra of lista) {
    if (comilla !== null) {
      comilla = letra === comilla ? null : comilla;
    } else if (letra === '"' || letra === "'") {
      comilla = letra;
    } else if (letra === ',') {
      partes.push(actual.trim());
      actual = '';
      continue;
    }
    actual += letra;
  }
  partes.push(actual.trim());
  return partes.filter((parte) => parte !== '');
}

/**
 * Lo que ocupa la pieza en la pantalla, y con `conLoQueFlota` también lo que
 * cuelga de ella fuera de su caja: la barra de tonalidad mide una línea y la
 * rueda que abre flota debajo, y señalar solo la línea dejaba la rueda a oscuras.
 */
export function medirPieza(elemento: Element, conLoQueFlota = false): Caja | null {
  if (!conLoQueFlota) {
    return union([cajaDe(elemento)]);
  }
  return union([elemento, ...elemento.querySelectorAll('*')].filter(seVe).map(cajaDe));
}

/** Si una caja se desplaza de verdad en ese eje, y no solo recorta. */
function desplaza(estilo: CSSStyleDeclaration, eje: 'x' | 'y', nodo: Element): boolean {
  const overflow = eje === 'y' ? estilo.overflowY : estilo.overflowX;
  if (overflow !== 'auto' && overflow !== 'scroll') {
    return false;
  }
  return eje === 'y' ? nodo.scrollHeight > nodo.clientHeight : nodo.scrollWidth > nodo.clientWidth;
}

/** Cuánto hay que mover para que `dentro` quepa en `marco`, empezando por su principio. */
function cuanto(inicio: number, fin: number, marcoInicio: number, marcoFin: number): number {
  const aire = 8;
  if (inicio < marcoInicio) {
    return inicio - marcoInicio - aire;
  }
  if (fin > marcoFin) {
    // Sin pasarse del principio: una pieza más grande que el hueco se enseña
    // desde arriba, que es donde empieza a leerse.
    return Math.min(fin - marcoFin + aire, inicio - marcoInicio - aire);
  }
  return 0;
}

/**
 * Traer la pieza a la vista **moviendo solo lo que se desplaza**.
 *
 * No con `scrollIntoView`, que mueve también las cajas que recortan con
 * `overflow: hidden`: el `<main>` de la aplicación es una, y moverla sube el
 * marco entero sin que nadie lo baje (`AppShell` lo cuenta). Aquí se recorren
 * los antepasados y solo se tocan los que tienen barra de verdad, en los dos
 * ejes: la fila de mandos de componer se desplaza de lado en un teléfono, y el
 * metrónomo o «Más» pueden estar fuera por la derecha.
 */
export function traerPiezaALaVista(elemento: Element): void {
  for (let nodo = elemento.parentElement; nodo !== null; nodo = nodo.parentElement) {
    const estilo = getComputedStyle(nodo);
    const enY = desplaza(estilo, 'y', nodo);
    const enX = desplaza(estilo, 'x', nodo);
    if (!enY && !enX) {
      continue;
    }
    const pieza = elemento.getBoundingClientRect();
    const marco = nodo.getBoundingClientRect();
    if (enY) {
      nodo.scrollTop += cuanto(pieza.top, pieza.bottom, marco.top, marco.bottom);
    }
    if (enX) {
      nodo.scrollLeft += cuanto(pieza.left, pieza.right, marco.left, marco.right);
    }
  }
}
