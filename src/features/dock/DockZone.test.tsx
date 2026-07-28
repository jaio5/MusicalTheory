// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ZoneLayout } from '@state/workspace';

import { DockZone } from './DockZone';

const PANELS = [
  { id: 'chord' as const, name: 'Acorde', render: () => <p>Contenido del acorde</p> },
  { id: 'tuner' as const, name: 'Afinador', render: () => <p>Contenido del afinador</p> },
];

const LAYOUT: ZoneLayout = { panels: ['chord', 'tuner'], active: 'chord', size: 240 };

function renderZone(overrides: Partial<Parameters<typeof DockZone>[0]> = {}) {
  const props = {
    zone: 'left' as const,
    layout: LAYOUT,
    panels: PANELS,
    dragging: null,
    onDragPanel: vi.fn(),
    onDrop: vi.fn(),
    onActivate: vi.fn(),
    onMove: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<DockZone {...props} />);
  return props;
}

describe('Zona del dock', () => {
  it('enseña solo el panel que está al frente', () => {
    renderZone();

    expect(screen.getByText('Contenido del acorde')).toBeInTheDocument();
    expect(screen.queryByText('Contenido del afinador')).not.toBeInTheDocument();
  });

  it('marca cuál es la pestaña activa para quien no la ve', () => {
    renderZone();

    expect(screen.getByRole('tab', { name: 'Acorde' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Afinador' })).toHaveAttribute('aria-selected', 'false');
  });

  it('cambia de pestaña al pulsarla', () => {
    const props = renderZone();

    fireEvent.click(screen.getByRole('tab', { name: 'Afinador' }));

    expect(props.onActivate).toHaveBeenCalledWith('tuner');
  });

  it('mueve un panel a otra zona sin arrastrar', () => {
    const props = renderZone();

    fireEvent.change(screen.getByRole('combobox', { name: /mover acorde/i }), {
      target: { value: 'bottom' },
    });

    expect(props.onMove).toHaveBeenCalledWith('chord', 'bottom');
  });

  it('cierra el panel del frente', () => {
    const props = renderZone();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Acorde' }));

    expect(props.onClose).toHaveBeenCalledWith('chord');
  });

  it('coloca lo que se suelta en el sitio de la pestaña donde cae', () => {
    const props = renderZone();
    const data = { getData: () => 'tuner', setData: vi.fn() };

    fireEvent.drop(screen.getByRole('tab', { name: 'Acorde' }), { dataTransfer: data });

    expect(props.onDrop).toHaveBeenCalledWith('tuner', 0);
  });

  it('dice qué hacer cuando la zona se queda vacía', () => {
    renderZone({ layout: { panels: [], active: null, size: 240 } });

    expect(screen.getByText(/zona vacía/i)).toBeInTheDocument();
  });
});
