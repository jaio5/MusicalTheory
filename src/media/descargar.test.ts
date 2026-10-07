// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { descargarBytes, descargarUrl, TIPO_MIDI } from './descargar';

describe('Descargar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('le pide al navegador que guarde una url con su nombre', () => {
    const click = vi.fn();
    const enlace = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(enlace);

    descargarUrl('blob:loquesea', 'toma.webm');

    expect(enlace.href).toBe('blob:loquesea');
    expect(enlace.download).toBe('toma.webm');
    expect(click).toHaveBeenCalledOnce();
  });

  /**
   * **Y suelta la url después.** Una url de objeto retiene los bytes hasta que
   * se revoca: sin esto, cada descarga deja el fichero entero en memoria hasta
   * que se recarga la página.
   */
  it('envuelve unos bytes y suelta la url', () => {
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement);
    const crear = vi.fn(() => 'blob:midi');
    const soltar = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: crear, revokeObjectURL: soltar });

    descargarBytes(Uint8Array.from([1, 2, 3]), 'cancion.mid', TIPO_MIDI);

    expect(crear).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(soltar).toHaveBeenCalledWith('blob:midi');
  });

  /** Y la suelta también si el clic revienta, que para eso está el `finally`. */
  it('suelta la url aunque la descarga falle', () => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(_: string) {
        throw new Error('sin permiso');
      },
    } as unknown as HTMLAnchorElement);
    const soltar = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: soltar });

    expect(() => descargarBytes(Uint8Array.from([1]), 'x.mid', TIPO_MIDI)).toThrow('sin permiso');
    expect(soltar).toHaveBeenCalledWith('blob:x');
  });
});
