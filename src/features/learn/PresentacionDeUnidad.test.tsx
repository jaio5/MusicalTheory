// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName } from '@core/music';
import { useSessionStore } from '@state/session-store';

import { PresentacionDeUnidad } from './PresentacionDeUnidad';

const PRESENTACION = {
  resumen: 'Siete nombres y unas alteraciones que los mueven.',
  contenidos: ['Los siete nombres', 'Sostenido y bemol', 'Tono y semitono'],
};

function pintar(props: Partial<Parameters<typeof PresentacionDeUnidad>[0]> = {}) {
  return render(
    <PresentacionDeUnidad
      titulo="Las notas"
      presentacion={PRESENTACION}
      queViene="Luego te pregunto justo esto."
      hayTonalidad
      encabezado={null}
      onEmpezar={() => {}}
      {...props}
    />,
  );
}

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

/**
 * Lo que se cuenta antes de empezar. La lista es la promesa: lo que luego se
 * pregunta, así que tiene que estar entera y en su orden.
 */
describe('la presentación de una unidad', () => {
  it('dice de qué va, qué entra y qué viene después', () => {
    pintar();

    const region = screen.getByRole('region', { name: 'Las notas' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Las notas' })).toBeVisible();
    expect(within(region).getByText(PRESENTACION.resumen)).toBeInTheDocument();
    expect(within(region).getByRole('heading', { level: 3, name: 'En esta unidad' })).toBeVisible();
    expect(
      within(region)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(PRESENTACION.contenidos);
    expect(within(region).getByText('Luego te pregunto justo esto.')).toBeInTheDocument();
  });

  // El título recibe el foco por código, pero no es una parada del tabulador.
  it('el título se puede enfocar sin ser una parada más', () => {
    pintar();

    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('tabindex', '-1');
  });

  it('empezar avisa a quien la monta', async () => {
    const empezar = vi.fn();
    pintar({ onEmpezar: empezar });

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(empezar).toHaveBeenCalledOnce();
  });

  it('la segunda salida solo sale si se la pasan', async () => {
    const atajo = vi.fn();
    const { unmount } = pintar();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    unmount();

    pintar({ atajo: { etiqueta: 'Ir directo', onClick: atajo } });
    await userEvent.click(screen.getByRole('button', { name: 'Ir directo' }));

    expect(atajo).toHaveBeenCalledOnce();
  });

  /**
   * Sin tonalidad se ofrece aquí mismo, a un toque: decir «elígela arriba» sería
   * señalar en vez de ofrecer. Y elegir una la pone de verdad.
   */
  it('sin tonalidad ofrece cuatro, y elegir una la pone', async () => {
    pintar({ hayTonalidad: false });

    await userEvent.click(screen.getByRole('button', { name: 'G mayor' }));

    expect(useSessionStore.getState().pinnedKey).toEqual({
      tonic: pitchClassFromName('G'),
      mode: 'major',
    });
  });

  it('con tonalidad no ofrece ninguna', () => {
    pintar();

    expect(screen.queryByRole('button', { name: 'C mayor' })).not.toBeInTheDocument();
  });
});
