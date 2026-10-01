'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';

import { IconoSonar } from '@ui/icons';
import { prefersReducedMotion } from '@ui/motion';

import { HOJA, LIENZO, TIRAS, type CapaDeLaEscena } from './escena-pixeles';
import './escena-portada.css';

/**
 * La escena del encabezado: un local de ensayo de noche, en píxel de consola de
 * dieciséis bits, con el profesor encima del ampli.
 *
 * **Sustituye a un vídeo** ([adr/0069](../../docs/adr/0069-la-portada-es-una-escena-de-pixel.md)).
 * El fotograma tenía un parecido serio con un personaje de anime con dueño y la
 * marca de agua del generador en una esquina, y pesaba 471 kB más 57 de póster.
 * Las cuatro imágenes de la escena pesan ocho entre todas.
 *
 * **Es PNG, y no SVG de rectángulos como la mascota.** La mascota pinta con
 * variables porque cambia con el tema; la escena va siempre en su marco oscuro,
 * así que eso no le sirve de nada, y son veintisiete mil píxeles con textura que
 * como rectángulos serían decenas de miles de números en el HTML. El píxel sale
 * duro con `image-rendering: pixelated` y **a un múltiplo entero**: el tamaño de
 * cada píxel, `--px`, lo calcula la hoja en el encabezado —el mayor entero que
 * cabe en el ancho de la página y en el alto de la pantalla—, y todo —capas,
 * tiras, desplazamientos— se mide en esos píxeles. Un múltiplo con decimales
 * saldría con filas de tres y filas de cuatro.
 *
 * **Tres capas a distinta hondura**: la pared, el suelo con lo que hay encima y
 * lo que queda entre la cámara y el ampli. Al bajar la página, la pared se queda
 * atrás y el platillo de delante se adelanta, con `animation-timeline` y sin una
 * línea de aquí. Con un ratón, además, siguen al puntero: eso sí es de aquí, con
 * un solo `requestAnimationFrame` pendiente como mucho y el desplazamiento
 * redondeado a píxeles del dibujo, para que nunca caiga entre dos. Con el dedo no:
 * en una pantalla táctil no hay puntero que seguir, solo toques sueltos.
 *
 * **Lo que late va por fotogramas**: los pilotos, el vúmetro, el neón, el
 * profesor que parpadea y a ratos se enciende, y dos notas que suben. Todo eso
 * sale de una hoja aparte, `vida.png`, que **solo se pide con la escena viva**:
 * con movimiento reducido o con el ahorro de datos puesto no se descarga, y lo que
 * queda es la escena quieta con todo encendido, que ya viene en las capas. En el
 * servidor la escena sale siempre quieta, y la vida se enciende al hidratar.
 *
 * **Y se puede parar** (WCAG 2.2.2): lo que se mueve más de cinco segundos tiene
 * que poder pausarse. El botón sale solo cuando hay algo que parar y se lleva
 * también el seguimiento del puntero; el paralaje del scroll se queda, porque lo
 * mueve quien baja la página y no la página sola.
 *
 * Es adorno: el escenario va con `aria-hidden` y no dice nada que no diga el
 * titular de al lado.
 */
