import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PASOS, indiceDe, pasosDe } from './pasos';
import { TRAMOS, tramoPara } from './tramos';

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
  /**
   * **Lo esencial, y no más.** Eran veintiuno en un diálogo modal; ahora son
   * cinco repartidos por pantallas (adr/0108). Si esto sube, que sea a propósito.
   */
  it('son pocos: lo esencial, entre cuatro y seis', () => {
    expect(PASOS.length).toBeGreaterThanOrEqual(4);
    expect(PASOS.length).toBeLessThanOrEqual(6);
  });

  it('cada tramo tiene al menos uno, y van en el orden de los tramos', () => {
    const tramos = PASOS.map((paso) => paso.tramo).filter(
      (tramo, indice, todos) => todos.indexOf(tramo) === indice,
    );
    expect(tramos).toEqual([...TRAMOS]);
  });

  it('cada uno con su nombre, sin repetir: es lo que se guarda', () => {
    const ids = PASOS.map((paso) => paso.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** Dos frases como mucho: lo que no cabe en dos, no se lee en un recorrido. */
  it('dicen lo suyo en dos frases como mucho', () => {
    for (const paso of PASOS) {
      const frases = paso.texto.split(/[.!?](?:\s|$)/).filter((frase) => frase.trim() !== '');
      expect(frases.length, `${paso.id}: ${paso.texto}`).toBeLessThanOrEqual(2);
    }
  });

  it('lo que se señala tiene un nombre para quien no lo ve', () => {
    for (const paso of PASOS) {
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
      [...paso.objetivo.matchAll(/data-tour="([^"]+)"/g)].map((m) => m[1]!),
    );
    expect(nombres.length).toBeGreaterThan(4);
    for (const nombre of new Set(nombres)) {
      expect(CODIGO, nombre).toMatch(new RegExp(`data-tour(?:=\\{[^}]*)?=?["']${nombre}["']`));
    }
  });

  /**
   * Y al revés: un `data-tour` puesto que ningún paso busca hace creer a quien lo
   * ve que renombrarlo rompe el recorrido.
   */
  it('cada pieza marcada la busca algún paso', () => {
    const buscadas = PASOS.map((paso) => paso.objetivo).join(' ');
    const puestas = [...CODIGO.matchAll(/data-tour=["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const nombre of new Set(puestas)) {
      expect(buscadas, nombre).toContain(`data-tour="${nombre}"`);
    }
  });
});

describe('por dónde se sigue dentro del tramo', () => {
  const componer = pasosDe('componer');

  it('sin paso guardado, por el primero', () => {
    expect(indiceDe(componer, null)).toBe(0);
  });

  it('por el guardado, si es de este tramo', () => {
    expect(componer[indiceDe(componer, 'componer-espacios')]!.id).toBe('componer-espacios');
  });

  it('por el primero, si el guardado es de otro tramo o ya no existe', () => {
    expect(indiceDe(componer, 'aprender-hoy')).toBe(0);
    expect(indiceDe(componer, 'componer-areas')).toBe(0);
  });
});

/** Cada pantalla, el suyo al llegar; la bienvenida, la primera en cualquiera. */
describe('qué tramo toca', () => {
  it('sin nada visto, la bienvenida, en cualquier pantalla de trabajo', () => {
    expect(tramoPara([], '/componer')).toBe('bienvenida');
    expect(tramoPara([], '/aprender/e1-notas')).toBe('bienvenida');
  });

  it('con la bienvenida vista, el de la pantalla', () => {
    expect(tramoPara(['bienvenida'], '/aprender')).toBe('aprender');
    expect(tramoPara(['bienvenida'], '/componer')).toBe('componer');
    expect(tramoPara(['bienvenida'], '/afinar')).toBe('afinar');
  });

  it('nada en una pantalla sin tramo, o con el suyo ya visto', () => {
    expect(tramoPara(['bienvenida'], '/profesor')).toBeNull();
    expect(tramoPara(['bienvenida'], '/aprender/e1-notas')).toBeNull();
    expect(tramoPara(['bienvenida', 'componer'], '/componer')).toBeNull();
  });
});
