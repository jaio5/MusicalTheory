// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { playQuietly } from './play-quietly';

/**
 * Arrancar un vídeo sin que su fallo tumbe lo que venga detrás.
 *
 * Quince líneas con su test porque cada una tapa un navegador distinto:
 * `play()` devuelve una promesa en los actuales y no en los antiguos ni en
 * jsdom, así que encadenarle un `.catch` a ciegas revienta; y cuando sí la
 * devuelve, puede rechazarse por la política de autoreproducción, que aquí no es
 * un error.
 */

describe('arrancar el video', () => {
  it('cuando devuelve promesa y sale bien, se espera', async () => {
    const play = vi.fn().mockResolvedValue(undefined);

    await playQuietly({ play } as unknown as HTMLMediaElement);

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('un rechazo por autoreproduccion no es un error: el canvas pinta negro', async () => {
    const play = vi.fn().mockRejectedValue(new Error('NotAllowedError'));

    await expect(playQuietly({ play } as unknown as HTMLMediaElement)).resolves.toBeUndefined();
  });

  it('un navegador que no devuelve promesa tampoco revienta', async () => {
    // Encadenarle un `.catch` a ciegas a esto es lo que fallaba.
    const play = vi.fn().mockReturnValue(undefined);

    await expect(playQuietly({ play } as unknown as HTMLMediaElement)).resolves.toBeUndefined();
  });

  it('y uno que lanza en el momento, tampoco', async () => {
    const play = vi.fn(() => {
      throw new Error('InvalidStateError');
    });

    await expect(playQuietly({ play } as unknown as HTMLMediaElement)).resolves.toBeUndefined();
  });
});
