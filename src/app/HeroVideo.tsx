'use client';

import { useEffect, useRef } from 'react';

import { playQuietly } from '@media/play-quietly';
import { prefersReducedMotion } from '@ui/motion';

/**
 * El vídeo del encabezado.
 *
 * Solo se descarga y se pone en marcha si quien mira acepta movimiento: para
 * quien ha pedido que no, dos megas de vídeo de adorno son dos megas y un
 * mareo. En ese caso queda el degradado de debajo, que ya da el mismo aire.
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
    // autoreproducción— se queda el degradado, que ya da el mismo aire.
    void playQuietly(video);
  }, []);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
