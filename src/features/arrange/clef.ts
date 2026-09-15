/**
 * La clave de sol, dibujada a partir de su trazo.
 *
 * **Por qué se dibuja.** Se probó con el carácter de siempre —`U+1D11E`— y salía
 * un cuadro vacío: los símbolos musicales de Unicode no están en las fuentes de
 * sistema, y una partitura que empieza con un cuadro no es una partitura.
 *
 * **Por qué se genera en vez de escribirse a mano.** La primera versión era una
 * silueta escrita curva a curva, y de ahí salió una espiral con un palo: le
 * faltaba el cuerpo. Una clave de sol es **un trazo que se cruza dos veces
 * consigo mismo** —el gancho de arriba baja y cruza el mástil, la panza de la
 * derecha vuelve por abajo y lo cruza otra vez— y esos dos cruces son lo que la
 * hace reconocible. Escribiendo el contorno a mano hay que llevar la cuenta de
 * los dos lados de cada cruce, y por eso se torció.
 *
 * Aquí se declara **la línea que recorre la pluma y cuánto pesa en cada punto**,
 * que es como se piensa una letra, y el contorno sale de desplazar esa línea a
 * los dos lados. Cambiar la forma es mover un punto de `TRAZO`, no rehacer
 * veinte curvas de Bézier.
 *
 * El sistema de coordenadas tiene el **centro de la espiral en el origen**, que
 * es lo único que la clave tiene que cumplir: ahí va la línea del Sol. Así,
 * colocarla es trasladar el origen a esa línea, sin restas mágicas.
 *
 * Lo demás son las proporciones de una clave de imprenta, contadas desde ese
 * origen y en espacios de pentagrama: la punta de arriba a cuatro espacios —un
 * espacio por encima de la quinta línea— y la bolita de abajo a poco más de dos
 * —un espacio por debajo de la primera—.
 *
 * **A lo ancho no está centrada, y ese era el error que la hacía irreconocible.**
 * Una clave de sol de imprenta llega a un espacio escaso por la izquierda del
 * centro de la espiral y a un espacio y medio largo por la derecha: la masa está
 * a la derecha, porque ahí va la panza. Esta la tenía al revés —una y media a la
 * izquierda, una y poco a la derecha—, y con las dos mitades cambiadas de sitio
 * la silueta que quedaba era la de una clave de fa: un cuenco a la izquierda con
 * un punto al lado. Ninguna cantidad de retoques en el gancho lo arreglaba,
 * porque el problema no estaba en el gancho.
 *
 * Estuvo además desplazada hacia abajo: le faltaba arriba y le sobraba de cola, y
 * se veía como una clave a la que alguien había tirado del pie.
 */

/** Lo que mide un espacio del pentagrama en las coordenadas de la clave. */
export const ESPACIO_CLAVE = 20;

/**
 * La bolita del final de la cola, que es un punto y no un trazo.
 *
 * Se dibuja aparte porque no es parte del recorrido de la pluma: es donde se
 * apoya y se levanta. Meterla en la línea central obligaría a que el grosor
 * subiera hasta su diámetro y bajara otra vez, y eso deforma la cola entera.
 */
export const BOLITA = { x: -7, y: 49, r: 4.4 } as const;

/**
 * La línea central del trazo: por dónde pasa la pluma y cuánto pesa.
 *
 * De la cola al centro de la espiral, que es el orden en que se escribe. El
 * tercer número es el grosor en ese punto: fino en la punta de arriba y en el
 * final de la espiral, gordo en la panza de la derecha, que es donde la pluma
 * va más plana.
 */
