// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ladoMasCercano,
  moverTutor,
  sitioDelTutor,
  sitioDelTutorEnServidor,
  SITIO_POR_DEFECTO,
  suscribirseAlSitio,
} from './tutor-spot';

beforeEach(() => {
  localStorage.clear();
  moverTutor(SITIO_POR_DEFECTO);
});

/**
 * Solo dos sitios posibles, y es la decisión del asunto: un muñeco que se queda
 * donde lo sueltes acaba en mitad de la pantalla tapando lo que estabas leyendo.
 */
describe('a qué lado se va al soltarlo', () => {
  it('al de la izquierda si su centro está en la mitad izquierda', () => {
    expect(ladoMasCercano(100, 1000)).toBe('izquierda');
    expect(ladoMasCercano(499, 1000)).toBe('izquierda');
  });

  it('al de la derecha si está en la otra mitad', () => {
    expect(ladoMasCercano(501, 1000)).toBe('derecha');
    expect(ladoMasCercano(980, 1000)).toBe('derecha');
  });

  // Justo en la mitad tiene que elegir uno de los dos y siempre el mismo: dudar
  // ahí haría que dos sueltas iguales acabaran en lados distintos.
  it('en la mitad exacta no duda', () => {
    expect(ladoMasCercano(500, 1000)).toBe('derecha');
  });
});

describe('el sitio donde lo dejaste', () => {
  it('sobrevive a cambiar de pantalla', () => {
    moverTutor({ lado: 'derecha', alto: 40 });
    expect(sitioDelTutor()).toEqual({ lado: 'derecha', alto: 40 });
  });

  it('avisa a quien lo esté mirando', () => {
    let avisos = 0;
    const dejar = suscribirseAlSitio(() => (avisos += 1));

    moverTutor({ lado: 'derecha', alto: 30 });

    expect(avisos).toBe(1);
    dejar();
  });

  /**
   * Arriba del todo se mete debajo de la cabecera y abajo del todo se esconde
   * tras la barra de navegación del móvil: dos formas de perder el muñeco sin
   * saber cómo recuperarlo.
   */
  it('no deja dejarlo fuera de la pantalla', () => {
    moverTutor({ lado: 'izquierda', alto: -50 });
    expect(sitioDelTutor().alto).toBe(5);

    moverTutor({ lado: 'izquierda', alto: 300 });
    expect(sitioDelTutor().alto).toBe(90);
  });

  it('un valor guardado que no vale se ignora en vez de romper la pantalla', () => {
    localStorage.setItem('caos-ordenado:sitio-del-profesor', '{{ esto no es json');
    expect(() => sitioDelTutor()).not.toThrow();
  });

  // En el servidor no hay ventana donde haberlo movido, así que se pinta el de
  // siempre y React resuelve la diferencia al hidratar.
  it('en el servidor es el de siempre', () => {
    expect(sitioDelTutorEnServidor()).toEqual(SITIO_POR_DEFECTO);
  });
});
