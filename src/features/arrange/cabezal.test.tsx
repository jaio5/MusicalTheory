// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { writtenBlock, type Part } from '@core/music';

import { crearCabezal, useBloqueQueSuena, type Cabezal } from './cabezal';

const ESTROFA: Part = {
  id: 'estrofa',
  name: 'Estrofa',
  blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'IV', 4)],
  notes: [],
  bars: 2,
};

function Fila({ cabezal }: { readonly cabezal: Cabezal }) {
  return <p>{useBloqueQueSuena(cabezal, ESTROFA) ?? 'nada'}</p>;
}

/**
 * Por dónde va la reproducción, fuera de React: cada fila lee lo suyo y las
 * demás leen nulo, que es lo que evita repintarlas.
 */
describe('El cabezal', () => {
  it('una fila lee el bloque que suena si es suyo, y nulo si no', () => {
    const cabezal = crearCabezal();
    render(<Fila cabezal={cabezal} />);

    expect(screen.getByText('nada')).toBeInTheDocument();
    act(() => cabezal.cambiarA('b'));
    expect(screen.getByText('b')).toBeInTheDocument();
    act(() => cabezal.cambiarA('de-otra-parte'));
    expect(screen.getByText('nada')).toBeInTheDocument();
  });

  // En el servidor no suena nada, aunque el cabezal diga otra cosa.
  it('pintado en el servidor, no suena nada', () => {
    const cabezal = crearCabezal();
    cabezal.cambiarA('a');

    expect(renderToString(<Fila cabezal={cabezal} />)).toContain('nada');
  });
});
