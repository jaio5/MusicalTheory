import { describe, expect, it } from 'vitest';

import { tlsPara } from './client';

/**
 * Hacia una base gestionada la conexión va cifrada y comprobando el
 * certificado; dentro del equipo o de compose, sin TLS, porque ahí no lo hay.
 *
 * Sin esto, la cadena que pegan Neon o Supabase —con `sslmode=require`— cifraba
 * sin comprobar a quién se hablaba: en postgres.js `require` no mira el
 * certificado, y quien se pusiera en medio se llevaba los hashes de todas las
 * contraseñas.
 */
describe('el cifrado hacia la base', () => {
  it('hacia fuera se comprueba el certificado', () => {
    expect(tlsPara('postgres://u:c@ep-algo.eu-central-1.aws.neon.tech/caos')).toBe('verify-full');
  });

  it('y el require que traen pegado los proveedores se endurece', () => {
    expect(tlsPara('postgres://u:c@db.proveedor.com/caos?sslmode=require')).toBe('verify-full');
  });

  it('lo que se escribe a proposito se respeta', () => {
    expect(tlsPara('postgres://u:c@10.0.0.5/caos?sslmode=disable')).toBeNull();
    expect(tlsPara('postgres://u:c@db.proveedor.com/caos?sslmode=verify-ca')).toBeNull();
  });

  it('dentro del equipo y de compose no hay certificado que pedir', () => {
    expect(tlsPara('postgres://caos:caos@localhost:5432/caos')).toBeNull();
    expect(tlsPara('postgres://caos:caos@127.0.0.1:5432/caos')).toBeNull();
    expect(tlsPara('postgres://caos:caos@[::1]:5432/caos')).toBeNull();
    expect(tlsPara('postgres://caos_app:x@db:5432/caos')).toBeNull();
    expect(tlsPara('postgres:///caos?host=/var/run/postgresql')).toBeNull();
  });

  it('una IP privada de otra maquina no cuenta como local', () => {
    expect(tlsPara('postgres://u:c@10.0.0.5/caos')).toBe('verify-full');
  });

  it('varios servidores no son una URL, y los lee postgres.js', () => {
    expect(tlsPara('no es una url')).toBeNull();
  });
});
