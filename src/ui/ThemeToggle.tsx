'use client';

import { useSyncExternalStore } from 'react';

import { elegirTema, suscribirseAlTema, temaElegido, temaEnServidor } from '@state/theme';

import { IconoLuna, IconoSol } from './icons';

/**
 * El conmutador de tema, en la barra de arriba.
 *
 * Dos estados y nada más: la aplicación es negra de casa y esto es la salida para
 * quien la use de día. Un ciclo de tres —claro, oscuro, lo que diga el sistema—
 * obliga a pasar por el que no quieres para volver al que sí, y nadie entiende
 * qué hace el tercer clic.
 *
 * Enseña **el tema al que va**, no el que hay: con el de luna se entiende sin
 * leer que pulsando se apaga la luz. El nombre accesible lo dice con palabras,
 * que es lo que oye quien no ve el icono.
 */
export function ThemeToggle() {
  const oscuro = useSyncExternalStore(suscribirseAlTema, temaElegido, temaEnServidor) === 'oscuro';

  return (
    <button
      type="button"
      onClick={() => elegirTema(oscuro ? 'claro' : 'oscuro')}
      aria-label={oscuro ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro'}
      title={oscuro ? 'Tema claro' : 'Tema oscuro'}
      className="border-border text-text-muted hover:border-brass-dim hover:text-text flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors"
    >
      {oscuro ? <IconoSol /> : <IconoLuna />}
    </button>
  );
}
