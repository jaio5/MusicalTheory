// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Formulario } from './Formulario';

/**
 * El formulario de esta aplicación.
 *
 * Dos cosas, y las dos son fallos que ya pasaron: que **no recargue la página**
 * al enviar —sin `preventDefault` se pierde lo escrito y no corre nada— y que
 * **no saque las burbujas del navegador**, que las escribe en su idioma: encima
 * de un formulario en español salía «Please fill out this field».
 */
describe('un formulario', () => {
  it('envia sin recargar la pagina', async () => {
    const enviar = vi.fn();
    render(
      <Formulario onEnviar={enviar}>
        <button type="submit">Enviar</button>
      </Formulario>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(enviar).toHaveBeenCalledOnce();
  });

  /**
   * Y un campo obligatorio vacío **no lo para el navegador**: lo para quien
   * envía, y lo cuenta en español. `required` se queda porque un lector de
   * pantalla lo anuncia, pero deja de ser lo que aborta el envío.
   */
  it('un campo obligatorio vacio no saca la burbuja del navegador', async () => {
    const enviar = vi.fn();
    render(
      <Formulario onEnviar={enviar}>
        <input aria-label="Correo" required defaultValue="" />
        <button type="submit">Enviar</button>
      </Formulario>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(enviar).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Correo')).toBeRequired();
  });
});
