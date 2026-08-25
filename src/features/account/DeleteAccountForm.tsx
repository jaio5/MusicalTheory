'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';

import { deleteAccount } from '@state/account';
import { Button } from '@ui/Button';

/**
 * Borrar la cuenta.
 *
 * Tres cosas que no son adorno:
 *
 * **Hay que abrirlo.** Cerrado es una línea de texto y un botón que solo despliega;
 * el formulario de verdad está dentro. Un campo de contraseña con un botón rojo al
 * lado, siempre a la vista al final de los ajustes, es un accidente esperando a
 * pasar con la guitarra en las manos.
 *
 * **Hay que escribir la palabra.** La contraseña sola no basta: la contraseña se
 * escribe de memoria y sin leer, y esto no tiene vuelta atrás. Escribir «borrar»
 * obliga a haber leído qué se va a perder.
 *
 * **Se dice qué se va con ella**, y en concreto: el avance, las canciones y el
 * plan. «Se borrarán todos tus datos» no dice nada; una lista de tres cosas sí.
 */
export function DeleteAccountForm() {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const puede = password !== '' && confirmacion.trim().toLowerCase() === 'borrar' && !working;

  async function submit(): Promise<void> {
    setError(null);
    setWorking(true);
    try {
      const result = await deleteAccount(password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // La cookie sigue viva y firmada, así que hay que cerrarla a mano. Sin
      // esto, quien acaba de borrarse se queda con una sesión que apunta a una
      // fila que ya no existe.
      await signOut({ callbackUrl: '/' });
    } finally {
      setWorking(false);
    }
  }

  if (!abierto) {
    return (
      <div>
        <p className="text-text-muted mb-3 max-w-prose text-xs">
          Borrar la cuenta se lleva por delante tu avance, tus canciones y tu plan. No hay vuelta
          atrás y no guardamos copia.
        </p>
        <Button variant="quiet" onClick={() => setAbierto(true)}>
          Quiero borrar mi cuenta
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-text max-w-prose text-sm">
        Se van con la cuenta: <strong>tu avance</strong> —unidades, XP, racha y medallas—,{' '}
        <strong>tus canciones guardadas</strong> y <strong>tu plan</strong>. Lo que hay en este
        navegador se queda; lo que está en tu cuenta desaparece.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">Tu contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">
          Escribe <strong className="text-text">borrar</strong> para confirmar
        </span>
        <input
          type="text"
          autoComplete="off"
          value={confirmacion}
          onChange={(event) => setConfirmacion(event.target.value)}
          className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
        />
      </label>

      {error !== null && (
        <p className="text-oxblood-bright text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!puede}>
          {working ? 'Borrando…' : 'Borrar mi cuenta'}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            setAbierto(false);
            setPassword('');
            setConfirmacion('');
            setError(null);
          }}
        >
          Mejor no
        </Button>
      </div>
    </form>
  );
}
