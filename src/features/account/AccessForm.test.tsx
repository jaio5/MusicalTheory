// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import type * as Cuenta from '@state/account';
import { AccountProvider } from '@state/account';

import { AccessForm } from './AccessForm';

const refrescar = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refrescar, push: () => {} }),
  usePathname: () => '/cuenta',
}));

const signInWithPassword = vi.fn();
const registerAccount = vi.fn();

vi.mock('@state/account', async (original) => ({
  ...(await original<typeof Cuenta>()),
  signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
  registerAccount: (...a: unknown[]) => registerAccount(...a),
}));

/**
 * Entrar o crear una cuenta, en el mismo formulario.
 *
 * En el mismo y con un interruptor arriba, no en dos pantallas: la mitad de las
 * veces uno no se acuerda de si ya tenía cuenta aquí, y mandarle a otra dirección
 * para descubrirlo es perder el sitio donde estaba. Lo que cambia según de dónde
 * vengas es cuál de los dos viene puesto.
 *
 * Lo que se prueba con más cuidado son **los `autoComplete`**: son los que el
 * navegador espera para ofrecer la contraseña guardada, y ponerlos mal es la
 * razón por la que algunos formularios no la ofrecen nunca. No se ve mirando la
 * pantalla, solo usándola durante meses.
 */

function pintar(props = {}, accounts = true) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={accounts}>
      <AccessForm {...props} />
    </AccountProvider>,
  );
}

beforeEach(() => {
  refrescar.mockReset();
  signInWithPassword.mockReset();
  signInWithPassword.mockResolvedValue({ ok: true });
  registerAccount.mockReset();
  registerAccount.mockResolvedValue({ ok: true });
});