export function EscenaPortada() {
  const escenario = useRef<HTMLDivElement>(null);
  const viva = useSyncExternalStore(suscribirseAlMovimiento, puedeMoverse, quietaEnElServidor);
  const [parada, setParada] = useState(false);

  useEffect(() => {
    const nodo = escenario.current;
    /* v8 ignore next 3 -- la ref está puesta al correr el efecto; el nulo es para el tipo */
    if (nodo === null) {
      return;
    }
    if (!viva || parada || !punteroFino()) {
      return;
    }

    let pendiente = 0;
    let ultimo = { x: 0, y: 0 };

    // Se lee la caja en el fotograma y no en el evento: un `pointermove` llega
    // muchas más veces por segundo de las que se pinta, y así cada fotograma
    // mide y escribe una vez.
    const pintar = () => {
      pendiente = 0;
      const caja = nodo.getBoundingClientRect();
      const centroX = caja.left + caja.width / 2;
      const centroY = caja.top + caja.height / 2;
      // Normalizado contra media ventana y no contra la caja: el puntero suele
      // estar en el titular, a la izquierda, y medido contra la caja se iría al
      // tope en cuanto saliera de ella.
      desplazar(
        nodo,
        acotar((ultimo.x - centroX) / (window.innerWidth / 2)),
        acotar((ultimo.y - centroY) / (window.innerHeight / 2)),
      );
    };

    const mover = (evento: PointerEvent) => {
      ultimo = { x: evento.clientX, y: evento.clientY };
      if (pendiente === 0) {
        pendiente = requestAnimationFrame(pintar);
      }
    };

    window.addEventListener('pointermove', mover, { passive: true });
    return () => {
      window.removeEventListener('pointermove', mover);
      cancelAnimationFrame(pendiente);
      desplazar(nodo, 0, 0);
    };
  }, [viva, parada]);

  const medidas = {
    '--lienzo-ancho': LIENZO.ancho,
    '--lienzo-alto': LIENZO.alto,
    '--hoja-ancho': HOJA.ancho,
    '--hoja-alto': HOJA.alto,
  } as CSSProperties;

  return (
    <div
      className="escena"
      data-escena=""
      data-viva={viva ? '' : undefined}
      data-parada={viva && parada ? '' : undefined}
    >
      <div
        ref={escenario}
        className="escena-escenario"
        data-escenario=""
        aria-hidden="true"
        style={medidas}
      >
        {CAPAS.map((capa) => (
          <div key={capa} className={`escena-capa escena-capa-${capa}`}>
            <div className={`escena-lamina escena-${capa}`}>
              {TIRAS_POR_CAPA[capa].map(([nombre, tira]) => (
                <span
                  key={nombre}
                  className="escena-tira"
                  data-tira={nombre}
                  style={
                    {
                      '--x': tira.x,
                      '--y': tira.y,
                      '--w': tira.ancho,
                      '--h': tira.alto,
                      '--fila': tira.fila,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        ))}
        <div className="escena-velo" />
      </div>

      {/* Oscuro en los dos temas: va encima de la sala, que lo es siempre. Con el
          fondo del tema, en claro salía un círculo blanco que pesaba más que el
          profesor. Lleva filo porque a sangre, en la esquina de la pantalla, un
          círculo oscuro sobre la noche no se encontraba. */}
      {viva && (
        <button
          type="button"
          onClick={() => setParada((antes) => !antes)}
          aria-label={parada ? 'Poner en marcha la escena' : 'Parar la escena'}
          title={parada ? 'Poner en marcha la escena' : 'Parar la escena'}
          className="size-tap bg-night/70 text-bulb hover:bg-night/90 border-bulb/30 hover:border-bulb/60 absolute right-4 bottom-4 flex cursor-pointer items-center justify-center rounded-full border transition-colors"
        >
          {parada ? (
            <IconoSonar />
          ) : (
            // Las dos barras de pausa. No hay icono de pausa en `ui/icons` porque
            // aquí es el único sitio que pausa en vez de parar.
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

const CAPAS: readonly CapaDeLaEscena[] = ['fondo', 'medio', 'frente'];

const TIRAS_POR_CAPA = Object.fromEntries(
  CAPAS.map((capa) => [capa, Object.entries(TIRAS).filter(([, tira]) => tira.capa === capa)]),
) as Record<CapaDeLaEscena, Array<[string, (typeof TIRAS)[keyof typeof TIRAS]]>>;

/**
 * Cuántos píxeles del dibujo se va cada capa con el puntero en un extremo.
 *
 * El medio no se mueve: es el ancla, y con él el profesor, que es a quien se
 * mira. La pared va con el puntero y lo de delante en contra, que es lo que hace
 * una cámara que se asoma.
 */
const HONDURA = {
  fondo: { x: 2, y: 1 },
  frente: { x: -3, y: -2 },
} as const;

function desplazar(nodo: HTMLElement, x: number, y: number): void {
  for (const [capa, cuanto] of Object.entries(HONDURA)) {
    // `+ 0` porque `Math.round(-0.2)` da `-0`, y escrito en el estilo sale «-0».
    nodo.style.setProperty(`--${capa}-x`, String(Math.round(x * cuanto.x) + 0));
    nodo.style.setProperty(`--${capa}-y`, String(Math.round(y * cuanto.y) + 0));
  }
}

function acotar(valor: number): number {
  return Math.max(-1, Math.min(1, valor));
}

function ahorraDatos(): boolean {
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return conexion?.saveData === true;
}

/** Si la escena puede moverse: quien mira acepta movimiento y no ahorra datos. */
function puedeMoverse(): boolean {
  return !prefersReducedMotion() && !ahorraDatos();
}

function quietaEnElServidor(): boolean {
  return false;
}

/**
 * Se escucha el cambio de preferencia, no solo la de entrada: quien activa el
 * movimiento reducido con la portada abierta lo pide para ahora.
 */
function suscribirseAlMovimiento(avisar: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

function punteroFino(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
}
