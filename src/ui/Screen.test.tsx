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
