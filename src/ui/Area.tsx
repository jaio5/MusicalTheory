'use client';

import { useState, type ReactNode } from 'react';

import { Chevron } from './Chevron';

/**
 * Dos flechas que se juntan o se separan: estrechar y ensanchar sin que se lean
 * como un zoom, que es lo que decían el «−» y el «+». Para el eje `alto` se
 * giran un cuarto de vuelta, y así «bajar» y «subir» son las mismas flechas.
 */
function GlifoDeMedida({
  hacia,
  eje,
}: {
  readonly hacia: 'dentro' | 'fuera';
  readonly eje: 'ancho' | 'alto';
}) {
  // Dentro: `→ ←` apuntando al centro; fuera: `← →` apuntando a los lados.
  const d =
    hacia === 'dentro'
      ? 'M2 8h5M5 5.5 7.5 8 5 10.5M14 8H9M11 5.5 8.5 8 11 10.5'
      : 'M7 8H2M4 5.5 1.5 8 4 10.5M9 8h5M12 5.5 14.5 8 12 10.5';
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 ${eje === 'alto' ? 'rotate-90' : ''}`}
    >
      <path d={d} />
    </svg>
  );
}

/**
 * Un área del banco de trabajo: su cabecera fina y lo que hay dentro.
 *
 * La cabecera es **de cuarenta y cuatro píxeles y lleva sus propios mandos**, que es la
 * idea entera: los controles de una cosa viven en esa cosa, y no en un ajustes
 * común donde hay que averiguar de qué es cada interruptor. Lo que antes era un
 * rótulo suelto encima de un bloque —un cartel para explicar algo que no se
 * entiende solo— aquí es el sitio donde están el nombre y los dos botones que
 * cambian lo que se ve debajo.
 *
 * **No lleva sombra ni esquinas redondeadas.** Un área no es una tarjeta: es una
 * parte de la pantalla, y se separa de la de al lado con el mismo borde de 1 px
 * que separa todo lo demás. Poner relieve a cada una convierte el banco en un
 * tablero de fichas.
 *
 * El `<section>` va con su nombre accesible aunque el título se vea: quien
 * navega por regiones necesita poder saltar de un área a otra, que es como se
 * usa esto con teclado.
 *
 * **Y se pliega a una tira.** Con las cinco áreas abiertas la pantalla se lee
 * como un panel de control: cinco cosas pidiendo la mirada a la vez y ninguna
 * mandando. Plegada, un área queda en una tira con su icono —lo justo para
 * saber que está ahí y volver a abrirla de un clic— y le devuelve el sitio a lo
 * que se está haciendo. Lo que decide cuáles vienen plegadas es el espacio de
 * trabajo, que trae su reparto de fábrica.
 */
export function Area({
  titulo,
  icono,
  mandos,
  children,
  className = '',
  scroll = true,
  plegada = false,
  onPlegar,
  atajo,
  pliegue = 'vertical',
  sinCabecera = false,
  cabeceraSoloEnElBanco = false,
  medida,
}: {
  readonly titulo: string;
  /** El dibujo del área, si lo tiene. Es decoración que orienta. */
  readonly icono?: ReactNode;
  /** Los dos o tres controles de esta área, a la derecha de su nombre. */
  readonly mandos?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  /**
   * Si lo de dentro se desplaza cuando no cabe.
   *
   * En falso para lo que se dibuja entero y no hace scroll nunca —el mástil—,
   * que es una decisión que ya estaba tomada y aquí se respeta.
   */
  readonly scroll?: boolean;
  /** Si está plegada a su tira. Lo decide quien la monta. */
  readonly plegada?: boolean;
  /** Plegarla y desplegarla. Sin esto, el área no se pliega. */
  readonly onPlegar?: () => void;
  /**
   * La tecla que la pliega y la devuelve, si la tiene.
   *
   * Un área que se puede esconder **tiene que decir cómo se devuelve**
   * ([adr/0031](../../docs/adr/0031-componer-es-un-banco-de-trabajo.md)), y la
   * tira plegada es justo donde se busca: es lo único que queda en pantalla de
   * ella. Va en el `title` y en `aria-keyshortcuts`.
   */
  readonly atajo?: string;
  /**
   * Hacia dónde se pliega: una columna deja una tira de pie y una fila deja una
   * barra tumbada.
   */
  readonly pliegue?: 'vertical' | 'horizontal';
  /**
   * Sin cabecera, para cuando algo de fuera ya la hace.
   *
   * En estrecho las áreas se eligen con pestañas, y la pestaña marcada ya dice
   * el nombre: repetirlo justo debajo son veintiocho píxeles y una palabra de
   * más en la pantalla donde menos sitio hay.
   */
  readonly sinCabecera?: boolean;
  /**
   * Que la cabecera **se esconda por debajo de `lg` con clases**, sin esperar a
   * que JavaScript diga que no hay banco.
   *
   * `sinCabecera` lo decide el cliente después de hidratar, y el servidor no sabe
   * el ancho: pinta el árbol del banco, con su cabecera. En un teléfono eso era
   * una franja de cuarenta y cuatro píxeles que salía y se iba al hidratar, y
   * arrastraba la pantalla entera hacia arriba (CLS 0,12 en `/componer`). Con
   * esto, la primera pintura ya sale sin ella.
   */
  readonly cabeceraSoloEnElBanco?: boolean;
  /**
   * Estrecharla y ensancharla **sin arrastrar**, desde su cabecera.
   *
   * El reparto se movía solo con el divisor: arrastrando o, con el foco puesto
   * en una línea de un píxel, con las flechas. Quien no arrastra —un dedo que
   * tiembla, un puntero de cabeza, un lector de pantalla— no tenía un sitio
   * donde pulsar (WCAG 2.5.7). Dos botones al lado del nombre, que es donde ya
   * viven los mandos de un área.
   */
  readonly medida?: {
    /** De qué es la medida: `ancho` para una columna, `alto` para una fila. */
    readonly eje: 'ancho' | 'alto';
    readonly menos: () => void;
    readonly mas: () => void;
    readonly puedeMenos: boolean;
    readonly puedeMas: boolean;
  };
}) {
  // Animar la entrada solo al **desplegar**: al cargar la pantalla, cinco áreas
  // asomando a la vez son ruido, y aquí se quiere que se note lo que el usuario
  // acaba de pedir. Se compara con el valor de la pasada anterior en el propio
  // render —el patrón de React para derivar estado— y no con un efecto, que
  // pintaría un fotograma sin animar.
  const [anterior, setAnterior] = useState(plegada);
  const [recienDesplegada, setRecienDesplegada] = useState(false);
  if (anterior !== plegada) {
    setAnterior(plegada);
    setRecienDesplegada(anterior && !plegada);
  }

  if (plegada && onPlegar !== undefined) {
    const depie = pliegue === 'vertical';
    return (
      <button
        type="button"
        onClick={onPlegar}
        aria-expanded={false}
        aria-label={`Desplegar ${titulo}`}
        title={atajo === undefined ? `Desplegar ${titulo}` : `Desplegar ${titulo} · ${atajo}`}
        aria-keyshortcuts={atajo}
        // La tira mide lo mismo que una cabecera, para que plegar no mueva de
        // sitio las líneas de la pantalla. Y lleva `size-tap` de fondo: es un
        // botón, y aquí los botones se pulsan con el dedo.
        //
        // El aro del foco va **hacia dentro** (`-outline-offset-3`): la tira vive
        // pegada al borde de una caja que recorta, y el de la casa, tres píxeles
        // por fuera, se quedaba cortado contra ese borde.
        className={`bg-surface border-border text-text-muted hover:text-brass-bright hover:bg-surface-raised flex shrink-0 cursor-pointer items-center justify-center gap-2 transition-colors focus-visible:-outline-offset-3 ${
          depie ? 'min-w-tap w-7 flex-col border-r py-2' : 'min-h-tap w-full border-t px-2'
        } ${className}`}
      >
        <span aria-hidden="true" className="[&_svg]:size-3.5">
          {icono}
        </span>
        <span
          aria-hidden="true"
          className={`text-xs whitespace-nowrap ${depie ? '[writing-mode:vertical-rl]' : ''}`}
        >
          {titulo}
        </span>
      </button>
    );
  }

  return (
    <section
      aria-label={titulo}
      className={`bg-surface flex min-h-0 min-w-0 flex-col ${className}`}
    >
      {/* Sin cabecera, el nombre sigue siendo un título para quien navega por
          títulos: sin él, lo que hay dentro saltaba del `h1` de la pantalla a un
          `h3` y el orden de los títulos quedaba roto en el móvil, que es justo
          donde las áreas van sin cabecera. */}
      {sinCabecera ? (
        <h2 className="sr-only">{titulo}</h2>
      ) : (
        <header
          className={`border-border text-text-muted min-h-tap flex shrink-0 items-center gap-2 border-b px-2 ${
            cabeceraSoloEnElBanco ? 'max-lg:hidden' : ''
          }`}
        >
          {icono !== undefined && (
            <span aria-hidden="true" className="shrink-0 opacity-70 [&_svg]:size-3.5">
              {icono}
            </span>
          )}
          <h2 className="min-w-0 truncate text-xs font-medium">{titulo}</h2>
          {/* Ocho píxeles entre mandos, que es lo que pide no fallar el de al
            lado cuando los dos son del tamaño del dedo. Y estirado, para que lo
            que lleva dentro pueda tomar el alto de la cabecera: sin esto, un
            `self-stretch` ahí abajo se estira contra esta caja, que mide lo que
            mide un icono. Medido: el botón seguía en 44 por 12. */}
          <div className="ml-auto flex shrink-0 items-stretch gap-2 self-stretch">
            {mandos}
            {medida !== undefined && (
              <span className="flex items-stretch" role="group" aria-label={`Medida de ${titulo}`}>
                {(
                  [
                    ['menos', medida.eje === 'ancho' ? 'Estrechar' : 'Bajar', 'dentro'],
                    ['mas', medida.eje === 'ancho' ? 'Ensanchar' : 'Subir', 'fuera'],
                  ] as const
                ).map(([cual, accion, hacia]) => (
                  <button
                    key={cual}
                    type="button"
                    onClick={medida[cual]}
                    disabled={!(cual === 'menos' ? medida.puedeMenos : medida.puedeMas)}
                    aria-label={`${accion} ${titulo}`}
                    title={`${accion} ${titulo}`}
                    // Del ancho del de plegar y la cabecera entera de alto, por
                    // lo mismo que él: es lo que se pulsa en esta fila.
                    className="hover:text-brass-bright inline-flex min-w-11 cursor-pointer items-center justify-center self-stretch disabled:cursor-default disabled:opacity-40"
                  >
                    <span aria-hidden="true">
                      <GlifoDeMedida hacia={hacia} eje={medida.eje} />
                    </span>
                  </button>
                ))}
              </span>
            )}
            {onPlegar !== undefined && (
              <button
                type="button"
                onClick={onPlegar}
                aria-expanded
                aria-label={`Plegar ${titulo}`}
                title={atajo === undefined ? `Plegar ${titulo}` : `Plegar ${titulo} · ${atajo}`}
                aria-keyshortcuts={atajo}
                // **Cuarenta y cuatro de ancho y la cabecera entera de alto.**
                // Medía veinte por doce: por debajo incluso del mínimo de la
                // norma, y no es un mando cualquiera —**es con el que se
                // devuelve un área plegada**, que este proyecto ya tenía escrito
                // que hay que poder hacer—.
                //
                // De alto, **toda la fila**: la cabecera mide cuarenta y cuatro por
                // decisión ([adr/0031](../../docs/adr/0031-componer-es-un-banco-de-trabajo.md)),
                // y un botón más alto que su fila se comería los clics de lo que
                // hay debajo sin que se vea por qué. `self-stretch` y no un
                // número, que es lo que pide la regla de los 44 px para este
                // caso: el control mide lo que mide su sitio.
                className="hover:text-brass-bright inline-flex min-w-11 cursor-pointer items-center justify-center self-stretch"
              >
                <Chevron className={`size-3 ${pliegue === 'vertical' ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
        </header>
      )}

      {/* Columna flexible y no un bloque: lo que va dentro de un área suele ser
          una pieza que quiere ocupar el hueco —el lienzo del arreglo es un
          `grow`— y dentro de un bloque `grow` no significa nada, así que se
          quedaba con su alto natural y se salía por abajo. */}
      <div
        className={`flex min-h-0 grow flex-col ${scroll ? 'overflow-y-auto' : 'overflow-hidden'} ${
          recienDesplegada ? 'motion-safe:animate-desplegar' : ''
        }`}
      >
        {children}
      </div>
    </section>
  );
}
