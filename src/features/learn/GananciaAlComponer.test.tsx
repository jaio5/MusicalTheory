// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { COMPOSE_XP } from '@core/music';

import { GananciaAlComponer } from './GananciaAlComponer';
import type { ComposeGain } from './use-progress';

/**
 * El aviso de lo que ha contado al componer.
 *
 * Lo que se prueba es lo que lo distingue de la pantalla de fin de unidad: que
 * no tapa nada, que se va solo y que con el tope lleno explica por qué el número
 * ha dejado de subir en vez de callarse.
 */

function ganancia(extra: Partial<ComposeGain> = {}): ComposeGain {
  return {
    deed: 'cancion',
    xp: COMPOSE_XP.cancion,
    newBadges: [],
    goalJustMet: false,
    ...extra,
  };
}

describe('el aviso de componer', () => {
  it('dice qué ha contado y cuánto ha sumado', () => {
    render(<GananciaAlComponer gain={ganancia()} onDismiss={() => {}} />);

    expect(screen.getByText('Canción guardada')).toBeInTheDocument();
    expect(screen.getByText(`+${COMPOSE_XP.cancion} XP`)).toBeInTheDocument();
  });

  it('nombra la medalla nueva, no su identificador', () => {
    render(
      <GananciaAlComponer
        gain={ganancia({ newBadges: ['primera-cancion'] })}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByText(/Primera canción/)).toBeInTheDocument();
  });

  it('y dice si la meta del día se ha cerrado componiendo', () => {
    render(<GananciaAlComponer gain={ganancia({ goalJustMet: true })} onDismiss={() => {}} />);

    expect(screen.getByText(/Meta del día cerrada/)).toBeInTheDocument();
  });

  it('con el tope lleno explica por qué ya no sube', () => {
    // Sin esta frase, un hecho que no suma se lee como un fallo de la
    // aplicación. Con ella se entiende que es un techo y que la racha sigue.
    render(<GananciaAlComponer gain={ganancia({ xp: 0 })} onDismiss={() => {}} />);

    expect(screen.getByText(/ya no suma más XP/)).toBeInTheDocument();
    expect(screen.queryByText('+0 XP')).not.toBeInTheDocument();
  });

  it('se va solo, sin que nadie lo cierre', () => {
    vi.useFakeTimers();
    const cerrar = vi.fn();

    render(<GananciaAlComponer gain={ganancia()} onDismiss={cerrar} duracion={1000} />);

    expect(cerrar).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(cerrar).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('no estorba: no se puede pulsar y no roba el foco', () => {
    // Componer no termina nunca, así que un aviso que pida un clic para quitarse
    // está interrumpiendo lo único que la pantalla quiere que hagas.
    const { container } = render(<GananciaAlComponer gain={ganancia()} onDismiss={() => {}} />);

    const region = container.querySelector('[aria-live]');

    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region?.className).toContain('pointer-events-none');
    expect(container.querySelector('button')).toBeNull();
  });

  it('sin nada que decir no dibuja caja, pero deja la región puesta', () => {
    // La región tiene que existir antes de que llegue el texto: un `aria-live`
    // que aparece a la vez que su contenido no lo anuncia ningún lector.
    const { container } = render(<GananciaAlComponer gain={null} onDismiss={() => {}} />);

    expect(container.querySelector('[aria-live]')).not.toBeNull();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
  });
});
