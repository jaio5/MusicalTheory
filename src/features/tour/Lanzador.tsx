'use client';

import { usePathname } from 'next/navigation';
import { lazy, Suspense } from 'react';

import { estadoDelRecorrido, useRecorrido } from '@state/recorrido';

import { tramosPara } from './tramos';

/**
 * El recorrido llega **solo a quien le toca**.
 *
 * Lo monta el marco, que está en todas las pantallas de trabajo, y quien ya lo ha
 * visto —casi todo el mundo, casi siempre— no tiene por qué descargarlo: el
 * recorrido con sus pasos va en su propio trozo y se pide aquí, al saber que
 * hace falta. Es lo mismo que hace componer con lo que no se ve al entrar
 * ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md)).
 *
 * En el servidor se da por visto, así que el HTML sale igual para todos y no hay
 * nada que corregir al hidratar; el navegador lo pide después, si toca.
 */
const cargarElRecorrido = () => import('./Recorrido');
const Recorrido = lazy(() => cargarElRecorrido().then((modulo) => ({ default: modulo.Recorrido })));

/*
  **Y a quien le toca, se le pide en cuanto llega este código**, no al montarse.
  El estado guardado se lee en el servidor como visto, así que la tarjeta se
  monta después de hidratar, y esperar a ese momento para empezar a descargarla
  era sumarle una ida y vuelta más a lo que ya tarda en salir. Pedirlo dos veces
  no descarga nada dos veces: `lazy` recibe la misma promesa.
*/
/* v8 ignore next 3 -- en el servidor no hay nada que pedir, y en jsdom siempre hay ventana */
if (typeof window !== 'undefined' && !estadoDelRecorrido().visto) {
  void cargarElRecorrido();
}

/**
 * **Un trámite no se interrumpe con una visita guiada.** Quien llega del correo a
 * `/olvidada?vale=…` viene a cambiar la contraseña, no a que le enseñen la
 * aplicación. En estas rutas no sale; sale en la siguiente pantalla de trabajo
 * que abra.
 */
const TRAMITES = ['/olvidada', '/registro', '/cuenta', '/planes'];

function esTramite(ruta: string): boolean {
  return TRAMITES.some((tramite) => ruta === tramite || ruta.startsWith(`${tramite}/`));
}

/**
 * Y **solo lo de esta pantalla** (`tramosPara`): la bienvenida en la primera, y
 * el de aprender, componer o afinar al llegar a cada una, en la misma tarjeta.
 * Si no toca ninguno, no se descarga nada.
 */
export function LanzadorDelRecorrido() {
  const estado = useRecorrido();
  const ruta = usePathname();
  if (estado.visto || esTramite(ruta)) {
    return null;
  }
  const tramos = tramosPara(estado.vistos, ruta);
  if (tramos.length === 0) {
    return null;
  }
  // `key`: otros tramos son otra tarjeta, que se busca su pieza desde cero.
  return (
    <Suspense fallback={null}>
      <Recorrido key={tramos.join()} tramos={tramos} estado={estado} />
    </Suspense>
  );
}
