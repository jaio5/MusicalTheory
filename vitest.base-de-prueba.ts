/**
 * La base de los tests, migrada **una vez por pasada** y no una por fichero.
 *
 * Cada fichero con base levantaba su PGlite desde cero: `initdb` dentro del
 * WebAssembly y las ocho migraciones. Lo caro no son las migraciones —30 ms— sino
 * el `initdb`, que tarda 1,7 s solo y pasa de 10 s con la máquina cargada: siete
 * ficheros arrancándolo a la vez se comían su `beforeAll` y la suite se caía por
 * tiempo dos pasadas de cada tres, con 163 tests sin correr (adr/0121).
 *
 * Aquí se hace una vez y se guarda el directorio de datos ya migrado en un
 * fichero; cada fichero lo carga con `loadDataDir` (`server/db/para-tests.ts`),
 * que tarda 0,3 s. Cada uno sigue teniendo **su** base, sin compartir filas.
 *
 * El volcado se guarda con la huella de las migraciones y de la versión de
 * PGlite: una migración nueva o una subida de PGlite hacen otro, y uno viejo no
 * se usa nunca. Si la huella coincide, ni siquiera se vuelve a migrar.
 *
 * **Las migraciones son las del repositorio**, leídas de `drizzle/`, no un
 * esquema escrito a mano: si fueran dos cosas, una migración mal escrita pasaría
 * los tests y reventaría al desplegar.
 *
 * Con `BASE_DE_PRUEBA_URL` no hace nada: la base es un Postgres de verdad que la
 * integración continua migra antes, como lo haría el contenedor de migraciones.
 */

import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

const MIGRACIONES = fileURLToPath(new URL('./drizzle', import.meta.url));
const CACHE = fileURLToPath(new URL('./node_modules/.cache/caos-ordenado', import.meta.url));

function ficherosDeMigracion(): string[] {
  return readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** Lo que, si cambia, hace que el volcado guardado ya no valga. */
function huella(): string {
  const hash = createHash('sha256');
  const pglite = JSON.parse(
    readFileSync(
      new URL('./node_modules/@electric-sql/pglite/package.json', import.meta.url),
      'utf8',
    ),
  ) as { version: string };
  hash.update(pglite.version);
  for (const fichero of ficherosDeMigracion()) {
    hash.update(fichero);
    hash.update(readFileSync(`${MIGRACIONES}/${fichero}`));
  }
  return hash.digest('hex').slice(0, 16);
}

async function migrarYVolcar(destino: string): Promise<void> {
  const cliente = new PGlite();
  try {
    for (const fichero of ficherosDeMigracion()) {
      const sql = readFileSync(`${MIGRACIONES}/${fichero}`, 'utf8');
      // Drizzle separa las sentencias de una migración con esta marca.
      for (const sentencia of sql.split('--> statement-breakpoint')) {
        const limpia = sentencia.trim();
        if (limpia !== '') {
          await cliente.exec(limpia);
        }
      }
    }
    const volcado = await cliente.dumpDataDir('none');
    // Primero a un nombre propio y luego se renombra: dos proyectos de Vitest
    // pueden llegar aquí a la vez, y renombrar es atómico; escribir no.
    const temporal = `${destino}.${process.pid}.tmp`;
    writeFileSync(temporal, Buffer.from(await volcado.arrayBuffer()));
    renameSync(temporal, destino);
  } finally {
    await cliente.close();
  }
}

export default async function prepararLaBase(proyecto: TestProject): Promise<void> {
  if (process.env['BASE_DE_PRUEBA_URL']) {
    return;
  }
  mkdirSync(CACHE, { recursive: true });
  const ruta = `${CACHE}/base-migrada-${huella()}.tar`;
  if (!existsSync(ruta)) {
    await migrarYVolcar(ruta);
  }
  proyecto.provide('baseMigrada', ruta);
}
