'use client';

import { useEffect, useRef, useState } from 'react';

import { useEnvio } from './use-envio';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { apiErrorFrom } from '@state/api-error';
import { Button } from '@ui/Button';
import { TextField } from '@ui/TextField';
import { Aviso } from '@ui/Aviso';

import { problemaDelCorreo } from './correo';
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
  // Su «hecho» es **el texto** de lo que salió bien y no un sí o un no, así que
  // se queda aquí: el sobre común le presta el error y el «en marcha».
  const { error, setError, working, enviar } = useEnvio();
  const [hecho, setHecho] = useState<string | null>(null);

  const conVale = vale !== undefined && vale !== '';

  /*
    El vale fuera de la barra de direcciones en cuanto se ha leído.

    Con él dentro, la dirección entera —vale incluido— se quedaba en el historial,
    en las pestañas sincronizadas de otros aparatos y en cualquier captura de
    pantalla: durante una hora, eso es una llave de la cuenta. El vale ya lo tiene
    este componente, así que la barra no lo necesita. `replaceState` y no
    `router.replace`: no hay que volver a pedir la página, solo cambiar lo que se
    lee arriba, y Next se entera igual («Native History API», en
    `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`).
  */
  useEffect(() => {
    if (!conVale) {
      return;
    }
    const direccion = new URL(window.location.href);
    if (!direccion.searchParams.has('vale')) {
      return;
    }
    direccion.searchParams.delete('vale');
    window.history.replaceState(window.history.state, '', direccion.toString());
  }, [conVale]);

  /*
    **El foco va al aviso cuando el formulario se va.** Lo que se pulsó era el
    botón de enviar, y al terminar ese botón deja de existir: el foco caía al
    `<body>`, el lector de pantalla no decía nada y el siguiente tabulador
    empezaba otra vez por la cabecera. Con el foco en la frase, se lee lo que ha
    pasado y se sigue desde ahí.
  */
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hecho !== null) {
      aviso.current?.focus();
    }
  }, [hecho]);

  async function pedirEnlace(): Promise<void> {
    // Igual que en el formulario de entrar: la burbuja de `type="email"` la
    // escribe el navegador en su idioma, así que se comprueba aquí y se dice con
    // el `Aviso`, que es el sitio donde esta pantalla ya cuenta lo que pasa.
    // Vacío también: el botón no se apaga por lo que falta, lo dice.
    const problema = problemaDelCorreo(email);
    if (problema !== undefined) {
      setError(problema);
      return;
    }

    await enviar(async () => {
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
      }
    });
  }

  async function cambiar(): Promise<void> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña nueva tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== repetida) {
      setError('Las dos no son la misma: escríbela otra vez igual.');
      return;
    }
    await enviar(async () => {
      try {
        const response = await request({
          method: 'PUT',
          body: JSON.stringify({ vale, password }),
        });
        if (!response.ok) {
          setError(
            (await apiErrorFrom(response, 'No hemos podido cambiar la contraseña.')).message,
          );
          return;
        }
        setHecho('Contraseña cambiada. Ya puedes entrar con ella.');
      } catch {
        setError('No hemos podido cambiar la contraseña. Comprueba la conexión.');
      }
    });
  }

  if (hecho !== null) {
    return (
      // `tabIndex={-1}`: se le puede llevar el foco por código sin que pase a
      // ser una parada más del tabulador.
      <div ref={aviso} tabIndex={-1} className="max-w-prose">
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

  // **El botón no se apaga por lo que falta.** Nacía apagado hasta tener el
  // correo, y un botón gris no dice qué le pasa: quien no veía la pantalla oía
  // «no disponible» y nada más. Se pulsa siempre, y lo que falta lo dice el
  // `Aviso`, como en los demás formularios de la cuenta.
  const coinciden = password === repetida;

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
        <Button type="submit" cargando={working}>
          {working ? 'Un momento…' : conVale ? 'Poner esta contraseña' : 'Mandarme el enlace'}
        </Button>
      </div>
    </Formulario>
  );
}
