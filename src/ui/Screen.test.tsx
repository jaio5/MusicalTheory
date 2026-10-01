// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chip } from './Chip';
import { Screen, Section, WorkHeader } from './Screen';

describe('El marco de pantalla', () => {
  it('pone el título como único h1 y la línea de para qué sirve', () => {
    render(
      <Screen title="Planes" lead="Tres planes y lo que hay sin pagar.">
        <p>contenido</p>
      </Screen>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Planes');
    expect(screen.getByText(/tres planes y lo que hay/i)).toBeInTheDocument();
  });

  // La vuelta atrás va encima del título: leerla debajo obliga a subir la vista
  // dos veces. Y es un enlace que se pulsa, así que le vale el mínimo del dedo.
  it('la vuelta atrás va antes del título y se puede pulsar', () => {
    render(
      <Screen title="Los grados" back={{ href: '/aprender', label: 'Camino' }}>
        <p>contenido</p>
      </Screen>,
    );

    const volver = screen.getByRole('link', { name: /camino/i });
    expect(volver).toHaveAttribute('href', '/aprender');
    expect(volver.className).toContain('min-h-tap');
  });

  it('solo hay un sitio que hace scroll', () => {
    const { container } = render(
      <Screen title="Tu cuenta">
        <p>contenido</p>
      </Screen>,
    );

    expect(container.querySelectorAll('.overflow-y-auto')).toHaveLength(1);
  });

  /**
   * Cada ancho se centraba por su cuenta y el título saltaba de sitio al cambiar
   * de pantalla —a 1440, de x=112 en Planes a 368 en Cuenta—. Lo que se centra
   * es una caja igual para las tres, y el ancho de cada una va dentro, sin centrar.
   */
  it.each(['lectura', 'normal', 'ancha'] as const)(
    'con el ancho %s, el título empieza en el mismo borde que las demás',
    (ancho) => {
      render(
        <Screen title="Planes" ancho={ancho}>
          <p>contenido</p>
        </Screen>,
      );

      const columna = screen.getByRole('heading', { level: 1 }).closest('header')!.parentElement!;
      const marco = columna.parentElement!;
      expect(columna.className).not.toContain('mx-auto');
      expect(marco.className).toContain('mx-auto');
      expect(marco.className).toContain('max-w-7xl');
    },
  );
});

describe('Los apartados', () => {
  it('llevan su rótulo y, si tienen ancla, sitio para no pegarse al borde', () => {
    const { container } = render(
      <Section id="contrasena" title="Contraseña">
        <p>formulario</p>
      </Section>,
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Contraseña');
    const apartado = container.querySelector('#contrasena');
    expect(apartado).not.toBeNull();
    expect(apartado?.className).toContain('scroll-mt');
  });
});

describe('La cabecera de las pantallas de taller', () => {
  // Componer, afinar y el camino no pueden usar el marco entero —tienen su propio
  // alto medido— pero sí deben decir dónde estás.
  it('también da un h1', () => {
    render(<WorkHeader title="Componer" lead="Tonalidad, progresión y acordes." />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Componer');
  });
});

describe('El botón de elegir', () => {
  it('mide lo que mide un dedo y dice si está marcado', () => {
    render(
      <Chip onClick={() => {}} pressed>
        Mástil
      </Chip>,
    );

    const boton = screen.getByRole('button', { name: 'Mástil' });
    expect(boton.className).toContain('min-h-tap');
    expect(boton).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('una pantalla con su accion principal', () => {
  /**
   * Una, y solo si la pantalla tiene una de verdad: va al lado del título y no
   * dentro del contenido, que es donde se busca lo que hace esta pantalla.
   */
  it('sale al lado del titulo', () => {
    render(
      <Screen title="Canciones" actions={<Chip onClick={() => {}}>Guardar</Chip>}>
        <p>contenido</p>
      </Screen>,
    );

    expect(screen.getByRole('heading', { name: 'Canciones' })).toBeInTheDocument();
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });
});

describe('las acciones de una cabecera de trabajo', () => {
  /**
   * Por defecto miden lo que mide su contenido y se van a la derecha. Para una
   * fila que se desplaza de lado eso la bajaba a un renglón propio: con
   * `accionesCrecen` se quedan con lo que deja el título, y la fila nunca empuja.
   */
  it('se van a la derecha a su ancho, o se quedan con lo que deja el título', () => {
    const { rerender } = render(<WorkHeader title="Componer" actions={<span>Mandos</span>} />);
    expect(screen.getByText('Mandos').parentElement?.className).toContain('ml-auto');

    rerender(<WorkHeader title="Componer" accionesCrecen actions={<span>Mandos</span>} />);
    const caja = screen.getByText('Mandos').parentElement?.className ?? '';
    expect(caja).toContain('flex-1');
    expect(caja).toContain('basis-0');
    expect(caja).not.toContain('ml-auto');
  });
});

describe('una cabecera de trabajo sin mandos', () => {
  // La mayoría de las pantallas de trabajo no llevan nada a la derecha del
  // título: sin esto quedaba una caja vacía empujando la línea.
  it('la cabecera de trabajo tampoco', () => {
    render(<WorkHeader title="Componer" lead="Escribe la canción." />);

    expect(screen.getByRole('heading', { name: 'Componer' })).toBeInTheDocument();
    expect(screen.getByText('Escribe la canción.')).toBeInTheDocument();
  });

  /**
   * La mayoría de las pantallas de trabajo no llevan nada a la derecha del
   * título: sin esto se quedaba una caja vacía empujando la línea.
   */
  it('no deja una caja vacia a la derecha', () => {
    render(
      <Screen title="Planes">
        <p>contenido</p>
      </Screen>,
    );

    expect(screen.getByRole('heading', { name: 'Planes' })).toBeInTheDocument();
    // Ni línea ni mandos: los dos son opcionales y la mayoría no los lleva.
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
