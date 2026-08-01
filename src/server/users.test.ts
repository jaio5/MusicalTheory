import { describe, expect, it } from 'vitest';

import { normalizeEmail } from './users';

/**
 * Solo se prueba la normalización: lo demás de este fichero es SQL, y probar SQL
 * sin base de datos es probar el simulacro. Lo que sí es lógica —y lo que causa el
 * error más caro, dos cuentas para la misma persona— está aquí.
 */
describe('normalizar el correo', () => {
  it('lo deja en minúsculas y sin espacios alrededor', () => {
    expect(normalizeEmail('  Javier@Example.COM ')).toBe('javier@example.com');
  });

  // Quien escribe `Javier@…` al registrarse escribe `javier@…` al entrar. Sin
  // normalizar, son dos cuentas distintas y la segunda parece que no existe.
  it('la misma dirección escrita de dos formas da lo mismo', () => {
    expect(normalizeEmail('JAVIER@EXAMPLE.COM')).toBe(normalizeEmail('javier@example.com'));
  });

  it('rechaza lo que no puede ser un correo', () => {
    for (const raro of [
      '',
      'javier',
      'javier@',
      '@example.com',
      'javier@example',
      'javier@example.',
      'javier @example.com',
      'javier@exa mple.com',
      null,
      42,
      undefined,
    ]) {
      expect(normalizeEmail(raro), String(raro)).toBeNull();
    }
  });

  it('acepta las direcciones con puntos y con más de un nivel de dominio', () => {
    expect(normalizeEmail('javier.barcelo@correo.uva.es')).toBe('javier.barcelo@correo.uva.es');
  });

  // La comprobación es de mínimos a propósito: una expresión regular exhaustiva
  // rechaza direcciones válidas y no evita ninguna falsa. Lo que comprueba que un
  // correo existe es escribirle.
  it('no se pone a inventar reglas: un signo raro pero legal pasa', () => {
    expect(normalizeEmail('javier+guitarra@example.com')).toBe('javier+guitarra@example.com');
  });

  it('rechaza los que se pasan de largo', () => {
    expect(normalizeEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });
});
