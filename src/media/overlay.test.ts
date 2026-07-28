import { describe, expect, it } from 'vitest';

import { formatCents, formatElapsed, overlayLines } from './overlay';
import { FORMAT_CANDIDATES, pickFormat, recordingFilename } from './recording-format';

const LAYOUT = { width: 1280, height: 720 };

const FULL = {
  noteName: 'La',
  cents: 7,
  keyName: 'La menor',
  chordSymbol: 'Am',
  elapsedMs: 65_000,
};

describe('formato del tiempo', () => {
  it('cuenta minutos y segundos', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9_000)).toBe('0:09');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(600_000)).toBe('10:00');
  });

  it('no cuenta hacia atrás', () => {
    expect(formatElapsed(-500)).toBe('0:00');
  });
});

describe('formato de los cents', () => {
  it('lleva el signo delante', () => {
    expect(formatCents(7)).toBe('+7 cents');
    expect(formatCents(-7)).toBe('-7 cents');
    expect(formatCents(0)).toBe('0 cents');
  });

  it('no escribe nada si no hay dato', () => {
    expect(formatCents(null)).toBe('');
  });
});

describe('líneas del overlay', () => {
  it('pinta nota, tonalidad, acorde y tiempo', () => {
    const lines = overlayLines(FULL, LAYOUT);
    const texts = lines.map((line) => line.text);

    expect(texts).toContain('La menor · Am');
    expect(texts.some((text) => text.startsWith('La'))).toBe(true);
    expect(texts).toContain('1:05');
  });

  it('destaca la nota sobre lo demás', () => {
    const lines = overlayLines(FULL, LAYOUT);
    const note = lines.find((line) => line.emphasis);

    expect(note).toBeDefined();
    expect(note!.fontSize).toBeGreaterThan(lines.filter((line) => !line.emphasis)[0]!.fontSize);
  });

  it('omite lo que no hay en vez de dejar huecos', () => {
    const lines = overlayLines(
      { noteName: null, cents: null, keyName: null, chordSymbol: null, elapsedMs: 0 },
      LAYOUT,
    );

    // Solo queda el tiempo.
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe('0:00');
  });

  it('escala con el tamaño del lienzo', () => {
    const small = overlayLines(FULL, { width: 640, height: 360 });
    const big = overlayLines(FULL, { width: 2560, height: 1440 });

    expect(big[0]!.fontSize).toBeGreaterThan(small[0]!.fontSize);
  });

  it('deja el tiempo pegado a la derecha y lo demás a la izquierda', () => {
    const lines = overlayLines(FULL, LAYOUT);
    const time = lines.find((line) => line.text === '1:05')!;
    const note = lines.find((line) => line.emphasis)!;

    expect(time.x).toBeGreaterThan(LAYOUT.width / 2);
    expect(note.x).toBeLessThan(LAYOUT.width / 2);
  });

  it('no se sale del lienzo', () => {
    for (const line of overlayLines(FULL, LAYOUT)) {
      expect(line.x).toBeGreaterThanOrEqual(0);
      expect(line.x).toBeLessThanOrEqual(LAYOUT.width);
      expect(line.y).toBeGreaterThanOrEqual(0);
      expect(line.y).toBeLessThanOrEqual(LAYOUT.height);
    }
  });
});

describe('negociación de formato', () => {
  it('se queda con el primero que acepte el navegador', () => {
    expect(pickFormat(() => true)?.mimeType).toBe('video/webm;codecs=vp9,opus');
  });

  it('cae al respaldo cuando el preferido no está', () => {
    const format = pickFormat((mimeType) => mimeType.startsWith('video/mp4'));
    expect(format?.extension).toBe('mp4');
  });

  it('devuelve null si no hay ninguno, en vez de fallar al grabar', () => {
    expect(pickFormat(() => false)).toBeNull();
  });

  it('todos los candidatos tienen extensión coherente con su tipo', () => {
    for (const candidate of FORMAT_CANDIDATES) {
      expect(candidate.mimeType).toContain(candidate.extension === 'webm' ? 'webm' : 'mp4');
    }
  });
});

describe('nombre del fichero', () => {
  it('lleva fecha, hora y la extensión que toca', () => {
    const format = { mimeType: 'video/webm', extension: 'webm' };
    const name = recordingFilename(format, new Date(2026, 6, 28, 19, 5));

    expect(name).toBe('caos-ordenado-2026-07-28-1905.webm');
  });
});
