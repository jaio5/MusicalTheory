'use client';

import { useRef, useState } from 'react';

import { useEnvio } from './use-envio';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { signInWithPassword, updateAccount, useAccount } from '@state/account';
import { Button } from '@ui/Button';
import { TextField } from '@ui/TextField';
import { Aviso } from '@ui/Aviso';
import { Formulario } from '@ui/Formulario';

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
 *
 * **El botón no se apaga por lo que falta.** Estaba desactivado hasta que los tres
 * campos cuadraban, y un botón gris no dice por qué: quien no veía la pantalla
 * oía «Cambiar la contraseña, no disponible» y nada más. Ahora se pulsa siempre, y
 * lo que falta se dice en el campo que falla —`aria-invalid` y su frase debajo— y
 * el foco va a él, que es como se entera un lector de pantalla. Mientras está en
 * marcha no hace caso, pero tampoco se apaga: apagado soltaba el foco
 * (`cargando` en `ui/Button`).
 */
export function PasswordForm() {
  const { account: cuenta, refresh } = useAccount();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [intentado, setIntentado] = useState(false);
  const { error, setError, hecho, setHecho, working, enviar } = useEnvio();
  const campoActual = useRef<HTMLInputElement>(null);
  const campoNueva = useRef<HTMLInputElement>(null);
  const campoRepetida = useRef<HTMLInputElement>(null);

  const coinciden = nueva === repetida;
  // Lo que falta solo se dice después de intentarlo: un campo en rojo antes de
  // escribir nada es una regañina. Menos que no coincidan, que se dice en cuanto
  // se escribe la segunda —el servidor no puede saberlo, y descubrirlo al volver
  // obligaría a escribirla otra vez—.
  const faltaActual = intentado && actual === '' ? 'Falta la de ahora.' : undefined;
  const faltaNueva =
    intentado && nueva.length < MIN_PASSWORD_LENGTH
      ? `Tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      : undefined;
  const faltaRepetida =
    (intentado || repetida !== '') && !coinciden ? 'Las dos nuevas no son la misma.' : undefined;

  async function submit(): Promise<void> {
    setIntentado(true);
    // El foco al primero que falla, en el orden en que se leen. Se mira el valor
    // y no los mensajes de arriba, que son de este render y todavía no saben que
    // ya se ha intentado.
    const primero =
      actual === ''
        ? campoActual
        : nueva.length < MIN_PASSWORD_LENGTH
          ? campoNueva
          : !coinciden
            ? campoRepetida
            : null;
    if (primero) {
      primero.current?.focus();
      return;
    }

    await enviar(async () => {
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
      setIntentado(false);
      setHecho(true);
      if (dentro.ok) {
        await refresh();
      } else {
        // La contraseña se cambió igual: lo que ha fallado es volver a entrar.
        // Decirlo es mejor que dejar la pantalla diciendo que todo fue bien
        // mientras la sesión está muerta.
        setError('La contraseña es la nueva, pero hay que volver a entrar con ella.');
      }
    });
  }

  return (
    <Formulario onEnviar={submit}>
      <TextField
        ref={campoActual}
        label="La de ahora"
        error={faltaActual}
        type="password"
        required
        autoComplete="current-password"
        value={actual}
        onChange={(event) => setActual(event.target.value)}
      />

      <TextField
        ref={campoNueva}
        label="La nueva"
        error={faltaNueva}
        extra={<span> · mínimo {MIN_PASSWORD_LENGTH} caracteres</span>}
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        value={nueva}
        onChange={(event) => setNueva(event.target.value)}
      />

      <TextField
        ref={campoRepetida}
        label="Otra vez la nueva"
        error={faltaRepetida}
        type="password"
        required
        autoComplete="new-password"
        value={repetida}
        onChange={(event) => setRepetida(event.target.value)}
      />

      <Aviso mensaje={error} />
      <Aviso
        mensaje={
          hecho && 'Cambiada. Las sesiones que hubiera abiertas en otros aparatos se han cerrado.'
        }
        tono="hecho"
      />

      <div>
        <Button type="submit" cargando={working}>
          {working ? 'Un momento…' : 'Cambiar la contraseña'}
        </Button>
      </div>

      <p className="text-text-muted text-xs">
        Se guarda cifrada con scrypt, nunca en claro, y cambiarla no cierra la sesión que tienes
        abierta aquí.
      </p>
    </Formulario>
  );
}
