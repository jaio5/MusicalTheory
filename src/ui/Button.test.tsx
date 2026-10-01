// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, estiloBoton } from './Button';

describe('el botón', () => {
  it('normal: 16 px, y no envía formularios sin querer', () => {
    render(<Button>Vale</Button>);
    const boton = screen.getByRole('button', { name: 'Vale' });

    expect(boton).toHaveClass('text-base', 'px-5', 'min-h-tap');
    expect(boton).toHaveAttribute('type', 'button');
    expect(boton).not.toHaveAttribute('aria-busy');
  });

  it('compacto: 14 px y menos relleno, con el mismo alto de dedo', () => {
    render(<Button tamano="compacto">Vale</Button>);
    const boton = screen.getByRole('button', { name: 'Vale' });

    expect(boton).toHaveClass('text-sm', 'px-4', 'min-h-tap');
    expect(boton).not.toHaveClass('text-base');
  });

  it('cargando marca aria-busy y dibuja la ruedecilla', () => {
    const { container } = render(
      <Button cargando type="submit" variant="danger" className="extra">
        Pensando
      </Button>,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button')).toHaveClass('extra');
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('estiloBoton da lo mismo para un enlace', () => {
    expect(estiloBoton()).toContain('bg-brass');
    expect(estiloBoton('quiet', 'w-full', 'compacto')).toContain('text-sm');
    expect(estiloBoton('quiet', 'w-full', 'compacto')).toContain('w-full');
  });
});
