// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apuntarSitio, leerSitio, olvidarSitio, usePreguntaEnCurso } from './sitio-en-la-unidad';

const CLAVE = 'caos-ordenado:sitio:e1-grados';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Lo guardado viene de la pestaña, y la pestaña puede traer lo de otra versión
 * de la aplicación o algo escrito a mano: lo que no se entiende es empezar de cero.
 */
describe('leer por dónde iba', () => {
  it('nada guardado, o algo que no es un objeto, es nada', () => {
    expect(leerSitio(null)).toBeNull();
    expect(leerSitio('{roto')).toBeNull();
    expect(leerSitio('3')).toBeNull();
    expect(leerSitio('null')).toBeNull();
  });

  it('se queda con los números que caben y descarta los demás', () => {
    expect(leerSitio(JSON.stringify({ momento: 2, pregunta: 4, fallada: 1 }))).toEqual({
      momento: 2,
      pregunta: 4,
      fallada: true,
    });
    expect(leerSitio(JSON.stringify({ momento: 7, pregunta: -1, fallada: 'sí' }))).toEqual({
      momento: 0,
      pregunta: 0,
      fallada: false,
    });
    expect(leerSitio(JSON.stringify({ momento: 1.5, pregunta: '3' }))).toEqual({
      momento: 0,
      pregunta: 0,
      fallada: false,
    });
  });
});

describe('apuntar y olvidar', () => {
  it('apunta solo números, sumando lo nuevo a lo que había', () => {
    apuntarSitio('e1-grados', { momento: 2 });
    apuntarSitio('e1-grados', { pregunta: 3, fallada: true });

    expect(JSON.parse(sessionStorage.getItem(CLAVE)!)).toEqual({
      momento: 2,
      pregunta: 3,
      fallada: 1,
    });

    olvidarSitio('e1-grados');
    expect(sessionStorage.getItem(CLAVE)).toBeNull();
  });

  // Navegación privada estricta: sin almacenamiento no se retoma, y nada se rompe.
  it('sin almacenamiento no rompe nada', () => {
    for (const metodo of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, metodo).mockImplementation(() => {
        throw new Error('bloqueado');
      });
    }

    expect(() => apuntarSitio('e1-grados', { momento: 1 })).not.toThrow();
    expect(() => olvidarSitio('e1-grados')).not.toThrow();
  });
});

describe('la pregunta en curso', () => {
  function Pregunta({ total }: { readonly total: number }) {
    const { at } = usePreguntaEnCurso('e1-grados', total);
    return <p>Pregunta {at + 1}</p>;
  }

  // Otra tonalidad puede tener menos preguntas que la del día que se guardó.
  it('si lo guardado ya no existe en la lección de ahora, empieza por la primera', () => {
    apuntarSitio('e1-grados', { momento: 2, pregunta: 5 });

    render(<Pregunta total={3} />);

    expect(screen.getByText('Pregunta 1')).toBeTruthy();
  });

  it('si existe, sigue en ella', () => {
    apuntarSitio('e1-grados', { momento: 2, pregunta: 2 });

    render(<Pregunta total={3} />);

    expect(screen.getByText('Pregunta 3')).toBeTruthy();
  });
});
