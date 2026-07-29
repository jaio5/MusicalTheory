'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { MicButton } from '@features/workspace';
import { useSessionStore } from '@state/session-store';

/** Las tres pantallas, cada una en su dirección. */
const SCREENS: ReadonlyArray<{ href: string; name: string; summary: string }> = [
  {
    href: '/aprender',
    name: 'Aprender',
    summary: 'Teoría a base de preguntas, y un profesor al lado.',
  },
  {
    href: '/componer',
    name: 'Componer',
    summary: 'Tonalidad, progresión, acordes y grabarte tocando.',
  },
  { href: '/afinar', name: 'Afinar', summary: 'La afinación que elijas, cuerda a cuerda.' },
];

/**
 * El marco de las tres pantallas: el botón de escuchar y por dónde se cambia.
 *
 * Cada pantalla es una dirección propia, así que se puede enlazar, volver atrás
 * y abrir el afinador en una pestaña mientras compones en otra. Lo que suena es
 * de esta pestaña, no de la aplicación entera.
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
      <header className="border-border bg-surface flex shrink-0 items-center gap-4 border-b px-3 py-1.5">
        {/* Reconocer acordes solo donde sirve: en componer. */}
        <MicButton chords={pathname === '/componer'} />

        <nav aria-label="Pantallas" className="ml-auto flex items-center gap-1">
          <Link
            href="/"
            className="text-text-muted hover:text-text mr-2 font-mono text-xs"
            title="Volver a la portada"
          >
            Caos ordenado
          </Link>
          {SCREENS.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              aria-current={pathname === screen.href ? 'page' : undefined}
              title={screen.summary}
              className={`border px-3 py-1 font-mono text-xs ${
                pathname === screen.href
                  ? 'border-brass-bright text-brass-bright'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              {screen.name}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-h-0 grow overflow-hidden">{children}</main>
    </div>
  );
}
