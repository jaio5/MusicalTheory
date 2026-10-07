'use client';

import Link from 'next/link';
import { useState } from 'react';

import { displayName } from '@core/billing';
import { AccessForm } from '@features/account';
import { useAccount } from '@state/account';
import { estiloBoton } from '@ui/Button';
import { Screen } from '@ui/Screen';

import { QueTeDaLaCuenta } from './QueTeDaLaCuenta';

/**
 * Crear tu cuenta.
 *
 * Es a donde lleva el avatar de quien todavía no tiene ninguna. Pantalla propia y
 * no un panel dentro de la cuenta, porque quien llega aquí no viene a mirar nada:
 * viene a rellenar tres campos.
 *
 * **Dos columnas, y el formulario primero.** A la izquierda lo que hay que hacer;
 * a la derecha, por qué merece la pena. En una sola columna, las razones quedaban
 * por debajo del pliegue y no las leía nadie, o quedaban encima y había que pasar
 * por delante de ellas para llegar al campo del correo. En pantalla estrecha se
 * apilan en ese mismo orden: primero el formulario.
 *
 * El muñeco da la bienvenida porque **esta es la única pantalla donde un
 * desconocido se para a decidir**: pone cara a lo que hay dentro. Es el mismo del
 * profesor, no un dibujo nuevo.
 *
 * Lo último que se cuenta es que sin cuenta la aplicación funciona entera. Es lo
 * que evita que esto parezca un muro: no lo es, y decirlo cuesta una línea.
 *
 * Si ya has entrado no se pinta el formulario. Un formulario de registro delante
 * de quien ya tiene la sesión abierta es una invitación a crear una segunda cuenta
 * sin querer y perder el avance de la primera.
 *
 * **Y esa pantalla sin formulario dice dos cosas distintas**, porque se llega a
 * ella por dos sitios: acabando de crear la cuenta aquí mismo, o entrando con la
 * sesión ya abierta. Al segundo se le explica por qué no hay nada que rellenar;
 * al primero se le confirma que salió bien y se le manda al camino, que es a lo
 * que venía. Las dos daban el mismo «no hay nada que crear aquí»: un acierto
 * contado con la cara de un tropiezo.
 */
export function RegisterScreen() {
  const { account, accounts, signedIn } = useAccount();
  // Acabar de crearla aquí y llegar con la sesión ya abierta terminan los dos en
  // la misma rama, y no son lo mismo: al primero hay que darle la enhorabuena y
  // el siguiente paso, y al segundo explicarle por qué no hay formulario. Sin
  // esto, quien pulsaba «Crear la cuenta» recibía «no hay nada que crear aquí»,
  // que es la frase de un tropiezo puesta encima de un acierto.
  const [reciencreada, setReciencreada] = useState(false);

  if (signedIn) {
    return (
      <Screen
        title={reciencreada ? 'Tu cuenta está lista' : 'Ya tienes cuenta'}
        lead={
          reciencreada
            ? `Estás dentro como ${displayName(account)}. Tu avance deja de vivir en este navegador y te sigue a donde estudies.`
            : `Estás dentro como ${displayName(account)}, así que no hay nada que crear aquí.`
        }
        ancho="lectura"
      >
        {/* Recién creada, lo primero es ir a estudiar: es a lo que se venía, y la
            cuenta no hay nada que mirarle todavía. Quien ya estaba dentro sí
            viene a mirar la suya, así que ahí manda la otra. */}
        <div className="flex flex-wrap gap-2">
          {reciencreada ? (
            <>
              <Link href="/aprender" className={estiloBoton('primary')}>
                Empezar a aprender
              </Link>
              <Link href="/cuenta" className={estiloBoton('quiet')}>
                Tu cuenta
              </Link>
            </>
          ) : (
            <>
              <Link href="/cuenta" className={estiloBoton('primary')}>
                Tu cuenta
              </Link>
              <Link href="/aprender" className={estiloBoton('quiet')}>
                Ir al camino
              </Link>
            </>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title="Crear tu cuenta"
      lead="Tu avance deja de vivir en este navegador y te lo llevas al móvil, al portátil o a donde estudies."
      ancho="lectura"
      aside={<QueTeDaLaCuenta accounts={accounts} />}
    >
      {/*
        **Dos columnas, y el formulario primero**, con las razones en la columna
        de al lado (`aside` de `ui/Screen`).

        Sin cuentas configuradas, «Qué te da» no puede prometerse —no hay cuenta
        que crear— y la rejilla dejaba el aviso pegado a la izquierda con el resto
        de la pantalla en blanco: el 23 % del ancho usado a 1920. Ahí el lado dice
        lo que sí funciona sin cuenta, con un enlace a cada sitio.

        El formulario, en su tarjeta y con el muñeco asomando por arriba (`marco`,
        el mismo de /cuenta): es lo único que hay que hacer en esta pantalla y
        tiene que verse como tal. Sin cuentas no hay formulario, solo el aviso de
        `AccessForm`, y va suelto: una tarjeta encendida prometía algo que
        rellenar.
      */}
      {/* Con formulario, el ancho de un formulario; con el aviso solo, lo que mida
          el aviso, para que lo de al lado no quede a un palmo. */}
      <div className={accounts ? 'w-full lg:w-[26rem]' : 'w-full'}>
        <AccessForm
          inicial="crear"
          marco={accounts}
          onDone={(comoEntro) => setReciencreada(comoEntro === 'crear')}
        />
      </div>
    </Screen>
  );
}
