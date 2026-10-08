import type { KeyboardEvent, ReactNode, ToggleEvent } from 'react';

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
/**
 * Que se vea que el panel sigue hacia abajo, **solo cuando sigue**.
 *
 * El tope de arriba es un máximo, y en un teléfono lo que hay dentro puede no
 * caber: en componer, a 390 px, la rueda y los cuatro atajos median 550 para 491
 * visibles, y el último botón salía **cortado en recto** contra el borde. Una
 * recta no se lee como «hay más», se lee como que algo se ha roto.
 *
 * Es el truco de `.hay-mas-al-lado` de `globals.css` puesto de pie, y por la
 * misma razón sin medir nada ni JavaScript —este componente también lo pintan
 * componentes de servidor—: dos tapas del color del panel viajan **con el
 * contenido** (`local`) y tapan dos sombras pegadas **al marco** (`scroll`).
 * Arriba del todo la tapa de arriba cubre su sombra; abajo del todo, la de
 * abajo. En medio se ven las dos. Si todo cabe, las tapas cubren siempre.
 *
 * Va aquí y no en la hoja porque el color de la tapa es el del panel, que solo
 * sabe este componente, y la clase de la hoja está pensada para tiras de lado.
 */
const PISTA_DE_QUE_SIGUE = {
  background: [
    'linear-gradient(var(--color-surface-raised) 55%, transparent) 0 0 / 100% 34px no-repeat local',
    'linear-gradient(transparent, var(--color-surface-raised) 45%) 0 100% / 100% 34px no-repeat local',
    'linear-gradient(color-mix(in srgb, var(--color-text) 18%, transparent), transparent) 0 0 / 100% 18px no-repeat scroll',
    'linear-gradient(transparent, color-mix(in srgb, var(--color-text) 18%, transparent)) 0 100% / 100% 18px no-repeat scroll',
    'var(--color-surface-raised)',
  ].join(', '),
} as const;

