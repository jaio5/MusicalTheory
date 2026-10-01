'use client';

import Link from 'next/link';

import { keyName } from '@core/music';
import { KeyPanel } from '@features/wheel';
import { selectActiveKey, useSessionStore } from '@state/session-store';

/**
 * La rueda de la portada, que es la de verdad.
 *
 * Lo que elijas aquí ya está elegido al entrar: la tonalidad vive en la sesión,
 * no en la pantalla, así que pulsar una en la portada es empezar antes de
 * entrar.
 */
export function LandingWheel() {
  const activeKey = useSessionStore(selectActiveKey);

  return (
    <div className="flex flex-col items-center gap-3">
      <KeyPanel compact />
      <p className="text-text-muted text-center text-sm">
        {activeKey === null ? 'Pulsa una tonalidad' : keyName(activeKey.tonic, activeKey.mode)}
      </p>
      {/* Con alto de dedo: con `py-1.5` medía treinta y dos píxeles, y es lo que
          se pulsa justo después de elegir con el dedo una tonalidad. */}
      {activeKey !== null && (
        <Link
          href="/componer"
          className="border-brass-bright text-brass-bright hover:bg-brass-dim/20 min-h-tap inline-flex items-center border px-4 text-sm"
        >
          Componer en {keyName(activeKey.tonic, activeKey.mode)}
        </Link>
      )}
    </div>
  );
}
