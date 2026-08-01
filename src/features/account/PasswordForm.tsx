'use client';

import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { updateAccount, useAccount } from '@state/account';
import { Button } from '@ui/Button';

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
  const { refresh } = useAccount();
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
      setActual('');
      setNueva('');
      setRepetida('');
      setHecho(true);
      await refresh();
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
      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">La de ahora</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={actual}
          onChange={(event) => setActual(event.target.value)}
          className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">
          La nueva · mínimo {MIN_PASSWORD_LENGTH} caracteres
        </span>
        <input
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          value={nueva}
          onChange={(event) => setNueva(event.target.value)}
          className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">Otra vez la nueva</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={repetida}
          onChange={(event) => setRepetida(event.target.value)}
          className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
        />
      </label>

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
          Cambiada. La próxima vez que entres, con la nueva.
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
