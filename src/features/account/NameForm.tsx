'use client';

import { useState } from 'react';

import { MAX_NAME_LENGTH } from '@core/billing';
import { updateAccount, useAccount } from '@state/account';
import { Button } from '@ui/Button';

/**
 * Cómo quieres que te llamen.
 *
 * Es lo único que se puede cambiar de quién eres: el correo identifica la cuenta
 * y cambiarlo pide confirmar la dirección nueva antes de mover nada, y sin envío
 * de correo eso se queda a medias. Dicho en la pantalla, no escondido.
 *
 * Vaciarlo es válido y vuelve a la letra del correo: nadie está obligado a decir
 * su nombre para estudiar teoría.
 */
export function NameForm() {
  const { account, refresh } = useAccount();
  const [name, setName] = useState(account.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [working, setWorking] = useState(false);

  // Si la cuenta cambia por debajo —al refrescar, al entrar con otra— gana la del
  // servidor, igual que hace el proveedor de la cuenta con la suya.
  const [tracked, setTracked] = useState(account.name);
  if (tracked !== account.name) {
    setTracked(account.name);
    setName(account.name ?? '');
  }

  async function submit(): Promise<void> {
    setError(null);
    setHecho(false);
    setWorking(true);
    try {
      const result = await updateAccount({ name });
      if (!result.ok) {
        setError(result.message);
        return;
      }
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
        <span className="text-text-muted text-xs">Cómo te llamas</span>
        <input
          type="text"
          autoComplete="name"
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setHecho(false);
          }}
          placeholder="Sin poner nada, se usa tu correo"
          className="border-border bg-background text-text placeholder:text-text-muted rounded-md border px-2 py-2 text-base"
        />
      </label>

      {error !== null && (
        <p className="text-oxblood-bright text-sm" aria-live="polite">
          {error}
        </p>
      )}
      {hecho && (
        <p className="text-tube-bright text-sm" aria-live="polite">
          Guardado.
        </p>
      )}

      <div>
        <Button type="submit" disabled={working || name === (account.name ?? '')}>
          {working ? 'Un momento...' : 'Guardar el nombre'}
        </Button>
      </div>
    </form>
  );
}
