// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName, type PlayUnit, type TheoryUnit } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { UnidadPorMomentos } from './UnidadPorMomentos';

const DE_TOCAR: PlayUnit = {
  id: 'e1-escala',
  title: 'La escala mayor',
  kind: 'play',
  scaleId: 'major',
  xp: 35,
};

const DE_TEORIA: TheoryUnit = {
  id: 'e1-grados',
  title: 'Qué es un grado',
  kind: 'theory',
  lesson: 'degrees',
  xp: 20,
};

beforeEach(() => {
  sessionStorage.clear();
  useSessionStore.getState().actions.reset();
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
});

function momentos() {
  return within(screen.getByRole('list', { name: 'Momentos de la unidad' }));
}

/**
 * Los momentos son los mismos en las tres clases de unidad, y lo que cambia es
 * si hay teoría escrita en medio y cómo se pone a prueba.
 */
describe('una unidad sin teoría', () => {
  it('va de la presentación a la prueba, y la prueba no se pinta antes', async () => {
    render(<UnidadPorMomentos unit={DE_TOCAR} prueba={<p>El mástil</p>} />);

    expect(momentos().getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('El mástil')).not.toBeInTheDocument();
    expect(screen.getByText(/la tocas con la guitarra/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(screen.getByText('El mástil')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tócala' })).toHaveFocus();
    expect(momentos().getByText('Prueba').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  // Ni atajo a la prueba ni vuelta a una teoría que no existe.
  it('no ofrece atajos ni vueltas, aunque ya esté hecha', async () => {
    render(<UnidadPorMomentos unit={DE_TOCAR} yaHecha prueba={<p>El mástil</p>} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.queryByRole('button', { name: 'Repasar la teoría' })).not.toBeInTheDocument();
  });
});

describe('una unidad con teoría', () => {
  it('pasa por los tres momentos, y cada uno pinta solo lo suyo', async () => {
    render(
      <UnidadPorMomentos unit={DE_TEORIA} teoria={<p>Lo que hay</p>} prueba={<p>Preguntas</p>} />,
    );

    expect(screen.getByText(/Primero lo explico/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getByText('Lo que hay')).toBeInTheDocument();
    expect(screen.queryByText('Preguntas')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ponerlo a prueba' }));
    expect(screen.getByText('Preguntas')).toBeInTheDocument();
    expect(screen.queryByText('Lo que hay')).not.toBeInTheDocument();
    // Los dos de antes, hechos.
    expect(momentos().getAllByText(', hecho')).toHaveLength(2);
  });

  /**
   * Lo que hay dentro de la prueba guarda su estado —la respuesta elegida, en
   * `Question`—, y desmontarla al ir a la teoría lo borraba.
   */
  it('volver a la teoría no desmonta la prueba: se esconde y guarda lo que llevaba', async () => {
    function Contador() {
      const [veces, setVeces] = useState(0);
      return <button onClick={() => setVeces(veces + 1)}>Pulsado {veces}</button>;
    }
    render(<UnidadPorMomentos unit={DE_TEORIA} teoria={<p>Lo que hay</p>} prueba={<Contador />} />);
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ponerlo a prueba' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pulsado 0' }));

    await userEvent.click(screen.getByRole('button', { name: 'Repasar la teoría' }));
    expect(screen.getByText('Lo que hay')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pulsado/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Volver a las preguntas' }));
    expect(screen.getByRole('button', { name: 'Pulsado 1' })).toBeInTheDocument();
    expect(screen.queryByText('Lo que hay')).not.toBeInTheDocument();
  });

  it('el atajo apunta que se está en la prueba, por su posición', async () => {
    render(
      <UnidadPorMomentos unit={DE_TEORIA} yaHecha teoria={<p>Lo que hay</p>} prueba={<p>P</p>} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Ir directo a las preguntas' }));

    expect(JSON.parse(sessionStorage.getItem('caos-ordenado:sitio:e1-grados')!)).toMatchObject({
      momento: 2,
    });
  });

  // Lo guardado de una de teoría no saca la teoría en una que no la tiene.
  it('un momento guardado que la unidad no tiene se queda en la presentación', () => {
    sessionStorage.setItem('caos-ordenado:sitio:e1-escala', JSON.stringify({ momento: 1 }));

    render(<UnidadPorMomentos unit={DE_TOCAR} prueba={<p>El mástil</p>} />);

    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument();
  });
});

/**
 * El servidor no sabe qué hay en el almacenamiento de la pestaña, y lo que pinta
 * tiene que coincidir con la primera pintura del cliente: el atajo llega después.
 */
describe('en el servidor', () => {
  it('empieza por la presentación aunque la unidad se dejara a medias', () => {
    sessionStorage.setItem('caos-ordenado:sitio:e1-grados', JSON.stringify({ momento: 2 }));

    const html = renderToString(
      <UnidadPorMomentos unit={DE_TEORIA} teoria={<p>Lo que hay</p>} prueba={<p>P</p>} />,
    );

    expect(html).toContain('Empezar');
    expect(html).not.toContain('Ir directo a las preguntas');
  });
});

/**
 * Enfocar el título lo trae a la vista pegado al borde de arriba, y en un
 * teléfono la fila de momentos quedaba recortada por el marco justo al cambiar
 * de momento. Se reserva lo que mide esa fila más el hueco, medido y no escrito.
 */
describe('al cambiar de momento, la fila de momentos sigue a la vista', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('el título reserva por encima el alto de la fila de momentos', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 28,
    } as DOMRect);
    render(
      <UnidadPorMomentos unit={DE_TEORIA} teoria={<p>Lo que hay</p>} prueba={<p>Preguntas</p>} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    const titulo = screen.getByRole('heading', { name: 'Lo que hay que saber' });
    expect(titulo).toHaveFocus();
    expect(titulo.style.scrollMarginTop).toBe('28px');
  });

  it('y suma el hueco entre la fila y el título, que es el de la columna', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 28,
    } as DOMRect);
    // jsdom no calcula el `gap`: se le pone a lo que devuelve, sin quitarle el resto.
    const calcular = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((elemento) => {
      const estilo = calcular(elemento);
      Object.defineProperty(estilo, 'rowGap', { value: '16px' });
      return estilo;
    });
    render(
      <UnidadPorMomentos unit={DE_TEORIA} teoria={<p>Lo que hay</p>} prueba={<p>Preguntas</p>} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(
      screen.getByRole('heading', { name: 'Lo que hay que saber' }).style.scrollMarginTop,
    ).toBe('44px');
  });
});