describe('sin cuentas configuradas', () => {
  it('se dice, y se dice que lo demás funciona igual', () => {
    pintar({}, false);

    expect(screen.getByText(/no hay cuentas configuradas/i)).toBeInTheDocument();
    expect(screen.getByText(/se guarda en este navegador/i)).toBeInTheDocument();
    // Y no que lo único que falta es llevárselo: el profesor y lo del plan tampoco.
    expect(screen.queryByText(/Lo único que no hay/)).not.toBeInTheDocument();
    expect(screen.getByText(/el profesor y lo que abre un plan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  // Un «no hay» sin salida deja a quien llega parado: lo que sigue es aprender.
  it('ofrece seguir, que es lo que se puede hacer', () => {
    pintar({}, false);

    expect(screen.getByRole('link', { name: 'Seguir aprendiendo' })).toHaveAttribute(
      'href',
      '/aprender',
    );
  });
});

describe('cuál de los dos viene puesto', () => {
  it('por defecto, entrar', () => {
    pintar();

    expect(screen.getByRole('button', { name: 'Ya tengo cuenta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('en la pantalla de registro, crear', () => {
    pintar({ inicial: 'crear' });

    expect(screen.getByRole('button', { name: 'Crear una' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Crear la cuenta' })).toBeInTheDocument();
  });

  it('el interruptor sigue estando, porque uno no se acuerda', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Crear una' }));

    expect(screen.getByRole('button', { name: 'Crear la cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Cómo te llamas/)).toBeInTheDocument();
  });
});

describe('lo que espera el navegador para ofrecer la contraseña guardada', () => {
  it('al entrar, la contraseña de siempre', () => {
    pintar();

    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('autocomplete', 'current-password');
  });

  it('al crear, una nueva: es lo que hace que la proponga', () => {
    pintar({ inicial: 'crear' });

    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('la contraseña es un campo de contraseña de verdad', () => {
    pintar();

    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('type', 'password');
  });
});

describe('el marco y la contraseña a la vista', () => {
  // Entrar iba suelto y crear en tarjeta: el mismo formulario con dos caras.
  it('con `marco` va en la tarjeta, y sin él, suelto', () => {
    const { unmount } = pintar({ marco: true });
    expect(screen.getByRole('region', { name: 'Entrar' })).toHaveClass('superficie-viva');
    unmount();

    pintar({ marco: true, inicial: 'crear' });
    expect(screen.getByRole('region', { name: 'Crear la cuenta' })).toBeInTheDocument();
  });

  it('sin `marco` no hay tarjeta', () => {
    pintar();

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('la contraseña se puede ver y volver a esconder', async () => {
    pintar();
    const ver = screen.getByRole('button', { name: 'Mostrar la contraseña' });

    await userEvent.click(ver);
    expect(ver).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('type', 'text');

    await userEvent.click(ver);
    expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute('type', 'password');
  });

  it('el campo vacío dice que falta, y uno mal escrito que no tiene buena pinta', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByLabelText(/Correo/)).toHaveAccessibleDescription('Falta el correo.');

    await userEvent.type(screen.getByLabelText(/Correo/), 'nada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByLabelText(/Correo/)).toHaveAccessibleDescription(/no tiene buena pinta/);
  });
});

describe('entrar', () => {
  // Apagado no decía qué faltaba: se pulsa, y lo que falta se dice en su campo.
  it('sin los dos campos, lleva al que falta y dice qué le pasa', async () => {
    pintar();
    const entrar = screen.getByRole('button', { name: 'Entrar' });

    expect(entrar).toBeEnabled();
    await userEvent.click(entrar);
    expect(screen.getByLabelText(/Correo/)).toHaveFocus();
    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.click(entrar);
    expect(screen.getByLabelText(/Contraseña/)).toHaveFocus();
    expect(screen.getByLabelText(/Contraseña/)).toHaveAccessibleDescription('Falta la contraseña.');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('al crear, la contraseña corta no se envía y se dice el mínimo', async () => {
    // Es la misma regla que el servidor. Comprobarla aquí evita un viaje que
    // solo puede terminar en «es corta».
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    expect(registerAccount).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Contraseña/)).toHaveAccessibleDescription(/al menos 8/);
  });

  // Lo que se marcó al intentarlo en una pestaña no vale para la otra.
  it('cambiar de pestaña quita las marcas del intento anterior', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('aria-invalid', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Crear una' }));
    expect(screen.getByLabelText(/Correo/)).not.toHaveAttribute('aria-invalid');
  });

  it('al entrar se refrescan las dos cosas, y las dos hacen falta', async () => {
    // Sin la primera, el candado de al lado seguiría cerrado un instante; sin la
    // segunda, el avatar de arriba seguiría siendo el de nadie.
    const alTerminar = vi.fn();
    pintar({ onDone: alTerminar });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(refrescar).toHaveBeenCalled());
    expect(alTerminar).toHaveBeenCalled();
  });

  /**
   * La burbuja de `type="email"` la escribe el navegador en su idioma, y aquí se
   * veía «Please include an '@'» encima de un formulario en español. Se
   * comprueba aquí y se dice con el `Aviso` de siempre.
   */
  it('un correo que no lo parece se dice aqui, y no se llama a nadie', async () => {
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'javier@sin-arroba');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Correo/)).toHaveFocus();
    expect(screen.getByLabelText(/Correo/)).toHaveAccessibleDescription(/no tiene buena pinta/);
  });

  it('el error se anuncia, para quien no ve la pantalla', async () => {
    signInWithPassword.mockResolvedValue({ ok: false, message: 'El correo o la contraseña.' });
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const aviso = await screen.findByText('El correo o la contraseña.');
    expect(aviso).toHaveAttribute('aria-live', 'polite');
  });

  /**
   * **Mientras entra, el botón no suelta el foco.** Apagado con `disabled`, el
   * navegador mandaba el foco al `<body>` y quien no ve la pantalla perdía el
   * sitio justo al pulsar Intro. Sigue enfocado, dice que no está disponible y
   * otro clic no manda dos veces.
   */
  it('mientras entra, el boton se queda con el foco y no manda dos veces', async () => {
    signInWithPassword.mockReturnValue(new Promise(() => {}));
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const boton = await screen.findByRole('button', { name: /Un momento/ });
    await userEvent.click(boton);

    expect(boton).toHaveFocus();
    expect(boton).not.toBeDisabled();
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('un fallo sin frase tiene una de respaldo', async () => {
    signInWithPassword.mockResolvedValue({ ok: false });
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/No ha salido/)).toBeInTheDocument();
  });

  it('cambiar de pestaña borra el error de la anterior', async () => {
    signInWithPassword.mockResolvedValue({ ok: false, message: 'No entras.' });
    pintar();

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('No entras.');
    await userEvent.click(screen.getByRole('button', { name: 'Crear una' }));

    expect(screen.queryByText('No entras.')).not.toBeInTheDocument();
  });
});

describe('crear la cuenta', () => {
  it('el nombre solo viaja si se ha puesto', async () => {
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Sí, 14 o más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    await waitFor(() => expect(registerAccount).toHaveBeenCalled());
    expect(registerAccount.mock.calls[0]![2]).toBeUndefined();
  });

  it('y si se pone, va', async () => {
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Cómo te llamas/), 'Javi');
    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Sí, 14 o más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    await waitFor(() => expect(registerAccount.mock.calls[0]![2]).toBe('Javi'));
  });

  it('la edad declarada viaja, y sin ella no se manda nada', async () => {
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    // Sin elegir: se dice, y nadie llama al servidor.
    expect(screen.getByText('Falta decir si tienes 14 años o más.')).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Sí, 14 o más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));

    await waitFor(() => expect(registerAccount.mock.calls[0]![3]).toBe(true));
  });

  it('por debajo de catorce no hay cuenta, y se dice que sin ella funciona igual', async () => {
    pintar({ inicial: 'crear' });

    await userEvent.type(screen.getByLabelText(/Correo/), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'unaContrasenaLarga');
    await userEvent.click(screen.getByRole('button', { name: 'Tengo menos' }));

    expect(screen.getByText(/hace falta tener 14 años.*funciona igual/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Crear la cuenta' }));
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it('al entrar no se pregunta la edad: ya se dijo al crearla', () => {
    pintar();
    expect(screen.queryByRole('group', { name: /14 años/ })).not.toBeInTheDocument();
  });

  it('lleva a la política de privacidad', () => {
    pintar({ inicial: 'crear' });
    expect(screen.getByRole('link', { name: 'política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad',
    );
  });
});

describe('la contraseña olvidada', () => {
  it('el enlace esta solo al entrar', async () => {
    // En el formulario de crear cuenta no hay contraseña que recuperar todavía,
    // y ofrecerlo ahí despista.
    pintar();

    expect(screen.getByRole('link', { name: /He olvidado mi contraseña/ })).toHaveAttribute(
      'href',
      '/olvidada',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Crear una' }));

    expect(screen.queryByRole('link', { name: /He olvidado/ })).not.toBeInTheDocument();
  });
});
