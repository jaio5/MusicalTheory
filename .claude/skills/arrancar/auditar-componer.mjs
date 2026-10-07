/**
 * Pasa `sonda-de-componer.mjs` por los estados y los tamaños que enseñan algo, y
 * deja el resultado en un JSON para poder comparar el antes con el después.
 *
 *   node .claude/skills/arrancar/auditar-componer.mjs [destino.json]
 *
 * Necesita `pnpm dev` levantado —`DATABASE_URL= pnpm dev`— y el Playwright
 * global de nvm, que es el que hay en este equipo. Contra `pnpm start` en otro
 * puerto, `RAIZ=http://localhost:3210`.
 *
 * **Los tamaños no son los extremos, son los dos lados de cada corte**: 640 y
 * 768 son donde esta aplicación cambia de navegación, y lo que se rompe se
 * rompe ahí. Lo aprendió a base de perder el botón de la cuenta en la franja de
 * la tableta, y está contado en `SKILL.md`.
 */
import { writeFileSync } from 'node:fs';

import { chromium } from '/home/javie/.nvm/versions/node/v24.15.0/lib/node_modules/playwright/index.mjs';

import { MEDIDAS } from './sonda-de-componer.mjs';
import { SONDA } from './sonda-de-medidas.mjs';

const RAIZ = process.env['RAIZ'] ?? 'http://localhost:3000';
const DESTINO = process.argv[2] ?? 'componer-medido.json';

const TAMANOS = [
  { nombre: 'movil', ancho: 320, alto: 568 },
  { nombre: 'movil-alto', ancho: 390, alto: 844 },
  { nombre: 'tableta', ancho: 700, alto: 600 },
  { nombre: 'portatil', ancho: 1024, alto: 600 },
  { nombre: 'escritorio', ancho: 1440, alto: 900 },
];

/**
 * Pulsa algo y **anota si no pudo**.
 *
 * Esto es la mitad del valor de la sonda. Tragándose los fallos, los seis
 * escenarios del teléfono salían idénticos y parecían medidos: lo que pasaba es
 * que ninguna tonalidad se dejaba pulsar porque la rueda flotante las tapa, que
 * es justo el fallo que había que encontrar. Un montaje que falla en silencio
 * mide la pantalla de partida seis veces y lo llama seis casos.
 */
const pulsar = async (page, nombre, log) => {
  const loc = page.getByRole('button', { name: nombre, exact: true });
  const cuantos = await loc.count();
  // **El primero que se deje, y se anota cuántos había.** De «C mayor» hay tres
  // copias en pantalla y una está `inert` adrede, porque la rueda flotante la
  // tapa. Pulsando siempre la última, la sonda medía el estado de partida y lo
  // llamaba un caso montado.
  for (let i = 0; i < cuantos; i++) {
    try {
      await loc.nth(i).click({ timeout: 1200 });
      await page.waitForTimeout(150);
      log.push({ paso: nombre, pudo: true, copias: cuantos, cual: i });
      return true;
    } catch {
      /* La siguiente copia. */
    }
  }
  log.push({ paso: nombre, pudo: false, copias: cuantos, porque: 'ninguna copia se dejo pulsar' });
  return false;
};

const ponerTonalidad = (page, log) => pulsar(page, 'C mayor', log);

/**
 * Abre un área **como se abre en ese ancho**.
 *
 * En ancho cada área tiene su «Desplegar …»; en estrecho no hay nada que
 * desplegar, porque las áreas son pestañas —se ve una cada vez— y la tonalidad no
 * es un área sino la barra flotante. Pidiendo el botón de escritorio en todos los
 * tamaños, el teléfono y la tableta salían con dos pasos rotos que no lo estaban:
 * el gesto no existe ahí. Se anota como que no aplica, no como que no se pudo.
 */
const abrirArea = async (page, titulo, log) => {
  const desplegar = page.getByRole('button', { name: `Desplegar ${titulo}`, exact: true });
  if ((await desplegar.count()) > 0) {
    return pulsar(page, `Desplegar ${titulo}`, log);
  }
  const pestana = page.getByRole('button', { name: titulo, exact: true });
  if ((await pestana.count()) > 0) {
    return pulsar(page, titulo, log);
  }
  log.push({ paso: `Abrir ${titulo}`, pudo: true, noAplica: 'en este ancho no es un area' });
  return true;
};

/**
 * Pulsa un panel de la bandeja de abajo **donde esté en ese ancho**.
 *
 * En ancho es una pastilla suelta de la fila de abajo; en un teléfono la bandeja
 * se pliega a «Más» (adr/0065) y el panel vive dentro de ese `popover`. Buscando
 * siempre la pastilla suelta, el teléfono y la tableta salían con tres casos rotos
 * que no lo estaban.
 */
