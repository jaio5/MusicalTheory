'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { avatarInitial, displayName } from '@core/billing';
import { useAccount } from '@state/account';

import { SignOutButton } from './SignOutButton';

/**
 * El avatar de arriba a la derecha, y lo que hay detrás.
 *
 * Redondo y con una letra. Redondo porque es la forma en la que todo el mundo
 * reconoce «esto soy yo» sin leer nada, que es justo lo que hace falta en una
 * barra donde ya hay cuatro rótulos compitiendo.
 *
 * Hace dos cosas distintas según quién mire, y **eso es a propósito**:
 *
 * - Sin cuenta es un enlace a `/registro`. Un desplegable con una sola opción
 *   —«entrar»— es un clic de más para llegar al mismo sitio.
 * - Con cuenta es un desplegable, porque lo que hay detrás son cuatro sitios
 *   distintos y llevar siempre al perfil obligaría a rebotar desde allí.
 *
 * Antes era un rótulo con el correo recortado. Cabía en pantalla ancha y en el
 * móvil se comía el sitio de la navegación.
 */
export function AccountMenu() {
  const { accounts, signedIn, account, planName } = useAccount();
  const [open, setOpen] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Cambiar de pantalla cierra el menú: sin esto se queda abierto encima de la
  // pantalla nueva, porque navegar aquí no vuelve a montar la cabecera. Se
  // compara durante el render y no en un efecto, que es lo que recomienda React
  // para el estado que depende de otro y lo que ya hace el proveedor de la cuenta.
  const [ultima, setUltima] = useState(pathname);
  if (ultima !== pathname) {
    setUltima(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function fuera(event: PointerEvent) {
      if (!contenedor.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        // El foco vuelve al botón: si se queda dentro de lo que acaba de
        // desaparecer, quien navega con teclado se queda sin sitio.
        boton.current?.focus();
      }
    }

    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!accounts) {
    return null;
  }

  if (!signedIn) {
    return (
      <Link
        href="/registro"
        title="Crear tu cuenta para llevarte el avance a otro aparato"
        aria-label="Crear tu cuenta"
        className="border-border text-text-muted hover:border-brass-dim hover:text-text flex size-9 shrink-0 items-center justify-center rounded-full border"
      >
        {/* La silueta de siempre. Es un adorno: quien no ve la pantalla lee el
            nombre del enlace, que dice lo mismo con palabras. */}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
          <circle cx="12" cy="8" r="3.5" />
          <path
            d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
          />
        </svg>
      </Link>
    );
  }

  const nombre = displayName(account);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        ref={boton}
        type="button"
        onClick={() => setOpen((estaba) => !estaba)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tu cuenta: ${nombre}, plan ${planName}`}
        className="border-brass-dim text-brass-bright hover:border-brass-bright bg-surface-raised flex size-9 items-center justify-center rounded-full border font-mono text-sm"
      >
        <span aria-hidden="true">{avatarInitial(account)}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Tu cuenta"
          className="border-border bg-surface absolute top-full right-0 z-20 mt-1 w-60 border shadow-lg"
        >
          <div className="border-border border-b px-3 py-2">
            <p className="text-text truncate text-sm">{nombre}</p>
            <p className="text-text-muted truncate font-mono text-xs">{account.email}</p>
            <p className="text-brass-bright mt-1 font-mono text-xs">Plan {planName}</p>
          </div>

          <ul className="py-1">
            {DESTINOS.map((destino) => (
              <li key={destino.href}>
                <Link
                  href={destino.href}
                  role="menuitem"
                  className="text-text hover:bg-surface-raised hover:text-brass-bright block px-3 py-2 text-sm"
                >
                  {destino.label}
                  <span className="text-text-muted block text-xs">{destino.summary}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-border border-t px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lo que hay detrás del avatar.
 *
 * Cuatro secciones de la misma pantalla y no cuatro pantallas: son cosas que se
 * miran de una en una y muy de vez en cuando, y repartirlas en cuatro
 * direcciones obligaría a volver atrás para pasar de una a otra. Cada una lleva
 * su ancla, así que el desplegable deja el sitio ya abierto.
 */
const DESTINOS: ReadonlyArray<{ href: string; label: string; summary: string }> = [
  { href: '/cuenta#perfil', label: 'Tu perfil', summary: 'Cómo te llamas y con qué correo entras' },
  {
    href: '/cuenta#suscripcion',
    label: 'Tu suscripción',
    summary: 'Qué plan tienes y qué te queda de IA',
  },
  { href: '/cuenta#contrasena', label: 'Contraseña', summary: 'Cambiarla desde aquí' },
  { href: '/cuenta#privacidad', label: 'Privacidad', summary: 'Qué se guarda de ti, y qué no' },
];
