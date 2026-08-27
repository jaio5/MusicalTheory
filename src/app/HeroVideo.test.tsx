// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeroVideo } from './HeroVideo';

/**
 * El vídeo del encabezado.
 *
 * Se prueba una sola cosa, y es la que importa: **solo se descarga si quien mira
 * acepta movimiento**. Para quien ha pedido que no, dos megas de vídeo de adorno
 * son dos megas y un mareo; en ese caso queda el degradado de debajo, que ya da
 * el mismo aire.
 *
 * El origen se pone desde el efecto y no en el JSX porque eso es actualizar un
 * sistema de fuera —el reproductor—, así que mirar el atributo `src` después de
 * pintar es exactamente lo que hay que comprobar.
 */

function preferencia(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reduce,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('el video de la portada', () => {
  it('con movimiento aceptado, se pone y arranca', () => {
    preferencia(false);

    const { container } = render(<HeroVideo />);

    expect(container.querySelector('video')).toHaveAttribute('src', '/hero.mp4');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('con movimiento reducido, no se descarga nada', () => {
    preferencia(true);

    const { container } = render(<HeroVideo />);

    expect(container.querySelector('video')).not.toHaveAttribute('src');
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('si el navegador no deja arrancarlo solo, se queda el degradado y no revienta', () => {
    // La política de autoreproducción. No es un error: el vídeo es adorno.
    preferencia(false);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));

    expect(() => render(<HeroVideo />)).not.toThrow();
  });

  it('un navegador que no devuelve promesa al arrancar tampoco', () => {
    // Los antiguos y jsdom. Encadenarle un `.catch` a ciegas es lo que fallaba,
    // y por eso esto pasa por `playQuietly` como el grabador de sesión.
    preferencia(false);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(
      undefined as unknown as Promise<void>,
    );

    expect(() => render(<HeroVideo />)).not.toThrow();
  });

  it('es adorno: ni suena ni lo lee un lector de pantalla', () => {
    preferencia(false);

    const { container } = render(<HeroVideo />);
    const video = container.querySelector('video')!;

    expect(video).toHaveAttribute('aria-hidden', 'true');
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('preload', 'none');
  });
});
