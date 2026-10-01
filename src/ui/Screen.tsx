import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * El marco de una pantalla. Todas usan este, y por eso todas se parecen.
 *
 * Antes cada pantalla se inventaba el suyo: nueve pantallas con cinco anchos
 * distintos —`max-w-xl`, `2xl`, `3xl`, `5xl`, `prose`—, tres rellenos, dos con el
 * título en sitios distintos y tres **sin título ninguno**. Se notaba al cambiar
 * de una a otra: nada caía donde acababas de dejarlo, y en las que no tenían
 * título había que deducir dónde estabas por lo que se veía.
 *
 * Lo que fija este componente es **dónde está cada cosa**, no cómo se ve:
 *
 * - El título, siempre arriba a la izquierda y siempre `h1`. Uno por pantalla.
 * - Debajo, una línea que dice para qué sirve esto. Cabe en un renglón a
 *   propósito: si hace falta un párrafo, es que la pantalla hace dos cosas.
 * - La acción principal, arriba a la derecha en pantalla ancha y bajo el título
 *   en estrecha, que es donde llega el pulgar sin tapar lo que se lee.
 * - La vuelta atrás, encima del título, porque leer «← Camino» después del
 *   título obliga a subir la vista dos veces.
 *
 * El ancho sale de **dos** opciones con nombre y no de un número por pantalla,
 * y las dos empiezan en el mismo borde izquierdo: `lectura` para lo que se lee
 * seguido y `completo` para todo lo demás. Lo que se maneja y lo que se compara
 * ya no se distinguen por lo estrecho de su columna, sino por cómo se reparten
 * dentro del ancho entero: en rejilla, en columnas o con algo al lado (`aside`).
 */
const ANCHOS = {
  /**
   * Texto seguido y ejercicios. **El único que se queda estrecho**, y no por
   * ahorrar sitio: un renglón de noventa caracteres se lee de una pasada y uno de
   * doscientos obliga a buscar dónde empezaba el siguiente. Lo que llena el ancho
   * aquí no es el texto, es lo que va al lado: por eso con `lectura` el `aside`
   * se queda con todo lo que sobra.
   */
  lectura: 'max-w-3xl',
  /**
   * Todo el ancho de la pantalla. Eran dos —`normal`, de 1024 px, y `ancha`, de
   * 1280— y los dos dejaban vacío el resto: a 1920 la cuenta usaba el 23 % del
   * ancho y los planes el 61 %. El ancho de un párrafo lo pone el párrafo
   * (`max-w-prose`); el de la pantalla es el de la pantalla.
   */
  completo: '',
} as const;

export type Ancho = keyof typeof ANCHOS;

/**
 * Las dos columnas cuando hay algo que va al lado.
 *
 * Con `completo`, lo de al lado es una columna que acompaña —una tercera parte
 * del ancho, nunca menos de 20 rem—; con `lectura`, lo principal se queda en
 * **lo que mide**, hasta la medida de lectura (`fit-content`), y lo de al lado se
 * lleva lo que sobre. Con una columna fija de 44 rem, un formulario de 28 dejaba
 * dieciséis de negro entre él y lo que lo acompaña.
 *
 * **Y `lectura` se parte antes, desde `md`**: lo suyo es estrecho y cabe con algo
 * al lado ya en una tableta o en un teléfono tumbado (844 × 390), donde apilado
 * dejaba lo de al lado fuera de la pantalla y media pantalla en negro a la
 * derecha. Una conversación no: por debajo de `lg` se quedaría en 400 px.
 */
const CON_LADO: Readonly<Record<Ancho, string>> = {
  lectura: 'md:grid-cols-[fit-content(44rem)_minmax(0,1fr)]',
  completo: 'lg:grid-cols-[minmax(0,1fr)_minmax(20rem,32%)]',
};