export const TRAZO: ReadonlyArray<readonly [number, number, number]> = [
  [-6, 47, 2.8], // sale de la bolita de abajo
  [1, 44, 4.0],
  [6, 37, 5.2],
  [9, 25, 5.9], // ya es el mástil
  [10, 4, 6.2],
  [10, -18, 6.2],
  [9, -42, 5.4],
  [6, -60, 4.2],
  [0, -80, 2.6], // la punta de arriba, un espacio por encima de la quinta línea
  [-9, -76, 3.2], // el gancho, que cae por la izquierda
  [-17, -66, 4.2],
  [-20, -52, 5.2],
  [-16, -38, 6.2],
  [-5, -28, 7.2],
  [9, -18, 8.4], // baja cruzando el mástil: primer cruce
  [23, -2, 9.6],
  [30, 14, 10.4], // la panza de la derecha, lo más grueso
  [25, 30, 9.4],
  [11, 38, 8.2],
  [-4, 36, 7.0], // vuelve cruzando el mástil por abajo: segundo cruce
  [-17, 26, 5.8],
  [-22, 11, 4.8],
  [-18, -4, 3.8], // y empieza a enroscarse
  [-9, -14, 3.4],
  [2, -10, 2.8],
  // La espiral se queda a la izquierda del mástil: si lo pasa, el trazo lo cruza
  // dos veces más y deja de haber los dos cruces que hacen la clave.
  [5, 1, 2.2],
  [-2, 9, 1.8],
  [-9, 4, 1.4], // muere en el centro, sobre la línea del Sol
];

/** Cuántos puntos se interpolan entre cada par del trazo. */
const FINURA = 12;

type Punto = readonly [number, number, number];

/**
 * Suaviza el trazo con Catmull-Rom, que es la curva que **pasa por los puntos
 * que le das** en vez de acercarse a ellos. Es lo que hace que mover un punto de
 * `TRAZO` mueva la clave por donde uno espera.
 *
 * Se interpola también el grosor, no solo la posición: si se interpolara solo la
 * posición, el trazo cambiaría de peso a saltos en cada punto declarado.
 */
function suavizar(puntos: ReadonlyArray<Punto>, finura = FINURA): Punto[] {
  // El primero y el último se repiten para que la curva llegue a los extremos:
  // Catmull-Rom necesita un punto antes y otro después de cada tramo.
  const con: Punto[] = [puntos[0]!, ...puntos, puntos[puntos.length - 1]!];
  const salida: Punto[] = [];

  for (let i = 0; i + 3 < con.length; i += 1) {
    const [p0, p1, p2, p3] = [con[i]!, con[i + 1]!, con[i + 2]!, con[i + 3]!];
    for (let k = 0; k < finura; k += 1) {
      const t = k / finura;
      const t2 = t * t;
      const t3 = t2 * t;
      const eje = (d: 0 | 1 | 2) =>
        0.5 *
        (2 * p1[d] +
          (-p0[d] + p2[d]) * t +
          (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
          (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
      salida.push([eje(0), eje(1), eje(2)]);
    }
  }
  salida.push(puntos[puntos.length - 1]!);
  return salida;
}

/**
 * El contorno: la línea desplazada media anchura a cada lado por su normal.
 *
 * La normal se saca de la dirección entre el punto anterior y el siguiente, que
 * es la aproximación de siempre y sobra para esto: la curva ya viene muestreada
 * fina, así que dos puntos seguidos están casi en la misma dirección.
 */
export function contornoDeTrazo(puntos: ReadonlyArray<Punto> = TRAZO): string {
  const linea = suavizar(puntos);
  const izquierda: Array<[number, number]> = [];
  const derecha: Array<[number, number]> = [];

  for (let i = 0; i < linea.length; i += 1) {
    const [x, y, grosor] = linea[i]!;
    const antes = linea[Math.max(0, i - 1)]!;
    const despues = linea[Math.min(linea.length - 1, i + 1)]!;
    const dx = despues[0] - antes[0];
    const dy = despues[1] - antes[1];
    const largo = Math.hypot(dx, dy) || 1;
    const nx = -dy / largo;
    const ny = dx / largo;
    izquierda.push([x + (nx * grosor) / 2, y + (ny * grosor) / 2]);
    derecha.push([x - (nx * grosor) / 2, y - (ny * grosor) / 2]);
  }

  const escribir = (p: ReadonlyArray<[number, number]>) =>
    p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');

  // De ida por un lado y de vuelta por el otro, y se cierra: un solo contorno,
  // sin agujeros que dependan de la regla de relleno.
  return `M ${escribir(izquierda)} L ${escribir([...derecha].reverse())} Z`;
}

/**
 * El contorno ya calculado. Es siempre el mismo, así que se hace una vez al
 * cargar el módulo y no en cada pintada del pentagrama.
 */
export const CLAVE_DE_SOL = contornoDeTrazo();
