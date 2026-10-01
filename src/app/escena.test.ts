import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HOJA, LIENZO, SEGURO, TIRAS } from './escena-pixeles';

/**
 * Que la escena de la portada y lo que la describe no se separen.
 *
 * Las imágenes y `escena-pixeles.ts` los escribe `arte/portada/build.py`, y la
 * hoja de estilos se escribe a mano. Lo que hay que vigilar está entre los tres:
 * que cada imagen mida lo que dice el módulo, que cada tira tenga su animación,
 * que los cortes de escala dejen ver lo importante y que el lienzo cubra la caja
 * en todos ellos. Nada de esto falla al compilar ni en un test de componente: sale
 * en el navegador, como una franja negra o una tira que no se mueve.
 */

const AQUI = import.meta.dirname;
const HOJA_DE_ESTILOS = readFileSync(resolve(AQUI, 'escena-portada.css'), 'utf8');

/** El ancho y el alto de un PNG, leídos de su cabecera. */
function medidas(fichero: string): { ancho: number; alto: number } {
  const datos = readFileSync(resolve(AQUI, '_escena', fichero));
  return { ancho: datos.readUInt32BE(16), alto: datos.readUInt32BE(20) };
}

/** Una cifra de la hoja de estilos, declarada como `--nombre: valor;`. */
function cifra(nombre: string): number {
  const valor = new RegExp(`${nombre}: ([\\d.]+);`).exec(HOJA_DE_ESTILOS)?.[1];
  expect(valor, nombre).toBeDefined();
  return Number(valor);
}

/** El múltiplo que sale de la fórmula de la hoja: el mayor entero que cabe en los dos topes, y nunca menos de dos. */
function multiplo(ancho: number, alto: number, columnas: number, filas: number): number {
  return Math.max(2, Math.floor(Math.min(ancho / columnas, alto / filas)));
}

/** Lo que mide la línea más larga del titular, «Toca. Aprende.», en em de la letra de títulos. */
const LINEA_MAS_LARGA = 7.72;

