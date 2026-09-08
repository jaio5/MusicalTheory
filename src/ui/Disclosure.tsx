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
  tope = false,
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
  /**
   * Que lo de dentro **no pueda comerse la pantalla**.
   *
   * Hace falta en las pantallas de taller —componer, la unidad—, donde esta barra
   * vive encima de una caja que crece y se desplaza. La barra es `shrink-0`, así
   * que si lo que se abre mide más que la pantalla, al que crece le tocan cero
   * píxeles: en un teléfono, abrir la rueda dejaba el resto de componer con altura
   * cero y **fuera de alcance**, sin forma de desplazarse hasta ello. No se veía
   * como un fallo de la rueda, se veía como que la aplicación se había quedado en
   * blanco.
   *
   * Con el tope, lo que se abre se desplaza por dentro y siempre queda pantalla
   * para lo de abajo. El número —38 de cada 100— sale de medirlo en un teléfono:
   * con la cabecera de componer envuelta en dos líneas y la barra de
   * herramientas abajo, es lo que deja sitio para que lo que crece crezca.
   */
  readonly tope?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <details className={`group ${className}`} open={abierto}>
      <summary
        className={`min-h-tap flex cursor-pointer list-none items-center gap-2 transition-colors marker:content-none [&::-webkit-details-marker]:hidden ${
          tone === 'grande'
            ? 'text-text text-fluid-subtitle hover:text-brass-bright'
            : 'text-text-muted hover:text-text text-sm font-medium'
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

      {tope ? <div className="max-h-[38dvh] overflow-y-auto">{children}</div> : children}
    </details>
  );
}
