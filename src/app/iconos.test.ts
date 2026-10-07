import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Los iconos de la pestaña y de la pantalla de inicio.
 *
 * Los escribe `arte/mascota/iconos.py` con los píxeles del profesor, y Next los
 * convierte en sus etiquetas del `<head>` por el nombre y por lo que miden. Nada de
 * esto falla al compilar: un icono de 48 hecho de un dibujo de 32 sale borroso, y
 * uno con fondo transparente sale con un recuadro negro en un iPhone. Se ve en la
 * pestaña, no en un test de componente.
 */

const AQUI = import.meta.dirname;
const leer = (fichero: string) => readFileSync(resolve(AQUI, fichero));

describe('los iconos de la aplicación', () => {
  it('la pestaña es el profesor en SVG, nítido y con el contorno de cada tema', () => {
    const svg = leer('icon.svg').toString('utf8');

    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    // Sobre una barra de pestañas oscura, el contorno del tema claro desaparece.
    expect(svg).toMatch(/@media \(prefers-color-scheme:dark\)\{\.contorno\{fill:#[0-9A-F]{6}\}\}/);
  });

  it('el .ico lleva el dibujo solo a escala entera: 32 y 64', () => {
    const ico = leer('favicon.ico');
    // Cabecera ICONDIR: reservado (0), tipo (1 = icono) y cuántas imágenes.
    expect(ico.readUInt16LE(2)).toBe(1);
    const cuantas = ico.readUInt16LE(4);
    // Cada entrada mide 16 bytes, y su primer byte es el ancho (0 quiere decir 256).
    const anchos = Array.from({ length: cuantas }, (_, i) => ico.readUInt8(6 + i * 16)).sort(
      (a, b) => a - b,
    );

    expect(anchos).toEqual([32, 64]);
  });

  it('el de inicio mide 180 y no tiene transparencia, que iOS pinta de negro', () => {
    const png = leer('apple-icon.png');
    // IHDR: ancho y alto en los bytes 16 y 20, y el tipo de color en el 25.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
    // 2 es RGB; 6 sería RGBA.
    expect(png.readUInt8(25)).toBe(2);
  });
});
