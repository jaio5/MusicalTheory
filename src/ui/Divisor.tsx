'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * El divisor entre dos áreas del banco de trabajo.
 *
 * **Veinticuatro píxeles de agarre y uno pintado.** Lo que se ve es el mismo
 * borde de 1 px que separa todo lo demás en esta aplicación, y lo que se toca es
 * una franja invisible alrededor. Eran siete, y siete es un blanco que con el
 * dedo no se acierta: la norma pide veinticuatro (WCAG 2.5.8), y aquí es lo
 * mínimo porque el banco también se usa en una tableta. La franja se come doce
 * píxeles del borde de cada área vecina, que es su relleno; donde el área tiene
 * barra de desplazamiento clásica, esa barra queda a medias bajo la franja, y se
 * acepta: el divisor se pone por encima porque sin él no hay reparto.
 *
 * **Y arrastrar no es la única manera** (WCAG 2.5.7): con el teclado se mueve de
 * rem en rem, y cada área del banco trae en su cabecera «Estrechar» y
 * «Ensanchar», que hacen lo mismo con un toque.
 *
 * **Se arrastra con Pointer Events y no con eventos de ratón.** Un `mousemove`
 * deja fuera el dedo y el lápiz, y perder el puntero al salirse del elemento
 * —que pasa siempre al arrastrar deprisa— obliga a escuchar en el documento y a
 * acordarse de dejar de escuchar. Con `setPointerCapture` los movimientos siguen
 * llegando aquí hasta que se suelta, y se sueltan solos.
 *
 * **Y se mueve con el teclado.** Un editor que solo se reparte con el ratón es
 * un editor a medias: las flechas mueven de rem en rem, `Inicio` devuelve la
 * medida de fábrica, y por eso esto es un `separator` con su valor y no un
 * `<div>` con un cursor bonito.
 *
 * El doble clic también devuelve la medida de fábrica, que es lo que hace
 * cualquier editor con áreas y lo que se intenta sin que nadie lo explique.
 */
