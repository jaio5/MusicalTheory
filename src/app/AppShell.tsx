'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { AccountMenu } from '@features/account';
import { MicButton } from '@features/workspace';
import { useSessionStore } from '@state/session-store';
import { IconoAfinar, IconoCamino, IconoComponer, IconoProfesor } from '@ui/icons';
import { ThemeToggle } from '@ui/ThemeToggle';

/**
 * Las pantallas, cada una en su dirección.
 *
 * Cinco y no tres desde que aprender se desglosó: el camino, el profesor, componer,
 * afinar y los planes. Cada una hace una cosa, y las que tienen partes dentro
 * —`/aprender/una-unidad`, `/aprender/repaso`, `/planes/pro`— también son direcciones
 * propias, así que el botón de atrás del navegador siempre significa lo que parece.
 */
const SCREENS: ReadonlyArray<{
  href: string;
  name: string;
  Icono: () => React.ReactElement;
  summary: string;
}> = [
  {
    href: '/aprender',
    name: 'Aprender',
    Icono: IconoCamino,
    summary: 'El camino: diez cursos, y empiezas por donde quieras.',
  },
  {
    href: '/profesor',
    name: 'Profesor',
    Icono: IconoProfesor,
    summary: 'Pregunta teoría y te la explica con tus acordes.',
  },
  {
    href: '/componer',
    name: 'Componer',
    Icono: IconoComponer,
    summary: 'Tonalidad, progresión, acordes y grabarte tocando.',
  },
  {
    href: '/afinar',
    name: 'Afinar',
    Icono: IconoAfinar,
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
    // `relative` no es decoración: es lo que impide que la página crezca por
    // debajo de la pantalla.
    //
    // Las etiquetas `sr-only` de Tailwind son `position: absolute`, y un
    // absoluto sin ancestro posicionado se ancla al **documento**. Las de la
    // lista de acordes viven dentro de un contenedor con scroll, así que su
    // posición estática está muy por debajo de lo que se ve: se escapaban del
    // `overflow-hidden` y estiraban el documento casi mil píxeles. La aplicación
    // se iba hacia arriba y debajo quedaba una franja negra vacía.
    //
    // Con esto, cualquier absoluto de dentro se ancla aquí, y aquí hay
    // `overflow-hidden`. Vale para las que hay y para las que se escriban.
    <div className="bg-background relative flex h-dvh flex-col overflow-hidden">
      <header className="border-border bg-surface flex shrink-0 items-center gap-3 border-b px-3 py-1.5 shadow-[0_1px_0_rgba(0,0,0,0.5)]">
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
              className={`rounded-md border px-3 py-1 font-mono text-xs transition-colors ${
                isHere(pathname, screen.href)
                  ? 'border-brass-dim bg-brass-dim/25 text-brass-bright'
                  : 'text-text-muted hover:bg-surface-raised hover:text-text border-transparent'
              }`}
            >
              {screen.name}
            </Link>
          ))}
        </nav>

        <ThemeToggle />
        <AccountMenu />
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
            className={`flex grow basis-0 flex-col items-center gap-1 py-2 font-mono text-xs transition-colors ${
              isHere(pathname, screen.href) ? 'text-brass-bright' : 'text-text-muted'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex min-h-7 items-center rounded-full px-4 transition-colors ${
                isHere(pathname, screen.href) ? 'bg-brass-dim/25' : ''
              }`}
            >
              <screen.Icono />
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
