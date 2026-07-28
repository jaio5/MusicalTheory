'use client';

import { useRef, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react';

/** Lo que se mueve con una pulsación de flecha. */
const STEP = 16;

export interface SplitterProps {
  /** Vertical separa columnas; horizontal separa la zona de abajo. */
  readonly orientation: 'vertical' | 'horizontal';
  readonly size: number;
  readonly min: number;
  readonly max: number;
  /** Hacia dónde crece la zona: 1 si crece con el ratón, -1 si al revés. */
  readonly direction: 1 | -1;
  readonly label: string;
  readonly onResize: (size: number) => void;
}

/**
 * La línea que separa dos zonas y deja cambiarles el tamaño.
 *
 * Se puede arrastrar y también mover con las flechas del teclado: es un control
 * de verdad, no un adorno, y quien no use ratón tiene que poder repartir la
 * pantalla igual.
 */
export function Splitter({
  orientation,
  size,
  min,
  max,
  direction,
  label,
  onResize,
}: SplitterProps) {
  const drag = useRef<{ origin: number; size: number } | null>(null);
  const vertical = orientation === 'vertical';

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    drag.current = { origin: vertical ? event.clientX : event.clientY, size };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = drag.current;
    if (start === null) {
      return;
    }
    const delta = (vertical ? event.clientX : event.clientY) - start.origin;
    onResize(start.size + delta * direction);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const grow = vertical ? 'ArrowRight' : 'ArrowDown';
    const shrink = vertical ? 'ArrowLeft' : 'ArrowUp';
    if (event.key !== grow && event.key !== shrink) {
      return;
    }
    event.preventDefault();
    onResize(size + (event.key === grow ? STEP : -STEP) * direction);
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      className={`bg-border hover:bg-brass focus-visible:bg-brass shrink-0 touch-none transition-colors ${
        vertical ? 'w-px cursor-col-resize hover:w-0.5' : 'h-px cursor-row-resize hover:h-0.5'
      }`}
    />
  );
}
