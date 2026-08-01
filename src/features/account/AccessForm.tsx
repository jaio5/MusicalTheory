'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { registerAccount, signInWithPassword, useAccount } from '@state/account';
import { Button } from '@ui/Button';

/**
 * Entrar o crear una cuenta, en el mismo formulario.
 *
 * En el mismo y con un interruptor arriba, no en dos pantallas: la mitad de las
 * veces uno no se acuerda de si ya tenía cuenta aquí, y mandarle a otra
 * dirección para descubrirlo es perder el sitio donde estaba. Lo que sí cambia
 * según de dónde vengas es **cuál de los dos viene puesto**: al avatar sin cuenta
 * se le pulsa para registrarse, y a la ventana de un plan se llega casi siempre
 * teniendo cuenta ya.
 *
 * Se entra con `type="password"` de verdad y sin autocompletado inventado: los
 * `autoComplete` que están puestos son los que el navegador espera para ofrecer
 * la contraseña guardada, y ponerlos mal es la razón por la que algunos
 * formularios no la ofrecen nunca.
 */
export function AccessForm({
  onDone,
  inicial = 'entrar',
}: {
  readonly onDone?: () => void;
  /** Qué pestaña viene puesta. El interruptor sigue estando para cambiarla. */
  readonly inicial?: 'entrar' | 'crear';
}) {
  const { accounts, refresh } = useAccount();
  const router = useRouter();
  const [nuevo, setNuevo] = useState(inicial === 'crear');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (!accounts) {
    return (
      <p className="text-text-muted max-w-prose text-sm">
        Esta copia de la aplicación no tiene cuentas configuradas. Todo lo demás funciona igual y tu
        avance se guarda en este navegador; lo que no hay es forma de llevártelo a otro aparato.
      </p>
    );
  }

  async function submit(): Promise<void> {
    setError(null);
    setWorking(true);
    try {
      const result = nuevo
        ? await registerAccount(email, password, name === '' ? undefined : name)
        : await signInWithPassword(email, password);

      if (result.ok) {
        // Las dos cosas, y las dos hacen falta: `refresh` trae la cuenta nueva a
        // esta pantalla sin recargar, y `router.refresh` hace que el servidor
        // vuelva a pintar el marco, que es quien lee la sesión. Sin la primera,
        // el candado de al lado seguiría cerrado un instante; sin la segunda, el
        // avatar de arriba seguiría siendo el de nadie.
        await refresh();
        router.refresh();
        onDone?.();
        return;
      }
      setError(result.message ?? 'No ha salido. Vuelve a intentarlo.');
    } finally {
      setWorking(false);
    }
  }

  const puede = email.trim() !== '' && password.length >= (nuevo ? MIN_PASSWORD_LENGTH : 1);

  return (
    <form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div
        role="group"
        aria-label="Entrar o registrarse"
        className="border-border flex w-fit border font-mono text-xs"
      >
        {[
          { key: false, label: 'Ya tengo cuenta' },
          { key: true, label: 'Crear una' },
        ].map((option) => (
          <button
            key={String(option.key)}
            type="button"
            aria-pressed={nuevo === option.key}
            onClick={() => {
              setNuevo(option.key);
              setError(null);
            }}
            className={`px-3 py-1.5 ${
              nuevo === option.key
                ? 'bg-surface-raised text-brass-bright'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {nuevo && (
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-xs">Cómo te llamas (si quieres)</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">Correo</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">
          Contraseña
          {nuevo && <span className="text-text-muted"> · mínimo {MIN_PASSWORD_LENGTH}</span>}
        </span>
        <input
          type="password"
          required
          minLength={nuevo ? MIN_PASSWORD_LENGTH : undefined}
          autoComplete={nuevo ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-border bg-background text-text rounded-md border px-2 py-2 text-base"
        />
      </label>

      {/* `aria-live` para que el lector de pantalla lo anuncie sin tener que
          volver a buscarlo: quien no ve la pantalla no sabe que ha aparecido. */}
      {error !== null && (
        <p className="text-oxblood-bright text-sm" aria-live="polite">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={!puede || working}>
          {working ? 'Un momento...' : nuevo ? 'Crear la cuenta' : 'Entrar'}
        </Button>
      </div>

      <p className="text-text-muted text-xs">
        La contraseña se guarda cifrada y nunca en claro. Lo único que se guarda de lo que toques
        son las unidades que superas: ni audio, ni vídeo.
      </p>
    </form>
  );
}
