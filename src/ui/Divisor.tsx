'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * El divisor entre dos áreas del banco de trabajo.
 *
 * **Seis píxeles de agarre y uno pintado.** Es la medida que hace que se pueda
 * coger sin apuntar y que no se vea una barra gorda entre dos cosas: lo que se
 * ve es el mismo borde de 1 px que separa todo lo demás en esta aplicación, y lo
 * que se toca es una franja invisible alrededor.
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
  readonly onCambio: (rem: number) => void;
  readonly onDevolver: () => void;
  /** Para esconderlo donde no hay banco: en estrecho las áreas se apilan. */
  readonly className?: string;
}) {
  const arrastre = useRef<{ desde: number; valor: number } | null>(null);

  // El rem de verdad y no 16 a secas: quien haya subido el tamaño de letra del
  // navegador arrastraría a otra velocidad que la que ve moverse.
  function remEnPx(): number {
    if (typeof document === 'undefined') {
      return 16;
    }
    const raiz = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Number.isFinite(raiz) && raiz > 0 ? raiz : 16;
  }

  function empezar(evento: ReactPointerEvent<HTMLDivElement>): void {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrastre.current = {
      desde: orientacion === 'vertical' ? evento.clientX : evento.clientY,
      valor,
    };
  }

  function mover(evento: ReactPointerEvent<HTMLDivElement>): void {
    const desde = arrastre.current;
    if (desde === null) {
      return;
    }
    const ahora = orientacion === 'vertical' ? evento.clientX : evento.clientY;
    const enRem = ((ahora - desde.desde) / remEnPx()) * sentido;
    onCambio(Math.min(max, Math.max(min, desde.valor + enRem)));
  }

  function soltar(evento: ReactPointerEvent<HTMLDivElement>): void {
    arrastre.current = null;
    evento.currentTarget.releasePointerCapture(evento.pointerId);
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
      {/* La franja que se agarra: invisible, centrada sobre la línea y más
          ancha que ella. Al pasar por encima, la línea se enciende: es lo que
          dice que esto se puede coger, sin dibujar un asa. */}
      <span
        aria-hidden="true"
        className={`group-hover:bg-brass-dim absolute ${
          vertical ? 'inset-y-0 -left-[3px] w-[7px]' : 'inset-x-0 -top-[3px] h-[7px]'
        }`}
      />
    </div>
  );
}
