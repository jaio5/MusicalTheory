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
  flotante = false,
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
   * Que lo que se abre **flote sobre lo de abajo en vez de empujarlo**.
   *
   * Hace falta en las pantallas de taller —componer, la unidad—, donde esta barra
   * vive encima de una caja que crece. Empujando, lo que se abre le quita altura a
   * esa caja, y aquí eso tiene dos caras y las dos son malas: si la barra no cede,
   * al que crece le tocan **cero píxeles** y lo de debajo queda fuera de alcance;
   * y si cede, la rueda de quintas se queda **partida por una recta**, que no se
   * lee como «hay más abajo» sino como que algo se ha roto.
   *
   * Flotando no hay nada que repartir: la barra mide su rótulo y ya, la caja de
   * abajo conserva su altura entera y la rueda sale redonda y a su tamaño. Medido
   * en un teléfono: lo que crece pasa de 328 px a 576, y la rueda de un casquete
   * cortado a 366 px de circunferencia completa.
   *
   * Es el mismo trato que ya tiene el cajón de herramientas de componer, que se
   * abre hacia arriba por encima del lienzo. Aquí se abre hacia abajo.
   *
   * **Y por eso quien la monta la deja `shrink-0`**: una barra que flota no
   * compite por el alto con nada, así que encogerla solo serviría para aplastarle
   * el rótulo.
   */
  readonly flotante?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <details
      // `relative` solo cuando flota: es lo que hace que lo de dentro se ancle
      // aquí y no en la primera caja posicionada que pille por encima.
      className={`group ${flotante ? 'relative' : ''} ${className}`}
      open={abierto}
    >
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

      {flotante ? (
        <div
          // `surface-alta` y sombra, como el cajón de herramientas: lo que está
          // encima se dice con el tono y no solo con el borde.
          //
          // El tope es **la pantalla menos lo que hay encima y debajo**, y por eso
          // son dos: en un teléfono hay más marco que en un escritorio.
          //
          //   teléfono  61 cabecera + 133 la de pantalla + 44 esta barra
          //             + 65 navegación abajo = 303 → 20rem
          //   a partir de `sm`  61 + 85 + 44, y la navegación sube arriba = 12rem
          //
          // **La barra de herramientas no se descuenta, se tapa.** Mientras eliges
          // tonalidad, esa fila no sirve para nada, y reservarle sus sesenta y un
          // píxeles era justo lo que dejaba la rueda cortada en un teléfono.
          //
          // Sigue siendo un número medido, y eso ya caducó una vez —el `38dvh` que
          // dejó componer en doce píxeles—. La diferencia no es el número: es que
          // **ahora hay quien lo vigile**. La sonda de `.claude/skills/arrancar`
          // recorre esta pantalla con la barra abierta en siete tamaños y dice si
          // algo queda fuera de alcance.
          //
          // Sin `top` y con `bottom` no se arregla, aunque lo parezca: el
          // navegador resuelve entonces el alto por el contenido y sube el panel
          // hasta taparse el propio rótulo. Probado en la página.
          className="bg-surface-raised border-border absolute inset-x-0 top-full z-30 max-h-[calc(100dvh-20rem)] overflow-y-auto border-b shadow-[var(--sombra-alta)] sm:max-h-[calc(100dvh-12rem)]"
        >
          {children}
        </div>
      ) : (
        children
      )}
    </details>
  );
}
