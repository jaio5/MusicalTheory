import { describe, expect, it } from 'vitest';

import { errorDelMicro } from './error-del-micro';

/** Un error del navegador con su nombre, como los que lanza `getUserMedia`. */
function lanzado(nombre: string): Error {
  const error = new Error('x');
  error.name = nombre;
  return error;
}

describe('errorDelMicro', () => {
  it('el permiso denegado dice dónde se vuelve a dar: el candado', () => {
    for (const nombre of ['NotAllowedError', 'SecurityError']) {
      const { motivo, mensaje } = errorDelMicro(lanzado(nombre));
      expect(motivo).toBe('denegado');
      expect(mensaje).toMatch(/candado de la barra de direcciones/);
    }
  });

  it('sin micrófono no se confunde con el permiso', () => {
    for (const nombre of ['NotFoundError', 'OverconstrainedError']) {
      const { motivo, mensaje } = errorDelMicro(lanzado(nombre));
      expect(motivo).toBe('sin-micro');
      expect(mensaje).toMatch(/No encuentro ningún micrófono/);
    }
  });

  it('ocupado por otra aplicación', () => {
    expect(errorDelMicro(lanzado('NotReadableError')).motivo).toBe('ocupado');
  });

  it('lo demás, y lo que ni siquiera es un error, cae en el general', () => {
    expect(errorDelMicro(lanzado('AbortError')).motivo).toBe('otro');
    expect(errorDelMicro('raro').mensaje).toMatch(/Vuelve a pulsar/);
  });
});
