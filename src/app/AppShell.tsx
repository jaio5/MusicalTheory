'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { AccountBadge } from '@features/account';
import { MicButton } from '@features/workspace';
import { useSessionStore } from '@state/session-store';

/**
 * Las pantallas, cada una en su dirección.
 *
 * Cinco y no tres desde que aprender se desglosó: el camino, el profesor, componer,
 * afinar y los planes. Cada una hace una cosa, y las que tienen partes dentro
 * —`/aprender/una-unidad`, `/aprender/repaso`, `/planes/pro`— también son direcciones
 * propias, así que el botón de atrás del navegador siempre significa lo que parece.
 */
const SCREENS: ReadonlyArray<{ href: string; name: string; icon: string; summary: string }> = [
  {
    href: '/aprender',
    name: 'Aprender',
    icon: '🗺️',
    summary: 'El camino: diez cursos, y empiezas por donde quieras.',
  },
  {
    href: '/profesor',
    name: 'Profesor',
    icon: '💬',
    summary: 'Pregunta teoría y te la explica con tus acordes.',
  },
  {
    href: '/componer',
    name: 'Componer',
    icon: '🎛️',
    summary: 'Tonalidad, progresión, acordes y grabarte tocando.',
  },
  {
    href: '/afinar',
    name: 'Afinar',
    icon: '🎚️',
    summary: 'La afinación que elijas, cuerda a cuerda.',
  },
];

/**
 * El marco: el botón de escuchar arriba, la navegación abajo en el móvil y arriba en
 * pantalla grande.
 *
 * Abajo en el móvil porque es donde llega el pulgar, y porque es lo que hace que esto
 * se sienta una aplicación y no una web con un menú. En pantalla grande sube a la
 * cabecera: allí abajo estorbaría y hay sitio de sobra.
 *
 * Lo que suena es de esta pestaña, no de la aplicación entera.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const actions = useSessionStore((state) => state.actions);
  const pathname = usePathname();

  // La configuración guardada se recupera después de pintar: leerla durante el
  // render daría un HTML distinto en servidor y en cliente.
  useEffect(() => {
    actions.loadWorkspace();
  }, [actions]);

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      <header className="border-border bg-surface flex shrink-0 items-center gap-3 border-b px-3 py-1.5">
        {/* Reconocer acordes solo donde sirve: en componer. */}
        <MicButton chords={pathname === '/componer'} />

        <Link
          href="/"
          className="text-text-muted hover:text-text ml-auto font-mono text-xs"
          title="Volver a la portada"
        >
          Caos ordenado
        </Link>

        <nav aria-label="Pantallas" className="hidden items-center gap-1 sm:flex">
          {SCREENS.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              aria-current={isHere(pathname, screen.href) ? 'page' : undefined}
              title={screen.summary}
              className={`border px-3 py-1 font-mono text-xs ${
                isHere(pathname, screen.href)
                  ? 'border-brass-bright text-brass-bright'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              {screen.name}
            </Link>
          ))}
        </nav>

        <AccountBadge />
      </header>

      <main className="min-h-0 grow overflow-hidden">{children}</main>

      {/* La misma navegación, abajo y con icono, solo en pantalla estrecha. Va en un
          `nav` distinto con su propio nombre para que un lector de pantalla no
          anuncie dos veces la misma lista. */}
      <nav
        aria-label="Pantallas, abajo"
        className="border-border bg-surface flex shrink-0 border-t sm:hidden"
      >
        {SCREENS.map((screen) => (
          <Link
            key={screen.href}
            href={screen.href}
            aria-current={isHere(pathname, screen.href) ? 'page' : undefined}
            className={`flex grow basis-0 flex-col items-center gap-0.5 py-2 font-mono text-xs ${
              isHere(pathname, screen.href) ? 'text-brass-bright' : 'text-text-muted'
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {screen.icon}
            </span>
            {screen.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * Si estamos en esa pantalla o en algo de dentro.
 *
 * Comparar la dirección entera dejaría «Aprender» apagado mientras se hace una
 * unidad, que es justo cuando más falta hace saber dónde estás.
 */
function isHere(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
