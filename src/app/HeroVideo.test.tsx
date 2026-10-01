// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeroVideo } from './HeroVideo';

/**
 * El vídeo del encabezado.
 *
 * Se prueba una sola cosa, y es la que importa: **solo se descarga si quien mira
 * acepta movimiento**. Para quien ha pedido que no, dos megas de vídeo de adorno
 * son dos megas y un mareo; en ese caso queda el póster, que son 56 kB del mismo
 * fotograma parado. Lo que no puede quedar es el hueco: el vídeo ya no va detrás
 * del titular, va en su caja al lado.
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

  it('con movimiento reducido, no se descarga nada y queda el poster', () => {
    preferencia(true);

    const { container } = render(<HeroVideo />);

    expect(container.querySelector('video')).not.toHaveAttribute('src');
    expect(container.querySelector('video')).toHaveAttribute('poster', '/hero.jpg');
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('si el navegador no deja arrancarlo solo, se queda el poster y no revienta', () => {
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

  /**
   * Un bucle de diez segundos que arranca solo tiene que poder pararse (WCAG
   * 2.2.2). El botón dice lo que pasa de verdad: lo lee de los eventos del
   * reproductor, no de lo que se le pidió.
   */
  it('se puede parar y volver a poner, y el botón dice cuál toca', async () => {
    preferencia(false);
    const pausa = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const { container } = render(<HeroVideo />);
    const video = container.querySelector('video')!;

    fireEvent.play(video);
    await userEvent.click(screen.getByRole('button', { name: 'Parar el vídeo' }));
    expect(pausa).toHaveBeenCalled();

    fireEvent.pause(video);
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Seguir con el vídeo' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Seguir con el vídeo' }).className).toContain(
      'size-tap',
    );
  });

  // Con el póster no hay nada que parar.
  it('sin vídeo no hay botón', () => {
    preferencia(true);
    render(<HeroVideo />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('con el ahorro de datos puesto, no se baja: queda el póster', () => {
    preferencia(false);
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } });

    const { container } = render(<HeroVideo />);

    expect(container.querySelector('video')).not.toHaveAttribute('src');
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  /**
   * En el móvil la caja cae debajo del pliegue: el vídeo no se pide hasta que
   * asoma, y al asomar se deja de mirar.
   */
  it('no se pide hasta que la caja asoma', () => {
    preferencia(false);
    let avisar: (entradas: Array<{ isIntersecting: boolean }>) => void = () => {};
    const desconectar = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(llamada: typeof avisar) {
          avisar = llamada;
        }
        observe() {}
        disconnect = desconectar;
      },
    );

    const { container, unmount } = render(<HeroVideo />);
    const video = container.querySelector('video')!;
    expect(video).not.toHaveAttribute('src');

    act(() => avisar([{ isIntersecting: false }]));
    expect(video).not.toHaveAttribute('src');

    act(() => avisar([{ isIntersecting: true }]));
    expect(video).toHaveAttribute('src', '/hero.mp4');
    expect(desconectar).toHaveBeenCalled();
    unmount();
  });
});
