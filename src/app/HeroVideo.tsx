'use client';

import { useEffect, useRef } from 'react';

import { playQuietly } from '@media/play-quietly';
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
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (video === null || prefersReducedMotion()) {
      return;
    }
    video.src = '/hero.mp4';
    // Por `playQuietly` y no por `play().catch()`: `play()` no devuelve promesa
    // en los navegadores antiguos ni en jsdom, y encadenarle un `.catch` a
    // ciegas revienta. Si el navegador no deja arrancarlo solo —la política de
    // autoreproducción— se queda el póster, que es el mismo fotograma parado.
    void playQuietly(video);
  }, []);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster="/hero.jpg"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
