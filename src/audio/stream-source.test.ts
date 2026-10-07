import { describe, expect, it } from 'vitest';

import { canShareStream } from './stream-source';

/**
 * Quién puede prestar su micrófono.
 *
 * Es lo que evita el segundo `getUserMedia`: la entrada de análisis ya tiene un
 * flujo abierto y se lo presta a quien grabe. Los dobles de los tests no lo
 * tienen, y entonces se abre el micrófono de `media/` como se hacía siempre, así
 * que esta pregunta tiene que contestar bien a las dos cosas.
 */
describe('si una entrada puede prestar su flujo', () => {
  it('lo puede quien tiene un flujo, aunque esté cerrado', () => {
    expect(canShareStream({ stream: null })).toBe(true);
    expect(canShareStream({ stream: {} as MediaStream })).toBe(true);
  });

  it('y no lo puede quien no lo tiene', () => {
    expect(canShareStream({})).toBe(false);
    expect(canShareStream(null)).toBe(false);
    expect(canShareStream(undefined)).toBe(false);
    expect(canShareStream('un micro')).toBe(false);
  });
});
