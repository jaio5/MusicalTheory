// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CLAVE_TEMA,
  elegirTema,
  GUION_TEMA,
  suscribirseAlTema,
  temaElegido,
  temaEnServidor,
} from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
});

describe('El tema', () => {
  // El negro es el de la casa: sin nada guardado y sin atributo, es lo que sale.
  it('sin haber elegido nada es oscuro', () => {
    expect(temaElegido()).toBe('oscuro');
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('elegir el claro lo escribe en el documento y lo recuerda', () => {
    elegirTema('claro');

    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro');
    expect(temaElegido()).toBe('claro');
  });

  /**
   * Volver al oscuro **borra** la preferencia en vez de escribir «oscuro»: lo de
   * la casa es la ausencia de elección, y así el día que cambie el tema base
   * cambia para todo el que no haya pedido otra cosa.
   */
  it('volver al oscuro borra la elección en vez de guardarla', () => {
    elegirTema('claro');
    elegirTema('oscuro');

    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull();
    expect(temaElegido()).toBe('oscuro');
  });

  it('un valor raro guardado a mano no cuenta como elección', () => {
    localStorage.setItem(CLAVE_TEMA, 'fucsia');
    expect(temaElegido()).toBe('oscuro');
  });

  it('en el servidor se pinta el de la casa', () => {
    expect(temaEnServidor()).toBe('oscuro');
  });
});

/**
 * El guion que corre antes de pintar. Si deja de poner el atributo, vuelve el
 * destello: el HTML se pinta oscuro y React lo cambia a claro un instante
 * después, que es un cuarto de segundo de pantalla negra para quien eligió claro.
 */
describe('El guion antidestello', () => {
  it('aplica el tema guardado sin esperar a React', () => {
    localStorage.setItem(CLAVE_TEMA, 'claro');

    // Es lo que hace el navegador con el `<script>` del `<head>`.
    new Function(GUION_TEMA)();

    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });

  it('sin nada guardado no toca el documento', () => {
    new Function(GUION_TEMA)();
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });
});

describe('quien se entera de un cambio', () => {
  it('el conmutador y el guion no se conocen: se avisa por suscripcion', () => {
    const avisos: number[] = [];
    const dejar = suscribirseAlTema(() => avisos.push(1));

    elegirTema('claro');
    elegirTema('oscuro');

    expect(avisos).toHaveLength(2);
    dejar();
  });

  it('quien se da de baja deja de recibir avisos', () => {
    const avisos: number[] = [];
    const dejar = suscribirseAlTema(() => avisos.push(1));

    dejar();
    elegirTema('claro');

    expect(avisos).toHaveLength(0);
  });

  it('darse de baja dos veces no afecta a los demas', () => {
    const otros: number[] = [];
    const dejar = suscribirseAlTema(() => undefined);
    suscribirseAlTema(() => otros.push(1));

    dejar();
    dejar();
    elegirTema('claro');

    expect(otros).toHaveLength(1);
  });
});

describe('cuando el navegador no deja guardar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('se cambia igual, solo que no se recuerda', () => {
    // Pasa en navegación privada y con las cookies de terceros bloqueadas. Que
    // reviente por no poder recordar una preferencia sería dejar sin tema a
    // quien solo quería mirar la rueda.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => elegirTema('claro')).not.toThrow();
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });

  it('y leer lo que no se puede leer devuelve el de la casa', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(temaElegido()).toBe('oscuro');
  });
});
