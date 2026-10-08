import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { levantarBaseDePrueba, type BaseDePrueba } from './db/para-tests';
import type * as Users from './users';

/**
 * Entrar con un correo que no existe tarda lo mismo que con uno que sí.
 *
 * Sin la contraseña cifrada que no es de nadie, entrar con un correo desconocido
 * contesta en un milisegundo y con uno conocido tarda cien: la diferencia se mide
 * desde fuera y regala una lista de quién tiene cuenta aquí. `auth.test.ts`
 * comprueba con un espía que se llama a `igualarCoste`; esto comprueba que de
 * verdad iguala, y por eso mide reloj y corre aparte (adr/0121).
 *
 * Auth.js no se ejecuta: se queda con la configuración que recibe `NextAuth` y se
 * llama a su `authorize` a mano, como en `auth.test.ts`.
 */

let configuracion: Record<string, never>;

vi.mock('next-auth', () => ({
  default: (config: Record<string, never>) => {
    configuracion = config;
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() };
  },
  CredentialsSignin: class extends Error {
    code = 'credentials';
  },
}));

vi.mock('next-auth/providers/credentials', () => ({
  default: (opciones: unknown) => opciones,
}));

let base: BaseDePrueba;
let users: typeof Users;

beforeAll(async () => {
  base = await levantarBaseDePrueba();
  process.env['AUTH_SECRET'] = 'un-secreto-de-prueba-con-largo-de-sobra';
  await import('./auth');
  users = await import('./users');
});

afterAll(async () => {
  delete process.env['AUTH_SECRET'];
  await base.cerrar();
});

function autorizar(credenciales: Record<string, unknown>) {
  const proveedor = (
    configuracion['providers'] as unknown as { authorize: (raw: unknown) => Promise<unknown> }[]
  )[0]!;
  return proveedor.authorize(credenciales);
}

async function tarda(hacer: () => Promise<unknown>): Promise<number> {
  const inicio = performance.now();
  await hacer();
  return performance.now() - inicio;
}

it('un correo desconocido tarda lo mismo que uno conocido', async () => {
  await users.createUser({ mayorDe14: true, email: 'a@b.c', password: 'unaContrasenaLarga' });

  const conocido = await tarda(() => autorizar({ email: 'a@b.c', password: 'mal' }));
  const desconocido = await tarda(() => autorizar({ email: 'nadie@b.c', password: 'mal' }));

  // El margen es holgado a propósito y aun así pilla los dos órdenes de magnitud
  // que hay entre comprobar un `scrypt` y no comprobar nada.
  expect(desconocido).toBeGreaterThan(conocido / 5);
});
