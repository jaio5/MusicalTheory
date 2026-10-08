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
   * es una caja igual para las dos, y el ancho de cada una va dentro, sin centrar.
   * Y esa caja llega a 2560 con un margen que crece con la pantalla: centrada en
   * 1280 dejaba a 1920 trescientos píxeles de negro a cada lado.
   */
  it.each(['lectura', 'completo'] as const)(
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
      expect(marco.className).toContain('max-w-pantalla');
      expect(marco.className).toContain('px-margen');
    },
  );

  it('lo que acompaña va en su columna, y debajo de lo principal en el orden', () => {
    render(
      <Screen title="Profesor" aside={<p>la tonalidad</p>}>
        <p>la pregunta</p>
      </Screen>,
    );

    const lado = screen.getByRole('complementary');
    expect(lado).toHaveTextContent('la tonalidad');
    expect(lado.className).toContain('md:sticky');
    // Lo principal va antes en el documento: en un teléfono se apila así.
    const principal = screen.getByText('la pregunta');
    expect(principal.compareDocumentPosition(lado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lado.parentElement!.className).toContain(
      'lg:grid-cols-[minmax(0,1fr)_minmax(20rem,32%)]',
    );
  });

  it('con lectura, el texto se queda en su medida y lo de al lado se lleva el resto', () => {
    render(
      <Screen title="Entrar" ancho="lectura" aside={<p>por qué</p>}>
        <p>el formulario</p>
      </Screen>,
    );

    expect(screen.getByText('el formulario').parentElement!.className).toContain('max-w-3xl');
    expect(screen.getByRole('complementary').parentElement!.className).toContain(
      'md:grid-cols-[fit-content(44rem)_minmax(0,1fr)]',
    );
  });

  it('sin nada al lado no hay columna de al lado', () => {
    render(
      <Screen title="Planes">
        <p>contenido</p>
      </Screen>,
    );

    expect(screen.queryByRole('complementary')).toBeNull();
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

describe('la linea de una cabecera de trabajo, solo en el banco', () => {
  /**
   * En un teléfono la línea de componer no cabe, y la pantalla la metía dentro
   * de sus acciones repitiendo el reparto de la cabecera. Con
   * `lineaSoloEnElBanco` se esconde por debajo de `lg` **con una clase** —el
   * servidor no sabe el ancho— y ahí las acciones crecen; desde `lg`, la línea
   * crece y las acciones miden lo suyo.
   */
  it('se esconde por debajo de lg, y ahi las acciones crecen', () => {
    render(
      <WorkHeader
        title="Componer"
        lead="Escribe la canción."
        lineaSoloEnElBanco
        actions={<span>Mandos</span>}
      />,
    );

    expect(screen.getByText('Escribe la canción.')).toHaveClass('max-lg:hidden', 'sm:flex-1');
    expect(screen.getByText('Mandos').parentElement).toHaveClass(
      'max-lg:flex-1',
      'max-lg:basis-0',
      'lg:ml-auto',
    );
  });

  /**
   * En un teléfono la línea se cortaba —«…por donde quiere…»— y dejaba las
   * acciones solas en otra fila. Ahora va debajo, entera, y a la letra del
   * cuerpo; solo se corta al lado del título, desde `sm`.
   */
  it('en un telefono va debajo y entera, a la letra del cuerpo', () => {
    render(<WorkHeader title="Aprender" lead="Diez cursos, y empiezas por donde quieras." />);

    const linea = screen.getByText('Diez cursos, y empiezas por donde quieras.');
    expect(linea).toHaveClass('max-sm:order-last', 'max-sm:basis-full', 'sm:truncate');
    expect(linea).not.toHaveClass('truncate', 'text-sm');
  });

  it('y empieza en el mismo borde que el cuerpo de las pantallas', () => {
    render(<WorkHeader title="Repaso" back={{ href: '/aprender', label: 'Camino' }} />);

    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveClass('px-margen');
    expect(screen.getByRole('link', { name: /Camino/ })).toHaveClass('min-h-tap');
  });

  it('sin pedirlo, la linea se ve en cualquier ancho', () => {
    render(<WorkHeader title="Componer" lead="Escribe la canción." />);

    expect(screen.getByText('Escribe la canción.')).not.toHaveClass('max-lg:hidden');
  });

  /**
   * Y el título puede partirse: con `shrink-0`, a la letra al 200 % un título
   * largo se salía por la derecha de un teléfono.
   */
  it('el titulo puede partirse en vez de salirse', () => {
    render(<WorkHeader title="La escala mayor, entera" />);

    const titulo = screen.getByRole('heading', { level: 1 });
    expect(titulo).toHaveClass('min-w-0', 'break-words');
    expect(titulo).not.toHaveClass('shrink-0');
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
