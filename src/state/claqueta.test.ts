// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El clic de la toma: cuánto suena y si suena.
 *
 * Se recuerda en el navegador, como el tema, y **quitarlo no toca el volumen**:
 * al volver a ponerlo suena como sonaba.
 */

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

async function claqueta() {
  return import('./claqueta');
}

describe('el clic de la toma', () => {
  it('de partida suena, al ochenta por ciento', async () => {
    const { useClaqueta, volumenQueSuena, VOLUMEN_DE_PARTIDA } = await claqueta();
    expect(VOLUMEN_DE_PARTIDA).toBe(0.8);
    expect(volumenQueSuena(useClaqueta.getState())).toBe(0.8);
    expect(useClaqueta.getState().enLaToma).toBe(false);
  });

  it('quitarlo calla sin olvidar el volumen, y mover el volumen lo devuelve', async () => {
    const { useClaqueta, volumenQueSuena } = await claqueta();
    const { acciones } = useClaqueta.getState();

    acciones.ponerVolumen(0.5);
    acciones.callar(true);
    expect(volumenQueSuena(useClaqueta.getState())).toBe(0);
    expect(useClaqueta.getState().volumen).toBe(0.5);

    acciones.ponerVolumen(0.6);
    expect(useClaqueta.getState().callada).toBe(false);
    expect(volumenQueSuena(useClaqueta.getState())).toBe(0.6);
  });

  it('lo imposible se acota', async () => {
    const { useClaqueta } = await claqueta();
    const { acciones } = useClaqueta.getState();
    acciones.ponerVolumen(4);
    expect(useClaqueta.getState().volumen).toBe(1);
    acciones.ponerVolumen(-1);
    expect(useClaqueta.getState().volumen).toBe(0);
    acciones.ponerVolumen(Number.NaN);
    expect(useClaqueta.getState().volumen).toBe(0.8);
  });

  it('se recuerda de una visita a otra', async () => {
    const primera = await claqueta();
    primera.useClaqueta.getState().acciones.ponerVolumen(0.3);
    primera.useClaqueta.getState().acciones.callar(true);

    vi.resetModules();
    const segunda = await claqueta();
    expect(segunda.useClaqueta.getState()).toMatchObject({ volumen: 0.3, callada: true });
  });

  it('lo guardado ilegible, o un volumen que no es numero, deja lo de partida', async () => {
    localStorage.setItem('caos-ordenado:claqueta', '{roto');
    expect((await claqueta()).useClaqueta.getState().volumen).toBe(0.8);

    vi.resetModules();
    localStorage.setItem('caos-ordenado:claqueta', JSON.stringify({ volumen: 'alto' }));
    expect((await claqueta()).useClaqueta.getState()).toMatchObject({
      volumen: 0.8,
      callada: false,
    });
  });

  it('sin poder guardar, se queda para esta visita', async () => {
    const { useClaqueta } = await claqueta();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('lleno');
    });
    useClaqueta.getState().acciones.callar(true);
    expect(useClaqueta.getState().callada).toBe(true);
    vi.restoreAllMocks();
  });

  it('dice si hay una toma con su clic sonando', async () => {
    const { useClaqueta } = await claqueta();
    useClaqueta.getState().acciones.marcarToma(true);
    expect(useClaqueta.getState().enLaToma).toBe(true);
  });
});
