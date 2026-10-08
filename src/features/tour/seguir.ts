import { cajaIluminada, colocarTarjeta, type Caja, type Sitio } from './colocar';
import type { Paso } from './pasos';
import { buscarPieza, medirPieza, traerPiezaALaVista } from './pieza';

/**
 * Seguir a la pieza que señala un paso y decir dónde van el aro y la tarjeta.
 *
 * **Midiendo cuando algo cambia, no en cada fotograma.** Fue un
 * `requestAnimationFrame` que medía la pieza sesenta veces por segundo mientras
 * la tarjeta estaba abierta. Ahora mide al moverse algo que se ve —un
 * `ResizeObserver` sobre la pieza y la tarjeta, el desplazamiento de cualquier
 * caja y el tamaño de la ventana—, y al cambiar lo que hay en la pantalla por
 * lo que ninguno de los tres avisa: la pieza que baja porque ha crecido lo de
 * encima, y la pieza que la pantalla cambia por otra —en componer, elegir
 * tonalidad quita los botones de salida y pone la lista de acordes, y el paso es
 * el mismo— ([adr/0120](../../../docs/adr/0120-la-primera-visita-no-se-mueve-y-cada-pantalla-trae-lo-suyo.md)).
 *
 * **Eso último lo dice un `MutationObserver`**, y no un intervalo. Se miraba cada
 * cuarto de segundo, se moviera algo o no, durante todo el rato que la tarjeta
 * estaba abierta; las dos cosas que había que cazar son nodos que entran o salen,
 * y eso lo avisa el navegador.
 */

/** Cuánto se espera a que aparezca la pieza de un paso. */
const ESPERA_MS = 3000;

export interface Vista {
  readonly caja: Caja | null;
  readonly sitio: Sitio;
}

/** Lo que se pinta, redondeado: si no cambia un píxel, no se repinta. */
function firmaDe({ caja, sitio }: Vista): string {
  const numeros = caja === null ? [] : [caja.x, caja.y, caja.ancho, caja.alto];
  return [...numeros, sitio.x, sitio.y].join(',');
}

function redondear(caja: Caja): Caja {
  return {
    x: Math.round(caja.x),
    y: Math.round(caja.y),
    ancho: Math.round(caja.ancho),
    alto: Math.round(caja.alto),
  };
}

/**
 * Dónde puede ir la tarjeta: el hueco de trabajo de `AppShell`, entre la cabecera
 * y la barra de pantallas, o la ventana si no lo hay.
 */
function marcoDeLaTarjeta(ventana: Caja): Caja {
  const contenido = document.getElementById('contenido');
  if (contenido === null) {
    return ventana;
  }
  const caja = contenido.getBoundingClientRect();
  return { x: caja.left, y: caja.top, ancho: caja.width, alto: caja.height };
}

/**
 * Empieza a seguir la pieza del paso y llama a `avisar` cada vez que lo pintado
 * cambia. Devuelve con qué pararlo.
 *
 * **No avisa hasta tener sitio**: mientras espera a una pieza que llega tarde, la
 * tarjeta no se pinta en medio para saltar luego al lado de la pieza. Pasado
 * `ESPERA_MS` se enseña igual, en medio y sin señalar: uno que se queda
 * esperando a una pieza que no viene es peor que uno que la explica sin
 * señalarla. **Y si la pieza ya está, el primer aviso es inmediato**, para que
 * quien lo llame desde un efecto de maquetación coloque la tarjeta antes de que
 * el navegador la pinte.
 */
export function seguirLaPieza(
  paso: Pick<Paso, 'objetivo' | 'conLoQueFlota'>,
  tarjeta: HTMLElement,
  avisar: (vista: Vista) => void,
): () => void {
  let pieza: Element | null = null;
  let esperando = true;
  /** Si ya pasó `ESPERA_MS` sin pieza: entonces se enseña sin señalar. */
  let plazoCumplido = false;
  let firma = '';
  let fotograma = 0;

  const medir = () => {
    fotograma = 0;
    const raiz = document.documentElement;
    const ventana = { x: 0, y: 0, ancho: raiz.clientWidth, alto: raiz.clientHeight };
    const medida = pieza === null ? null : medirPieza(pieza, paso.conLoQueFlota);
    const caja = medida === null ? null : redondear(cajaIluminada(medida, ventana));
    const tamano = { ancho: tarjeta.offsetWidth, alto: tarjeta.offsetHeight };
    const sitio = colocarTarjeta(caja, tamano, marcoDeLaTarjeta(ventana));
    const vista = { caja, sitio: { ...sitio, x: Math.round(sitio.x), y: Math.round(sitio.y) } };
    const nueva = firmaDe(vista);
    if (nueva !== firma) {
      firma = nueva;
      avisar(vista);
    }
  };

  const programar = () => {
    if (fotograma === 0) {
      fotograma = requestAnimationFrame(medir);
    }
  };

  const observador = new ResizeObserver(programar);
  const senalar = (nueva: Element | null) => {
    pieza = nueva;
    observador.disconnect();
    observador.observe(tarjeta);
    if (nueva !== null) {
      observador.observe(nueva);
    }
  };

  const revisar = () => {
    if (pieza?.isConnected === true) {
      programar();
      return;
    }
    // Se fue, o no había ninguna: se busca la que la sustituye.
    const encontrada = buscarPieza(paso.objetivo);
    if (esperando) {
      if (encontrada === null && !plazoCumplido) {
        return;
      }
      esperando = false;
      if (encontrada !== null) {
        traerPiezaALaVista(encontrada);
      }
    } else if (encontrada === pieza) {
      // Sigue sin haber ninguna: no hay nada nuevo que medir.
      return;
    }
    senalar(encontrada);
    medir();
  };

  revisar();
  const plazo = window.setTimeout(() => {
    plazoCumplido = true;
    revisar();
  }, ESPERA_MS);
  // Lo que entra y sale del hueco de trabajo, que es donde viven las piezas que
  // cambian; sin él, el documento entero.
  const cambios = new MutationObserver(revisar);
  cambios.observe(document.getElementById('contenido') ?? document.body, {
    childList: true,
    subtree: true,
  });
  // En captura: se desplaza la caja de dentro —la columna, el camino—, no la
  // ventana, y el evento de desplazamiento no sube.
  const enDesplazamiento = { capture: true, passive: true } as const;
  window.addEventListener('scroll', programar, enDesplazamiento);
  window.addEventListener('resize', programar);

  return () => {
    window.clearTimeout(plazo);
    cambios.disconnect();
    cancelAnimationFrame(fotograma);
    observador.disconnect();
    window.removeEventListener('scroll', programar, enDesplazamiento);
    window.removeEventListener('resize', programar);
  };
}