export function Screen({
  title,
  lead,
  back,
  actions,
  ancho = 'completo',
  aside,
  children,
}: {
  readonly title: string;
  /** Para qué sirve esta pantalla, en un renglón. */
  readonly lead?: string;
  /** A dónde se vuelve, si esta pantalla está dentro de otra. */
  readonly back?: { readonly href: string; readonly label: string };
  /** La acción principal. Una, y solo si la pantalla tiene una de verdad. */
  readonly actions?: ReactNode;
  readonly ancho?: Ancho;
  /**
   * Lo que acompaña a lo principal: la tonalidad del profesor, por qué crear una
   * cuenta. Desde `lg` (desde `md` con `lectura`) va en su columna a la derecha, y se queda a la vista
   * mientras se desplaza lo principal; en estrecho va debajo, porque lo
   * principal es a lo que se viene.
   */
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) {
  const principal = (
    <div className={`flex min-w-0 flex-col gap-10 md:gap-14 ${ANCHOS[ancho]}`}>{children}</div>
  );

  return (
    // Un solo sitio que hace scroll. Había pantallas con tres cajas con scroll
    // dentro, y entonces la rueda del ratón mueve lo que no esperas.
    <div className="h-full min-h-0 overflow-y-auto">
      {/*
        **Un solo borde izquierdo para todas**, y el ancho de cada una dentro.

        Cada ancho se centraba por su cuenta, y eso ponía el título en un sitio
        distinto según la pantalla: medido a 1440, Planes empezaba en x=112,
        Profesor y Registro en 240 y Cuenta en 368. Al cambiar de una a otra el
        título saltaba, que es justo lo que este marco venía a quitar.

        **Y la caja ya no se queda en 1280.** Centrar una caja de 80 rem dejaba a
        1920 trescientos píxeles de negro a cada lado, y a 2560 seiscientos noventa:
        en un monitor la aplicación era una columna en medio de una pared. Ahora la
        caja llega hasta 2560 (`max-w-pantalla`) y el margen crece con la pantalla
        (`px-margen`), así que el título cae siempre a un margen del borde y lo que
        hay debajo se reparte en columnas en vez de dejar sitio.
      */}
      <div className="max-w-pantalla px-margen mx-auto w-full pt-6 pb-16 md:pt-10">
        {/*
          **Dos ritmos y no uno.** Entre la cabecera y lo primero hay más aire que
          entre dos apartados, y entre dos apartados más que dentro de uno: con el
          mismo hueco en todas partes —eran `gap-8` para todo— la pantalla se lee
          como una lista de cajas iguales y no se sabe dónde empieza nada.
        */}
        <div className="flex flex-col gap-10 md:gap-14">
          <header className="entra-pantalla">
            {back !== undefined && (
              <Link
                href={back.href}
                className="text-text-muted hover:text-brass-bright min-h-tap -mx-2 mb-1 inline-flex items-center gap-1.5 px-2 text-sm font-medium transition-colors"
              >
                <span aria-hidden="true">←</span> {back.label}
              </Link>
            )}

            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
              <div className="min-w-0">
                {/* La letra del flight case, a tamaño de título de verdad: es lo
                    que dice dónde estás desde el otro lado de la habitación, con la
                    guitarra puesta. Crece con la pantalla y no pasa de 48 px. */}
                <h1 className="titular text-text text-fluid-title">{title}</h1>
                {lead !== undefined && (
                  <p className="text-text-muted text-fluid-subtitle mt-3 max-w-[60ch]">{lead}</p>
                )}
              </div>
              {actions !== undefined && <div className="shrink-0">{actions}</div>}
            </div>
          </header>

          {aside === undefined ? (
            principal
          ) : (
            // `items-start` y `sticky` en lo de al lado: si lo principal es largo,
            // lo que lo acompaña se queda a la vista en vez de quedarse arriba.
            <div
              className={`grid items-start gap-10 md:gap-x-[clamp(2rem,4vw,5rem)] ${CON_LADO[ancho]}`}
            >
              {principal}
              <aside className="flex min-w-0 flex-col gap-8 md:sticky md:top-6">{aside}</aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * La cabecera de una pantalla de taller: afinar, componer, el camino.
 *
 * Esas tres no pueden usar `Screen`: no son documentos que se leen de arriba
 * abajo, sino sitios donde se trabaja con el alto medido —el mástil ya peleó una
 * vez por sus píxeles— y con su propio scroll dentro. Lo que sí comparten con las
 * demás es esto: **un `h1` y una línea que diga qué es**, para que se sepa dónde
 * se está sin deducirlo de lo que se ve.
 *
 * Va en una franja fina y con el mismo relleno que la barra de herramientas que
 * ya tienen debajo, así que no roba una fila entera.
 */
export function WorkHeader({
  title,
  lead,
  back,
  actions,
  accionesCrecen = false,
}: {
  readonly title: string;
  readonly lead?: string;
  /**
   * A dónde se vuelve. Lo tiene también `Screen`, y lo tiene aquí porque si no
   * cada pantalla se inventa el suyo: la unidad y el repaso llegaron a meter dos
   * «← Camino» distintos dentro de `actions`, uno con `aria-label` y otro sin, y
   * ninguno con alto de dedo.
   */
  readonly back?: { readonly href: string; readonly label: string };
  readonly actions?: ReactNode;
  /**
   * Que las acciones se queden **todo lo que deje el título**, en vez de medir lo
   * que mida su contenido.
   *
   * Es para una fila que se desplaza de lado —la barra de componer en un
   * teléfono—. Midiendo su contenido, una fila de seiscientos píxeles en un hueco
   * de doscientos sesenta no se encoge: el `flex-wrap` la baja a un renglón
   * propio. Se le daba un ancho fijo, «la pantalla menos el título», y el título
   * en la serif de reserva de un equipo medía 0,34 px más de lo contado: dos
   * renglones. Con base cero no hay nada que contar.
   */
  readonly accionesCrecen?: boolean;
}) {
  return (
    <div className="border-border flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 md:px-4">
      {back !== undefined && (
        <Link
          href={back.href}
          className="text-text-muted hover:text-brass-bright min-h-tap -mx-2 inline-flex shrink-0 items-center gap-1.5 px-2 text-sm font-medium transition-colors"
        >
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      {/* La misma letra que el título de `Screen`, a la altura de la franja: el
          taller no puede gastar sesenta píxeles en decir dónde estás, pero sí
          decirlo con la voz de la casa. */}
      <h1 className="titular text-text shrink-0 text-lg">{title}</h1>
      {/*
        `flex-1` con base cero, y no solo `min-w-0`: es lo que hace que la línea
        comparta fila con el rótulo en vez de bajarse a la suya.

        `flex-wrap` decide dónde parte **antes** de encoger a nadie, y mira el
        tamaño natural del texto: una frase de trescientos píxeles al lado de un
        rótulo de ochenta no cabía, así que se bajaba y se quedaba con una fila
        entera para ella. Con base cero sí cabe, y luego crece hasta lo que sobre.

        Son veinte píxeles en un teléfono, y ahí valen: esta cabecera gastaba 153
        de 640 —casi una cuarta parte de la pantalla— en decir dónde estás.
      */}
      {lead !== undefined && (
        <p className="text-text-muted min-w-0 flex-1 basis-0 truncate text-sm">{lead}</p>
      )}
      {/*
        El hueco de acciones **puede encoger**, y hace falta que pueda.
        
        Llevaba `shrink-0`, y con eso su ancho es el de su contenido pase lo que
        pase: en un teléfono, la fila de componer —el conmutador de caras más el
        metrónomo entero— medía cuatrocientos diez píxeles dentro de una pantalla
        de trescientos noventa, y el `overflow-hidden` del marco se comía el botón
        de subir el tempo. No se veía y no se podía pulsar.
        
        Lo que arregla no es meter otro `flex-wrap`: el de dentro ya estaba, y no
        envolvía nada porque nadie le estaba apretando. Con `min-w-0` y sin
        `shrink-0`, la caja se estrecha, el de dentro se entera y parte la fila.
      */}
      {actions !== undefined && (
        <div className={accionesCrecen ? 'min-w-0 flex-1 basis-0' : 'ml-auto min-w-0'}>
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * Un apartado dentro de una pantalla.
 *
 * Su título es un `h2` que se lee como título —la letra de los titulares a la
 * altura de un párrafo, `.titulo-apartado`— y no un rótulo de doce píxeles: con
 * el rótulo, la cabecera de la pantalla y la de un apartado estaban a dos tallas
 * de distancia y en dos letras distintas, y la pantalla no tenía escalones entre
 * medias. El mismo hueco por encima en todas. El `id` es opcional y sirve para enlazar el apartado desde fuera, como hace el
 * desplegable del avatar con `/cuenta#contrasena`; cuando lo lleva, se reserva
 * sitio arriba para que el título no se quede pegado al borde al saltar.
 */
export function Section({
  title,
  id,
  children,
}: {
  readonly title: string;
  readonly id?: string;
  readonly children: ReactNode;
}) {
  return (
    // `id` sin valor lo omite React solo, y reservar sitio arriba no molesta
    // cuando no hay ancla a la que saltar: tres condicionales para nada.
    <section id={id} aria-label={title} className="scroll-mt-4">
      {/*
        El rótulo, y una línea fina que ocupa lo que sobra.
        
        Llevaba una marca de latón **delante**: dos píxeles de ancho por doce de
        alto, que con el rótulo en versalitas de máquina pasaba por adorno y con
        el rótulo en la sans se lee como un `|` suelto antes del título, igual que
        una errata. La línea detrás hace el mismo trabajo —separar sin meter una
        regla de lado a lado, que es lo que aplanaba las pantallas— y se lee como
        lo que es: donde empieza un apartado.
      */}
      <h2 className="titulo-apartado flex items-center gap-4">
        <span className="shrink-0">{title}</span>
        <span aria-hidden="true" className="bg-border h-px grow" />
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
