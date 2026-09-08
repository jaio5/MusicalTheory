// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { midiToFrequency, pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { KeyPanel } from './KeyPanel';

/** Toca una melodía clara de A menor, con instantes separados. */
function playAMinor() {
  const { actions } = useSessionStore.getState();
  [45, 48, 52, 45, 55, 52, 50, 48, 45, 52, 45, 57].forEach((midi, index) => {
    actions.setPitch(midiToFrequency(midi), 0.99, index * 300);
  });
}

describe('Panel de tonalidad', () => {
  it('dice que hay que tocar algo antes de detectar nada', () => {
    render(<KeyPanel />);
    expect(screen.getByText(/toca unas notas sueltas y la detectamos sola/i)).toBeInTheDocument();
  });

  /**
   * La rueda **no es una imagen donde se elige tonalidad**, y por eso aquí es un
   * grupo. Llevaba `role="img"` con veinticuatro botones dentro, que es decirle a
   * un lector de pantalla que ahí no hay nada que tocar: los hijos de un `img`
   * son decoración por definición. En la portada, donde no se pulsa, sigue siendo
   * una imagen.
   *
   * Lo que no se pierde es lo que decía: qué tonalidad ha quedado arriba y qué
   * anillo ha pasado a fuera son las dos cosas que la rueda cuenta girando, y
   * girar no se oye.
   */
  it('describe la rueda para quien no la ve', () => {
    render(<KeyPanel />);
    expect(
      screen.getByRole('group', { name: /rueda de quintas.*todavía no hay tonalidad/i }),
    ).toBeInTheDocument();
  });

  it('y dice que ahí se elige y cómo se recorre', () => {
    render(<KeyPanel />);
    expect(screen.getByRole('group', { name: /muévete con las flechas/i })).toBeInTheDocument();
  });

  /**
   * La rueda es **un mando, no una lista de veinticuatro enlaces**.
   *
   * Lo era: entrar en componer con el teclado y llegar a la lista de acordes
   * costaba pasar por las doce mayores y las doce menores, una a una. Un mando se
   * tabula una vez y se recorre con las flechas, que es lo que espera cualquiera
   * que llegue aquí sin ratón.
   */
  it('solo pide un turno del tabulador, no veinticuatro', () => {
    const { container } = render(<KeyPanel />);

    const alcanzables = container.querySelectorAll('[data-casilla][tabindex="0"]');
    expect(alcanzables).toHaveLength(1);
    expect(container.querySelectorAll('[data-casilla]')).toHaveLength(24);
  });

  it('las flechas giran la rueda y cambian de anillo', async () => {
    render(<KeyPanel />);
    const do_ = screen.getByTitle('C mayor');
    do_.focus();

    // Derecha e izquierda giran por el círculo de quintas, que es el orden en el
    // que están puestas: de Do se va a Sol.
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByTitle('G mayor'));

    // Abajo y arriba cambian de anillo sin moverse de sitio: la relativa menor
    // de Sol comparte armadura y por eso comparte posición.
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByTitle('E menor'));

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByTitle('G mayor'));
  });

  it('da la vuelta redonda: la rueda no tiene principio ni final', async () => {
    render(<KeyPanel />);
    screen.getByTitle('C mayor').focus();

    await userEvent.keyboard('{ArrowLeft}');

    expect(document.activeElement).toBe(screen.getByTitle('F mayor'));
  });

  it('detecta A menor al tocarla y lo dice', async () => {
    playAMinor();
    render(<KeyPanel />);

    expect(await screen.findByText(/detectada: A menor/i)).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /rueda de quintas con A menor arriba/i }),
    ).toBeInTheDocument();
  });

  it('enseña las tres candidatas con su puntuación', async () => {
    playAMinor();
    render(<KeyPanel />);

    const candidates = await screen.findByText(/lo que mejor encaja/i);
    expect(candidates).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('deja fijar una tonalidad a mano', async () => {
    playAMinor();
    render(<KeyPanel />);

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /tonalidad/i }),
      `${pitchClassFromName('E')}:major`,
    );

    expect(await screen.findByText(/fijada a mano: E mayor/i)).toBeInTheDocument();
    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('E'),
      mode: 'major',
    });
  });

  it('la tonalidad fijada manda sobre la detectada', async () => {
    playAMinor();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('E'), mode: 'major' });

    render(<KeyPanel />);

    expect(await screen.findByText(/fijada a mano: E mayor/i)).toBeInTheDocument();
  });

  it('permite volver a la detección', async () => {
    playAMinor();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('E'), mode: 'major' });

    render(<KeyPanel />);
    await userEvent.click(screen.getByRole('button', { name: /volver a la detección/i }));

    expect(await screen.findByText(/detectada: A menor/i)).toBeInTheDocument();
    expect(useSessionStore.getState().pinnedKey).toBeNull();
  });
});

describe('pulsar en la rueda', () => {
  it('cada tonalidad de la rueda es un botón de verdad', () => {
    render(<KeyPanel />);

    // Doce mayores y doce menores.
    const wheelKeys = screen
      .getAllByRole('button')
      .filter((button) => /mayor|menor/.test(button.getAttribute('title') ?? ''));
    expect(wheelKeys).toHaveLength(24);
  });

  it('fija la tonalidad al pulsarla', async () => {
    render(<KeyPanel />);

    await userEvent.click(screen.getByTitle('E menor'));

    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('E'),
      mode: 'minor',
    });
    expect(await screen.findByText(/fijada a mano: E menor/i)).toBeInTheDocument();
  });

  it('se puede usar con el teclado, sin ratón', async () => {
    render(<KeyPanel />);

    const key = screen.getByTitle('G mayor');
    key.focus();
    expect(key).toHaveFocus();

    await userEvent.keyboard('{Enter}');

    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('G'),
      mode: 'major',
    });
  });

  it('marca cuál está activa para quien no ve la rueda', async () => {
    render(<KeyPanel />);
    await userEvent.click(screen.getByTitle('F mayor'));

    expect(screen.getByTitle('F mayor')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('G mayor')).toHaveAttribute('aria-pressed', 'false');
  });

  it('escribe cada tonalidad como toca: Sib, no La#', () => {
    render(<KeyPanel />);
    expect(screen.getByTitle('Bb mayor')).toBeInTheDocument();
    expect(screen.queryByTitle('A# mayor')).not.toBeInTheDocument();
  });
});

describe('los anillos se dan la vuelta', () => {
  it('con una mayor, las mayores van por fuera', async () => {
    render(<KeyPanel />);
    await userEvent.click(screen.getByTitle('G mayor'));

    expect(
      await screen.findByRole('group', { name: /las mayores en el anillo de fuera/i }),
    ).toBeInTheDocument();
  });

  it('con una menor, las menores pasan a fuera', async () => {
    render(<KeyPanel />);
    await userEvent.click(screen.getByTitle('E menor'));

    expect(
      await screen.findByRole('group', { name: /las menores en el anillo de fuera/i }),
    ).toBeInTheDocument();
  });

  it('las posiciones no cambian: la relativa sigue en el mismo sitio', async () => {
    render(<KeyPanel />);

    // C mayor y A menor comparten armadura, así que comparten posición: al
    // pasar de una a otra la rueda no gira.
    await userEvent.click(screen.getByTitle('C mayor'));
    const doMayor = screen.getByTitle('C mayor').closest('foreignObject');
    const laMenor = screen.getByTitle('A menor').closest('foreignObject');

    expect(doMayor?.getAttribute('transform')).toBe(laMenor?.getAttribute('transform'));
  });
});