describe('la escena de la portada', () => {
  it('las tres capas miden el lienzo, y la hoja lo que dice el módulo', () => {
    for (const capa of ['fondo.png', 'medio.png', 'frente.png']) {
      expect(medidas(capa), capa).toEqual(LIENZO);
    }
    expect(medidas('vida.png')).toEqual(HOJA);
  });

  /**
   * El vídeo eran 471 kB y el póster 57. La escena entera tiene que quedarse
   * muy por debajo de cien, y hoy son ocho: si esto falla, algo se ha guardado
   * sin paleta o con el tamaño de pantalla en vez del del dibujo.
   */
  it('pesa unas decenas de kilobytes como mucho', () => {
    const total = readdirSync(resolve(AQUI, '_escena')).reduce(
      (suma, fichero) => suma + statSync(resolve(AQUI, '_escena', fichero)).size,
      0,
    );

    expect(total).toBeLessThan(30 * 1024);
  });

  it('cada tira cabe en el lienzo y en la hoja', () => {
    for (const [nombre, tira] of Object.entries(TIRAS)) {
      expect(tira.x + tira.ancho, nombre).toBeLessThanOrEqual(LIENZO.ancho);
      expect(tira.y + tira.alto, nombre).toBeLessThanOrEqual(LIENZO.alto);
      expect(tira.ancho * tira.marcos, nombre).toBeLessThanOrEqual(HOJA.ancho);
      expect(tira.fila + tira.alto, nombre).toBeLessThanOrEqual(HOJA.alto);
    }
  });

  it('cada tira tiene su animación en la hoja de estilos', () => {
    for (const nombre of Object.keys(TIRAS)) {
      expect(HOJA_DE_ESTILOS, nombre).toContain(`[data-tira='${nombre}'] {\n    animation:`);
    }
  });

  /**
   * La sala a sangre, de pie: un teléfono o una tableta en vertical.
   *
   * La sala va abajo y centrada, así que lo importante tiene que caber entero de
   * lado a lado, con aire; y no puede llevarse la primera pantalla entera, que
   * encima va el titular. Se recorre una rejilla de anchos y altos de verdad.
   */
  it('de pie, lo importante cabe de lado a lado y deja sitio arriba', () => {
    const columnas = cifra('--sala-de-pie-ancho');
    const filas = cifra('--sala-de-pie-alto');
    expect(HOJA_DE_ESTILOS).toContain('100cqw / var(--sala-de-pie-ancho)');
    expect(HOJA_DE_ESTILOS).toContain('100svh / var(--sala-de-pie-alto)');

    for (let ancho = 320; ancho <= 1366; ancho += 2) {
      for (let alto = Math.max(ancho, 568); alto <= 1400; alto += 8) {
        const px = multiplo(ancho, alto, columnas, filas);
        expect(SEGURO.ancho * px, `${ancho}×${alto} a ${px}×`).toBeLessThanOrEqual(ancho);
        // Lo que reserva el hueco del texto: de la fila 20 al pie.
        expect((LIENZO.alto - 20) * px, `${ancho}×${alto}`).toBeLessThanOrEqual(alto * 0.6);
      }
    }
  });

  /**
   * Tumbada, de 640 a 2880 de ancho y entre el 4:3 y el 21:9: la sala a la
   * derecha y el titular en la pared de la izquierda.
   *
   * El lienzo no pasa del 68 % del ancho, que es lo que deja columna a las
   * letras. Por abajo, el múltiplo entero cobra su precio en los escalones: justo
   * antes de saltar de 2× a 3×, hacia los 950 píxeles, el lienzo ocupa un 45 %, y
   * en una ventana más apaisada que el 16:9, donde manda el alto, un 43 %. De ahí
   * el 42 %; hasta el 16:9 y desde 3× no baja de la mitad. Lo que se
   * corta por arriba y por abajo es pared y tarima, nunca lo importante. Y en la
   * columna que deja cabe «Toca. Aprende.» con la letra en su mínimo de dos rem.
   */
  it('tumbada, no pasa del 68 % y deja columna al titular', () => {
    const columnas = cifra('--sala-tumbada-ancho');
    const filas = cifra('--sala-tumbada-alto');
    const tapa = cifra('--sala-tapa');
    expect(tapa).toBe(LIENZO.ancho - SEGURO.x);
    expect(HOJA_DE_ESTILOS).toContain('100cqw / var(--sala-tumbada-ancho)');
    expect(HOJA_DE_ESTILOS).toContain('100svh / var(--sala-tumbada-alto)');

    for (let ancho = 640; ancho <= 2880; ancho += 4) {
      for (let alto = Math.max(360, Math.ceil(ancho / 2.4)); alto <= ancho * 0.75; alto += 8) {
        const px = multiplo(ancho, alto, columnas, filas);
        const donde = `${ancho}×${alto} a ${px}×`;
        expect((LIENZO.ancho * px) / ancho, donde).toBeLessThanOrEqual(0.68);
        expect((LIENZO.ancho * px) / ancho, donde).toBeGreaterThanOrEqual(
          px >= 3 && alto >= ancho * 0.5625 ? 0.5 : 0.42,
        );

        const cortadoPorLado = (LIENZO.alto * px - alto) / 2 / px;
        expect(cortadoPorLado, donde).toBeLessThanOrEqual(SEGURO.y / 2);

        // El margen y el hueco en su punto más ancho a ese ancho de pantalla.
        const margen = Math.min(120, 0.04 * ancho + 8);
        const hueco = Math.min(64, Math.max(16, 0.025 * ancho));
        const columna = ancho - tapa * px - hueco - margen;
        expect(columna, donde).toBeGreaterThanOrEqual(LINEA_MAS_LARGA * 32);
      }
    }
  });

  /**
   * El titular, al tamaño de su columna. Si alguien sube el 12,5 sin mirar, la
   * línea más larga deja de caber y el titular se parte por dentro de «Aprende».
   */
  it('el titular llena su columna sin salirse', () => {
    const porColumna = Number(/min\(([\d.]+)cqi,/.exec(HOJA_DE_ESTILOS)?.[1]);
    expect(porColumna * LINEA_MAS_LARGA, 'cqi').toBeLessThanOrEqual(100);
    expect(porColumna * LINEA_MAS_LARGA, 'cqi').toBeGreaterThanOrEqual(90);
  });

  /**
   * El hero es oscuro en los dos temas porque vuelve a declarar las variables
   * del oscuro. Si la paleta cambia en globals.css y aquí no, el titular sale
   * con un latón que ya no es el de la casa.
   */
  /**
   * El único color de esta hoja que no es de la paleta es el negro de la sala, y
   * lo es a propósito: es el de los cantos del dibujo, que se funden en él. Por
   * eso sale de `arte/portada/build.py` y no de tokens.ts, y aquí se vigila que
   * no se le sumen otros ni se copie a mano en otra regla, que el día que cambie
   * uno se separaría del otro.
   */
  it('fuera del escenario oscuro, el único color suelto es el negro de la sala', () => {
    const sinEscenario = HOJA_DE_ESTILOS.replace(/\.escenario-oscuro \{[^}]*\}/, '');
    const colores = [...sinEscenario.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([color]) => color);
    const dibujo = readFileSync(resolve(AQUI, '../../arte/portada/build.py'), 'utf8');
    const negro = /'negro': '(#[0-9A-Fa-f]{6})'/.exec(dibujo)?.[1]?.toLowerCase();

    expect(colores).toEqual([negro]);
    expect(HOJA_DE_ESTILOS).toContain(`--sala: ${negro};`);
  });

  it('el escenario oscuro usa los mismos colores que el tema oscuro', () => {
    const global = readFileSync(resolve(AQUI, 'globals.css'), 'utf8');
    const oscuro = global.split(":root[data-tema='oscuro'] {")[1]!.split('\n}')[0]!;
    const escenario = HOJA_DE_ESTILOS.split('.escenario-oscuro {')[1]!.split('\n}')[0]!;

    const crudas = [...escenario.matchAll(/(--[a-z-]+): (#[0-9a-f]{6});/g)];
    expect(crudas.length).toBeGreaterThanOrEqual(10);
    for (const [, nombre, valor] of crudas) {
      expect(oscuro, nombre).toContain(`${nombre}: ${valor};`);
    }
  });

  it('el píxel se pinta duro, y la vida solo se pide con la escena viva', () => {
    expect(HOJA_DE_ESTILOS.match(/image-rendering: pixelated/g)).toHaveLength(2);
    expect(HOJA_DE_ESTILOS).toContain(
      ".escena[data-viva] .escena-tira {\n  background-image: url('./_escena/vida.png');",
    );
  });

  /**
   * Todo lo que se mueve va dentro de `prefers-reduced-motion: no-preference`.
   * La regla general de globals.css lo frenaría igual, pero dejando el último
   * fotograma, y el del paralaje tiene la pared corrida.
   */
  it('no hay ninguna animación fuera del movimiento aceptado', () => {
    const fuera = HOJA_DE_ESTILOS.split('@media (prefers-reduced-motion: no-preference)')[0]!;

    expect(fuera).not.toMatch(/\banimation(-name)?:/);
  });
});
