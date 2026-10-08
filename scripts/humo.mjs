/**
 * El humo: cada ruta pública, contra el servidor de producción, en tres anchos.
 *
 * Lo que mira es lo que ningún test de componentes ve, porque solo pasa con la
 * aplicación compilada y en un navegador de verdad: que la página **conteste
 * 200**, que **no escriba errores en la consola** —una hidratación que no cuadra,
 * un módulo que no carga— y que **no deje nada fuera de alcance**, que es lo que
 * busca la sonda de `arrancar` (`sonda-de-medidas.mjs`).
 *
 * Los tres anchos son el teléfono, la tableta justo en el punto donde cambia la
 * navegación (`md`, adr/0084) y el portátil. Es pequeño a propósito: corre en
 * cada empujón, y lo que mide a fondo los tamaños es la sonda de la skill.
 *
 * Se arranca contra un servidor ya levantado, el mismo que se publica —la salida
 * standalone, con sus estáticos al lado como en el `Dockerfile`—, sin base de
 * datos: la aplicación funciona sin ella y así se prueba también eso.
 *
 *     pnpm build && cp -r .next/static .next/standalone/.next/static
 *     HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js &
 *     HUMO_URL=http://127.0.0.1:3000 node scripts/humo.mjs
 */

import { chromium } from 'playwright';

import { SONDA } from '../.claude/skills/arrancar/sonda-de-medidas.mjs';

const BASE = process.env['HUMO_URL'] ?? 'http://127.0.0.1:3000';

const RUTAS = [
  '/',
  '/aprender',
  '/aprender/e1-grados',
  '/aprender/repaso',
  '/componer',
  '/afinar',
  '/profesor',
  '/planes',
  '/planes/basico',
  '/registro',
  '/cuenta',
  '/olvidada',
  '/privacidad',
  '/aviso-legal',
];

const ANCHOS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

/**
 * Lo que se espera tras el `load` a que la consola hable: la hidratación y los
 * efectos del primer pintado escriben sus errores justo después.
 *
 * Antes se esperaba a `networkidle`, que son quinientos milisegundos sin una
 * petición **por ruta y en serie**: catorce rutas por tres anchos, veintiún
 * segundos de esperar a nada. Esto espera lo justo para que un error de
 * hidratación llegue, y los tres anchos van a la vez.
 */
const ESPERA_A_LA_CONSOLA_MS = 300;

/** Las rutas a un ancho, una detrás de otra, con lo que falle en cada una. */
async function recorrer(navegador, tamano) {
  const fallos = [];
  const contexto = await navegador.newContext({ viewport: tamano });
  try {
    for (const ruta of RUTAS) {
      const donde = `${ruta} a ${tamano.width} px`;
      const pagina = await contexto.newPage();
      const errores = [];
      pagina.on('console', (mensaje) => {
        if (mensaje.type() === 'error') {
          errores.push(mensaje.text());
        }
      });
      pagina.on('pageerror', (error) => errores.push(error.message));

      const respuesta = await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'load' });
      await pagina.waitForTimeout(ESPERA_A_LA_CONSOLA_MS);
      const estado = respuesta?.status() ?? 0;
      if (estado !== 200) {
        fallos.push(`${donde}: contesta ${estado}`);
      }
      for (const error of errores) {
        fallos.push(`${donde}: error en la consola: ${error}`);
      }
      for (const problema of await pagina.evaluate(SONDA)) {
        fallos.push(`${donde}: ${problema.tipo} ${JSON.stringify(problema)}`);
      }
      await pagina.close();
    }
  } finally {
    await contexto.close();
  }
  return fallos;
}

const navegador = await chromium.launch();
let fallos;
try {
  // Un contexto por ancho y los tres a la vez; cada uno devuelve sus fallos y se
  // juntan en el orden de `ANCHOS`, así que el informe sale igual en cada pasada.
  fallos = (await Promise.all(ANCHOS.map((tamano) => recorrer(navegador, tamano)))).flat();
} finally {
  await navegador.close();
}

if (fallos.length > 0) {
  console.error(fallos.join('\n'));
  process.exit(1);
}
console.log(
  `${RUTAS.length} rutas a ${ANCHOS.length} anchos: todas en 200, sin errores y sin nada fuera de alcance.`,
);
