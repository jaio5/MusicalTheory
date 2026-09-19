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
 * plegada detrás de una frase es pedir sin ofrecer dónde.
 *
 * **Y flota sobre lo de abajo en vez de empujarlo.** Empujando había que repartir
 * el alto entre la rueda y lo que hay debajo, y no hay reparto bueno: la rueda
 * mide 384 px y en cuanto le tocan menos sale **cortada por una recta**, que
 * parece rota y no parece que haya más. Flotando sale entera y el lienzo no
 * pierde un píxel. El porqué entero, en `ui/Disclosure`.
 */
export function BarraDeTonalidad({
  className,
  onAbrirse,
  children,
}: {
  /** El marco: quien no viva ya dentro de una caja con borde pone el suyo. */
  readonly className?: string;
  /**
   * Avisa de si el panel está abierto.
   *
   * Flotando, abierto tapa la pantalla entera de un teléfono, y lo tapado no
   * debería seguir recibiendo el foco: quien monta esta barra lo usa para
   * apagar lo de debajo mientras dura.
   */
  readonly onAbrirse?: (abierto: boolean) => void;
  /** Lo que acompaña a la rueda: los ajustes, o una frase que explique. */
  readonly children?: ReactNode;
}) {
  const activeKey = useSessionStore(selectActiveKey);

  return (
    <Disclosure
      abierto={activeKey === null}
      /*
        Flota **siempre**, y se probó a que no.

        La idea era que sin tonalidad no hay nada debajo que proteger, así que
        podía empujar y dejar ver el aviso de «elige una tonalidad» que hoy queda
        detrás del panel. Empujando, en un teléfono la rueda **no cabe**: el marco
        de la aplicación no desplaza —`main` recorta— y la sonda encontró trece
        elementos inalcanzables, la rueda entera entre ellos. Flotar es lo que la
        salva, y por eso vuelve. El aviso tapado se arregla en la pantalla que lo
        pinta, no aquí.
      */
      flotante
      {...(className === undefined ? {} : { className })}
      {...(onAbrirse === undefined ? {} : { onAbrirse })}
      summary={
        <>
          Tonalidad:{' '}
          <span className="text-brass-bright">
            {activeKey === null ? 'sin elegir' : keyName(activeKey.tonic, activeKey.mode)}
          </span>
        </>
      }
    >
      {/*
        En columna en un teléfono y **en fila en cuanto hay ancho**.

        Apilado, lo que va debajo de la rueda —los dos desplegables, las notas de
        la escala y su explicación— son otros doscientos treinta píxeles, y eso
        obligaba a desplazar el panel incluso en un escritorio con sitio de sobra
        a los lados. En fila, la altura la pone la rueda sola y no hay nada que
        desplazar.

        El ancho va acotado en los dos casos: flotando, el panel ocupa la línea
        entera, y sin tope salían dos desplegables de mil doscientos píxeles a los
        lados de una rueda de trescientos sesenta.
      */}
      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-3 pt-2 pb-3 sm:max-w-2xl sm:flex-row sm:items-center sm:gap-6">
        <KeyPanel compact />
        {children}
      </div>
    </Disclosure>
  );
}
