'use client';

import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { apiErrorFrom } from '@state/api-error';
import { Button } from '@ui/Button';
import { TextField } from '@ui/TextField';
import { Aviso } from '@ui/Aviso';

import { CORREO_MAL, pareceUnCorreo } from './correo';
import { Formulario } from '@ui/Formulario';

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
    // Igual que en el formulario de entrar: la burbuja de `type="email"` la
    // escribe el navegador en su idioma, así que se comprueba aquí y se dice con
    // el `Aviso`, que es el sitio donde esta pantalla ya cuenta lo que pasa.
    if (!pareceUnCorreo(email)) {
      setError(CORREO_MAL);
      return;
    }

    setError(null);
    setWorking(true);
    try {
      const response = await request({ method: 'POST', body: JSON.stringify({ email }) });
      if (!response.ok) {
        setError((await apiErrorFrom(response, 'No hemos podido mandar el correo.')).message);
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
        setError((await apiErrorFrom(response, 'No hemos podido cambiar la contraseña.')).message);
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
    <Formulario onEnviar={() => (conVale ? cambiar() : pedirEnlace())}>
      {conVale ? (
        <>
          <TextField
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <TextField
            label="Otra vez, para comprobarla"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(event) => setRepetida(event.target.value)}
          />
          {repetida !== '' && !coinciden && (
            <p className="text-text-muted text-xs">Las dos no son la misma.</p>
          )}
        </>
      ) : (
        <TextField
          label="Tu correo"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      )}

      <Aviso mensaje={error} anuncio="urgente" />

      <div className="w-fit">
        <Button type="submit" disabled={!puede} cargando={working}>
          {working ? 'Un momento…' : conVale ? 'Poner esta contraseña' : 'Mandarme el enlace'}
        </Button>
      </div>
    </Formulario>
  );
}
