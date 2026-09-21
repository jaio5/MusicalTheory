// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('un sitio guardado con la forma cambiada', () => {
  /**
   * El sitio se lee del equipo **una sola vez** por carga, así que cada caso
   * necesita el módulo recién importado. Lo guardado puede venir de una versión
   * vieja o de alguien que lo editó a mano: lo que no se entiende vuelve al
   * sitio de fábrica, que es mejor que no pintar el muñeco.
   */
  async function leerConGuardado(guardado: string) {
    localStorage.setItem('caos-ordenado:sitio-del-profesor', guardado);
    vi.resetModules();
    const modulo = await import('./tutor-spot');
    return modulo.sitioDelTutor();
  }

  it('sin nada guardado, el de fabrica', async () => {
    localStorage.clear();
    vi.resetModules();
    const modulo = await import('./tutor-spot');

    expect(modulo.sitioDelTutor()).toEqual(SITIO_POR_DEFECTO);
  });

  it('lo que no es un sitio vuelve al de fabrica', async () => {
    for (const guardado of ['"izquierda"', 'null', '42', 'no es json']) {
      expect(await leerConGuardado(guardado), guardado).toEqual(SITIO_POR_DEFECTO);
    }
  });

  // Un lado que no existe cae a la izquierda, que es el otro de los dos.
  it('un lado inventado cae al otro lado', async () => {
    expect(await leerConGuardado('{"lado":"arriba"}')).toEqual({
      lado: 'izquierda',
      alto: SITIO_POR_DEFECTO.alto,
    });
  });

  /**
   * Y el alto se recorta entre el 5 y el 90 por ciento: más arriba se mete
   * debajo de la cabecera y más abajo se esconde tras la barra de navegación
   * del móvil.
   */
  it('el alto se recorta, y el que no es un numero se queda en el de fabrica', async () => {
    for (const [alto, esperado] of [
      [-10, 5],
      [50, 50],
      [200, 90],
    ] as const) {
      const sitio = await leerConGuardado(JSON.stringify({ lado: 'derecha', alto }));
      expect(sitio, `alto ${alto}`).toEqual({ lado: 'derecha', alto: esperado });
    }

    const raro = await leerConGuardado(JSON.stringify({ lado: 'derecha', alto: 'medio' }));
    expect(raro.alto).toBe(SITIO_POR_DEFECTO.alto);
  });
});
