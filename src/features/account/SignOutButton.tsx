'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signOutHere } from '@state/account';
import { Button } from '@ui/Button';

/**
 * Salir de la cuenta.
 *
 * Después de salir hay que pedirle al servidor que vuelva a pintar: la cuenta la
 * lee el layout en el servidor, así que sin `refresh` la cookie ya está borrada y
 * la pantalla sigue enseñando el plan de antes.
 *
 * No borra el avance de este navegador. Salir no es olvidar: el avance local
 * sigue ahí, y quien vuelva a entrar lo encontrará fusionado con el de su cuenta.
 */
export function SignOutButton() {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  return (
    <Button
      variant="quiet"
      disabled={working}
      onClick={() => {
        setWorking(true);
        void signOutHere()
          .then(() => {
            router.refresh();
          })
          .finally(() => setWorking(false));
      }}
    >
      {working ? 'Saliendo...' : 'Salir de la cuenta'}
    </Button>
  );
}
