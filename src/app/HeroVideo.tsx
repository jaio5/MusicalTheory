'use client';

import { useEffect, useRef, useState } from 'react';

import { playQuietly } from '@media/play-quietly';
import { IconoSonar } from '@ui/icons';
import { prefersReducedMotion } from '@ui/motion';

/**
 * El vídeo del encabezado.
 *
 * Solo se descarga y se pone en marcha si quien mira acepta movimiento: para
 * quien ha pedido que no, medio mega de vídeo de adorno es medio mega y un
 * mareo.
 *
 * **Y por eso lleva póster.** Antes el vídeo iba a sangre detrás del titular y
 * no hacía falta: sin él quedaba el degradado, que ya daba el mismo aire. Ahora
 * vive en una caja con su marco a la derecha del titular, así que no aparecer es
 * dejar un rectángulo vacío en mitad de la portada. El póster son 56 kB de un
 * fotograma —contra los 471 kB del vídeo— y lo pinta el navegador solo, tanto
 * mientras el vídeo carga como cuando no se va a cargar nunca.
 *
 * **Pesaba 2,3 MB y ahora pesa 471 kB**, que es el mismo vídeo mejor guardado:
 * venía a 1280 por 720 para verse en una caja de 519 por 415, y llevaba una
 * pista de audio AAC dentro de un vídeo silenciado. A 1040 de ancho —el doble
 * de lo que se ve, para las pantallas densas— y sin audio, la portada pasa de
 * 3.222 kB a 1.344, que es lo que pesan las demás pantallas. Era la página que
 * más pesaba y es la única que ve quien llega.
 *
 * El origen se pone desde el efecto y no en el JSX porque eso es actualizar un
 * sistema de fuera —el reproductor— y no estado de React: así no hay un render
 * de más ni un fotograma con el vídeo puesto donde no se quería.
 *
 * **Y no se pide hasta que se va a ver.** En el móvil la caja cae por debajo del
 * pliegue —va después del titular— y los 471 kB se bajaban igual, con la pantalla
 * enseñando otra cosa. Con `IntersectionObserver` el origen se pone cuando la caja
 * asoma, y con el ahorro de datos puesto (`navigator.connection.saveData`) no se
 * pone nunca: queda el póster, como con el movimiento reducido. Donde no hay
 * observador —navegadores viejos— se pone al montar, como antes.
 *
 * **Se puede parar.** Es un bucle de diez segundos que arranca solo, y WCAG 2.2.2
 * pide que lo que se mueve más de cinco segundos se pueda pausar. El botón sale
 * solo cuando hay vídeo —con el póster no hay nada que parar— y dice lo que está
 * pasando de verdad: lo lee de los eventos del reproductor, no de lo que se le
 * pidió, porque la política de autoreproducción puede dejarlo parado sin avisar.
 */
function ahorraDatos(): boolean {
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return conexion?.saveData === true;
}

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [puesto, setPuesto] = useState(false);
  const [sonando, setSonando] = useState(false);

  useEffect(() => {
    const video = ref.current;
    /* v8 ignore next 3 -- la ref está puesta al correr el efecto; el nulo es para el tipo */
    if (video === null) {
      return;
    }
    if (prefersReducedMotion() || ahorraDatos()) {
      return;
    }

    const poner = () => {
      video.src = '/hero.mp4';
      setPuesto(true);
      // Por `playQuietly` y no por `play().catch()`: `play()` no devuelve promesa
      // en los navegadores antiguos ni en jsdom, y encadenarle un `.catch` a
      // ciegas revienta. Si el navegador no deja arrancarlo solo —la política de
      // autoreproducción— se queda el póster, que es el mismo fotograma parado.
      void playQuietly(video);
    };

    if (typeof IntersectionObserver === 'undefined') {
      poner();
      return;
    }
    // Un margen por debajo para que empiece a bajar un poco antes de asomar, y
    // al asomar ya esté en marcha y no en su primer fotograma.
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          observador.disconnect();
          poner();
        }
      },
      { rootMargin: '0px 0px 200px 0px' },
    );
    observador.observe(video);
    return () => observador.disconnect();
  }, []);

  return (
    <>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster="/hero.jpg"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
      />
      {puesto && (
        <button
          type="button"
          onClick={() => {
            const video = ref.current;
            /* v8 ignore next 3 -- el botón solo existe con el vídeo montado */
            if (video === null) {
              return;
            }
            if (sonando) {
              video.pause();
            } else {
              void playQuietly(video);
            }
          }}
          aria-label={sonando ? 'Parar el vídeo' : 'Seguir con el vídeo'}
          title={sonando ? 'Parar el vídeo' : 'Seguir con el vídeo'}
          className="bg-background/80 text-text hover:text-brass-bright size-tap absolute right-3 bottom-3 flex cursor-pointer items-center justify-center rounded-full"
        >
          {sonando ? (
            // Las dos barras de pausa. No hay icono de pausa en `ui/icons` porque
            // aquí es el único sitio que pausa en vez de parar.
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <IconoSonar />
          )}
        </button>
      )}
    </>
  );
}
