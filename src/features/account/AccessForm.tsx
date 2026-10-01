'use client';

import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { useEnvio } from './use-envio';
import { useRef, useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '@core/billing';
import { registerAccount, signInWithPassword, useAccount } from '@state/account';
import { Button, estiloBoton } from '@ui/Button';
import { IconoLlave } from '@ui/icons';
import { TextField } from '@ui/TextField';
import { Mascota } from '@ui/Mascota';
import { Segmentado } from '@ui/Segmentado';
import { Aviso } from '@ui/Aviso';

import { problemaDelCorreo } from './correo';
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
 *
 * El botón se pulsa siempre que no esté en marcha: apagado hasta tener los dos
 * campos no decía qué faltaba. Lo que falta se dice en su campo y el foco va a él,
 * como en `PasswordForm`.
 */
export function AccessForm({
  onDone,
  inicial = 'entrar',
  marco = false,
}: {
  /**
   * Se ha entrado, y **por qué puerta**.
   *
   * El interruptor cambia de pestaña sin avisar a nadie, así que sin decirlo aquí
   * quien pulsaba «Ya tengo cuenta» y entraba con una cuenta de hace meses
   * recibía «Tu cuenta está lista», que es la enhorabuena de otro.
   */
  readonly onDone?: (comoEntro: 'entrar' | 'crear') => void;
  /** Qué pestaña viene puesta. El interruptor sigue estando para cambiarla. */
  readonly inicial?: 'entrar' | 'crear';
  /**
   * Con la tarjeta encendida y el muñeco asomando, que es el marco de las dos
   * pantallas donde esto es lo único que hay que hacer. Entrar iba suelto y crear
   * en tarjeta, y al pasar de una a otra con el conmutador la pantalla cambiaba de
   * cara. La ventana de pago no lo pide: ahí es un paso dentro de otra cosa.
   */
  readonly marco?: boolean;
}) {
  const { accounts, refresh } = useAccount();
  const router = useRouter();
  const [nuevo, setNuevo] = useState(inicial === 'crear');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [veContrasena, setVeContrasena] = useState(false);
  const { error, setError, working, enviar } = useEnvio();
  const campoCorreo = useRef<HTMLInputElement>(null);
  const campoContrasena = useRef<HTMLInputElement>(null);

  if (!accounts) {
    // Es un estado normal y no un fallo —sin base de datos todo el mundo es
    // anónimo con plan gratis—, así que se dice como se dice un estado vacío:
    // con su dibujo y diciendo qué sigue funcionando, no con un párrafo suelto
    // en mitad de una pantalla en blanco.
    return (
      // A mano y no con `ui/Vacio`: ése se centra, y centrado cae en una x distinta
      // según la pantalla que lo pone (336 en una, 496 en otra) mientras el resto
      // arranca en el borde común (adr/0060). Con su salida: un estado vacío sin
      // acción deja parado delante de un «no hay», y lo que sigue es aprender.
      <div className="flex max-w-md flex-col items-start gap-3">
        <span
          aria-hidden="true"
          className="border-border bg-surface text-brass flex size-14 items-center justify-center rounded-full border opacity-80 [&_svg]:size-6"
        >
          <IconoLlave />
        </span>
        <p className="text-text text-base font-medium">Aquí no hay cuentas configuradas</p>
        <p className="text-text-muted text-sm text-balance">
          Todo lo demás funciona igual y tu avance se guarda en este navegador. Lo único que no hay
          es forma de llevártelo a otro aparato.
        </p>
        <Link href="/aprender" className={estiloBoton('primary')}>
          Seguir aprendiendo
        </Link>
      </div>
    );
  }

  const minimo = nuevo ? MIN_PASSWORD_LENGTH : 1;
  // La comprobación la hace el formulario y no el navegador: la burbuja de
  // `type="email"` la escribe el navegador **en su idioma**, y aquí se veía
  // «Please include an '@' in the email address» encima de un formulario en
  // español. Esa burbuja no se puede traducir; lo que sí se puede es no dejar que
  // salga y decirlo en el campo, que es donde se arregla.
  const correoMal = intentado ? problemaDelCorreo(email) : undefined;
  const contrasenaMal =
    intentado && password.length < minimo
      ? nuevo
        ? `Tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
        : 'Falta la contraseña.'
      : undefined;

  async function submit(): Promise<void> {
    setIntentado(true);
    if (problemaDelCorreo(email) !== undefined) {
      campoCorreo.current?.focus();
      return;
    }
    if (password.length < minimo) {
      campoContrasena.current?.focus();
      return;
    }

    await enviar(async () => {
      const result = nuevo
        ? await registerAccount(email, password, name === '' ? undefined : name)
        : await signInWithPassword(email, password);

      if (!result.ok) {
        setError(result.message ?? 'No ha salido. Vuelve a intentarlo.');
        return;
      }

      // Las dos cosas, y las dos hacen falta: `refresh` trae la cuenta nueva a
      // esta pantalla sin recargar, y `router.refresh` hace que el servidor
      // vuelva a pintar el marco, que es quien lee la sesión. Sin la primera, el
      // candado de al lado seguiría cerrado un instante; sin la segunda, el
      // avatar de arriba seguiría siendo el de nadie.
      await refresh();
      router.refresh();
      onDone?.(nuevo ? 'crear' : 'entrar');
    });
  }

  const formulario = (
    <Formulario onEnviar={submit}>
      <Segmentado
        etiqueta="Entrar o registrarse"
        opciones={[
          { valor: 'entrar', texto: 'Ya tengo cuenta' },
          { valor: 'crear', texto: 'Crear una' },
        ]}
        valor={nuevo ? 'crear' : 'entrar'}
        onCambiar={(valor) => {
          setNuevo(valor === 'crear');
          setError(null);
          setIntentado(false);
        }}
      />

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
        ref={campoCorreo}
        label="Correo"
        error={correoMal}
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
        ref={campoContrasena}
        label="Contraseña"
        error={contrasenaMal}
        extra={nuevo && <span> · mínimo {MIN_PASSWORD_LENGTH}</span>}
        type={veContrasena ? 'text' : 'password'}
        required
        minLength={nuevo ? MIN_PASSWORD_LENGTH : undefined}
        autoComplete={nuevo ? 'new-password' : 'current-password'}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {/* Fuera de la etiqueta del campo: un botón dentro de un `<label>` pasa a
          ser parte de su nombre, y pulsarlo enfoca el campo además de hacer lo
          suyo. `aria-pressed` y un rótulo fijo, porque un rótulo que cambia
          («Mostrar» y luego «Ocultar») se anuncia dos veces. */}
      <button
        type="button"
        aria-pressed={veContrasena}
        onClick={() => setVeContrasena((visto) => !visto)}
        className="text-text-muted hover:text-text min-h-tap -mt-2 inline-flex w-fit cursor-pointer items-center text-sm underline underline-offset-4"
      >
        Mostrar la contraseña
      </button>

      <Aviso mensaje={error} />

      <div>
        <Button type="submit" cargando={working} disabled={working}>
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

  if (!marco) {
    return formulario;
  }
  return (
    <section
      aria-label={inicial === 'crear' ? 'Crear la cuenta' : 'Entrar'}
      className="superficie-viva relative p-5 pt-10"
    >
      <div className="absolute -top-6 left-5">
        <Mascota className="size-16" />
      </div>
      {formulario}
    </section>
  );
}
