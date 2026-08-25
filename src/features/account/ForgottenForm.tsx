'use client';

import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { Button } from '@ui/Button';

/** Lo que dijo el servidor, o una frase cuando no dijo nada legible. */
async function messageOf(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body.error?.message;
    return typeof message === 'string' && message !== '' ? message : fallback;
  } catch {
    return fallback;
  }
}

export interface ForgottenFormProps {
  /** El vale del enlace del correo, si se ha llegado por ahí. */
  readonly vale?: string;
  /** Se inyecta en los tests para no llamar al servidor de verdad. */
  readonly request?: (init: RequestInit & { method: string }) => Promise<Response>;
}

async function defaultRequest(init: RequestInit & { method: string }): Promise<Response> {
  return fetch('/api/cuenta/olvidada', {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Las dos mitades de recuperar la contraseña, en la misma pantalla.
 *
 * Sin vale, pide el correo. Con vale —se llega por el enlace— pide la contraseña
 * nueva. Una pantalla y no dos porque son un solo trámite partido por un correo,
 * y quien vuelve del buzón no está empezando nada: está terminando lo de hace un
 * minuto.
 *
 * Al pedir el enlace, la respuesta es la misma exista o no ese correo. Es la
 * misma regla que la pantalla de entrar, que no dice cuál de los dos campos
 * falló: si contestara distinto, esto sería un buscador de quién tiene cuenta.
 */
export function ForgottenForm({ vale, request = defaultRequest }: ForgottenFormProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const conVale = vale !== undefined && vale !== '';

  async function pedirEnlace(): Promise<void> {
    setError(null);
    setWorking(true);
    try {
      const response = await request({ method: 'POST', body: JSON.stringify({ email }) });
      if (!response.ok) {
        setError(await messageOf(response, 'No hemos podido mandar el correo.'));
        return;
      }
      const body = (await response.json()) as { message?: unknown };
      setHecho(
        typeof body.message === 'string'
          ? body.message
          : 'Si ese correo tiene cuenta, le hemos mandado un enlace.',
      );
    } catch {
      setError('No hemos podido mandar el correo. Comprueba la conexión.');
    } finally {
      setWorking(false);
    }
  }

  async function cambiar(): Promise<void> {
    setError(null);
    setWorking(true);
    try {
      const response = await request({
        method: 'PUT',
        body: JSON.stringify({ vale, password }),
      });
      if (!response.ok) {
        setError(await messageOf(response, 'No hemos podido cambiar la contraseña.'));
        return;
      }
      setHecho('Contraseña cambiada. Ya puedes entrar con ella.');
    } catch {
      setError('No hemos podido cambiar la contraseña. Comprueba la conexión.');
    } finally {
      setWorking(false);
    }
  }

  if (hecho !== null) {
    return (
      <div className="max-w-prose">
        <p className="text-text text-sm" role="status">
          {hecho}
        </p>
        {conVale && (
          <p className="text-text-muted mt-3 text-sm">
            Las sesiones que hubiera abiertas en otros aparatos se han cerrado.
          </p>
        )}
      </div>
    );
  }

  const coinciden = password === repetida;
  const puede = conVale
    ? password.length >= MIN_PASSWORD_LENGTH && coinciden && !working
    : email !== '' && !working;

  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void (conVale ? cambiar() : pedirEnlace());
      }}
    >
      {conVale ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Contraseña nueva</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Otra vez, para comprobarla</span>
            <input
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(event) => setRepetida(event.target.value)}
              className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
            />
          </label>
          {repetida !== '' && !coinciden && (
            <p className="text-text-muted text-xs">Las dos no son la misma.</p>
          )}
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-xs">Tu correo</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
          />
        </label>
      )}

      {error !== null && (
        <p className="text-oxblood-bright text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="w-fit">
        <Button type="submit" disabled={!puede}>
          {conVale ? 'Poner esta contraseña' : 'Mandarme el enlace'}
        </Button>
      </div>
    </form>
  );
}
