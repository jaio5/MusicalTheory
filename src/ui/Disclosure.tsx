import type { ReactNode } from 'react';

import { Chevron } from './Chevron';

/**
 * El otro desplegable: el que abre y cierra un trozo de pantalla.
 *
 * No confundir con `ui/Field`, que es el de elegir una opción de una lista. Son
 * dos controles distintos y los dos se llaman «desplegable» al hablar; lo que
 * tienen que compartir es **la señal de que eso se abre**, y hasta ahora no la
 * compartían: la tonalidad de una unidad, los consejos de un estilo y las
 * preguntas de la portada eran tres `<details>` con tres pintas y ninguna flecha.
 *
 * Sigue siendo un `<details>` de verdad y no un botón con estado: se abre sin
 * JavaScript, el navegador ya sabe anunciarlo y el buscador del navegador
 * encuentra lo que hay dentro aunque esté cerrado.
 *
 * La flecha es la misma que la del selector —un chevrón que gira al abrir— y el
 * triángulo que pone el navegador por su cuenta se quita: es lo único que dibuja
 * el sistema aquí, y en Safari no se parece al de Chrome.
 *
 * Dos tamaños, porque hay dos usos y no cuatro: `normal` para una barra dentro de
 * una pantalla, y `grande` para las preguntas de la portada, donde el enunciado
 * es lo que se lee de lejos.
 */
export function Disclosure({
  summary,
  tone = 'normal',
  className = '',
  abierto = false,
  children,
}: {
  /** El enunciado, lo que se lee con el bloque cerrado. */
  readonly summary: ReactNode;
  readonly tone?: 'normal' | 'grande';
  readonly className?: string;
  /**
   * Si empieza abierto.
   *
   * Para cuando la pantalla **no puede seguir** sin lo que hay dentro: una unidad
   * sin tonalidad elegida pedía «elige una tonalidad» y no ofrecía dónde, con la
   * rueda plegada detrás de una línea de texto que no parecía pulsable. Pedir sin
   * ofrecer es la manera más corta de dejar a alguien parado.
   *
   * Es `defaultOpen` y no `open`: se abre así la primera vez y a partir de ahí
   * manda quien lo abre y lo cierra, no el componente.
   */
  readonly abierto?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <details className={`group ${className}`} open={abierto}>
      <summary
        className={`min-h-tap flex cursor-pointer list-none items-center gap-2 transition-colors marker:content-none [&::-webkit-details-marker]:hidden ${
          tone === 'grande'
            ? 'text-text text-fluid-subtitle hover:text-brass-bright'
            : 'text-text-muted hover:text-text font-mono text-xs'
        }`}
      >
        {/* La flecha primero: así todas las filas que se abren empiezan igual y se
            reconocen sin leerlas. Da media vuelta al abrir. */}
        <Chevron
          className={`shrink-0 transition-transform duration-150 group-open:rotate-180 ${
            tone === 'grande' ? 'size-4' : 'size-3'
          }`}
        />
        <span className="min-w-0">{summary}</span>
      </summary>

      {children}
    </details>
  );
}
