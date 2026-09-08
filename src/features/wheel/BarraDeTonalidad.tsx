'use client';

import type { ReactNode } from 'react';

import { keyName } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Disclosure } from '@ui/Disclosure';

import { KeyPanel } from './KeyPanel';

/**
 * La tonalidad plegada en una línea, con la rueda dentro.
 *
 * La unidad y el taller tenían esta barra escrita entera cada uno: el mismo
 * `Disclosure`, el mismo resumen y la misma rueda compacta, con dos textos que
 * ya empezaban a separarse. Lo que cambia entre las dos es el marco —una lleva
 * borde y fondo, la otra vive dentro de un contenedor que ya los pone— y lo que
 * va debajo de la rueda.
 *
 * **Se abre sola mientras no haya tonalidad, y se pliega al elegirla.** Sin
 * tonalidad ninguna de las dos pantallas puede empezar, y pedirla con la rueda
 * plegada detrás de una frase es pedir sin ofrecer dónde. El `tope` es el
 * cinturón para el teléfono: abierta a mano se desplaza por dentro en vez de
 * llevarse los ochocientos píxeles y dejar lo de debajo con altura cero.
 */
export function BarraDeTonalidad({
  className,
  children,
}: {
  /** El marco: quien no viva ya dentro de una caja con borde pone el suyo. */
  readonly className?: string;
  /** Lo que acompaña a la rueda: los ajustes, o una frase que explique. */
  readonly children?: ReactNode;
}) {
  const activeKey = useSessionStore(selectActiveKey);

  return (
    <Disclosure
      abierto={activeKey === null}
      tope
      {...(className === undefined ? {} : { className })}
      summary={
        <>
          Tonalidad:{' '}
          <span className="text-brass-bright">
            {activeKey === null ? 'sin elegir' : keyName(activeKey.tonic, activeKey.mode)}
          </span>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 pt-2 pb-3">
        <KeyPanel compact />
        {children}
      </div>
    </Disclosure>
  );
}
