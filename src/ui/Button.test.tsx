// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

  /**
   * **El que trabaja no suelta el foco.** Apagado con `disabled` mientras
   * trabajaba, el navegador mandaba el foco al `<body>` y el lector de pantalla
   * perdía el sitio. Con `aria-disabled` sigue enfocado y el clic no hace nada.
   */
  it('cargando no se apaga: se queda con el foco y no hace caso del clic', () => {
    const pulsado = vi.fn();
    const { rerender } = render(<Button onClick={pulsado}>Entrar</Button>);
    const boton = screen.getByRole('button', { name: 'Entrar' });
    boton.focus();

    rerender(
      <Button onClick={pulsado} cargando>
        Entrar
      </Button>,
    );
    fireEvent.click(boton);

    expect(boton).not.toBeDisabled();
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(boton).toHaveFocus();
    expect(pulsado).not.toHaveBeenCalled();

    rerender(<Button onClick={pulsado}>Entrar</Button>);
    fireEvent.click(boton);

    expect(boton).not.toHaveAttribute('aria-disabled');
    expect(pulsado).toHaveBeenCalledTimes(1);
  });

  // Y el clic es lo que manda un formulario: cancelado, no se manda dos veces.
  it('cargando, el de enviar no manda el formulario', () => {
    const enviado = vi.fn((evento: React.FormEvent) => evento.preventDefault());
    render(
      <form onSubmit={enviado}>
        <Button type="submit" cargando>
          Mandar
        </Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mandar' }));

    expect(enviado).not.toHaveBeenCalled();
  });

  it('un aria-disabled de fuera se respeta', () => {
    render(<Button aria-disabled>Vale</Button>);

    expect(screen.getByRole('button', { name: 'Vale' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('estiloBoton da lo mismo para un enlace', () => {
    expect(estiloBoton()).toContain('bg-brass');
    expect(estiloBoton('quiet', 'w-full', 'compacto')).toContain('text-sm');
    expect(estiloBoton('quiet', 'w-full', 'compacto')).toContain('w-full');
  });
});
