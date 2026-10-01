import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * El rótulo. Texto y no marcado, porque también es lo que lee el lector de
   * pantalla cuando va oculto.
   */
  readonly label: string;
  /**
   * Lo que va al lado del rótulo y no es parte del nombre del campo: «· mínimo
   * 8 caracteres», una marca de obligatorio. Aparte de `label` porque `label` es
   * texto —es el nombre del campo oculto en `compact`, donde esto no sale—. A la
   * vista va dentro de la etiqueta, así que sí forma parte del nombre: el lector
   * dice «La nueva · mínimo 8 caracteres», que es lo que conviene oír antes de
   * escribirla.
   */
  readonly extra?: ReactNode;
  /** Oculta la etiqueta a la vista pero la deja para el lector de pantalla. */
  readonly compact?: boolean;
  /** Debajo del campo, en pequeño: qué se espera. */
  readonly hint?: ReactNode;
  /**
   * Lo que está mal **en este campo**, dicho debajo de él.
   *
   * Aparte de `hint` porque no es lo mismo decirlo que marcarlo: con error el
   * campo lleva `aria-invalid` y apunta al mensaje con `aria-describedby`, así
   * que el lector de pantalla lo dice al llegar al campo —«no válido, las dos
   * nuevas no son la misma»— y no solo quien mira el color rojo de debajo. No
   * se anuncia al aparecer: eso es cosa del `ui/Aviso` del formulario, que es la
   * región que ya estaba montada.
   */
  readonly error?: ReactNode;
  /**
   * El campo de verdad, para llevarle el foco. Un formulario que no deja pasar
   * lleva el foco al primer campo que falla, y es así como se entera quien no ve
   * la pantalla: al llegar, el campo dice que no vale y por qué.
   */
  readonly ref?: Ref<HTMLInputElement>;
  /**
   * `completo` ocupa la línea entera; `crece` se estira dentro de una fila y
   * deja sitio a lo que tenga al lado.
   *
   * Se pide y no se hereda, por lo mismo que en `ui/Field`: en la barra de
   * guardar una canción, un campo que ocupa la línea entera empuja el botón a la
   * de abajo.
   */
  readonly ancho?: AnchoTexto;
}

const ANCHOS_TEXTO = {
  completo: 'w-full',
  crece: 'min-w-0 flex-1 basis-48',
} as const;

export type AnchoTexto = keyof typeof ANCHOS_TEXTO;

/**
 * Un campo de escribir, con su etiqueta.
 *
 * Es el tercer componente de la misma familia que `ui/Field` —elegir una opción—
 * y `ui/Disclosure` —abrir un bloque—, y nace del mismo problema: estaba escrito
 * a mano **catorce veces** entre los formularios de la cuenta y el de canciones,
 * y ya había divergido en dos variantes según llevara o no `placeholder`.
 *
 * Lo que la duplicación escondía era peor que la duplicación: **ninguna de las
 * catorce copias llegaba a los 44 px** que esta aplicación exige en todo lo que
 * se pulsa. `py-2` con letra base se queda en unos 42, y nadie lo vio porque no
 * había un sitio donde mirarlo. Aquí el alto es `min-h-tap`, el mismo que los
 * botones y los desplegables.
 *
 * Un `<label>` que envuelve al `<input>` y no un `htmlFor` con identificador: no
 * hace falta inventarse identificadores únicos, y pulsar la etiqueta enfoca el
 * campo igual.
 */
export function TextField({
  label,
  extra,
  compact = false,
  hint,
  error,
  ancho = 'completo',
  className = '',
  ...props
}: TextFieldProps) {
  const id = useId();
  const hayError = error !== undefined && error !== null && error !== false;
  const describe =
    [hint !== undefined && `${id}-pista`, hayError && `${id}-error`].filter(Boolean).join(' ') ||
    undefined;

  return (
    // La pista y el error van **fuera** de la etiqueta. Dentro, formaban parte
    // del nombre del campo —un `<label>` que envuelve se nombra con todo su
    // texto—, y el lector decía «Contraseña, ocho caracteres o más» como si fuera
    // su nombre. Fuera, se enlazan con `aria-describedby`, que es su sitio.
    <div className={`flex flex-col gap-1 ${ANCHOS_TEXTO[ancho]}`}>
      <label className="flex flex-col gap-1">
        <span className={compact ? 'sr-only' : 'text-text-muted text-sm font-medium'}>
          {label}
          {!compact && extra}
        </span>
        <input
          aria-label={compact ? label : undefined}
          aria-invalid={hayError || undefined}
          aria-describedby={describe}
          // `border-strong` y no `border`: un campo vacío es solo su borde, y el de
          // separar cajas se queda en 1,3:1 —no se ve dónde se escribe—. Con error,
          // el borde es el rojo que se lee, además del texto de debajo.
          className={`${hayError ? 'border-oxblood-bright' : 'border-border-strong'} bg-field text-text placeholder:text-text-muted hover:border-brass min-h-tap rounded-md border px-3 py-2 text-base shadow-[var(--sombra-hueco)] transition-colors duration-150 ${className}`}
          {...props}
        />
      </label>
      {hint !== undefined && (
        <span id={`${id}-pista`} className="text-text-muted text-sm">
          {hint}
        </span>
      )}
      {hayError && (
        <span id={`${id}-error`} className="text-oxblood-bright text-sm font-medium">
          {error}
        </span>
      )}
    </div>
  );
}
