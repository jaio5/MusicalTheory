'use client';

import { useState } from 'react';

import { MAX_NAME_LENGTH } from '@core/billing';
import { updateAccount, useAccount } from '@state/account';
import { Button } from '@ui/Button';
import { TextField } from '@ui/TextField';
import { Aviso } from '@ui/Aviso';
import { Formulario } from '@ui/Formulario';

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
    <Formulario onEnviar={submit}>
      <TextField
        label="Cómo te llamas"
        type="text"
        autoComplete="name"
        maxLength={MAX_NAME_LENGTH}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setHecho(false);
        }}
        placeholder="Sin poner nada, se usa tu correo"
      />

      <Aviso mensaje={error} />
      <Aviso mensaje={hecho && 'Guardado.'} tono="hecho" />

      <div>
        <Button type="submit" disabled={working || name === (account.name ?? '')}>
          {working ? 'Un momento...' : 'Guardar el nombre'}
        </Button>
      </div>
    </Formulario>
  );
}
