// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { AccountProvider } from '@state/account';

import { PathScreen } from './PathScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/aprender',
}));

/**
 * El fallo que tuvo: al pulsar el muñeco en el camino desaparecía en vez de
 * abrirse. Se prueba **dentro de la pantalla entera** y no con el muñeco suelto,
 * porque suelto ya funcionaba: lo que fallaba era la combinación.
 */
describe('El profesor dentro del camino', () => {
  it('al pulsarlo se queda y abre el formulario', async () => {
    render(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <PathScreen />
      </AccountProvider>,
    );

    const muñeco = screen.getByRole('button', { name: /preguntarle al profesor/i });
    await userEvent.click(muñeco);

    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pregunta lo que quieras/i)).toBeInTheDocument();
  });
});