export function Disclosure({
  summary,
  tone = 'normal',
  className = '',
  abierto = false,
  flotante = false,
  onAbrirse,
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
  /**
   * Avisa de si está abierto, para quien tenga algo que hacer con eso.
   *
   * Lo necesita quien monta uno **flotante**: mientras el panel está abierto tapa
   * lo que hay debajo, y lo tapado no debería seguir recibiendo el foco ni
   * anunciarse. Nadie de fuera puede deducirlo mirando `abierto`, que es solo el
   * valor de partida: a partir de ahí manda quien lo abre y lo cierra.
   *
   * Se avisa también al montar, con el estado de salida, porque un `<details>`
   * que nace abierto no dispara `toggle`.
   */
  readonly onAbrirse?: (abierto: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <details
      // `relative` solo cuando flota: es lo que hace que lo de dentro se ancle
      // aquí y no en la primera caja posicionada que pille por encima.
      className={`group ${flotante ? 'relative' : 'desplegable'} ${className}`}
      open={abierto}
      /*
        El `ref` y el manejador **solo si alguien escucha**, y no siempre.

        Este componente se usa también desde componentes de servidor —las
        preguntas de la portada—, y ahí ni un `ref` ni un manejador de eventos
        pueden pasar: React contesta «Refs cannot be used in Server Components» y
        la página entera devuelve 500. Los cinco comandos pasaban igual, build
        incluido; lo cazó pedir la portada con un navegador.

        Quien pasa `onAbrirse` es siempre un componente de cliente, así que ahí
        los dos son legales.

        El `ref` avisa al montar con el estado de salida, porque un `<details>`
        que nace abierto no dispara `toggle` y quien escucha se quedaría creyendo
        que está cerrado justo en el caso que importa.
      */
      {...(onAbrirse === undefined
        ? {}
        : {
            ref: (nodo: HTMLDetailsElement | null) => {
              if (nodo !== null) {
                onAbrirse(nodo.open);
              }
            },
            onToggle: (evento: ToggleEvent<HTMLDetailsElement>) =>
              onAbrirse(evento.currentTarget.open),
          })}
      /*
        **Escape cierra lo que flota, y el foco vuelve al rótulo.**

        Un panel que tapa lo de debajo es un diálogo a efectos del teclado, y de
        un diálogo se sale con Escape: sin eso, quien entra con el tabulador en
        la rueda solo puede salir recorriéndola entera o volviendo al rótulo a
        ciegas. El foco va al `summary` porque es lo que se acaba de cerrar, y
        si se quedara en una casilla de la rueda estaría en algo que ya no se ve.

        Solo cuando flota, y por lo mismo que el `ref`: sin flotar lo usan
        componentes de servidor, que no pueden pasar un manejador. Todos los
        flotantes de hoy viven en componentes de cliente.
      */
      {...(flotante ? { onKeyDown: cerrarConEscape } : {})}
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
          // son tres: en un teléfono hay más marco que en un escritorio.
          //
          //   estrecho  61 cabecera + 181 la de pantalla + 44 esta barra
          //             + 65 navegación abajo = 351 → 22rem
          //   desde `sm`  61 + 117 + 44 + 65 = 287 → 18.5rem (296), nueve de margen
          //   desde `md`  61 + 117 + 44, y la navegación sube arriba = 222 → 14rem
          //   desde `lg`  61 + 85 + 44 = 12rem: la cabecera vuelve a una fila
          //
          // **El escalón de `md` cuenta las dos filas de componer**, que llegan
          // hasta `lg` (`sm:max-lg:flex-wrap`): con 12rem el panel acababa 30 px
          // por debajo de la ventana entre 768 y 1023.
          //
          // **El escalón de `sm` existe porque el de abajo mide con más marco del
          // que hay de 640 para arriba**: a 700×600 el panel se quedaba en 248 px
          // con 373 libres hasta la navegación, y los cuatro atajos de salida
          // salían cortados por el borde de abajo. Los 117 son la cabecera de
          // componer con sus mandos en dos filas, que es lo más alto que hay en
          // ese tramo: el panel empieza en el píxel 222 ahí y en el 162 en la
          // unidad, medido a 639, 640×400, 700×600 y 767.
          //
          // **Los 181 son con la barra de herramientas envuelta en dos filas**, que
          // es lo que pasa por debajo de 390 px **con la sesión abierta**: ahí cabe
          // la insignia del cupo de IA y la fila se parte. Con 133 —una sola fila,
          // que es lo que decía esta cuenta— el panel se metía 31 px por debajo de
          // la navegación, y la última fila de la rueda quedaba dentro de la
          // pantalla pero **sin poder pulsarse**: el toque se lo quedaba la barra.
          // Medido con sesión a 320×568 y a 360×640; anónimo no pasa, porque sin
          // insignia la fila no se parte.
          //
          // El tope es un máximo, así que las pantallas donde la barra sí cabe en
          // una fila solo pierden los 48 px que aquí sobran, y la rueda se
          // desplaza dentro de su panel: no se queda nada fuera de alcance.
          //
          // **El corte es `barra-arriba` y no `sm` porque es donde la navegación
          // cambia de sitio**, y este número solo dice cuánto marco hay. Estuvo en
          // `sm` mientras la barra de abajo se iba en 640; al llevarla a 768 —abajo
          // de eso la cabecera no cabía y se comía el botón de la cuenta— este
          // tope se quedó descontando una navegación que seguía ahí, y la rueda
          // volvía a salirse entre 640 y 767 con la ventana baja. Ahora es la
          // misma variante que pide `AppShell` (`globals.css`): si la navegación
          // se mueve, esto se mueve con ella. Va con `max-lg` porque una variante
          // propia se escribe en la hoja **después** de `lg`, y sin acotarla le
          // ganaría desde 1024.
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
          //
          // **Y tiene suelo: nueve rem, pase lo que pase** (`max()`). Restar un
          // número fijo a la pantalla da cero —o menos— en cuanto la ventana es
          // baja: a 320×256, que es un 1280×1024 con zoom al 400 % (WCAG 1.4.10),
          // el panel medía **cero píxeles**, y a 640×400 cuarenta y ocho, con la
          // rueda abierta y sin manera de verla. Con suelo, el panel puede pasar
          // del borde de abajo, y por eso por debajo de 500 px de alto **el marco
          // deja desplazar** su `<main>` y pliega la navegación de abajo a solo
          // iconos (`app/AppShell.tsx`): lo que no cabe se alcanza bajando.
          className="border-border motion-safe:animate-desplegar barra-arriba:max-lg:max-h-[max(9rem,calc(100dvh-14rem))] absolute inset-x-0 top-full z-30 max-h-[max(9rem,calc(100dvh-22rem))] overflow-y-auto border-b shadow-[var(--sombra-alta)] sm:max-h-[max(9rem,calc(100dvh-18.5rem))] lg:max-h-[max(9rem,calc(100dvh-12rem))]"
          style={PISTA_DE_QUE_SIGUE}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </details>
  );
}

function cerrarConEscape(evento: KeyboardEvent<HTMLDetailsElement>): void {
  const detalles = evento.currentTarget;
  if (evento.key !== 'Escape' || !detalles.open) {
    return;
  }
  // Que no suba: si esto vive dentro de algo que también se cierra con Escape,
  // una pulsación cierra una cosa y no dos.
  evento.stopPropagation();
  detalles.open = false;
  detalles.querySelector('summary')?.focus();
}
