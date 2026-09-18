'use client';

import Link from 'next/link';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { registerAccount, signInWithPassword, useAccount } from '@state/account';
import { Button } from '@ui/Button';
import { IconoLlave } from '@ui/icons';
import { TextField } from '@ui/TextField';
import { Vacio } from '@ui/Vacio';
import { Aviso } from '@ui/Aviso';

import { CORREO_MAL, pareceUnCorreo } from './correo';
import { Formulario } from '@ui/Formulario';

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
    // Es un estado normal y no un fallo —sin base de datos todo el mundo es
    // anónimo con plan gratis—, así que se dice como se dice un estado vacío:
    // con su dibujo y diciendo qué sigue funcionando, no con un párrafo suelto
    // en mitad de una pantalla en blanco.
    return (
      <Vacio icono={<IconoLlave />} titulo="Aquí no hay cuentas configuradas">
        Todo lo demás funciona igual y tu avance se guarda en este navegador. Lo único que no hay es
        forma de llevártelo a otro aparato.
      </Vacio>
    );
  }

  async function submit(): Promise<void> {
    // La comprobación la hace el formulario y no el navegador: la burbuja de
    // `type="email"` la escribe el navegador **en su idioma**, y aquí se veía
    // «Please include an '@' in the email address» encima de un formulario en
    // español. Esa burbuja no se puede traducir; lo que sí se puede es no dejar
    // que salga y decirlo con el `Aviso` de siempre.
    if (!pareceUnCorreo(email)) {
      setError(CORREO_MAL);
      return;
    }

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
    <Formulario onEnviar={submit}>
      <div
        role="group"
        aria-label="Entrar o registrarse"
        className="border-border flex w-fit border text-sm"
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
            // Del alto de lo que se pulsa, como todo lo demás: con `py-1.5` se
            // quedaba en treinta y dos píxeles, y es el primer control del
            // formulario y de los pocos que se dan con el pulgar en un móvil.
            className={`min-h-tap px-3 ${
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
        <TextField
          label="Cómo te llamas (si quieres)"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      )}

      <TextField
        label="Correo"
        // `text` y no `email`: con `email` el navegador saca su propia burbuja
        // en su idioma antes de que este formulario pueda decir nada. El teclado
        // del teléfono se sigue pidiendo con `inputMode`.
        type="text"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <TextField
        label="Contraseña"
        extra={nuevo && <span> · mínimo {MIN_PASSWORD_LENGTH}</span>}
        type="password"
        required
        minLength={nuevo ? MIN_PASSWORD_LENGTH : undefined}
        autoComplete={nuevo ? 'new-password' : 'current-password'}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <Aviso mensaje={error} />

      <div>
        <Button type="submit" cargando={working} disabled={!puede || working}>
          {working ? 'Un momento…' : nuevo ? 'Crear la cuenta' : 'Entrar'}
        </Button>
      </div>

      {/* El enlace solo al entrar: en el formulario de crear cuenta no hay
          contraseña que recuperar todavía, y ofrecerlo ahí despista. */}
      {!nuevo && (
        <p className="text-text-muted text-xs">
          <Link href="/olvidada" className="enlace">
            He olvidado mi contraseña
          </Link>
        </p>
      )}

      <p className="text-text-muted text-xs">
        La contraseña se guarda cifrada y nunca en claro. Lo único que se guarda de lo que toques
        son las unidades que superas. Nada de audio.
      </p>
    </Formulario>
  );
}
