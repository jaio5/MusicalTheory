// @vitest-environment jsdom
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEnLinea } from './use-en-linea';

function Estado() {
  return <p>{useEnLinea() ? 'con red' : 'sin red'}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * El servidor no sabe si quien abre la página tiene red, y lo que pinta tiene
 * que coincidir con la primera pintura del cliente: supone que sí, y el aviso
 * llega después si hace falta.
 */
describe('si hay red, en el servidor', () => {
  it('supone que sí, aunque el navegador diga que no', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    expect(renderToString(<Estado />)).toContain('con red');
  });
});
