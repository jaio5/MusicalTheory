/**
 * ¿Sigue reconociendo acordes con la CPU de un teléfono de gama media?
 *
 * El [ROADMAP](../../../docs/ROADMAP.md) lo tiene apuntado y nunca se había
 * medido: los números del análisis salen de un sobremesa, y un teléfono anda
 * entre cinco y diez veces por detrás. Y el análisis en vivo va **en el hilo
 * principal** ([adr/0003](../../../docs/adr/0003-analisis-en-el-hilo-principal.md)),
 * así que si la CPU no da, lo que se pierde no es fluidez: son acordes.
 *
 * Se mide tocando de verdad —un WAV por el micrófono falso— y contando **qué
 * acordes escribió la aplicación**, que es lo único que le importa a quien
 * compone. No milisegundos: aciertos.
 *
 *     node .claude/skills/arrancar/gama-media.mjs acordes.wav
 *
 * El freno se pone con `Emulation.setCPUThrottlingRate` de Chrome DevTools, que
 * es el mismo que usa el panel de rendimiento: 1 es este equipo, 4 un teléfono
 * decente y 6 uno modesto.
 */
import { chromium } from '/home/javie/.nvm/versions/node/v24.15.0/lib/node_modules/playwright/index.mjs';

const WAV = process.argv[2];
const RAIZ = 'http://localhost:3000';
const FRENOS = [1, 4, 6, 10, 20];
/**
 * Lo que trae el WAV, para poder decir cuántos de cuántos.
 *
 * **El fichero se repite en bucle**, así que grabando más segundos de los que
 * dura vuelven a sonar los primeros: sobra un acorde al final y no es un fallo.
 */
const ESPERADOS = ['C', 'F', 'G', 'Am'];

if (WAV === undefined) {
  console.error('falta el WAV: node gama-media.mjs acordes.wav');
  process.exit(1);
}

const pulsa = async (page, nombre) => {
  const loc = page.getByRole('button', { name: nombre, exact: true });
  for (let i = 0; i < (await loc.count()); i++) {
    try {
      await loc.nth(i).click({ timeout: 1500 });
      await page.waitForTimeout(200);
      return true;
    } catch {
      /* la siguiente copia */
    }
  }
  return false;
};

const nav = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});

console.log(`\nGama media · ${ESPERADOS.join(' ')} por el micro falso\n`);

for (const freno of FRENOS) {
  const ctx = await nav.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
  });
  const page = await ctx.newPage();
  const fallos = [];
  page.on('pageerror', (e) => fallos.push(e.message.slice(0, 80)));

  await page.goto(`${RAIZ}/componer`, { waitUntil: 'networkidle' });
  await pulsa(page, 'C mayor');
  await pulsa(page, 'Tocando');

  // El freno se pone **después de cargar**: frenar la carga mide otra cosa
  // —cuánto tarda en arrancar— y lo que se busca aquí es si oye bien.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: freno });

  const empezo = Date.now();
  await pulsa(page, 'Tocar');
  await page.waitForTimeout(9000);
  await pulsa(page, 'Parar y escribirlo');
  await page.waitForTimeout(1500);
  const segundos = ((Date.now() - empezo) / 1000).toFixed(1);

  // Se leen de «Lo que ya llevas», que es la lista que el propio espacio de
  // tocar enseña al parar. Mirando los bloques del lienzo no se ve nada: al
  // parar se sigue en «Tocando» y el lienzo ni está montado. Costó una pasada
  // en falso con tres ceros que parecían una medida.
  const oidos = await page.evaluate(() => {
    const lista = document.querySelector('ol[aria-label="Lo que ya llevas"]');
    return lista === null
      ? []
      : [...lista.querySelectorAll('li')].map((li) => li.textContent?.trim() ?? '');
  });

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const aciertos = ESPERADOS.filter((esperado) => oidos.includes(esperado)).length;
  console.log(
    `freno ×${freno}  escribió ${String(oidos.length).padStart(2)} acordes  ` +
      `acierta ${aciertos}/${ESPERADOS.length}  (${segundos}s)  ` +
      `${oidos.join(' ') || '—'}${fallos.length > 0 ? `  · ${fallos[0]}` : ''}`,
  );
  await ctx.close();
}

await nav.close();
console.log(
  '\nSi el número de aciertos cae al frenar, el reconocimiento no aguanta un teléfono modesto.\n',
);
