'use client';

import { useEffect, useRef } from 'react';

import { playQuietly } from '@media/play-quietly';
import { prefersReducedMotion } from '@ui/motion';

/**
 * El vídeo del encabezado.
 *
 * Solo se descarga y se pone en marcha si quien mira acepta movimiento: para
 * quien ha pedido que no, dos megas de vídeo de adorno son dos megas y un
 * mareo.
 *
 * **Y por eso lleva póster.** Antes el vídeo iba a sangre detrás del titular y
 * no hacía falta: sin él quedaba el degradado, que ya daba el mismo aire. Ahora
 * vive en una caja con su marco a la derecha del titular, así que no aparecer es
 * dejar un rectángulo vacío en mitad de la portada. El póster son 56 kB de un
 * fotograma —contra los 2,3 MB del vídeo— y lo pinta el navegador solo, tanto
 * mientras el vídeo carga como cuando no se va a cargar nunca.
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
