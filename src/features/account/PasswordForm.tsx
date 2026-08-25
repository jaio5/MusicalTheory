'use client';

import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { signInWithPassword, updateAccount, useAccount } from '@state/account';
import { Button } from '@ui/Button';
import { TextField } from '@ui/TextField';

/**
 * Cambiar la contraseña.
 *
 * Pide la de ahora aunque ya estés dentro, y el servidor la comprueba otra vez:
 * una sesión abierta en un ordenador prestado no puede bastar para quedarse con
 * la cuenta. Lo que se escribe aquí no se guarda en ningún estado que sobreviva
 * al envío —los tres campos se vacían al terminar— porque una contraseña en
 * memoria es una contraseña que acaba en una traza de error.
 *
 * Los `autoComplete` son los que el navegador espera para ofrecer la guardada y
 * para proponer una nueva; puestos mal, el gestor de contraseñas no se entera de
 * que ha cambiado nada.
 */
export function PasswordForm() {
  const { account: cuenta, refresh } = useAccount();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [working, setWorking] = useState(false);

  const coinciden = nueva === repetida;
  const puede = actual !== '' && nueva.length >= MIN_PASSWORD_LENGTH && coinciden && !working;

  async function submit(): Promise<void> {
    setError(null);
    setHecho(false);
    setWorking(true);
    try {
      const result = await updateAccount({ passwordActual: actual, passwordNueva: nueva });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      // **Se vuelve a entrar, con la nueva.** Cambiar la contraseña sube la
      // versión de sesión de la cuenta, y eso invalida todas las cookies
      // firmadas antes —incluida la de esta pestaña—. Sin esta línea, cambiar la
      // contraseña te echaba a ti también: la pantalla decía «hecho» y un
      // segundo después «entra con tu cuenta».
      //
      // Se descubrió la primera vez que esto se ejecutó contra Postgres. Ningún
      // test podía verlo: sin cookie no hay versión que dejar de cuadrar.
      const dentro = await signInWithPassword(cuenta.email ?? '', nueva);

      setActual('');
      setNueva('');
      setRepetida('');
      setHecho(true);
      if (dentro.ok) {
        await refresh();
      } else {
        // La contraseña se cambió igual: lo que ha fallado es volver a entrar.
        // Decirlo es mejor que dejar la pantalla diciendo que todo fue bien
        // mientras la sesión está muerta.
        setError('La contraseña es la nueva, pero hay que volver a entrar con ella.');
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TextField
        label="La de ahora"
        type="password"
        required
        autoComplete="current-password"
        value={actual}
        onChange={(event) => setActual(event.target.value)}
      />

      <TextField
        label="La nueva"
        extra={<span> · mínimo {MIN_PASSWORD_LENGTH} caracteres</span>}
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        value={nueva}
        onChange={(event) => setNueva(event.target.value)}
      />

      <TextField
        label="Otra vez la nueva"
        type="password"
        required
        autoComplete="new-password"
        value={repetida}
        onChange={(event) => setRepetida(event.target.value)}
      />

      {/* Que no coincidan se dice antes de enviar y no después: el servidor no
          puede saberlo, y descubrirlo al volver obligaría a escribirla otra vez. */}
      {repetida !== '' && !coinciden && (
        <p className="text-oxblood-bright text-sm">Las dos nuevas no son la misma.</p>
      )}

      {error !== null && (
        <p className="text-oxblood-bright text-sm" aria-live="polite">
          {error}
        </p>
      )}
      {hecho && (
        <p className="text-tube-bright text-sm" aria-live="polite">
          Cambiada. Las sesiones que hubiera abiertas en otros aparatos se han cerrado.
        </p>
      )}

      <div>
        <Button type="submit" disabled={!puede}>
          {working ? 'Un momento...' : 'Cambiar la contraseña'}
        </Button>
      </div>

      <p className="text-text-muted text-xs">
        Se guarda cifrada con scrypt, nunca en claro, y cambiarla no cierra la sesión que tienes
        abierta aquí.
      </p>
    </form>
  );
}
