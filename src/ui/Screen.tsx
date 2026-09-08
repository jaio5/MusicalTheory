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
 * El ancho sale de tres opciones con nombre y no de un número por pantalla:
 * `lectura` para lo que se lee seguido, `normal` para lo que se maneja y `ancha`
 * para lo que se compara en rejilla. Tres, porque cuatro ya nadie las distingue.
 */
export const ANCHOS = {
  /**
   * Texto seguido y ejercicios. **El único que se queda estrecho**, y no por
   * ahorrar sitio: un renglón de noventa caracteres se lee de una pasada y uno de
   * doscientos obliga a buscar dónde empezaba el siguiente. Lo que llena el ancho
   * aquí no es el texto, es lo que va al lado.
   */
  lectura: 'max-w-3xl',
  /** Lo normal: formularios, ajustes, una conversación. */
  normal: 'max-w-5xl',
  /** Rejillas que se comparan de un vistazo, como las tarjetas de plan. */
  ancha: 'max-w-7xl',
} as const;

export type Ancho = keyof typeof ANCHOS;

export function Screen({
  title,
  lead,
  back,
  actions,
  ancho = 'normal',
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
  readonly children: ReactNode;
}) {
  return (
    // Un solo sitio que hace scroll. Había pantallas con tres cajas con scroll
    // dentro, y entonces la rueda del ratón mueve lo que no esperas.
    <div className="h-full min-h-0 overflow-y-auto">
      <div className={`mx-auto flex flex-col gap-8 p-4 md:p-8 ${ANCHOS[ancho]}`}>
        <header>
          {back !== undefined && (
            <Link
              href={back.href}
              className="text-text-muted hover:text-text min-h-tap -mx-2 mb-2 inline-flex items-center gap-1 px-2 text-sm"
            >
              ← {back.label}
            </Link>
          )}

          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              {/* En la serif de la portada y no en la de sistema: es la letra
                  con la que esta aplicación se presenta, y usarla solo fuera
                  hacía que dentro pareciera otra aplicación. */}
              <h1 className="text-text font-display text-3xl leading-tight tracking-tight md:text-4xl">
                {title}
              </h1>
              {lead !== undefined && (
                <p className="text-text-muted mt-2 max-w-prose text-sm">{lead}</p>
              )}
            </div>
            {actions !== undefined && <div className="shrink-0">{actions}</div>}
          </div>
        </header>

        {children}
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
}) {
  return (
    <div className="border-border flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5">
      {back !== undefined && (
        <Link
          href={back.href}
          className="text-text-muted hover:text-text min-h-tap -mx-2 inline-flex shrink-0 items-center gap-1 px-2 text-sm"
        >
          ← {back.label}
        </Link>
      )}
      <h1 className="text-text font-display text-base">{title}</h1>
      {lead !== undefined && <p className="text-text-muted min-w-0 truncate text-xs">{lead}</p>}
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
      {actions !== undefined && <div className="ml-auto min-w-0">{actions}</div>}
    </div>
  );
}

/**
 * Un apartado dentro de una pantalla.
 *
 * Título en versalitas de máquina de escribir —el mismo rótulo que ya usaban la
 * cuenta y los planes por su cuenta— y el mismo hueco por encima en todas. El
 * `id` es opcional y sirve para enlazar el apartado desde fuera, como hace el
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
      <h2 className="rotulo flex items-center gap-3">
        <span className="shrink-0">{title}</span>
        <span aria-hidden="true" className="bg-border h-px grow" />
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
