import { afterEach, describe, expect, it } from 'vitest';

import { LARGO_MINIMO_DEL_SECRETO, avisoDeSecreto, secretoDeSesion } from './secreto';

const ANTES = process.env['AUTH_SECRET'];

afterEach(() => {
  if (ANTES === undefined) {
    delete process.env['AUTH_SECRET'];
  } else {
    process.env['AUTH_SECRET'] = ANTES;
  }
});

describe('el secreto de la sesión', () => {
  // Un secreto de una letra se adivina, y con él se falsifica la cookie y se
  // deshace el HMAC de los correos borrados: cuenta como ninguno.
  it('uno corto cuenta como ninguno, y se avisa al arrancar', () => {
    process.env['AUTH_SECRET'] = 'x';
    expect(secretoDeSesion()).toBeNull();
    expect(avisoDeSecreto()).toMatch(/1 caracteres y hacen falta al menos 32/);
  });

  it('uno largo vale y no avisa', () => {
    const largo = 'a'.repeat(LARGO_MINIMO_DEL_SECRETO);
    process.env['AUTH_SECRET'] = largo;
    expect(secretoDeSesion()).toBe(largo);
    expect(avisoDeSecreto()).toBeNull();
  });

  // Sin secreto no hay cuentas, y eso es una manera legítima de servirla.
  it('sin ninguno no hay cuentas, y no es un error', () => {
    delete process.env['AUTH_SECRET'];
    expect(secretoDeSesion()).toBeNull();
    expect(avisoDeSecreto()).toBeNull();
    process.env['AUTH_SECRET'] = '';
    expect(secretoDeSesion()).toBeNull();
    expect(avisoDeSecreto()).toBeNull();
  });
});
