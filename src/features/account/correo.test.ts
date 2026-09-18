import { describe, expect, it } from 'vitest';

import { pareceUnCorreo } from './correo';

/**
 * La regla mínima del correo.
 *
 * Existe porque el navegador ya lo comprobaba **y lo decía en inglés**. Lo que
 * se prueba aquí no es que acierte siempre —eso no lo puede saber nadie sin
 * mandar un mensaje— sino que **no rechaza direcciones legales**, que es la
 * manera de que una comprobación de formulario haga más daño que bien.
 */
describe('si un correo lo parece', () => {
  it('uno normal pasa', () => {
    expect(pareceUnCorreo('alguien@ejemplo.com')).toBe(true);
    expect(pareceUnCorreo('  alguien@ejemplo.com  ')).toBe(true);
  });

  // Direcciones raras pero válidas: rechazarlas es dejar a alguien fuera de su
  // propia cuenta por una regla inventada.
  it('las raras pero legales tambien', () => {
    expect(pareceUnCorreo('a+etiqueta@sub.dominio.co.uk')).toBe(true);
    expect(pareceUnCorreo("o'brien@ejemplo.es")).toBe(true);
    expect(pareceUnCorreo('a_b-c.d@ejemplo.museum')).toBe(true);
  });

  it('lo que seguro esta mal, no', () => {
    expect(pareceUnCorreo('noesuncorreo')).toBe(false);
    expect(pareceUnCorreo('sin@dominio')).toBe(false);
    expect(pareceUnCorreo('@ejemplo.com')).toBe(false);
    expect(pareceUnCorreo('dos@arrobas@ejemplo.com')).toBe(false);
    expect(pareceUnCorreo('con espacio@ejemplo.com')).toBe(false);
    expect(pareceUnCorreo('punto@ejemplo.')).toBe(false);
    expect(pareceUnCorreo('')).toBe(false);
  });
});
