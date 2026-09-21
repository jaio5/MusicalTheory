// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TextField } from './TextField';

/**
 * Un campo de texto, con su etiqueta pegada.
 *
 * La etiqueta envuelve al campo en vez de apuntarle con un `for`: así no hay
 * identificadores que inventar ni que mantener únicos, y un campo sin etiqueta
 * deja de ser posible por construcción.
 */
describe('un campo de texto', () => {
  it('se encuentra por su etiqueta', () => {
    render(<TextField label="Correo" type="email" defaultValue="a@b.c" />);

    expect(screen.getByLabelText('Correo')).toHaveValue('a@b.c');
  });

  // La pista va debajo y solo si la hay: un hueco vacío desalinea el formulario.
  it('la pista sale solo cuando se da', () => {
    const { rerender } = render(<TextField label="Contraseña" hint="Ocho caracteres o más." />);
    expect(screen.getByText('Ocho caracteres o más.')).toBeInTheDocument();

    rerender(<TextField label="Contraseña" />);
    expect(screen.queryByText('Ocho caracteres o más.')).not.toBeInTheDocument();
  });
});

describe('un campo sin etiqueta a la vista', () => {
  /**
   * En una barra estrecha —guardar una canción, buscar un acorde— el rótulo
   * ocupa una línea que no hay. Se esconde a la vista y se le pone al campo,
   * que es lo que oye el lector de pantalla: quitarlo del todo dejaría un campo
   * sin nombre.
   */
  it('la etiqueta se esconde pero se sigue oyendo', () => {
    render(<TextField label="Nombre de la canción" compact extra={<span>· opcional</span>} />);

    expect(screen.getByRole('textbox')).toHaveAccessibleName('Nombre de la canción');
    // Y lo que va al lado del rótulo no se cuela en el nombre del campo.
    expect(screen.queryByText('· opcional')).not.toBeInTheDocument();
  });
});
