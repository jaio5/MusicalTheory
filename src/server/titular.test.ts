import { afterEach, describe, expect, it, vi } from 'vitest';

import { loQueFalta, titular } from './titular';

/**
 * Los datos de quien publica, del entorno y nunca inventados.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('quién publica esta copia', () => {
  it('sin variables no hay nada, y se sabe qué falta', () => {
    for (const v of ['TITULAR_NOMBRE', 'TITULAR_NIF', 'TITULAR_DOMICILIO', 'TITULAR_CORREO']) {
      vi.stubEnv(v, '');
    }
    vi.stubEnv('TITULAR_ALOJAMIENTO', '   ');
    const datos = titular();

    expect(Object.values(datos).every((v) => v === null)).toBe(true);
    expect(loQueFalta(datos)).toEqual([
      'TITULAR_NOMBRE',
      'TITULAR_NIF',
      'TITULAR_DOMICILIO',
      'TITULAR_CORREO',
      'TITULAR_ALOJAMIENTO',
    ]);
  });

  it('con ellas, lo que dicen, sin espacios de sobra', () => {
    vi.stubEnv('TITULAR_NOMBRE', '  Ana Pérez ');
    vi.stubEnv('TITULAR_NIF', '00000000T');
    vi.stubEnv('TITULAR_DOMICILIO', 'Calle Mayor 1, Madrid');
    vi.stubEnv('TITULAR_CORREO', 'hola@ejemplo.test');
    vi.stubEnv('TITULAR_ALOJAMIENTO', 'Un proveedor, Alemania');

    expect(titular()).toEqual({
      nombre: 'Ana Pérez',
      nif: '00000000T',
      domicilio: 'Calle Mayor 1, Madrid',
      correo: 'hola@ejemplo.test',
      alojamiento: 'Un proveedor, Alemania',
    });
    expect(loQueFalta(titular())).toEqual([]);
  });
});
