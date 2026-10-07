'use client';

import { useSyncExternalStore } from 'react';

import {
  alCambiarElPermiso,
  cuentaVueltas,
  permitirContarVueltas,
  pideQueNoLeSigan,
} from '@state/metricas';
import { Segmentado } from '@ui/Segmentado';

/**
 * El sí o el no a que se cuenten tus vueltas desde este navegador.
 *
 * **Por defecto, no**, y no se pregunta con una ventana que tape la pantalla: se
 * decide aquí, en la política de privacidad y en tu cuenta. Es lo único de la
 * analítica que guarda algo en el aparato —un número aleatorio— y por eso lo
 * único que pide permiso ([adr/0110](../../../docs/adr/0110-contar-sin-seguir.md)).
 *
 * Con cuenta no hace falta: te reconoce la sesión, y lo que se cuenta va con un
 * seudónimo de ella. Esto es para quien la usa sin cuenta.
 *
 * Lo que se pinta en el servidor es «no», porque allí no hay navegador al que
 * preguntar; al hidratar se corrige solo si había dicho que sí.
 */
export function ContarVueltas() {
  const si = useSyncExternalStore(alCambiarElPermiso, cuentaVueltas, () => false);
  const noSeguir = useSyncExternalStore(alCambiarElPermiso, pideQueNoLeSigan, () => false);

  if (noSeguir) {
    return (
      <p className="text-text-muted max-w-prose text-sm">
        Tu navegador pide que no se te siga (Do Not Track o Global Privacy Control), y se respeta:
        desde aquí no se cuenta nada, ni siquiera sumado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-text-muted max-w-prose text-sm">
        ¿Te contamos las vueltas desde este navegador? Se guarda en él un número al azar, que no
        dice quién eres, para saber si vuelves otro día. Puedes cambiarlo cuando quieras; decir que
        no lo borra.
      </p>
      <Segmentado
        etiqueta="Contar mis vueltas desde este navegador"
        opciones={[
          { valor: 'si', texto: 'Sí, contadlas' },
          { valor: 'no', texto: 'No' },
        ]}
        valor={si ? 'si' : 'no'}
        onCambiar={(valor) => permitirContarVueltas(valor === 'si')}
      />
    </div>
  );
}
