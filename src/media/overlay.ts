/**
 * El overlay que se quema en el vídeo: qué texto va y dónde.
 *
 * La composición decide posiciones sobre un lienzo de tamaño arbitrario, así
 * que todo se calcula en proporción. Es matemática y cadenas, sin canvas, para
 * poder probarlo.
 */

import type { OverlayFrame } from './session-recorder';

export interface OverlayLine {
  readonly text: string;
  /** Tamaño de fuente en píxeles, ya escalado al alto del lienzo. */
  readonly fontSize: number;
  readonly x: number;
  readonly y: number;
  readonly emphasis: boolean;
}

export interface OverlayLayout {
  readonly width: number;
  readonly height: number;
}

const MARGIN_RATIO = 0.04;
const BIG_RATIO = 0.09;
const SMALL_RATIO = 0.035;

export function formatElapsed(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** La desviación tal como se lee en pantalla, con signo. */
export function formatCents(cents: number | null): string {
  if (cents === null) {
    return '';
  }
  return `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents`;
}

/**
 * Las líneas que hay que pintar sobre el fotograma. Las que no tienen dato se
 * omiten en vez de dejar un hueco con un guion.
 */
export function overlayLines(frame: OverlayFrame, layout: OverlayLayout): OverlayLine[] {
  const margin = layout.height * MARGIN_RATIO;
  const big = layout.height * BIG_RATIO;
  const small = layout.height * SMALL_RATIO;

  const lines: OverlayLine[] = [];
  let y = layout.height - margin;

  const bottom = [frame.keyName, frame.chordSymbol].filter(
    (value): value is string => value !== null && value !== '',
  );
  if (bottom.length > 0) {
    lines.push({ text: bottom.join(' · '), fontSize: small, x: margin, y, emphasis: false });
    y -= small * 1.6;
  }

  if (frame.noteName !== null && frame.noteName !== '') {
    const cents = formatCents(frame.cents);
    lines.push({
      text: cents === '' ? frame.noteName : `${frame.noteName}  ${cents}`,
      fontSize: big,
      x: margin,
      y,
      emphasis: true,
    });
  }

  lines.push({
    text: formatElapsed(frame.elapsedMs),
    fontSize: small,
    x: layout.width - margin,
    y: margin + small,
    emphasis: false,
  });

  return lines;
}
