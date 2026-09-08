/**
 * Deja la base de datos con cuatro cuentas de prueba y nada más.
 *
 * **Borra todas las cuentas.** No es un `TRUNCATE` de la base entera: se vacía
 * `users`, y las demás tablas se van solas porque todas cuelgan de ella con
 * `onDelete: 'cascade'` —el avance, el gasto de IA, los vales de contraseña y
 * las canciones—. Lo que no cuelga de una cuenta, como los topes por dirección
 * IP, se queda: no es de nadie.
 *
 * La contraseña se cifra con `server/password.ts`, el mismo código que usa la
 * aplicación al registrarte. Escribir aquí un hash a mano daría cuentas que
 * existen y con las que no se puede entrar, que es la peor de las dos cosas.
 *
 * Node ejecuta este fichero tal cual, quitándole los tipos al vuelo, y para eso
 * el import tiene que llevar la extensión `.ts` escrita. De ahí el
 * `allowImportingTsExtensions` del `tsconfig.json`, que solo vale porque aquí
 * `tsc` nunca emite: comprueba y calla.
 *
 * Se ejecuta con `pnpm usuarios:prueba -- --si`. Sin `--si` no borra nada: un
 * script que vacía cuentas no puede dispararse por darle a la flecha arriba en
 * la terminal.
 */
import postgres from 'postgres';

import { hashPassword } from '../src/server/password.ts';

/** Lo que se crea. Una por plan, para poder mirar los candados desde dentro. */
const CUENTAS = [
  { email: 'gratis@prueba.local', name: 'Prueba Gratis', plan: 'gratis' },
  { email: 'basico@prueba.local', name: 'Prueba Basico', plan: 'basico' },
  { email: 'medio@prueba.local', name: 'Prueba Medio', plan: 'medio' },
  { email: 'pro@prueba.local', name: 'Prueba Pro', plan: 'pro' },
] as const;

/** La misma para todas: son de prueba y hay que poder teclearlas. */
const CONTRASENA = 'prueba1234';

const url = process.env.DATABASE_URL;
if (url === undefined || url === '') {
  console.error('No hay DATABASE_URL. Levanta Postgres con `pnpm docker:db`.');
  process.exit(1);
}

/*
 * El seguro: solo contra una base de datos de este equipo.
 *
 * Este script borra cuentas, y la diferencia entre la de desarrollo y una de
 * verdad es una variable de entorno que se cambia sin querer. Si algún día hay
 * una base publicada, que este script no pueda ni rozarla.
 */
const anfitrion = new URL(url).hostname;
if (anfitrion !== 'localhost' && anfitrion !== '127.0.0.1') {
  console.error(`Esto solo corre contra tu equipo, y DATABASE_URL apunta a "${anfitrion}".`);
  process.exit(1);
}

if (!process.argv.includes('--si')) {
  console.error('Esto BORRA todas las cuentas. Si es lo que quieres: pnpm usuarios:prueba -- --si');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const [antes] = await sql`select count(*)::int as total from users`;
  console.log(`Cuentas antes: ${antes?.total ?? 0}`);

  // `delete` y no `truncate`: `truncate` no dispara las claves ajenas en cascada
  // salvo que se le nombren todas las tablas, y entonces hay que acordarse de
  // añadir cada tabla nueva aquí. Con `delete` la cascada la lleva el esquema.
  await sql`delete from users`;
  console.log('Borradas todas las cuentas, y con ellas su avance y sus canciones.');

  for (const cuenta of CUENTAS) {
    const passwordHash = await hashPassword(CONTRASENA);
    await sql`
      insert into users (email, name, password_hash, plan)
      values (${cuenta.email}, ${cuenta.name}, ${passwordHash}, ${cuenta.plan})
    `;
    console.log(`  creada  ${cuenta.email.padEnd(24)} plan ${cuenta.plan}`);
  }

  const [despues] = await sql`select count(*)::int as total from users`;
  console.log(`\nCuentas ahora: ${despues?.total ?? 0}. La contraseña de todas: ${CONTRASENA}`);
} finally {
  await sql.end();
}
