/**
 * Enseña a Node a leer `src/` como lo lee el resto del proyecto.
 *
 * `usuarios-de-prueba.ts` importa un solo fichero, y le basta con escribir la
 * extensión. El examen del profesor importa la ruta entera —el prompt, el
 * contrato, el dominio y el modelo de casa—, y ahí dentro los imports van **sin
 * extensión y con alias** (`@core/music`, `./notes`), que es lo que entienden
 * Next, Vitest y `tsc` y no Node. Copiar esos ficheros con otra forma de importar
 * sería examinar otro programa.
 *
 * Se carga antes que el script, con `--import`, porque los `import` de arriba de
 * un módulo se resuelven antes de ejecutar una sola línea suya: registrado desde
 * el propio examen llegaría tarde.
 */
import { statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);

/** Los mismos alias de `tsconfig.json`, en el mismo orden: `@/` va el último. */
const ALIAS: ReadonlyArray<readonly [string, string]> = [
  ['@core/', 'core/'],
  ['@audio/', 'audio/'],
  ['@media/', 'media/'],
  ['@server/', 'server/'],
  ['@state/', 'state/'],
  ['@features/', 'features/'],
  ['@ui/', 'ui/'],
  ['@/', ''],
];

function esFichero(ruta: string): boolean {
  try {
    return statSync(ruta).isFile();
  } catch {
    return false;
  }
}

registerHooks({
  resolve(especificador, contexto, siguiente) {
    let destino = especificador;
    for (const [alias, carpeta] of ALIAS) {
      if (destino.startsWith(alias)) {
        destino = new URL(carpeta + destino.slice(alias.length), SRC).href;
        break;
      }
    }

    // Solo lo que es de este repositorio: un paquete de `node_modules` lo
    // resuelve Node como siempre.
    if (destino.startsWith('.') || destino.startsWith('file:')) {
      const base = fileURLToPath(new URL(destino, contexto.parentURL));
      for (const candidato of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (esFichero(candidato)) {
          return siguiente(pathToFileURL(candidato).href, contexto);
        }
      }
    }
    return siguiente(especificador, contexto);
  },
});
