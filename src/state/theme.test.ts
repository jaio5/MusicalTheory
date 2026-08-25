// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { CLAVE_TEMA, elegirTema, GUION_TEMA, temaElegido, temaEnServidor } from './theme';

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
