/**
 * Cuánto JavaScript descarga cada ruta, de verdad.
 *
 * Nació de un fallo que **ningún test veía y que no se lee en el código**: las
 * ocho rutas descargaban exactamente los mismos chunks, así que el afinador
 * —seis cuerdas y una aguja— se traía el lienzo de componer entero, el grabado
 * de partituras y el temario. La causa era un barril, `app/screens/index.ts`,
 * del que cada página importaba la suya: con `export *`, pedir una pantalla las
 * trae las nueve.
 *
 * Los tests, los tipos y las capas de ESLint estaban todos en verde, porque
 * ninguno de los tres mira lo que acaba viajando por el cable. Esto sí.
 *
 * ## Cómo se usa
 *
 * Hace falta **un servidor de producción**, no `pnpm dev`: en desarrollo no hay
 * ni división de chunks ni minificado, y los números no significan nada.
 *
 * ```bash
 * pnpm build
 * PORT=3210 DATABASE_URL= pnpm start &
 * node .claude/skills/arrancar/peso-de-las-rutas.mjs
 * ```
 *
 * ## Qué mira, y qué no
 *
 * `transferSize` es lo que viaja comprimido, cabeceras incluidas, que es lo que
 * paga quien abre la página. No es el tamaño del fichero en disco.
 *
 * La portada pesa más que ninguna y **está bien**: son los 471 KB del vídeo, no
 * código. Por eso la media va en columna aparte.
 */

import { chromium } from '/home/javie/.nvm/versions/node/v24.15.0/lib/node_modules/playwright/index.mjs';

const BASE = process.env['BASE'] ?? 'http://localhost:3210';

const RUTAS = [
  '/',
  '/componer',
  '/aprender',
  '/aprender/e1-grados',
  '/aprender/repaso',
  '/afinar',
  '/profesor',
  '/planes',
  '/registro',
];

/**
 * Cadenas que solo existen en una pantalla, para poder preguntar si viajan a
 * otra. **Es la comprobación que de verdad vale**: un número que sube puede ser
 * una función nueva, pero «el afinador se descarga el lienzo de componer» es un
 * fallo sin discusión.
 */
const NO_DEBERIA_VIAJAR = {
  '/afinar': ['Añadir otra parte', 'Pídeme una idea'],
  '/planes': ['Añadir otra parte'],
  '/registro': ['Añadir otra parte'],
  // Componer suma al avance, pero no enseña el temario: los títulos de las
  // unidades llegan con el `import()` del primer hecho, no con la pantalla.
  '/componer': ['Reconocer el I, el IV y el V'],
};

const kb = (bytes) => (bytes / 1024).toFixed(0).padStart(5);

const navegador = await chromium.launch();
console.log('ruta                  recursos    total       js    media    FCP');

for (const ruta of RUTAS) {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  const pagina = await contexto.newPage();

  // Los cuerpos se guardan para poder buscar dentro; con las cabeceras no basta
  // porque `content-length` no viene en las respuestas troceadas.
  const cuerpos = [];
  pagina.on('response', async (respuesta) => {
    if (respuesta.url().endsWith('.js')) {
      try {
        cuerpos.push(await respuesta.text());
      } catch {
        // Una respuesta que ya se cerró no se puede leer, y no pasa nada.
      }
    }
  });

  await pagina.goto(BASE + ruta, { waitUntil: 'networkidle' });

  const medida = await pagina.evaluate(() => {
    const recursos = performance.getEntriesByType('resource');
    const suma = (filtro) =>
      recursos.filter(filtro).reduce((total, r) => total + (r.transferSize || 0), 0);
    const navegacion = performance.getEntriesByType('navigation')[0];
    const pintado = performance
      .getEntriesByType('paint')
      .find((p) => p.name === 'first-contentful-paint');
    return {
      n: recursos.length,
      total: suma(() => true) + (navegacion?.transferSize ?? 0),
      js: suma((r) => r.name.endsWith('.js')),
      media: suma((r) => /\.(mp4|webm|png|jpe?g|webp|avif|svg|woff2?)/.test(r.name)),
      fcp: pintado ? Math.round(pintado.startTime) : null,
    };
  });

  console.log(
    `${ruta.padEnd(21)} ${String(medida.n).padStart(4)}  ${kb(medida.total)}KB ${kb(medida.js)}KB ${kb(medida.media)}KB ${String(medida.fcp).padStart(5)}ms`,
  );

  const todo = cuerpos.join('\n');
  for (const frase of NO_DEBERIA_VIAJAR[ruta] ?? []) {
    if (todo.includes(frase)) {
      console.log(`   ⚠ se descarga «${frase}», que no es de esta pantalla`);
      // Falla, y no solo avisa: saliendo con cero, un aviso entre veinte líneas
      // de cifras pasó por bueno la primera vez que volvió el temario a componer.
      process.exitCode = 1;
    }
  }

  await contexto.close();
}

await navegador.close();
