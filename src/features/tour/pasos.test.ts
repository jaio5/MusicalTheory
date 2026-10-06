import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PASOS, indiceDe, pasosPara, textoDe } from './pasos';

/** Todo el código de las pantallas, para buscar dónde está puesta cada pieza. */
const CODIGO = (() => {
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
      } else if (entrada.name.endsWith('.tsx') && !entrada.name.includes('.test.')) {
        salida.push(readFileSync(ruta, 'utf8'));
      }
    }
  };
  recorrer(join(process.cwd(), 'src'));
  return salida.join('\n');
})();

describe('los pasos', () => {
  it('van en el orden pedido: bienvenida, aprender, profesor, componer y afinar', () => {
    const secciones = PASOS.map((paso) => paso.seccion).filter(
      (seccion, indice, todas) => todas.indexOf(seccion) === indice,
    );
    expect(secciones).toEqual(['Bienvenida', 'Aprender', 'Profesor', 'Componer', 'Afinar']);
    expect(PASOS.at(-1)!.id).toBe('despedida');
  });

  it('cada uno con su nombre, sin repetir: es lo que se guarda', () => {
    const ids = PASOS.map((paso) => paso.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** Dos frases como mucho: lo que no cabe en dos, no se lee en un recorrido. */
  it('dicen lo suyo en dos frases como mucho', () => {
    for (const paso of PASOS) {
      for (const texto of [paso.texto, paso.textoMovil].filter((t) => t !== undefined)) {
        const frases = texto.split(/[.!?](?:\s|$)/).filter((frase) => frase.trim() !== '');
        expect(frases.length, `${paso.id}: ${texto}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('lo que se señala tiene un nombre para quien no lo ve', () => {
    for (const paso of PASOS.filter((p) => p.objetivo !== undefined)) {
      expect(paso.nombre, paso.id).toBeTruthy();
    }
  });

  /**
   * La trampa de estos recorridos: alguien renombra una pieza y el paso se queda
   * señalando el aire, con todos los tests en verde. Cada `data-tour` que se
   * busca tiene que estar puesto en alguna pantalla.
   */
  it('cada pieza que se busca está puesta en alguna pantalla', () => {
    const nombres = PASOS.flatMap((paso) =>
      [...(paso.objetivo ?? '').matchAll(/data-tour="([^"]+)"/g)].map((m) => m[1]!),
    );
    expect(nombres.length).toBeGreaterThan(10);
    for (const nombre of new Set(nombres)) {
      expect(CODIGO, nombre).toMatch(new RegExp(`data-tour(?:=\\{[^}]*)?=?["']${nombre}["']`));
    }
  });

  it('componer, entera: los nueve apartados que se pidieron', () => {
    const componer = PASOS.filter((paso) => paso.seccion === 'Componer').map((paso) => paso.id);
    expect(componer).toEqual([
      'componer-tonalidad',
      'componer-espacios',
      'componer-papel',
      'componer-tocar',
      'componer-cancion',
      'componer-anadir',
      'componer-barra',
      'componer-ensayar',
      'componer-areas',
      'componer-pestanas',
      'componer-restablecer',
      'componer-bandeja',
      'componer-metronomo',
      'componer-atajos',
    ]);
  });
});

describe('según el ancho', () => {
  it('con banco: áreas, restablecer y teclas, y sin las pestañas', () => {
    const ids = pasosPara(true).map((paso) => paso.id);
    expect(ids).toContain('componer-areas');
    expect(ids).toContain('componer-atajos');
    expect(ids).not.toContain('componer-pestanas');
  });

  it('sin banco: las pestañas, y nada de plegar ni de teclas', () => {
    const ids = pasosPara(false).map((paso) => paso.id);
    expect(ids).toContain('componer-pestanas');
    expect(ids).not.toContain('componer-areas');
    expect(ids).not.toContain('componer-restablecer');
    expect(ids).not.toContain('componer-atajos');
  });

  it('el texto del teléfono, si lo hay', () => {
    const bandeja = PASOS.find((paso) => paso.id === 'componer-bandeja')!;
    expect(textoDe(bandeja, false)).toMatch(/^En «Más»/);
    expect(textoDe(bandeja, true)).toBe(bandeja.texto);
    const profesor = PASOS.find((paso) => paso.id === 'profesor')!;
    expect(textoDe(profesor, false)).toBe(profesor.texto);
  });
});

describe('dónde se sigue', () => {
  const conBanco = pasosPara(true);
  const sinBanco = pasosPara(false);

  it('sin paso guardado, por el principio', () => {
    expect(indiceDe(conBanco, null)).toBe(0);
  });

  it('por el guardado, si existe con este ancho', () => {
    expect(conBanco[indiceDe(conBanco, 'componer-areas')]!.id).toBe('componer-areas');
  });

  /** Una tableta que se gira a mitad de recorrido. */
  it('por el siguiente que exista, si el guardado no existe con este ancho', () => {
    expect(sinBanco[indiceDe(sinBanco, 'componer-areas')]!.id).toBe('componer-pestanas');
    expect(sinBanco[indiceDe(sinBanco, 'componer-atajos')]!.id).toBe('afinar-afinacion');
  });

  it('por el principio, si el guardado ya no existe en ninguna versión', () => {
    expect(indiceDe(conBanco, 'un-paso-que-se-quito')).toBe(0);
  });
});
