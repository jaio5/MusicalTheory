import { describe, expect, it } from 'vitest';

import { scryptSync } from 'node:crypto';

import { HASH_DE_NADIE, hashPassword, necesitaRecifrar, verifyPassword } from './password';

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

    expect(stored.startsWith('scrypt$16384$8$5$')).toBe(true);
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
      // Parámetros que revientan a `scrypt` por dentro: un coste absurdo pide
      // más memoria de la que hay, y eso lanza en vez de devolver un hash.
      'scrypt$1073741824$8$1$c2Fs$aGFzaA==',
      // Y un `n` que no es potencia de dos, que también lanza.
      'scrypt$3$8$1$c2Fs$aGFzaA==',
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

  /*
    Los parámetros de OWASP (`N=2^14, r=8, p=5`), y lo que hay alrededor de
    subirlos: lo guardado con los de antes sigue valiendo, se sabe que hay que
    volver a cifrarlo, y la cuenta que no existe tarda lo que tarda una de hoy.
  */
  it('cifra con una de las combinaciones de OWASP', async () => {
    const [, n, r, p] = (await hashPassword('cualquiera')).split('$').map(Number);
    // Las cinco de la hoja de OWASP cuestan lo mismo: N·r·p = 2^17 · 8.
    expect((n ?? 0) * (r ?? 0) * (p ?? 0)).toBeGreaterThanOrEqual(2 ** 17 * 8 * 0.6);
    expect(r).toBe(8);
  });

  it('lo cifrado con los parámetros viejos sigue entrando, y pide recifrarse', async () => {
    const sal = Buffer.from('una sal de prueb');
    const clave = scryptSync('la de siempre', sal, 64, { N: 16_384, r: 8, p: 1 });
    const viejo = ['scrypt', 16_384, 8, 1, sal.toString('base64'), clave.toString('base64')].join(
      '$',
    );

    await expect(verifyPassword('la de siempre', viejo)).resolves.toBe(true);
    expect(necesitaRecifrar(viejo)).toBe(true);
    expect(necesitaRecifrar(await hashPassword('la de siempre'))).toBe(false);
  });

  it('una fila sin formato no se recifra: no se ha podido comprobar', () => {
    expect(necesitaRecifrar('vaya')).toBe(false);
  });

  it('el hash de nadie lleva los parámetros de hoy, y no entra con nada', async () => {
    // Es lo que iguala el tiempo de un correo que no existe con el de uno que sí:
    // con los parámetros viejos escritos a mano, igualaba el de una cuenta vieja.
    const hoy = (await hashPassword('x')).split('$').slice(0, 4).join('$');
    expect(HASH_DE_NADIE.startsWith(`${hoy}$`)).toBe(true);
    expect(necesitaRecifrar(HASH_DE_NADIE)).toBe(false);
    await expect(verifyPassword('', HASH_DE_NADIE)).resolves.toBe(false);
  });
});