const abrirDeLaBandeja = async (page, nombre, log) => {
  const suelto = page.getByRole('button', { name: nombre, exact: true });
  if ((await suelto.count()) > 0 && (await suelto.first().isVisible())) {
    return pulsar(page, nombre, log);
  }
  const mas = page.getByRole('button', { name: 'Más', exact: true });
  if ((await mas.count()) > 0) {
    await mas
      .first()
      .click({ timeout: 1200 })
      .catch(() => {});
    await page.waitForTimeout(150);
  }
  return pulsar(page, nombre, log);
};

const ponerAcordes = async (page, log) => {
  // **El lienzo llega después que la pantalla** (adr/0058): se descarga aparte, y
  // buscando sus acordes en cuanto se abre no había ninguno y los cuatro se
  // anotaban como no puestos, quince casos rotos que no lo estaban. Se espera a
  // la paleta; si no llega, lo dirá el primer acorde.
  await page
    .getByRole('button', { name: /^C, I\b/ })
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  for (const grado of ['C, I', 'F, IV', 'G, V', 'Am, vi']) {
    const loc = page.getByRole('button', {
      name: new RegExp(`^${grado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
    });
    const cuantos = await loc.count();
    let puesto = false;
    for (let i = 0; i < cuantos && !puesto; i++) {
      try {
        await loc.nth(i).click({ timeout: 1200 });
        await page.waitForTimeout(150);
        puesto = true;
      } catch {
        /* La siguiente copia. */
      }
    }
    log.push({ paso: `acorde ${grado}`, pudo: puesto, copias: cuantos });
  }
};

const ESCENARIOS = [
  {
    nombre: 'tocando-sin-tonalidad',
    cuenta: 'Recien abierto, que es lo primero que ve alguien nuevo',
    montar: async () => {},
  },
  {
    nombre: 'tocando',
    cuenta: 'Con la tonalidad puesta, en el espacio de tocar',
    montar: async (page, log) => {
      await ponerTonalidad(page, log);
    },
  },
  {
    nombre: 'escribir-vacio',
    cuenta: 'A punto de escribir el primer acorde',
    montar: async (page, log) => {
      await ponerTonalidad(page, log);
      await pulsar(page, 'Escribir', log);
    },
  },
  {
    nombre: 'escribir-con-acordes',
    cuenta: 'Cuatro acordes escritos: el caso normal',
    montar: async (page, log) => {
      await ponerTonalidad(page, log);
      await pulsar(page, 'Escribir', log);
      await ponerAcordes(page, log);
    },
  },
  {
    nombre: 'escribir-todo-abierto',
    cuenta: 'Las cinco areas abiertas y el mastil fuera: el peor reparto',
    montar: async (page, log) => {
      await ponerTonalidad(page, log);
      await pulsar(page, 'Escribir', log);
      await ponerAcordes(page, log);
      await abrirArea(page, 'Tonalidad', log);
      await abrirArea(page, 'A dónde ir', log);
      await abrirDeLaBandeja(page, 'Mástil', log);
    },
  },
  {
    nombre: 'ensayar',
    cuenta: 'Con la cancion escrita, listo para ensayarla',
    montar: async (page, log) => {
      await ponerTonalidad(page, log);
      await pulsar(page, 'Escribir', log);
      await ponerAcordes(page, log);
      await pulsar(page, 'Ensayar', log);
    },
  },
];

const nav = await chromium.launch();
const medido = { cuando: new Date().toISOString(), casos: [] };

for (const tam of TAMANOS) {
  for (const esc of ESCENARIOS) {
    const ctx = await nav.newContext({ viewport: { width: tam.ancho, height: tam.alto } });
    // El recorrido de la primera visita sale encima en un contexto nuevo: se marca
    // como visto, o las medidas serían las de la tarjeta y su trozo de código.
    await ctx.addInitScript(() => localStorage.setItem('caos-ordenado:recorrido', 'visto'));
    const page = await ctx.newPage();
    const fallos = [];
    page.on('pageerror', (e) => fallos.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') fallos.push(m.text().slice(0, 120));
    });
    await page.goto(`${RAIZ}/componer`, { waitUntil: 'networkidle' });
    const log = [];
    await esc.montar(page, log);
    await page.waitForTimeout(300);
    const medidas = await page.evaluate(MEDIDAS);
    const recortado = await page.evaluate(SONDA);
    const montaje = { pasos: log, roto: log.filter((l) => !l.pudo) };
    medido.casos.push({
      tamano: tam.nombre,
      escenario: esc.nombre,
      montaje,
      ...medidas,
      recortado,
      fallos,
    });
    await ctx.close();
  }
}

await nav.close();
writeFileSync(DESTINO, JSON.stringify(medido, null, 1));

// ---- Lo que se lee en el terminal -------------------------------------------

const pad = (s, n) => String(s).padEnd(n);
const dec = (caso) => {
  const d = caso.documento;
  if (d === null) return '—';
  const peor = caso.ayudaMasAlta;
  const mal = peor !== null && peor.alto > d.alto;
  return `${pad(d.nombre, 8)} ${pad(`${d.alto}px`, 7)} ${pad(`${caso.documentoPct}%`, 5)} ${
    mal ? `< ${peor.nombre} ${peor.alto}px` : 'manda'
  }`;
};

console.log('\n== MONTAJE: pasos que la sonda no pudo dar (un caso roto no se mide) ==\n');
for (const caso of medido.casos) {
  if (caso.montaje.roto.length === 0) continue;
  console.log(
    `${pad(caso.tamano, 12)} ${pad(caso.escenario, 24)} ${caso.montaje.roto.length}/${
      caso.montaje.pasos.length
    } sin poder: ${caso.montaje.roto
      .map((r) => r.paso)
      .join(', ')
      .slice(0, 70)}`,
  );
}

console.log('\n== EL REPARTO: cuanto se lleva la cancion frente a la ayuda mas alta ==\n');
for (const caso of medido.casos) {
  const roto = caso.montaje.roto.length > 0 ? '  ← montaje roto' : '';
  console.log(`${pad(caso.tamano, 12)} ${pad(caso.escenario, 24)} ${dec(caso)}${roto}`);
}

console.log('\n== VACIO del area principal, mandos a la vista y cuantos por encima ==\n');
for (const caso of medido.casos) {
  console.log(
    `${pad(caso.tamano, 12)} ${pad(caso.escenario, 24)} vacio ${pad(
      caso.vacio === null ? '—' : `${caso.vacio.vacioPct}%`,
      5,
    )} mandos ${pad(caso.mandosVisibles, 4)} encima ${caso.encimaDelDocumento ?? '—'}`,
  );
}

console.log('\n== LO PEQUENO DE PULSAR: por debajo de 44 px ==\n');
for (const caso of medido.casos) {
  if (caso.pequenos.length === 0) continue;
  console.log(
    `${pad(caso.tamano, 12)} ${pad(caso.escenario, 24)} ${caso.pequenos.length}: ${caso.pequenos
      .map((m) => `${m.nombre} ${m.ancho}x${m.alto}`)
      .join(', ')
      .slice(0, 80)}`,
  );
}

console.log('\n== DUPLICADOS: mismo nombre, a la vez, en pantalla ==\n');
for (const caso of medido.casos) {
  if (caso.duplicados.length === 0) continue;
  const total = caso.duplicados.reduce((n, d) => n + d.veces - 1, 0);
  console.log(
    `${pad(caso.tamano, 12)} ${pad(caso.escenario, 24)} ${total} de mas: ${caso.duplicados
      .map((d) => `${d.nombre} x${d.veces}`)
      .join(', ')
      .slice(0, 90)}`,
  );
}

console.log('\n== ALCANCE: candidatos a tapado. Se confirman mirando, no valen solos ==\n');
for (const caso of medido.casos) {
  const tapados = caso.alcance.filter((a) => a.estado === 'tapado');
  const fuera = caso.alcance.filter((a) => a.estado !== 'tapado');
  if (tapados.length === 0 && caso.recortado.length === 0) continue;
  console.log(
    `${pad(caso.tamano, 12)} ${pad(caso.escenario, 24)} tapados ${pad(tapados.length, 3)} fuera ${pad(
      fuera.length,
      3,
    )} recortados ${caso.recortado.length}`,
  );
  for (const t of tapados.slice(0, 4))
    console.log(`${' '.repeat(14)}  «${t.nombre}» lo tapa «${t.por}»`);
}

const conFallos = medido.casos.filter((c) => c.fallos.length > 0);
console.log(`\n== CONSOLA ==\n\n${conFallos.length === 0 ? 'Sin errores en ningun caso.' : ''}`);
for (const c of conFallos) console.log(`${c.tamano}/${c.escenario}: ${c.fallos[0]}`);

console.log(`\nMedido en ${DESTINO}\n`);
