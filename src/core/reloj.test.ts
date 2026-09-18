import { describe, expect, it } from 'vitest';

import { reloj } from './reloj';

describe('el reloj de una toma', () => {
  it('escribe minutos y segundos con dos cifras', () => {
    expect(reloj(0)).toBe('0:00');
    expect(reloj(9)).toBe('0:09');
    expect(reloj(75)).toBe('1:15');
    expect(reloj(600)).toBe('10:00');
  });

  // Los milisegundos de una grabación no vienen redondos, y un «0:7.5» en
  // pantalla se lee como un error de la aplicación.
  it('redondea lo que le llegue con decimales', () => {
    expect(reloj(7.5)).toBe('0:08');
    expect(reloj(59.4)).toBe('0:59');
  });

  // Una duración negativa no existe, pero un reloj que la pinte tampoco ayuda.
  it('nada por debajo de cero', () => {
    expect(reloj(-3)).toBe('0:00');
  });
});
