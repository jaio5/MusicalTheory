import { describe, expect, it } from 'vitest';

import { cifra, cifraConSigno, cifraCorta, enLista, enPulsos, veces } from './cifras';

describe('cifra', () => {
  it('escribe con coma decimal', () => {
    expect(cifra(329.63, 1)).toBe('329,6');
  });

  it('sin decimales por defecto, y sin separador de miles', () => {
    expect(cifra(1200.4)).toBe('1200');
  });

  it('el cero negativo sale sin signo', () => {
    expect(cifra(-0.04, 1)).toBe('0,0');
  });
});

describe('cifraConSigno', () => {
  it('lo que sube lleva más', () => {
    expect(cifraConSigno(3.24, 1)).toBe('+3,2');
  });

  it('lo que baja lleva el signo de restar, no el guion', () => {
    expect(cifraConSigno(-1.2)).toBe('−1');
  });

  it('lo que se redondea a cero no lleva signo', () => {
    expect(cifraConSigno(-0.04, 1)).toBe('0,0');
    expect(cifraConSigno(0.3)).toBe('0');
  });
});

describe('cifraCorta', () => {
  it('sin decimales de relleno, con coma y hasta dos', () => {
    expect(cifraCorta(4)).toBe('4');
    expect(cifraCorta(0.5)).toBe('0,5');
    expect(cifraCorta(2.75)).toBe('2,75');
    expect(cifraCorta(1 / 3)).toBe('0,33');
    expect(cifraCorta(-0.001)).toBe('0');
  });
});

describe('enPulsos', () => {
  // El lector de pantalla decía «1 pulsos» en cada negra de la partitura.
  it('con su singular', () => {
    expect(enPulsos(1)).toBe('1 pulso');
    expect(enPulsos(2)).toBe('2 pulsos');
    expect(enPulsos(0.5)).toBe('0,5 pulsos');
  });
});

describe('veces', () => {
  it('una en letra y las demás en cifra', () => {
    expect(veces(1)).toBe('una vez');
    expect(veces(2)).toBe('2 veces');
    expect(veces(0)).toBe('0 veces');
  });
});

describe('enLista', () => {
  it('con la «y» delante de la última, y sin nada si es una', () => {
    expect(enLista(['el 3'])).toBe('el 3');
    expect(enLista(['el 3', 'el 19'])).toBe('el 3 y el 19');
    expect(enLista(['el 3', 'el 19', 'el 23'])).toBe('el 3, el 19 y el 23');
  });
});
