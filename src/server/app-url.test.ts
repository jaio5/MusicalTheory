import { afterEach, describe, expect, it } from 'vitest';

import { appUrl } from './app-url';

/**
 * Dónde vive esta copia, vista desde fuera.
 *
 * Cuatro líneas con un test porque el fallo que evita ya ocurrió: la variable se
 * leía en dos sitios —el vuelta de la pasarela y el enlace del correo—, uno le
 * quitaba la barra final y el otro no, y salían enlaces con doble barra que
 * algunos clientes de correo parten por la mitad.
 */

const antes = process.env['APP_URL'];

afterEach(() => {
  if (antes === undefined) {
    delete process.env['APP_URL'];
  } else {
    process.env['APP_URL'] = antes;
  }
});

describe('la dirección de la aplicación', () => {
  it('sin configurar, se supone el equipo de quien desarrolla', () => {
    // En producción eso manda a la gente a su propio ordenador, y está dicho en
    // `docs/DESPLIEGUE.md`. Fallar al arrancar sería peor: dejaría sin
    // aplicación a quien solo quiere el afinador, que no necesita nada de esto.
    delete process.env['APP_URL'];

    expect(appUrl()).toBe('http://localhost:3000');
  });

  it('vacía es como no estar', () => {
    process.env['APP_URL'] = '';

    expect(appUrl()).toBe('http://localhost:3000');
  });

  it('la barra final se quita siempre', () => {
    process.env['APP_URL'] = 'https://caos.example/';

    expect(appUrl()).toBe('https://caos.example');
  });

  it('y si no la lleva, se deja como está', () => {
    process.env['APP_URL'] = 'https://caos.example';

    expect(appUrl()).toBe('https://caos.example');
  });
});
