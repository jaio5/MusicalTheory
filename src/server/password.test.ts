import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

/**
 * Estos tests tardan más que el resto —cada cifrado son unos cien milisegundos a
 * propósito— y aun así son de los que más importan: es lo único del proyecto donde
 * un fallo silencioso significa que las contraseñas de otros no están protegidas.
 */
describe('cifrado de contraseñas', () => {
  it('reconoce la contraseña buena', async () => {
    const stored = await hashPassword('la de siempre');

    await expect(verifyPassword('la de siempre', stored)).resolves.toBe(true);
  });

  it('rechaza cualquier otra', async () => {
    const stored = await hashPassword('la de siempre');

    await expect(verifyPassword('la de siempr', stored)).resolves.toBe(false);
    await expect(verifyPassword('La de siempre', stored)).resolves.toBe(false);
    await expect(verifyPassword('', stored)).resolves.toBe(false);
  });

  // Con sal distinta cada vez, dos cuentas con la misma contraseña no se
  // reconocen entre sí: es lo que impide sacar contraseñas comparando filas.
  it('cifra distinto la misma contraseña dos veces', async () => {
    const uno = await hashPassword('la misma');
    const otro = await hashPassword('la misma');

    expect(uno).not.toBe(otro);
    await expect(verifyPassword('la misma', uno)).resolves.toBe(true);
    await expect(verifyPassword('la misma', otro)).resolves.toBe(true);
  });

  it('guarda sus propios parámetros, para poder subirlos sin invalidar nada', async () => {
    const stored = await hashPassword('cualquiera');

    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(stored.split('$')).toHaveLength(6);
  });

  it('nunca guarda la contraseña', async () => {
    const stored = await hashPassword('secreto reconocible');

    expect(stored).not.toContain('secreto');
  });

  // Una fila estropeada no puede tirar la pantalla de entrar: es un no, no una
  // excepción.
  it('trata como no válido cualquier formato raro', async () => {
    for (const raro of [
      '',
      'vaya',
      'scrypt$16384$8$1$solo-cuatro-campos',
      'bcrypt$16384$8$1$c2Fs$aGFzaA==',
      'scrypt$muchas$8$1$c2Fs$aGFzaA==',
      'scrypt$16384$8$1$$',
    ]) {
      await expect(verifyPassword('cualquiera', raro)).resolves.toBe(false);
    }
  });

  /**
   * Dos formas de escribir la misma letra acentuada tienen que valer igual: el
   * teclado de un móvil y el de un portátil no siempre mandan la misma, y una
   * contraseña que funciona en un aparato y no en otro es indistinguible de una
   * contraseña perdida.
   */
  it('normaliza los acentos antes de cifrar', async () => {
    // Con escapes a propósito: escritas con la ñ tal cual, las dos cadenas
    // quedarían idénticas en el fichero y el test no probaría nada.
    const compuesta = 'can\u0303ada larga'; // n + tilde combinante
    const precompuesta = 'ca\u00f1ada larga'; // la ñ de una pieza
    expect(compuesta).not.toBe(precompuesta);

    const stored = await hashPassword(compuesta);

    await expect(verifyPassword(precompuesta, stored)).resolves.toBe(true);
  });
});
