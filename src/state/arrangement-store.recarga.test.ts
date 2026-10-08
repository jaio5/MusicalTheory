// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * El guardado del lienzo, una vez por pestaña **aunque el módulo se evalúe dos**.
 *
 * En desarrollo cada recarga en caliente vuelve a evaluar el almacén, y cada vez
 * se abría otro `BroadcastChannel` con sus oyentes, sin cerrar el de antes. Aquí
 * se evalúa dos veces y se mira que el primer canal se cierra.
 */

const canales: CanalDeMentira[] = [];

class CanalDeMentira {
  cerrado = false;
  constructor() {
    canales.push(this);
  }
  postMessage(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {
    this.cerrado = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { __caosGuardadoDelLienzo?: () => void }).__caosGuardadoDelLienzo;
  canales.length = 0;
});

describe('al volver a evaluar el almacén', () => {
  it('cierra el canal de la vez anterior y deja abierto solo el nuevo', async () => {
    vi.stubGlobal('BroadcastChannel', CanalDeMentira);

    vi.resetModules();
    await import('./arrangement-store');
    vi.resetModules();
    await import('./arrangement-store');

    expect(canales.map((canal) => canal.cerrado)).toEqual([true, false]);
  });
});
