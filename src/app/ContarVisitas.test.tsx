// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const contar = vi.fn();
let ruta = '/afinar';

vi.mock('@state/metricas', () => ({ contar: (...a: unknown[]) => contar(...a) }));
vi.mock('next/navigation', () => ({ usePathname: () => ruta }));

const { ContarVisitas } = await import('./ContarVisitas');

describe('las visitas', () => {
  it('una por pantalla, y otra al cambiar de pantalla, no al repintar', () => {
    const { rerender, container } = render(<ContarVisitas />);
    rerender(<ContarVisitas />);
    ruta = '/componer';
    rerender(<ContarVisitas />);

    expect(contar.mock.calls).toEqual([
      ['visita', '/afinar'],
      ['visita', '/componer'],
    ]);
    expect(container).toBeEmptyDOMElement();
  });
});
