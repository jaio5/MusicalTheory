'use client';

import { useState } from 'react';

import { billingPortalUrl } from '@state/account';
import { Button } from '@ui/Button';

/**
 * El enlace a la pasarela: cambiar la tarjeta, ver las facturas.
 *
 * **Es un botón y no un enlace, aunque lleve a otro sitio.** La dirección no
 * existe hasta que se pide: abrir el portal crea una sesión en la pasarela, y esa
 * sesión caduca. Un `<a href>` puesto al pintar la pantalla estaría caducado antes
 * de que nadie lo pulsara, y además se abriría solo cada vez que un rastreador
 * siguiera los enlaces de la página.
 *
 * Y no se enseña cuando no hay adónde ir: sin pasarela puesta y con una cuenta
 * que nunca ha pagado, no hay facturas que mirar. Se descubre al pulsarlo, que es
 * el único momento en el que se puede saber sin una consulta de más en cada
 * visita a esta pantalla.
 */
export function BillingPortalLink() {
  const [working, setWorking] = useState(false);
  const [nada, setNada] = useState(false);

  if (nada) {
    return (
      <p className="text-text-muted text-sm" role="status">
        Aquí no hay facturas todavía: esta cuenta no ha pagado nada.
      </p>
    );
  }

  return (
    <Button
      variant="quiet"
      disabled={working}
      onClick={() => {
        setWorking(true);
        void billingPortalUrl()
          .then((url) => {
            if (url === null) {
              setNada(true);
              return;
            }
            // Otra web, no una ruta de esta aplicación.
            window.location.assign(url);
          })
          .finally(() => setWorking(false));
      }}
      cargando={working}
    >
      {working ? 'Abriendo…' : 'Tarjeta y facturas'}
    </Button>
  );
}
