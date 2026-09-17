import type { Metadata } from 'next';
import Link from 'next/link';

import { estiloBoton } from '@ui/Button';
import { Screen } from '@ui/Screen';

import { AppShell } from './AppShell';

export const metadata: Metadata = {
  title: 'Esta dirección no existe · Caos ordenado',
};

/**
 * Una dirección que no lleva a ninguna parte.
 *
 * Sin este fichero, Next contesta con la suya: «404 — This page could not be
 * found», en inglés, sin cabecera, sin manera de volver y con la aplicación
 * entera desaparecida de la pantalla. Se llega ahí por un enlace viejo, un
 * marcador de cuando algo se llamaba de otra forma o una letra de más al
 * escribir, y ninguna de las tres es motivo para echar a nadie fuera.
 *
 * Va dentro de `AppShell` a propósito: con la barra puesta, esto deja de ser un
 * callejón y pasa a ser una pantalla más de las que ya se saben navegar. Lo que
 * se dice es lo mismo que dice la unidad que no existe —qué ha pasado y por
 * dónde se sigue—, porque es el mismo tropiezo en otro sitio.
 *
 * Las tres salidas son las tres cosas que se vienen a hacer aquí, y la primera
 * es el camino: quien llega perdido casi nunca quería la portada.
 */
export default function NoEncontrada() {
  return (
    <AppShell>
      <Screen
        title="Esta dirección no existe"
        lead="Puede que el enlace sea viejo, que la pantalla se llame ahora de otra forma o que se haya colado una letra de más. Lo que había antes sigue estando: solo hay que entrar por otro sitio."
        ancho="lectura"
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/aprender" className={estiloBoton('primary')}>
            Ir al camino
          </Link>
          <Link href="/componer" className={estiloBoton('quiet')}>
            Componer
          </Link>
          <Link href="/" className={estiloBoton('quiet')}>
            La portada
          </Link>
        </div>
      </Screen>
    </AppShell>
  );
}