export function Divisor({
  orientacion,
  valor,
  min,
  max,
  sentido = 1,
  etiqueta,
  onCambio,
  onArrastrar,
  onDevolver,
  className = '',
}: {
  readonly orientacion: 'vertical' | 'horizontal';
  /** Lo que mide ahora el área que este divisor manda, en rem. */
  readonly valor: number;
  readonly min: number;
  readonly max: number;
  /**
   * Hacia dónde crece el área al arrastrar hacia la derecha o hacia abajo.
   *
   * La columna de la izquierda crece arrastrando hacia la derecha (`1`); la de
   * la derecha y el área de abajo crecen al revés (`-1`).
   */
  readonly sentido?: 1 | -1;
  readonly etiqueta: string;
  /** Un cambio que se queda: una tecla, o el final de un arrastre. */
  readonly onCambio: (rem: number) => void;
  /**
   * Lo que va midiendo **mientras** se arrastra, si quien lo usa distingue.
   *
   * Existe por lo que costaba no distinguir: el banco guardaba el reparto en
   * `localStorage` —leer las preferencias enteras, mezclar y escribirlas— en cada
   * movimiento del puntero, que son sesenta por segundo. Con esto se mueve en
   * memoria y se guarda una vez, al soltar, con `onCambio`. Sin él, cada
   * movimiento va a `onCambio`, como antes.
   */
  readonly onArrastrar?: (rem: number) => void;
  readonly onDevolver: () => void;
  /** Para esconderlo donde no hay banco: en estrecho las áreas se apilan. */
  readonly className?: string;
}) {
  /**
   * El gesto en curso: desde dónde, con qué valor, cuánto mide un rem y lo último
   * que se ha movido.
   *
   * El rem se lee **una vez, al empezar**: es un `getComputedStyle`, que obliga
   * al navegador a tener los estilos al día, y se hacía en cada movimiento. El
   * tamaño de letra no cambia a mitad de un arrastre.
   */
  const arrastre = useRef<{
    desde: number;
    valor: number;
    rem: number;
    ultimo: number | null;
  } | null>(null);

  // El rem de verdad y no 16 a secas: quien haya subido el tamaño de letra del
  // navegador arrastraría a otra velocidad que la que ve moverse. Solo se llama
  // desde un `pointerdown`, así que siempre hay `document`.
  function remEnPx(): number {
    const raiz = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Number.isFinite(raiz) && raiz > 0 ? raiz : 16;
  }

  function empezar(evento: ReactPointerEvent<HTMLDivElement>): void {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrastre.current = {
      desde: orientacion === 'vertical' ? evento.clientX : evento.clientY,
      valor,
      rem: remEnPx(),
      ultimo: null,
    };
  }

  function mover(evento: ReactPointerEvent<HTMLDivElement>): void {
    const gesto = arrastre.current;
    if (gesto === null) {
      return;
    }
    const ahora = orientacion === 'vertical' ? evento.clientX : evento.clientY;
    const enRem = ((ahora - gesto.desde) / gesto.rem) * sentido;
    const siguiente = Math.min(max, Math.max(min, gesto.valor + enRem));
    gesto.ultimo = siguiente;
    (onArrastrar ?? onCambio)(siguiente);
  }

  function soltar(evento: ReactPointerEvent<HTMLDivElement>): void {
    const gesto = arrastre.current;
    arrastre.current = null;
    evento.currentTarget.releasePointerCapture(evento.pointerId);
    // Lo arrastrado se da por bueno al soltar, y solo si hubo arrastre y quien lo
    // usa lo va midiendo aparte: sin `onArrastrar`, `onCambio` ya se enteró.
    if (onArrastrar !== undefined && gesto?.ultimo !== null && gesto?.ultimo !== undefined) {
      onCambio(gesto.ultimo);
    }
  }

  const vertical = orientacion === 'vertical';

  return (
    <div
      role="separator"
      aria-orientation={orientacion}
      aria-label={etiqueta}
      aria-valuenow={Math.round(valor)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onDoubleClick={onDevolver}
      onKeyDown={(evento) => {
        const menos = vertical ? 'ArrowLeft' : 'ArrowUp';
        const mas = vertical ? 'ArrowRight' : 'ArrowDown';
        if (evento.key === menos || evento.key === mas) {
          evento.preventDefault();
          const paso = (evento.key === mas ? 1 : -1) * sentido;
          onCambio(Math.min(max, Math.max(min, valor + paso)));
          return;
        }
        if (evento.key === 'Home') {
          evento.preventDefault();
          onDevolver();
        }
      }}
      // `touch-action: none` es lo que impide que el navegador se lleve el
      // gesto como un desplazamiento en cuanto se arrastra con el dedo, y sin
      // él el divisor no se mueve en una tableta aunque todo lo demás esté bien.
      className={`group bg-border relative shrink-0 touch-none ${
        vertical ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'
      } focus-visible:bg-brass-bright focus-visible:outline-none ${className}`}
    >
      {/* La franja que se agarra: invisible, centrada sobre la línea y de
          veinticuatro píxeles. Encima de lo de al lado (`z-10`), porque se come
          el borde de las dos áreas vecinas y tiene que ganarles el puntero. */}
      <span
        aria-hidden="true"
        className={`absolute z-10 ${
          vertical ? 'inset-y-0 -left-[11.5px] w-6' : 'inset-x-0 -top-[11.5px] h-6'
        }`}
      />
      {/* Lo que se enciende al pasar por encima, y es lo que dice que esto se
          puede coger sin dibujar un asa. Tres píxeles y no la franja entera: se
          agarra ancho, pero no se pinta una barra gorda entre dos áreas. */}
      <span
        aria-hidden="true"
        className={`group-hover:bg-brass-dim pointer-events-none absolute ${
          vertical ? 'inset-y-0 -left-px w-[3px]' : 'inset-x-0 -top-px h-[3px]'
        }`}
      />
    </div>
  );
}
