/**
 * El rol con el que se conecta la aplicación: lee y escribe filas, y nada más.
 *
 * **Lo corre el contenedor de las migraciones, justo después de migrar**, con el
 * superusuario de Postgres, y es el único sitio donde se usa ese superusuario.
 * La aplicación entra con este otro rol, que no puede crear ni borrar tablas, ni
 * leer ficheros del servidor con `COPY … FROM`, ni crear roles, ni saltarse
 * nada: si alguien encontrara una inyección de SQL, se quedaría en las filas de
 * nuestras tablas en vez de en la máquina entera (docs/adr/0117).
 *
 * Es idempotente y se corre en **cada** arranque, no solo al crear la base, por
 * dos razones: las tablas que traiga una migración nueva necesitan su permiso, y
 * una base creada antes de que existiera este rol —la de cualquier equipo donde
 * ya se hubiera levantado compose— lo recibe sin borrar nada. Un script de
 * `docker-entrypoint-initdb.d` solo corre con el volumen vacío, y por eso no vale.
 *
 * `.mjs` y no TypeScript porque corre en la etapa de construcción de la imagen
 * con `node` a secas, sin los alias ni el cargador de `scripts/`.
 */

import postgres from 'postgres';

const url = process.env['DATABASE_URL'];
const usuario = process.env['POSTGRES_APP_USER'] || 'caos_app';
const clave = process.env['POSTGRES_APP_PASSWORD'];

if (!url || !clave) {
  console.error(
    'Faltan DATABASE_URL o POSTGRES_APP_PASSWORD: sin ellas no se puede dar de alta el rol de la aplicación.',
  );
  process.exit(1);
}

// El nombre va pegado en el SQL —un rol no se puede pasar como parámetro—, así
// que solo se admite lo que Postgres acepta sin comillas.
if (!/^[a-z_][a-z0-9_]{0,62}$/.test(usuario)) {
  console.error(`POSTGRES_APP_USER no es un nombre de rol válido: ${usuario}`);
  process.exit(1);
}

/** Un literal de texto de SQL: la comilla simple se dobla y ya no cierra nada. */
const literal = (texto) => `'${texto.replaceAll("'", "''")}'`;
/** Un identificador entre comillas dobles, por si la base lleva mayúsculas. */
const nombre = (texto) => `"${texto.replaceAll('"', '""')}"`;

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  const [{ base, yo }] = await sql`select current_database() as base, current_user as yo`;
  if (yo === usuario) {
    // Sería darle a la aplicación el superusuario con otro nombre.
    throw new Error(
      `POSTGRES_APP_USER (${usuario}) no puede ser el mismo que el de las migraciones.`,
    );
  }

  await sql.begin(async (tx) => {
    const existe = await tx`select 1 from pg_roles where rolname = ${usuario}`;
    if (existe.length === 0) {
      await tx.unsafe(`create role ${usuario} login`);
    }
    // Todo lo que no necesita, dicho en voz alta: si el rol ya existía con más
    // poderes, se le quitan aquí.
    await tx.unsafe(
      `alter role ${usuario} with login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password ${literal(clave)}`,
    );
    await tx.unsafe(`grant connect on database ${nombre(base)} to ${usuario}`);
    await tx.unsafe(`grant usage on schema public to ${usuario}`);
    await tx.unsafe(
      `grant select, insert, update, delete on all tables in schema public to ${usuario}`,
    );
    await tx.unsafe(`grant usage, select on all sequences in schema public to ${usuario}`);
    // Y lo que creen migraciones futuras hechas desde fuera de compose —un
    // `pnpm db:migrate` contra esta base—, que no pasarían por este script.
    await tx.unsafe(
      `alter default privileges in schema public grant select, insert, update, delete on tables to ${usuario}`,
    );
    await tx.unsafe(
      `alter default privileges in schema public grant usage, select on sequences to ${usuario}`,
    );
  });

  console.log(`Rol ${usuario} al día: lee y escribe filas, y nada más.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
